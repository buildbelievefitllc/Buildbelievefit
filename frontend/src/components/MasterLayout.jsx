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
// Executive workspace nav. The personal client tabs (Program · Prehab · Nutrition)
// were purged — they live only in the Sovereign Client Vault now. Generator, the
// admin Nutrition Locker, and Access Control fold under the Command Center group;
// Sports Portal, Language, and Settings get their own entries.
// Repositioning C-01 — the sidebar is now the AUTHORITATIVE nav: all 17 Command
// Center surfaces appear here, grouped under the same four executive domains the
// in-page rail uses (Coaching · Content · Knowledge · System). Previously only 10
// surfaces were listed and the two navs were desynced. The roster item ('' tab)
// stays the default landing.
const NAV_GROUPS = [
  {
    labelKey: 'cmd-dom-coaching',
    items: [
      { labelKey: 'cmd-tab-roster', to: '/command', isActive: (tab) => ['', 'roster', 'command', 'access', 'analytics'].includes(tab) },
      { labelKey: 'cmd-tab-telemetry', to: '/command/telemetry', isActive: (tab) => tab === 'telemetry' },
      { labelKey: 'cmd-tab-eagle-eye', to: '/command/eagle-eye', isActive: (tab) => tab === 'eagle-eye' },
      { labelKey: 'cmd-tab-comlink', to: '/command/comlink', isActive: (tab) => tab === 'comlink' },
      { labelKey: 'cmd-tab-nutrition-locker', to: '/command/nutrition-locker', isActive: (tab) => tab === 'nutrition-locker' },
      { labelKey: 'cmd-tab-sports', to: '/command/sports', isActive: (tab) => tab === 'sports' },
    ],
  },
  {
    labelKey: 'cmd-dom-content',
    items: [
      { labelKey: 'cmd-tab-content', to: '/command/content', isActive: (tab) => tab === 'content' },
      { labelKey: 'cmd-tab-content-manager', to: '/command/content-manager', isActive: (tab) => tab === 'content-manager' },
      { labelKey: 'cmd-tab-studio', to: '/command/studio', isActive: (tab) => tab === 'studio' },
      { labelKey: 'cmd-tab-studio-v4', to: '/command/studio-v4', isActive: (tab) => tab === 'studio-v4' },
      { labelKey: 'cmd-tab-studio-batch', to: '/command/studio-batch', isActive: (tab) => tab === 'studio-batch' },
    ],
  },
  {
    labelKey: 'cmd-dom-knowledge',
    items: [
      { labelKey: 'cmd-tab-coach-lab', to: '/command/coach-lab', isActive: (tab) => tab === 'coach-lab' },
      { labelKey: 'cmd-tab-coach-cave', to: '/command/coach-cave', isActive: (tab) => tab === 'coach-cave' },
      { labelKey: 'cmd-tab-language', to: '/command/language', isActive: (tab) => tab === 'language' },
      { labelKey: 'cmd-tab-language-lab', to: '/command/language-lab', isActive: (tab) => tab === 'language-lab' },
    ],
  },
  {
    labelKey: 'cmd-dom-system',
    items: [
      { labelKey: 'vault-tab-generator', to: '/command/generator', isActive: (tab) => tab === 'generator' },
      { labelKey: 'vault-tab-settings', to: '/command/settings', isActive: (tab) => tab === 'settings' },
    ],
  },
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

        <nav className="bbf-sidebar-nav" aria-label={t('vault-command')}>
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} style={styles.navGroup}>
              <div style={styles.navGroupHead}>{t(group.labelKey)}</div>
              {group.items.map((item) => {
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
            </div>
          ))}
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
  navGroup: { display: 'flex', flexDirection: 'column', gap: '.15rem', marginBottom: '.9rem' },
  navGroupHead: {
    fontFamily: 'var(--hb)',
    fontSize: '.6rem',
    letterSpacing: '2.5px',
    textTransform: 'uppercase',
    color: 'var(--gold-deep)',
    padding: '0 .75rem .35rem',
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
  // Content Studio launcher — an <a> styled like a nav item but gold-tinted to read
  // as an external action (new tab), distinct from the router-driven nav tabs.
  navLaunch: { display: 'block', textDecoration: 'none', color: 'var(--gold-soft)' },
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
