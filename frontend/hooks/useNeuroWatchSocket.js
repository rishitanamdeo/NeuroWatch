// useNeuroWatchSocket.js
// Member 4 — Venue Map & Rescue Routing
//
// Thin wrapper around socket.io-client that gives VenueMap / RescuePanel
// (and anything else) a live { spikeGrid, risk, status, rescue, connected }
// snapshot from the Flask-SocketIO backend (Member 1 / Member 2).
//
// Backend contract (as agreed in the task split):
//   - app.py (M1) opens a Socket.IO server on http://localhost:5000
//   - It broadcasts an event called "neurowatch_update" roughly every ~800ms with:
//       {
//         spike_grid: number[10][10],   // 0..1 intensity per zone (row-major, y then x)
//         risk: number,                  // 0..100
//         status: "SAFE" | "CAUTION" | "WARNING" | "HIGH RISK" | "EMERGENCY",
//         rescue: {
//           zone: "C4",
//           route: "C",
//           exit_gate: "Gate 3 (Emergency)",
//           officers_deployed: 12,
//           action: "Evacuate Zone C immediately via Gate 3...",
//           announcement: "Attention pilgrims in Zone C ...",
//           victim: { zone: "C5", confidence: 0.82 } | null
//         } | null
//       }
//
// If the backend isn't reachable yet (e.g. M1/M2 still wiring things up),
// this hook keeps `connected: false` and leaves the snapshot fields as
// `null` so consumers can fall back to demo/mock data.
//
// Usage:
//   const { connected, spikeGrid, risk, status, rescue } = useNeuroWatchSocket();

import { useEffect, useRef, useState } from "react";

const SOCKET_URL = "http://localhost:5000";
const EVENT_NAME = "neurowatch_update";

const initialState = {
  connected: false,
  spikeGrid: null,
  risk: null,
  status: null,
  rescue: null,
  lastUpdated: null,
};

export default function useNeuroWatchSocket() {
  const [state, setState] = useState(initialState);
  const socketRef = useRef(null);

  useEffect(() => {
    let socket;

    // socket.io-client is loaded lazily so this hook doesn't explode in
    // environments (like a static preview) where the package isn't installed.
    import("socket.io-client")
      .then(({ io }) => {
        socket = io(SOCKET_URL, {
          transports: ["websocket", "polling"],
          reconnectionDelay: 1000,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          setState((prev) => ({ ...prev, connected: true }));
        });

        socket.on("disconnect", () => {
          setState((prev) => ({ ...prev, connected: false }));
        });

        socket.on(EVENT_NAME, (payload) => {
          if (!payload) return;
          setState((prev) => ({
            ...prev,
            connected: true,
            spikeGrid: payload.spike_grid ?? payload.spikeGrid ?? prev.spikeGrid,
            risk: payload.risk ?? prev.risk,
            status: payload.status ?? prev.status,
            rescue: payload.rescue ?? null,
            lastUpdated: new Date().toISOString(),
          }));
        });
      })
      .catch(() => {
        // socket.io-client not available in this environment; consumers
        // should render their own demo/mock state.
        setState((prev) => ({ ...prev, connected: false }));
      });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  return state;
}
