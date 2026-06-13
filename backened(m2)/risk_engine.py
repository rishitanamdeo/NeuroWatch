"""
risk_engine.py  —  Member 2: Neuromorphic Engine
NeuroWatch | Hackathon Sprint

Implements:
  - risk formula:   risk = 0.4×density + 0.3×flow_variance + 0.3×spike_rate
  - get_status(risk)          → SAFE / CAUTION / WARNING / HIGH RISK / EMERGENCY
  - get_rescue_plan(risk, grid) → recommended action + zone + exit + announcement
  - detect_victim(grid)       → finds low-motion cell surrounded by high-motion cells

Expected risk scores:
  normal      ~15
  kumbh_surge ~65
  crush       ~92

Used by: app.py   (imported and called on every Socket.IO broadcast cycle)
Depends on: spike_generator.py
"""

import numpy as np
from spike_generator import (
    get_spike_grid,
    get_spike_rate,
    get_flow_variance,
    get_spike_density_score,
    set_scenario,
)

# ─── Risk thresholds ─────────────────────────────────────────────────────────

THRESHOLDS = [
    (20,  "SAFE"),
    (40,  "CAUTION"),
    (60,  "WARNING"),
    (80,  "HIGH RISK"),
    (101, "EMERGENCY"),
]

# ─── Rescue plans by risk band ───────────────────────────────────────────────

RESCUE_PLANS = {
    "SAFE": {
        "action":       "Monitor — no intervention required",
        "zone":         "All clear",
        "exit":         "N/A",
        "officers":     0,
        "route":        "N/A",
        "announcement": "",
        "color":        "#22c55e",   # green
    },
    "CAUTION": {
        "action":       "Alert ground patrol — increase monitoring frequency",
        "zone":         "Zone B",
        "exit":         "Gate 1",
        "officers":     2,
        "route":        "Route A",
        "announcement": "Attention visitors: please maintain spacing and move calmly.",
        "color":        "#86efac",   # light green
    },
    "WARNING": {
        "action":       "Deploy crowd-control barriers — redirect flow",
        "zone":         "Zone C",
        "exit":         "Gate 2",
        "officers":     5,
        "route":        "Route B",
        "announcement": "Important notice: crowd density is rising. Please follow officer directions.",
        "color":        "#f59e0b",   # amber
    },
    "HIGH RISK": {
        "action":       "Open emergency exits — begin guided evacuation of Zone C",
        "zone":         "Zone C4",
        "exit":         "Gate 3 (Emergency)",
        "officers":     12,
        "route":        "Route C",
        "announcement": "URGENT: High crowd pressure detected. Proceed immediately to nearest exit.",
        "color":        "#ef4444",   # red
    },
    "EMERGENCY": {
        "action":       "INITIATE FULL EVACUATION — all gates open — medical teams on standby",
        "zone":         "Zone C4",
        "exit":         "Gate 3 (Emergency)",
        "officers":     30,
        "route":        "Route C",
        "announcement": "EMERGENCY ALERT: Crowd crush risk. ALL VISITORS EVACUATE NOW via marked exits.",
        "color":        "#7f1d1d",   # dark red
    },
}

# ─── Core functions ──────────────────────────────────────────────────────────

def compute_risk(density: float, flow_variance: float, spike_rate: float) -> float:
    """
    Risk formula as specified in the task sheet:
        risk = 0.4×density + 0.3×flow_variance + 0.3×spike_rate

    All inputs are expected in [0, 1].
    Output is scaled to [0, 100].
    """
    raw = 0.4 * density + 0.3 * flow_variance + 0.3 * spike_rate
    return round(min(raw * 100.0, 100.0), 2)


def get_status(risk: float) -> str:
    """
    Map a 0–100 risk score to a human-readable status label.

    >>> get_status(10)  → 'SAFE'
    >>> get_status(65)  → 'WARNING'
    >>> get_status(92)  → 'EMERGENCY'
    """
    for threshold, label in THRESHOLDS:
        if risk < threshold:
            return label
    return "EMERGENCY"


def get_rescue_plan(risk: float, grid: list[list[float]]) -> dict:
    """
    Return a structured rescue plan dictionary based on the current risk
    level and spike grid.

    Args:
        risk  : float, 0–100
        grid  : 10×10 list of floats (spike intensities from get_spike_grid)

    Returns:
        dict with keys:
            status, action, zone, exit, officers, route,
            announcement, color, victim
    """
    status = get_status(risk)
    plan   = RESCUE_PLANS[status].copy()

    # Enrich with victim detection
    victim = detect_victim(grid)

    plan["status"] = status
    plan["risk"]   = risk
    plan["victim"] = victim

    # Override zone with the highest-intensity zone if we're in a danger state
    if status in ("HIGH RISK", "EMERGENCY") and grid:
        hotspot_zone = _find_hotspot_zone(np.array(grid))
        if hotspot_zone:
            plan["zone"] = hotspot_zone

    return plan


def detect_victim(grid: list[list[float]]) -> dict | None:
    """
    Detect a potential fallen/trapped victim:
      A 'victim cell' is one with LOW spike intensity (still / trapped person)
      surrounded by neighbours with HIGH spike intensity (surging crowd).

    Args:
        grid : 10×10 list of floats

    Returns:
        dict  { zone, row, col, confidence }  or  None
    """
    if not grid:
        return None

    g = np.array(grid)
    best_score = -1.0
    best_pos   = None

    LOW_THRESH  = 0.25   # cell must be below this to be a candidate victim
    HIGH_THRESH = 0.55   # neighbours must exceed this

    for r in range(1, GRID_SIZE - 1):
        for c in range(1, GRID_SIZE - 1):
            cell = g[r, c]
            if cell >= LOW_THRESH:
                continue
            neighbours = [
                g[r-1, c], g[r+1, c],
                g[r, c-1], g[r, c+1],
            ]
            high_neighbours = sum(1 for n in neighbours if n >= HIGH_THRESH)
            if high_neighbours >= 3:
                score = (1.0 - cell) * (high_neighbours / 4.0) * np.mean(neighbours)
                if score > best_score:
                    best_score = score
                    best_pos   = (r, c)

    if best_pos is None:
        return None

    r, c = best_pos
    zone_row = chr(ord('A') + r)
    zone_col = c + 1
    confidence = round(min(best_score * 100, 99.9), 1)

    return {
        "zone":       f"{zone_row}{zone_col}",
        "row":        r,
        "col":        c,
        "confidence": confidence,
    }


# ─── Internal helpers ─────────────────────────────────────────────────────────

GRID_SIZE = 10

def _find_hotspot_zone(g: np.ndarray) -> str | None:
    """Return the grid zone label of the cell with the highest spike intensity."""
    if g.size == 0:
        return None
    idx = np.unravel_index(np.argmax(g), g.shape)
    r, c = idx
    zone_row = chr(ord('A') + r)
    zone_col = c + 1
    return f"Zone {zone_row}{zone_col}"


# ─── Full evaluation pass (called by app.py on each broadcast tick) ──────────

def evaluate(scenario: str) -> dict:
    """
    Run a full neuromorphic evaluation pass for the given scenario.

    Returns a dict that app.py can broadcast directly via Socket.IO:
    {
        "risk":          float (0–100),
        "status":        str,
        "density":       float,
        "flow_variance": float,
        "spike_rate":    float,
        "grid":          list[list[float]],
        "rescue":        dict,
    }
    """
    # Step the LIF grid for this scenario
    grid = get_spike_grid(scenario)

    density       = get_spike_density_score()
    flow_var      = get_flow_variance()
    spike_rate    = get_spike_rate()

    risk          = compute_risk(density, flow_var, spike_rate)
    status        = get_status(risk)
    rescue        = get_rescue_plan(risk, grid)

    return {
        "risk":          risk,
        "status":        status,
        "density":       round(density,    4),
        "flow_variance": round(flow_var,   4),
        "spike_rate":    round(spike_rate, 4),
        "grid":          grid,
        "rescue":        rescue,
    }


# ─── Quick self-test ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== NeuroWatch Risk Engine — Self Test ===\n")
    for sc in ("normal", "kumbh_surge", "crush"):
        set_scenario(sc)
        # Warm up the grid with a few steps
        for _ in range(5):
            result = evaluate(sc)
        print(f"Scenario : {sc}")
        print(f"  Risk   : {result['risk']}")
        print(f"  Status : {result['status']}")
        print(f"  Density: {result['density']:.4f}")
        print(f"  FlowVar: {result['flow_variance']:.4f}")
        print(f"  Victim : {result['rescue']['victim']}")
        print(f"  Zone   : {result['rescue']['zone']}")
        print()
