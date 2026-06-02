// src/components/sports/LifelineRoadmap.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Lifeline Phase Roadmap — the lifelong, age-tiered development ladder. The phase
// matching the athlete's current biological-age bracket is marked ACTIVE TARGET
// (driven by the admin override's age slider via ageProfile()).

import { LIFELINE_PHASES, LIFELINE_TAGS } from './sportsData.js';

export default function LifelineRoadmap({ activePhaseId, age }) {
  return (
    <section className="sp-card">
      <div className="sp-card-head">
        <div>
          <div className="sp-card-tag">Lifelong Progression</div>
          <h3 className="sp-card-title">Lifeline Phase Roadmap</h3>
        </div>
        <span className="sp-sec-meta">{age}-Yr Horizon</span>
      </div>
      <p className="sp-sec-note">Telemetry indicators re-target automatically based on the athlete&apos;s age tier.</p>

      <div className="sp-lifeline">
        {LIFELINE_PHASES.map((p) => {
          const active = p.id === activePhaseId;
          return (
            <div key={p.id} className={`sp-life${active ? ' is-active' : ''}`}>
              <div className="sp-life-rail">
                <span className="sp-life-dot" />
                <span className="sp-life-line" />
              </div>
              <div className="sp-life-body">
                <div className="sp-life-head">
                  <span className="sp-life-name">{p.label}</span>
                  {active ? <span className="sp-life-active">Active Target</span> : null}
                </div>
                <div className="sp-life-desc">{p.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sp-life-tags">
        {LIFELINE_TAGS.map((t) => (
          <span key={t} className="sp-life-tag">{t}</span>
        ))}
      </div>
    </section>
  );
}
