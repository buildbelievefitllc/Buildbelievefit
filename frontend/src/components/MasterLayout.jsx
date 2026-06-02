// src/components/MasterLayout.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Persistent shell for authenticated users. Brutalist, high-contrast.
//
// Structure: a left-hand navigation sidebar + a right-hand main content viewport
// (children). The nav items push the CEO to the matching Command Center surface
// via React Router (/command/<tab>) — Command Center groups the coaching consoles
// (Founder Five / Risk Telemetry / Analytics / Comlink), while Program / Nutrition
// / Settings deep-link the admin's own Player-Coach views. The active item is
// derived from the URL, never hardcoded. Brand tokens per CLAUDE.md §2.

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';

// Coaching surfaces all live under the "Command Center" item (Client Hub is a
// sub-surface there, per the monolith's Phase 5.2). The Player-Coach tabs get their
// own deep-link entries. `active` is matched against the current /command/<tab>.
const COACHING_TABS = ['', 'roster', 'command', 'telemetry', 'analytics', 'comlink'];
const NAV_ITEMS = [
  { labelKey: 'vault-command', to: '/command', isActive: (tab) => COACHING_TABS.includes(tab) },
  { labelKey: 'cmd-tab-sports', to: '/command/sports', isActive: (tab) => tab === 'sports' },
  { labelKey: 'vault-tab-program', to: '/command/program', isActive: (tab) => ['program', 'generator', 'prehab'].includes(tab) },
  { labelKey: 'vault-tab-nutrition', to: '/command/nutrition', isActive: (tab) => tab === 'nutrition' },
  { labelKey: 'vault-tab-settings', to: '/command/settings', isActive: (tab) => tab === 'settings' },
];

export default function MasterLayout({ children }) {
  const { user, signOut } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  // Active surface = the segment after /command (empty ⇒ the default roster).
  const activeSurface = location.pathname.startsWith('/command')
    ? location.pathname.split('/')[2] || ''
    : '';

  // Layout lives in index.css classes (bbf-shell / bbf-sidebar / …) so it can go
  // responsive — inline styles can't express the media query the mobile collapse
  // needs. Purely visual, non-conflicting styles stay inline.
  return (
    <div className="bbf-shell">
      <aside className="bbf-sidebar">
        <div style={styles.brand}>
          BBF<span style={{ color: 'var(--yel)' }}>.</span>
        </div>

        <nav className="bbf-sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(activeSurface);
            return (
              <button
                key={item.labelKey}
                type="button"
                onClick={() => navigate(item.to)}
                aria-current={active ? 'page' : undefined}
                style={{ ...styles.navItem, ...(active ? styles.navItemActive : null) }}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="bbf-sidebar-foot">
          {user?.username ? <div style={styles.who}>@{user.username}</div> : null}
          {/* Cross back to the athlete Vault — the admin is an athlete first.
              ("/" is the public landing now; the Vault lives at /vault.) */}
          <button type="button" style={styles.toVault} onClick={() => navigate('/vault')}>
            {t('shell-athlete-vault')}
          </button>
          <button type="button" style={styles.signout} onClick={signOut}>
            {t('shell-signout')}
          </button>
        </div>
      </aside>

      <main className="bbf-viewport">{children}</main>
    </div>
  );
}

const styles = {
  // Layout (shell / sidebar / nav / foot / viewport) now lives in index.css so it
  // can respond to viewport width; only non-layout visual styles remain inline.
  brand: {
    fontFamily: 'var(--hb)',
    fontSize: '1.8rem',
    fontWeight: 900,
    letterSpacing: '2px',
    padding: '0 .4rem 1.5rem',
  },
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
  who: { fontSize: '.72rem', letterSpacing: '1px', color: 'var(--mut)', marginBottom: '.6rem' },
  toVault: {
    width: '100%',
    fontFamily: 'var(--hb)',
    fontSize: '.72rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'var(--wht)',
    background: 'rgba(106,13,173,.22)',
    border: '1px solid rgba(139,26,191,.5)',
    borderRadius: 8,
    padding: '.6rem',
    cursor: 'pointer',
    marginBottom: '.6rem',
  },
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
};
