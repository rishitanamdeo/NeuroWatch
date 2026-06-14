// RescuePanel.jsx
// Member 4 — Venue Map & Rescue Routing
// "The map — where is the danger and how do we respond"
//
// Companion to VenueMap.jsx. Reads the `rescue` object produced by
// risk_engine.get_rescue_plan() (Member 2) and presents it as a
// human-readable action card: current action, target zone, recommended
// exit gate, an animated officer-deployment counter, the route hop list,
// and (if risk_engine.detect_victim() found something) a pulsing
// victim-detection alert.
//
// Props
// ------
//   rescue : {
//     status: "SAFE" | "CAUTION" | "WARNING" | "HIGH RISK" | "EMERGENCY",
//     zone: "C4",
//     route: "C",                 // key into venueLayout.routes
//     exit_gate: "Gate 3 (Emergency)",
//     officers_deployed: 12,
//     action: "Evacuate Zone C immediately via Gate 3...",
//     announcement: "Attention pilgrims in Zone C ...",
//     victim: { zone: "C5", confidence: 0.82 } | null
//   } | null
//
// When `rescue` is null (SAFE state, nothing to coordinate), the panel
// renders a calm "all clear" placeholder instead of empty fields.

import React, { useEffect, useRef, useState } from "react";
import venueLayout from "../../../data/venue_layout.json";
import "./RescuePanel.css";

function statusClass(status) {
  if (!status) return "";
  return status.toLowerCase().replace(/\s+/g, "-");
}

// counts up/down toward `target` over ~600ms whenever it changes
function useAnimatedCounter(target) {
  const [value, setValue] = useState(target ?? 0);
  const frame = useRef(null);

  useEffect(() => {
    const start = value;
    const end = target ?? 0;
    if (start === end) return;
    const duration = 600;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const current = Math.round(start + (end - start) * progress);
      setValue(current);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    }
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

function RouteHops({ routeKey }) {
  const route = routeKey ? venueLayout.routes[routeKey] : null;
  if (!route) return null;
  const gate = venueLayout.gates.find((g) => g.id === route.gate);

  return (
    <div className="rescue-route-list">
      {route.path.map((zoneId, i) => (
        <React.Fragment key={zoneId}>
          <span
            className="rescue-route-list__hop"
            style={{ "--hop-delay": `${i * 0.15}s` }}
          >
            {zoneId}
          </span>
          <span className="rescue-route-list__arrow">→</span>
        </React.Fragment>
      ))}
      <span className="rescue-route-list__gate">{gate ? gate.label : route.gate}</span>
    </div>
  );
}

export default function RescuePanel({ rescue = null }) {
  const officers = useAnimatedCounter(rescue?.officers_deployed ?? 0);
  const status = rescue?.status || "SAFE";
  const hasRescue = Boolean(rescue && rescue.zone);

  return (
    <div className="rescue-panel">
      <div className="rescue-panel__header">
        <h3 className="rescue-panel__title">Rescue Coordination</h3>
        <span className={`rescue-panel__status rescue-panel__status--${statusClass(status)}`}>
          {status}
        </span>
      </div>

      {!hasRescue && (
        <div className="rescue-panel__empty">
          <span className="rescue-panel__empty-dot" />
          All sectors nominal — no rescue action required.
        </div>
      )}

      {hasRescue && (
        <>
          <div className="rescue-panel__row">
            <span className="rescue-panel__label">Current Action</span>
            <span className="rescue-panel__value">
              {rescue.action || "Monitoring elevated activity in flagged zone."}
            </span>
          </div>

          <div className="rescue-panel__row">
            <span className="rescue-panel__label">Target Zone</span>
            <span className="rescue-panel__value">
              <span className="rescue-panel__zone-tag">{rescue.zone}</span>
              {rescue.exit_gate ? `  →  recommended exit: ${rescue.exit_gate}` : ""}
            </span>
          </div>

          {rescue.route && (
            <div className="rescue-panel__row">
              <span className="rescue-panel__label">Evacuation Route {rescue.route}</span>
              <RouteHops routeKey={rescue.route} />
            </div>
          )}

          <div className="rescue-panel__row">
            <span className="rescue-panel__label">Officers Deployed</span>
            <div className="rescue-panel__counter">
              <span className="rescue-panel__counter-value">{officers}</span>
              <span className="rescue-panel__counter-label">on-site response personnel</span>
            </div>
          </div>

          {rescue.victim && (
            <div className="victim-card">
              <span className="victim-card__icon">!</span>
              <div className="victim-card__body">
                <span className="victim-card__title">Possible victim detected</span>
                <span className="victim-card__detail">
                  Zone {rescue.victim.zone} · confidence{" "}
                  {Math.round((rescue.victim.confidence || 0) * 100)}%
                </span>
              </div>
            </div>
          )}

          {rescue.announcement && (
            <div className="rescue-panel__announcement">{rescue.announcement}</div>
          )}
        </>
      )}
    </div>
  );
}
