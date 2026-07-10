// src/components/WatchGuideButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium gold→purple CAPSULE PILL that triggers a tutorial guide. Self-contained
// inline-style component (no Tailwind / lucide / external CSS) per the Vite build.
//
// BRAND (§2 LOCKED): the gradient uses the real BBF tokens — Gold #f5c800 (gold-soft
// #f5cf60) → Purple #6a0dad — NOT amber-400/purple-600. Black ink on the gold zone
// keeps the label high-contrast (same pattern as the portal's active mode chip).
//
// `testId` is passed through to data-testid — the Playwright media-portal spec drives
// the launcher through it, so it must not be dropped.

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  // gold-dominant left (where the icon + label sit) → purple trailing accent
  background: 'linear-gradient(90deg, #f5cf60 0%, #f5c800 46%, #8a1fd0 82%, #6a0dad 100%)',
  color: '#090909',
  fontFamily: "var(--hb, 'Bebas Neue'), sans-serif",
  fontWeight: 900,
  fontSize: '12px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  padding: '6px 16px',
  borderRadius: '9999px',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 0 15px rgba(245, 200, 0, 0.32), inset 0 1px 0 rgba(255,255,255,0.35)',
  transition: 'all 0.3s ease',
};

export default function WatchGuideButton({ onClick, label = 'WATCH GUIDE', testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      style={buttonStyle}
      onMouseOver={(e) => {
        e.currentTarget.style.boxShadow = '0 0 25px rgba(106, 13, 173, 0.6), inset 0 1px 0 rgba(255,255,255,0.45)';
        e.currentTarget.style.transform = 'scale(1.02)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = buttonStyle.boxShadow;
        e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#090909" aria-hidden="true" focusable="false">
        <path d="M8 5v14l11-7z" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
