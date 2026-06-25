// src/components/sportshub/youthSequenceParts.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared step-CTA primitives for THE GAMEPLAN — the youth Sports Hub guided
// sequence (the youth twin of the adult SovereignSequence's SequenceCTA/Next).
// Kept youth-local (sportshub/) so the youth flow never imports the adult vault
// sequence; brand-locked gold transport + a purple-outline secondary fork.

import './youthSequence.css';

// Big gold transport button with a trailing arrow. `variant='secondary'` is the
// purple-outline fork CTA (e.g. "Fix the Pain") so it never competes with primary.
export function YouthCTA({ label, onClick, testid, variant = 'primary' }) {
  return (
    <button
      type="button"
      className={`yseq-cta${variant === 'secondary' ? ' yseq-cta--secondary' : ''}`}
      onClick={onClick}
      data-testid={testid}
    >
      <span className="yseq-cta-label">{label}</span>
    </button>
  );
}

// Bottom-of-tab hand-off: a divider + the CTA so it reads as a deliberate next
// step at the foot of the surface.
export function YouthNext({ label, onClick, testid, variant = 'primary' }) {
  return (
    <div className="yseq-next">
      <YouthCTA label={label} onClick={onClick} testid={testid} variant={variant} />
    </div>
  );
}
