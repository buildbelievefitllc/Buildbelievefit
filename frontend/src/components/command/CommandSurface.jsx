// src/components/command/CommandSurface.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Shared chrome for the three Command Center surfaces (Client Hub /
// Risk Telemetry / Comlink). Renders the header band (kicker + title + lede);
// each surface passes its own copy and, in later phases, its own live body.
//
// Presentational only — no data, no state. Brand tokens per CLAUDE.md §2.

export default function CommandSurface({ kicker, title, lede, children }) {
  return (
    <section style={styles.surface}>
      <header style={styles.head}>
        <div style={styles.kicker}>{kicker}</div>
        <h2 style={styles.title}>{title}</h2>
        {lede ? <p style={styles.lede}>{lede}</p> : null}
      </header>
      {children}
    </section>
  );
}

// Brutalist empty-state used by every surface until live wiring lands. The note
// states which phase fills it in, so the skeleton never reads as "broken."
export function Placeholder({ note }) {
  return (
    <div style={styles.ph}>
      <span style={styles.phDot} />
      <div>
        <div style={styles.phTitle}>Structural skeleton</div>
        <div style={styles.phNote}>{note}</div>
      </div>
    </div>
  );
}

const styles = {
  surface: { maxWidth: 920 },
  head: { marginBottom: '1.5rem' },
  kicker: {
    fontFamily: 'var(--hb)',
    fontSize: '.68rem',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: 'var(--gold-deep)',
    marginBottom: '.4rem',
  },
  title: { fontFamily: 'var(--display)', fontSize: '2rem', letterSpacing: '1px', margin: 0 },
  lede: {
    fontFamily: 'var(--bd)',
    fontSize: '.95rem',
    fontWeight: 600,
    lineHeight: 1.45,
    letterSpacing: '.4px',
    color: 'var(--mut)',
    maxWidth: '62ch',
    margin: '.5rem 0 0',
  },
  ph: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem 1.4rem',
    border: '1px dashed var(--line)',
    borderRadius: 12,
    background: 'rgba(249,245,255,.015)',
  },
  phDot: {
    width: 10,
    height: 10,
    flexShrink: 0,
    borderRadius: '50%',
    background: 'var(--yel)',
    boxShadow: '0 0 12px rgba(245,200,0,.5)',
  },
  phTitle: {
    fontFamily: 'var(--hb)',
    fontSize: '.8rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'var(--wht)',
  },
  phNote: { fontFamily: 'var(--bd)', fontSize: '.9rem', color: 'var(--mut)', marginTop: '.15rem' },
};
