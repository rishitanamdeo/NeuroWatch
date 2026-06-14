// VenueMap.jsx
// Member 4 — Venue Map & Rescue Routing
// "The map — where is the danger and how do we respond"
//
// Renders a 10x10 SVG top-down layout of the venue (temple, food court,
// river ghat, pilgrim camp, gates) and overlays it with the live spike
// grid coming from the neuromorphic engine (Member 2). The cell(s) above
// `dangerThreshold` glow red, and if a `rescue` object is supplied, the
// recommended evacuation route is drawn from the danger zone to its exit
// gate with an animated marching-ants line.
//
// Props
// ------
//   spikeGrid       : number[10][10]   10x10 array of 0..1 intensities,
//                                       row-major as [y][x] (y = row index
//                                       0..9 for rows 1..10, x = col index
//                                       0..9 for cols A..J). Defaults to all
//                                       zeros (SAFE state) if not provided.
//   rescue          : {
//                        zone: "C4",
//                        route: "C",            // key into venueLayout.routes
//                        exit_gate: "Gate 3 (Emergency)",
//                        ...
//                      } | null
//   dangerThreshold : number  (default 0.7) — spike intensity that
//                     triggers the red pulse on a zone.
//   connected       : boolean — drives the live/offline indicator.
//
// This component is intentionally "dumb": Dashboard.jsx (Member 3) is
// expected to own the Socket.IO connection and pass `spikeGrid` / `rescue`
// down as props each time a `risk_update` event arrives. For standalone
// testing, see demo_preview.html which feeds it mock data for all three
// scenarios (normal / kumbh_surge / crush).

import React, { useMemo } from "react";
import venueLayout from "../../../data/venue_layout.json";
import "./VenueMap.css";

const CELL = venueLayout.grid.cellSize; // 50
const PAD = 50; // space around the grid for gate labels
const GRID_PX = CELL * venueLayout.grid.cols; // 500
const VIEW = GRID_PX + PAD * 2; // 600

const EMPTY_GRID = Array.from({ length: 10 }, () => Array(10).fill(0));

// blue -> yellow -> red heat scale, matching the HeatMap component's palette
function heatColor(t) {
  const v = Math.max(0, Math.min(1, t || 0));
  const stops = [
    [0.0, [29, 78, 216]],   // #1d4ed8
    [0.5, [250, 204, 21]],  // #facc15
    [1.0, [239, 68, 68]],   // #ef4444
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i][0] && v <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const span = b[0] - a[0] || 1;
  const local = (v - a[0]) / span;
  const c = a[1].map((c0, i) => Math.round(c0 + (b[1][i] - c0) * local));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function zoneCenter(zoneId) {
  const zone = venueLayout.zones.find((z) => z.id === zoneId);
  if (!zone) return null;
  return {
    x: PAD + zone.x * CELL + CELL / 2,
    y: PAD + zone.y * CELL + CELL / 2,
  };
}

// edge anchor point for a gate, just outside the grid
function gatePoint(gate) {
  const zone = venueLayout.zones.find((z) => z.id === gate.anchorZone);
  const cx = PAD + zone.x * CELL + CELL / 2;
  const cy = PAD + zone.y * CELL + CELL / 2;
  switch (gate.side) {
    case "west":
      return { x: PAD - 22, y: cy, labelX: PAD - 26, labelAnchor: "end" };
    case "east":
      return { x: PAD + GRID_PX + 22, y: cy, labelX: PAD + GRID_PX + 26, labelAnchor: "start" };
    case "south":
      return { x: cx, y: PAD + GRID_PX + 22, labelX: cx, labelAnchor: "middle" };
    case "north":
    default:
      return { x: cx, y: PAD - 22, labelX: cx, labelAnchor: "middle" };
  }
}

function landmarkBounds(landmark) {
  const zones = landmark.zones
    .map((id) => venueLayout.zones.find((z) => z.id === id))
    .filter(Boolean);
  const xs = zones.map((z) => z.x);
  const ys = zones.map((z) => z.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    x: PAD + minX * CELL,
    y: PAD + minY * CELL,
    w: (maxX - minX + 1) * CELL,
    h: (maxY - minY + 1) * CELL,
    cx: PAD + ((minX + maxX + 1) / 2) * CELL,
    cy: PAD + ((minY + maxY + 1) / 2) * CELL,
  };
}

// minimal icon glyphs for each landmark type, drawn around (cx, cy)
function LandmarkIcon({ icon, cx, cy }) {
  switch (icon) {
    case "temple":
      return (
        <g stroke="rgba(231,236,243,0.55)" strokeWidth="1.5" fill="none">
          <path d={`M ${cx - 14} ${cy + 8} L ${cx} ${cy - 10} L ${cx + 14} ${cy + 8} Z`} />
          <rect x={cx - 9} y={cy + 8} width="18" height="8" />
          <line x1={cx} y1={cy - 10} x2={cx} y2={cy - 16} />
        </g>
      );
    case "foodcourt":
      return (
        <g stroke="rgba(231,236,243,0.55)" strokeWidth="1.5" fill="none">
          <circle cx={cx - 8} cy={cy} r="9" />
          <line x1={cx + 6} y1={cy - 10} x2={cx + 6} y2={cy + 10} />
          <line x1={cx + 11} y1={cy - 10} x2={cx + 11} y2={cy + 10} />
          <line x1={cx + 6} y1={cy - 10} x2={cx + 11} y2={cy - 10} />
        </g>
      );
    case "ghat":
      return (
        <g stroke="rgba(231,236,243,0.45)" strokeWidth="1.5" fill="none">
          <path d={`M ${cx - 20} ${cy} q 5 -6 10 0 t 10 0 t 10 0 t 10 0`} />
          <path d={`M ${cx - 20} ${cy + 8} q 5 -6 10 0 t 10 0 t 10 0 t 10 0`} />
        </g>
      );
    case "camp":
      return (
        <g stroke="rgba(231,236,243,0.55)" strokeWidth="1.5" fill="none">
          <path d={`M ${cx - 16} ${cy + 8} L ${cx - 6} ${cy - 10} L ${cx + 4} ${cy + 8} Z`} />
          <path d={`M ${cx} ${cy + 8} L ${cx + 10} ${cy - 10} L ${cx + 20} ${cy + 8} Z`} />
        </g>
      );
    default:
      return null;
  }
}

export default function VenueMap({
  spikeGrid = EMPTY_GRID,
  rescue = null,
  dangerThreshold = 0.7,
  connected = false,
}) {
  const grid = spikeGrid && spikeGrid.length === 10 ? spikeGrid : EMPTY_GRID;

  // route polyline points, if the backend has flagged a rescue route
  const routePoints = useMemo(() => {
    if (!rescue || !rescue.route) return null;
    const route = venueLayout.routes[rescue.route];
    if (!route) return null;
    const gate = venueLayout.gates.find((g) => g.id === route.gate);
    if (!gate) return null;

    const points = route.path
      .map(zoneCenter)
      .filter(Boolean);
    points.push(gatePoint(gate));
    return points;
  }, [rescue]);

  const dangerZoneIds = useMemo(() => {
    const ids = new Set();
    venueLayout.zones.forEach((zone) => {
      const intensity = grid[zone.y]?.[zone.x] ?? 0;
      if (intensity >= dangerThreshold) ids.add(zone.id);
    });
    if (rescue?.zone) ids.add(rescue.zone);
    return ids;
  }, [grid, dangerThreshold, rescue]);

  return (
    <div className="venue-map">
      <div className="venue-map__header">
        <h3 className="venue-map__title">Venue Map — Sector Overview</h3>
        <span className="venue-map__connection">
          <span
            className={
              "venue-map__connection-dot" +
              (connected ? " venue-map__connection-dot--live" : "")
            }
          />
          {connected ? "live feed" : "offline / demo data"}
        </span>
      </div>
      <span className="venue-map__subtitle">
        {rescue?.zone
          ? `Danger zone ${rescue.zone} → ${rescue.exit_gate || "nearest gate"}`
          : "All sectors nominal"}
      </span>

      <svg
        className="venue-map__stage"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* grid cells, colored by spike intensity */}
        {venueLayout.zones.map((zone) => {
          const intensity = grid[zone.y]?.[zone.x] ?? 0;
          const isDanger = dangerZoneIds.has(zone.id);
          return (
            <rect
              key={zone.id}
              className={"zone-cell" + (isDanger ? " zone-danger" : "")}
              x={PAD + zone.x * CELL}
              y={PAD + zone.y * CELL}
              width={CELL}
              height={CELL}
              fill={heatColor(intensity)}
              fillOpacity={0.3 + intensity * 0.6}
            />
          );
        })}

        {/* zone id labels (only every other cell to avoid clutter) */}
        {venueLayout.zones
          .filter((z) => z.x % 2 === 0 && z.y % 2 === 0)
          .map((zone) => (
            <text
              key={`label-${zone.id}`}
              className="zone-label"
              x={PAD + zone.x * CELL + 3}
              y={PAD + zone.y * CELL + 10}
            >
              {zone.id}
            </text>
          ))}

        {/* landmark outlines + icons */}
        {venueLayout.landmarks.map((landmark) => {
          const b = landmarkBounds(landmark);
          return (
            <g key={landmark.id}>
              <rect
                className="landmark-outline"
                x={b.x + 2}
                y={b.y + 2}
                width={b.w - 4}
                height={b.h - 4}
                rx={6}
              />
              <LandmarkIcon icon={landmark.icon} cx={b.cx} cy={b.cy - 6} />
              <text className="landmark-label" x={b.cx} y={b.y + b.h - 6} textAnchor="middle">
                {landmark.label}
              </text>
            </g>
          );
        })}

        {/* rescue route, drawn on top of everything */}
        {routePoints && (
          <>
            <polyline
              className="rescue-route"
              points={routePoints.map((p) => `${p.x},${p.y}`).join(" ")}
            />
            <polygon
              className="rescue-route-arrow"
              points={arrowHead(routePoints)}
            />
          </>
        )}

        {/* gates */}
        {venueLayout.gates.map((gate) => {
          const p = gatePoint(gate);
          const isVertical = gate.side === "west" || gate.side === "east";
          const w = isVertical ? 12 : 36;
          const h = isVertical ? 36 : 12;
          const closed = gate.status === "closed" || rescue?.closed_gates?.includes(gate.id);
          return (
            <g key={gate.id}>
              <rect
                className={"gate" + (closed ? " gate--closed" : "")}
                x={p.x - w / 2}
                y={p.y - h / 2}
                width={w}
                height={h}
                rx={3}
              />
              <text
                className="gate-label"
                x={p.labelX}
                y={gate.side === "south" ? p.y + 26 : p.y - 6}
                textAnchor={p.labelAnchor}
              >
                {gate.label}
              </text>
              <text
                className="gate-sublabel"
                x={p.labelX}
                y={gate.side === "south" ? p.y + 38 : p.y + 8}
                textAnchor={p.labelAnchor}
              >
                {closed ? "CLOSED" : "OPEN"}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="venue-map__legend">
        <div className="venue-map__legend-item">
          <span className="venue-map__legend-gradient" />
          spike intensity (low → high)
        </div>
        <div className="venue-map__legend-item">
          <span
            className="venue-map__legend-swatch"
            style={{ background: "transparent", border: "2px solid var(--nw-emergency)" }}
          />
          danger zone (≥ {Math.round(dangerThreshold * 100)}%)
        </div>
        <div className="venue-map__legend-item">
          <span className="venue-map__legend-swatch" style={{ background: "var(--nw-emergency)" }} />
          rescue route
        </div>
        <div className="venue-map__legend-item">
          <span className="venue-map__legend-swatch" style={{ background: "var(--nw-safe)" }} />
          gate open
        </div>
      </div>
    </div>
  );
}

// build a small triangular arrowhead pointing along the final route segment
function arrowHead(points) {
  if (points.length < 2) return "";
  const end = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
  const size = 8;
  const p1 = end;
  const p2 = {
    x: end.x - size * Math.cos(angle - Math.PI / 6),
    y: end.y - size * Math.sin(angle - Math.PI / 6),
  };
  const p3 = {
    x: end.x - size * Math.cos(angle + Math.PI / 6),
    y: end.y - size * Math.sin(angle + Math.PI / 6),
  };
  return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
}
