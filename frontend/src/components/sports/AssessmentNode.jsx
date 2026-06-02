// src/components/sports/AssessmentNode.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Anti-Lockout Tier Assessment Node — "The Autonomous Gatekeeper".
// Two readiness sliders gate phase advancement: drag a value below its sparing
// limit and the gate flips from APPROVED to a conditional-redirection warning.

import { useState } from 'react';

export default function AssessmentNode({ assessment }) {
  const [somatic, setSomatic] = useState(assessment.somaticReadiness.value);
  const [movement, setMovement] = useState(assessment.movementQuality.value);

  const sLimit = assessment.somaticReadiness.limit;
  const mLimit = assessment.movementQuality.limit;
  const approved = somatic >= sLimit && movement >= mLimit;

  return (
    <section className="sp-card">
      <div className="sp-card-head">
        <div>
          <div className="sp-card-tag">The Autonomous Gatekeeper</div>
          <h3 className="sp-card-title">Anti-Lockout Tier Assessment Node</h3>
        </div>
        <span className={`sp-approved${approved ? '' : ' is-warn'}`}>
          {approved ? '⚡ Autonomic Overload Approved' : '⚠ Conditional Redirection'}
        </span>
      </div>

      <div className="sp-block-tag">Biotechnical Factor Stressor Simulator</div>
      <p className="sp-slide-help">Slide a value below its limit to test conditional redirection of the development phase.</p>

      <Slider
        name="Somatic Readiness Target"
        value={somatic}
        limit={sLimit}
        onChange={setSomatic}
        foot="Corresponds to sleep index, muscle recovery, and vagal tone levels."
      />
      <Slider
        name="Movement Quality"
        value={movement}
        limit={mLimit}
        onChange={setMovement}
        foot="Calculated from balance tracking, decelerative forces, and tendon thickness."
      />

      <div className={`sp-verdict${approved ? '' : ' is-warn'}`}>
        <span className="sp-verdict-ico">{approved ? '✅' : '⚠️'}</span>
        <div>
          <div className="sp-verdict-t">
            {approved ? assessment.verdict : 'Conditional Redirection Engaged'}
          </div>
          <div className="sp-verdict-b">
            {approved
              ? assessment.verdictNote
              : 'One or more somatic parameters dropped below the sparing limit. Advancement is gated — reduce load and re-test before progressing phases.'}
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({ name, value, limit, onChange, foot }) {
  const under = value < limit;
  return (
    <div className="sp-slide-row">
      <div className="sp-slide-top">
        <span className="sp-slide-name">{name}</span>
        <span className={`sp-slide-read${under ? ' is-under' : ''}`}>
          <b>{value}%</b> <span>(Limit: {limit}%)</span>
        </span>
      </div>
      <input
        className="sp-slider"
        type="range"
        min="0"
        max="100"
        value={value}
        aria-label={`${name} — limit ${limit}%`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="sp-slide-foot">{foot}</div>
    </div>
  );
}
