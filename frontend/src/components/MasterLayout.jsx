// src/components/MasterLayout.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Persistent shell for authenticated users. Brutalist, high-contrast.
//
// Structure only: a left-hand navigation sidebar + a right-hand main content
// viewport (children). Nav items are structural placeholders — real routes/icons
// land in later phases. Brand tokens per CLAUDE.md §2 (Purple/Gold locked; black
// is surface only). signOut is wired so the gate is exit-able during testing.

import { useAuth } from '../context/AuthContext.jsx';

// Client Hub is intentionally NOT a top-level item: per the monolith's Phase 5.2,
// it lives *inside* Command Center as a sub-surface (see pages/CommandCenter.jsx).
const NAV_ITEMS = ['Command Center', 'Program', 'Nutrition', 'Settings'];

export default function MasterLayout({ children }) {
  const { user, signOut } = useAuth();

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          BBF<span style={{ color: 'var(--yel)' }}>.</span>
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map((item, i) => (
            <button
              key={item}
              type="button"
              style={{ ...styles.navItem, ...(i === 0 ? styles.navItemActive : null) }}
            >
              {item}
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFoot}>
          {user?.username ? <div style={styles.who}>@{user.username}</div> : null}
          <button type="button" style={styles.signout} onClick={signOut}>
            Sign Out
          </button>
        </div>
      </aside>

      <main style={styles.viewport}>{children}</main>
    </div>
  );
}

const styles = {
  shell: {
    display: 'flex',
    height: '100%',
    minHeight: '100%',
    background: 'var(--blk)',
    color: 'var(--wht)',
  },
  sidebar: {
    width: 248,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem 1rem',
    background: 'linear-gradient(180deg, var(--purp) 0%, var(--blk) 60%)',
    borderRight: '1px solid var(--line)',
  },
  brand: {
    fontFamily: 'var(--hb)',
    fontSize: '1.8rem',
    fontWeight: 900,
    letterSpacing: '2px',
    padding: '0 .4rem 1.5rem',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: '.25rem', flex: 1 },
  navItem: {
    textAlign: 'left',
    fontFamily: 'var(--hb)',
    fontSize: '.82rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'rgba(249,245,255,.62)',
    background: 'none',
    border: '1px solid transparent',
    borderRadius: 8,
    padding: '.7rem .75rem',
    cursor: 'pointer',
  },
  navItemActive: {
    color: 'var(--wht)',
    background: 'rgba(106,13,173,.18)',
    borderColor: 'rgba(245,200,0,.3)',
    borderLeft: '3px solid var(--yel)',
  },
  sidebarFoot: { borderTop: '1px solid var(--line)', paddingTop: '1rem', marginTop: '1rem' },
  who: { fontSize: '.72rem', letterSpacing: '1px', color: 'var(--mut)', marginBottom: '.6rem' },
  signout: {
    width: '100%',
    fontFamily: 'var(--hb)',
    fontSize: '.72rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'var(--gold-soft)',
    background: 'none',
    border: '1px solid rgba(245,200,0,.3)',
    borderRadius: 8,
    padding: '.6rem',
    cursor: 'pointer',
  },
  viewport: { flex: 1, overflowY: 'auto', padding: '2rem' },
};
