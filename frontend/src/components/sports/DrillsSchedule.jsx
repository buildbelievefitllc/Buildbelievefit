// src/components/sports/DrillsSchedule.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Interactive Sports Drills Schedule — the athlete's drill scorecard. Each row is
// a checkable target; toggling completion updates the live Target Match Rate and
// the AI progression forecast surfaces once every target is attained.

import { useState } from 'react';

export default function DrillsSchedule({ drills, forecast }) {
  const [met, setMet] = useState(() => drills.map((d) => !!d.met));

  const toggle = (i) => setMet((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const completed = met.filter(Boolean).length;
  const total = drills.length || 1;
  const pct = Math.round((completed / total) * 100);
  const allMet = completed === drills.length;

  return (
    <section className="sp-card">
      <div className="sp-card-head">
        <div>
          <div className="sp-card-tag">Active Drill Matrix</div>
          <h3 className="sp-card-title">Interactive Sports Drills Schedule</h3>
        </div>
      </div>
      <p className="sp-sec-note">Check tasks completed or adjust performance metrics to see the AI forecast change.</p>

      <div className="sp-drills">
        {drills.map((d, i) => (
          <div key={d.name} className={`sp-drill${met[i] ? ' is-met' : ''}`}>
            <button
              type="button"
              className={`sp-drill-check${met[i] ? ' is-on' : ''}`}
              aria-pressed={met[i]}
              aria-label={`Toggle ${d.name} complete`}
              onClick={() => toggle(i)}
            >
              {met[i] ? '✓' : ''}
            </button>
            <div className="sp-drill-body">
              <div className="sp-drill-name">{d.name}</div>
              <div className="sp-drill-desc">{d.desc}</div>
              <div className="sp-drill-metric">Target Metric: {d.target} {d.unit} · {d.metricLabel}</div>
            </div>
            <div className="sp-drill-result">
              <span className="sp-drill-ach">Achieved <b>{d.achieved}</b> {d.unit}</span>
              <span className={`sp-met-badge ${met[i] ? 'is-on' : 'is-off'}`}>
                {met[i] ? 'Target Met' : 'Pending'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="sp-match">
        <div className="sp-match-top">
          <span className="sp-match-l">Target Match Rate</span>
          <span className="sp-match-v">{pct}% ({completed}/{drills.length} Completed)</span>
        </div>
        <div className="sp-match-track">
          <div className="sp-match-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="sp-forecast">
        <span className="sp-forecast-ico">⚡</span>
        <div>
          <div className="sp-forecast-t">AI Physical Outlook & Progression Forecast</div>
          <div className="sp-forecast-b">
            {allMet
              ? forecast
              : 'Partial completion logged. Attain the remaining targets to unlock the full progression forecast and the next milestone projection.'}
          </div>
        </div>
      </div>
    </section>
  );
}
