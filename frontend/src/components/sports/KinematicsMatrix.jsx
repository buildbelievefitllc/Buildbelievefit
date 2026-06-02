// src/components/sports/KinematicsMatrix.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Active Kinematics Matrix — the raw telemetry grid. Each row is a measured
// biomechanical vector with a status read-out, color-toned by quality.

export default function KinematicsMatrix({ rows, sportLabel }) {
  return (
    <section className="sp-card">
      <div className="sp-card-head">
        <div>
          <div className="sp-card-tag">Active Kinematics Matrix</div>
          <h3 className="sp-card-title">Raw Telemetry Vectors</h3>
        </div>
        <span className="sp-kin-spec">Sport Specs: {sportLabel}</span>
      </div>

      <div className="sp-kin-rows">
        {rows.map((r) => (
          <div key={r.label} className="sp-kin-row">
            <span className="sp-kin-label">{r.label}</span>
            <span className="sp-kin-val">{r.value}</span>
            <span className={`sp-kin-status tone-${r.tone || 'mut'}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
