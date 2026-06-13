"""
app.py — Main Flask Server with Socket.IO
Serves REST API + real-time WebSocket events for the React frontend.
"""

import time
import threading
import numpy as np
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

from crowd_detector import get_spike_grid, get_spike_rate, get_flow_variance
from risk_engine import compute_risk, get_status, get_rescue_plan

app = Flask(__name__)
app.config["SECRET_KEY"] = "neurowatch-secret-2024"
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Global state
current_scenario = "normal"
alert_log = []

# ─── REST ENDPOINTS ──────────────────────────────────────────────────────────

@app.route("/api/scenario", methods=["POST"])
def set_scenario():
    global current_scenario
    data = request.get_json()
    current_scenario = data.get("scenario", "normal")
    return jsonify({"status": "ok", "scenario": current_scenario})

@app.route("/api/risk", methods=["GET"])
def get_risk():
    grid = get_spike_grid(current_scenario)
    risk = compute_risk(grid, current_scenario)
    status = get_status(risk)
    rescue = get_rescue_plan(risk, grid)
    return jsonify({
        "risk": risk,
        "status": status,
        "spike_rate": round(get_spike_rate() * 100, 1),
        "flow_variance": round(get_flow_variance() * 1000, 2),
        "rescue": rescue,
        "grid": grid,
    })

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    return jsonify({"alerts": alert_log[-20:]})

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "NeuroWatch online", "scenario": current_scenario})

# ─── BACKGROUND BROADCAST LOOP ───────────────────────────────────────────────

def broadcast_loop():
    """Push real-time data to all connected clients every 800ms."""
    global alert_log
    while True:
        time.sleep(0.8)
        try:
            grid = get_spike_grid(current_scenario)
            risk = compute_risk(grid, current_scenario)
            status = get_status(risk)
            rescue = get_rescue_plan(risk, grid)

            # Build alert if threshold crossed
            if risk >= 75:
                alert_entry = {
                    "time": time.strftime("%H:%M:%S"),
                    "risk": risk,
                    "status": status,
                    "zone": rescue.get("zone", "—"),
                    "message": rescue.get("announcement", ""),
                }
                if not alert_log or alert_log[-1]["zone"] != alert_entry["zone"] or abs(alert_log[-1]["risk"] - risk) > 3:
                    alert_log.append(alert_entry)
                    if len(alert_log) > 50:
                        alert_log.pop(0)

            payload = {
                "risk": risk,
                "status": status,
                "spike_rate": round(get_spike_rate() * 100, 1),
                "flow_variance": round(get_flow_variance() * 1000, 2),
                "rescue": rescue,
                "grid": grid,
                "scenario": current_scenario,
                "timestamp": time.strftime("%H:%M:%S"),
            }
            socketio.emit("neurowatch_update", payload)
        except Exception as e:
            print(f"[broadcast error] {e}")

@socketio.on("connect")
def on_connect():
    print("[NeuroWatch] Client connected")
    emit("neurowatch_update", {"status": "connected"})

@socketio.on("disconnect")
def on_disconnect():
    print("[NeuroWatch] Client disconnected")

# ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    t = threading.Thread(target=broadcast_loop, daemon=True)
    t.start()
    print("\n[NeuroWatch] Backend running at http://localhost:5000\n")
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
