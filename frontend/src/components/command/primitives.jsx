// src/components/command/primitives.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared Command Center presentational primitives — the brutalist vocabulary
// reused across surfaces (Tile, Badge, Loading, Empty). Styles are identical to
// the dossier's so aesthetic parity is guaranteed by construction.
//
// NOTE: ClientDossier still carries local copies (it predates this module and is
// live-verified — not re-touched here to protect the shipped vertical). A future
// cleanup should migrate it onto these. New surfaces import from here.

// Stat tile: label + big numeric value + unit, with a colored top accent.
export function Tile({ label, value, unit, accent }) {
  const has = value !== null && value !== undefined && value !== '';
  return (
    <div style={{ ...styles.tile, borderTopColor: accent || 'var(--mut)' }}>
      <span style={styles.tileLabel}>{label}</span>
      <span style={styles.tileValue}>{has ? Number(value).toLocaleString() : '—'}</span>
      <span style={styles.tileUnit}>{has ? unit : ''}</span>
    </div>
  );
}

// Outlined pill in a caller-supplied color.
export function Badge({ label, color }) {
  return <span style={{ ...styles.badge, color, borderColor: color }}>{label}</span>;
}

// Bounded loading indicator — never an infinite mystery spinner.
export function Loading({ label }) {
  return (
    <div style={styles.loading} role="status" aria-live="polite">
      <span style={styles.spinnerDot} />
      {label || 'Loading…'}
    </div>
  );
}

export function Empty({ children }) {
  return <div style={styles.empty}>{children}</div>;
}

const styles = {
  tile: {
    background: 'var(--gry)', border: '1px solid var(--line)', borderTop: '3px solid var(--mut)',
    borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  },
  tileLabel: { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mut)' },
  tileValue: { fontFamily: 'var(--display)', fontSize: '2rem', lineHeight: 1.1, color: 'var(--wht)', margin: '.25rem 0 0' },
  tileUnit: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)' },
  badge: {
    fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    border: '1px solid var(--mut)', borderRadius: 6, padding: '.25rem .55rem', whiteSpace: 'nowrap', display: 'inline-block',
  },
  loading: { display: 'flex', alignItems: 'center', gap: '.6rem', padding: '1.5rem .2rem', color: 'var(--mut)', fontFamily: 'var(--bd)', letterSpacing: '.5px' },
  spinnerDot: { width: 10, height: 10, borderRadius: '50%', background: 'var(--yel)', boxShadow: '0 0 12px rgba(245,200,0,.6)' },
  empty: { fontFamily: 'var(--bd)', fontSize: '.92rem', fontWeight: 600, color: 'var(--mut)', padding: '.4rem 0' },
};
