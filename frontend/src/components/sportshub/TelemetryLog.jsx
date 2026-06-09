// src/components/sportshub/TelemetryLog.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Athlete telemetry logbook strip — the data-entry surface under every daily
// exercise/drill (DayProtocol) and Native Sport Engine movement (SportProtocol).
// Per movement the athlete logs:
//   · Weight Used (lbs) — optional; blank = bodyweight ("BW")
//   · RPE 1–10 (0.5 steps — the Referee's promotion gate reads rpe averages
//     against max_rpe_avg 8.5, so half-steps are meaningful)
//   · Log Set → records the entry (and the caller marks the movement complete
//     via the existing done-toggle persistence where one exists)
//
// UI-FIRST (CEO order): entries land in a session-local ledger keyed per
// movement, so they survive the per-day panel remounts (SportsHub keys the
// panel by activeDay). The next hop wires this ledger into
// bbf_athlete_progression — the telemetry table the Autonomous Referee
// (bbf-evaluate-athlete-progress) reads (protocol_completed, rpe_avg_last_3).

import { useState } from 'react';
import './telemetryLog.css';

// Session-local telemetry ledger (cleared on reload — DB wiring lands next).
const LEDGER = new Map();

export default function TelemetryLog({ logKey, onLogged }) {
  const saved = LEDGER.get(logKey) || null;
  const [rec, setRec] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(saved?.weight ?? '');
  const [rpe, setRpe] = useState(saved?.rpe ?? 7);

  function logSet(e) {
    e.preventDefault();
    const w = String(weight).trim();
    const entry = { weight: w === '' ? null : Number(w), rpe: Number(rpe), at: new Date().toISOString() };
    LEDGER.set(logKey, entry);
    setRec(entry);
    setEditing(false);
    onLogged?.(entry);
  }

  if (rec && !editing) {
    return (
      <div className="sh-tlog is-logged">
        <span className="sh-tlog-check" aria-hidden="true">✓</span>
        <span className="sh-tlog-summary">
          Logged · <b>{rec.weight == null ? 'BW' : `${rec.weight} lbs`}</b> · RPE <b>{fmtRpe(rec.rpe)}</b>
        </span>
        <button
          type="button"
          className="sh-tlog-edit"
          onClick={() => { setWeight(rec.weight ?? ''); setRpe(rec.rpe); setEditing(true); }}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form className="sh-tlog" onSubmit={logSet}>
      <label className="sh-tlog-cell">
        <span className="sh-tlog-l">Weight</span>
        <span className="sh-tlog-wbox">
          <input
            className="sh-tlog-win"
            type="number" min="0" max="2000" step="any" inputMode="decimal"
            placeholder="BW"
            value={weight}
            aria-label="Weight used in pounds — leave blank for bodyweight"
            onChange={(e) => setWeight(e.target.value)}
          />
          <span className="sh-tlog-unit">lbs</span>
        </span>
      </label>
      <label className="sh-tlog-cell sh-tlog-rpe">
        <span className="sh-tlog-l">RPE <b className={rpeTone(rpe)}>{fmtRpe(rpe)}</b><small className="sh-tlog-cap"> / 10</small></span>
        <input
          className="sh-tlog-range"
          type="range" min="1" max="10" step="0.5"
          value={rpe}
          aria-label={`Rate of perceived exertion: ${rpe} of 10`}
          onChange={(e) => setRpe(Number(e.target.value))}
        />
      </label>
      <button type="submit" className="sh-tlog-btn">{rec ? 'Update' : 'Log Set'}</button>
    </form>
  );
}

function fmtRpe(r) {
  const n = Number(r);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
// Tone tracks the Referee's gate (max_rpe_avg 8.5): green = comfortable,
// gold = working, red = at/over the promotion-blocking zone.
function rpeTone(r) {
  if (r >= 9) return 'is-max';
  if (r >= 7) return 'is-hot';
  return 'is-ok';
}
