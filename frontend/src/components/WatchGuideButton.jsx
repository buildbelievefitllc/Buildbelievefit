// src/components/WatchGuideButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium, high-visibility gold→purple CAPSULE PILL that triggers a tutorial guide.
// The project has no Tailwind / lucide-react / TS, so the spec's utility-class block
// is translated to the house idiom: a brand-locked (§2 — #f5c800 gold, #6a0dad
// purple) pill styled in bbfMediaPortal.css (.wg-pill), an inline Play glyph (no
// icon dependency), a subtle pulse + purple glow, and active:scale press feedback.
//
// Drop-in: <WatchGuideButton onPress={fn} label="WATCH GUIDE" testId="…-watch" />

// Inline play triangle — filled, matches the spec's fill/stroke-black premium look.
function PlayGlyph() {
  return (
    <svg className="wg-pill-ic" width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M2.5 1.6a.6.6 0 0 1 .9-.52l6.7 3.9a.6.6 0 0 1 0 1.04l-6.7 3.9a.6.6 0 0 1-.9-.52V1.6Z" fill="currentColor" />
    </svg>
  );
}

export default function WatchGuideButton({ onPress, label = 'WATCH GUIDE', testId, className }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`wg-pill${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      <PlayGlyph />
      <span className="wg-pill-label">{label}</span>
    </button>
  );
}
