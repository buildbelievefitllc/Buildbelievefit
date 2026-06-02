// src/pages/CommandCenter.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Command Center: the authenticated home surface. A sub-navigation
// (segmented tabs) switches between the three administrative surfaces the live
// monolith groups here:
//
//   Client Hub      → Roster (secure service-role)
//   Risk Telemetry  → Sovereign Panopticon (ACWR injury-risk grid)
//   Comlink         → Concierge + incoming leads + SOS queue
//
// State is local (`activeTab`); no routing per-tab yet.
//
// Phase 21.2 — "Player-Coach". The CEO trains on the platform himself, so the
// admin surface now also carries the client training tabs (Program, Nutrition,
// Settings) alongside the coaching consoles. These reuse the exact Vault
// components and the same auth-session data source (selectPlans + useVaultProfile),
// so the admin's own training view stays 1:1 with what a client sees.

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CommandRoster from '../components/command/CommandRoster.jsx';
import ClientHub from '../components/command/ClientHub.jsx';
import RiskTelemetry from '../components/command/RiskTelemetry.jsx';
import ClientAnalytics from '../components/command/ClientAnalytics.jsx';
import Comlink from '../components/command/Comlink.jsx';
import AdminTokenGate from '../components/command/AdminTokenGate.jsx';
import Program from '../components/vault/Program.jsx';
import Nutrition from '../components/vault/Nutrition.jsx';
import Settings from '../components/vault/Settings.jsx';
import Generator from '../components/vault/Generator.jsx';
import Prehab from '../components/vault/Prehab.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useVaultProfile, selectPlans } from '../lib/vaultApi.js';
import { hasAdminToken } from '../lib/adminAuth.js';

// `needsToken` marks the surfaces whose data path gates on the X-BBF-Admin-Token
// server-side: the roster (bbf-admin-roster), the Command feed (bbf-command-feed),
// the Comlink (Render leads/concierge), Analytics (its client dropdown reuses the
// roster), and Risk Telemetry (its bbf_users roster now reads through the service
// role, not anon — see telemetryApi). Only the Player-Coach training tabs (the
// admin's own vault session) render directly.
const TABS = [
  // "Founder Five" master-detail roster is the Command Center centerpiece (default).
  { id: 'roster', label: 'Founder Five', Panel: ClientHub, needsToken: true },
  { id: 'command', label: 'Command', Panel: CommandRoster, needsToken: true },
  { id: 'telemetry', label: 'Risk Telemetry', Panel: RiskTelemetry, needsToken: true },
  { id: 'analytics', label: 'Analytics', Panel: ClientAnalytics, needsToken: true },
  { id: 'comlink', label: 'Comlink', Panel: Comlink, needsToken: true },
  // Player-Coach surfaces — the admin's own training view.
  { id: 'program', label: 'Program', Panel: Program },
  { id: 'generator', label: 'Generator', Panel: Generator },
  { id: 'prehab', label: 'Prehab', Panel: Prehab },
  { id: 'nutrition', label: 'Nutrition', Panel: Nutrition },
  { id: 'settings', label: 'Settings', Panel: Settings },
];

const DEFAULT_TAB = TABS[0].id;

export default function CommandCenter() {
  // The URL segment is the source of truth for the active surface — deep-linkable,
  // and the left sidebar (MasterLayout) + the segmented tabs both push here so the
  // navigation is genuinely router-driven. Unknown / absent ⇒ the default roster.
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeDef = TABS.find((t) => t.id === tab) ?? TABS[0];
  const activeTab = activeDef.id;
  const ActivePanel = activeDef.Panel;

  const selectTab = (id) => navigate(id === DEFAULT_TAB ? '/command' : `/command/${id}`);

  // Admin-token hydration. hasAdminToken() reads the runtime store (window global /
  // sessionStorage) at mount, so a deploy that injects the token never shows the
  // gate; otherwise the unlock gate flips this true for the token-gated tabs.
  const [tokenReady, setTokenReady] = useState(hasAdminToken);

  // Player-Coach data: the admin's own plan envelope + profile metrics, sourced
  // exactly like the client Vault so Program/Nutrition render identically. The
  // coaching panels ignore these extra props.
  const { user, session } = useAuth();
  const uid = user?.username || user?.id || '';
  const { data: profile } = useVaultProfile(uid);
  const plans = useMemo(() => selectPlans(session), [session]);

  const gated = activeDef.needsToken && !tokenReady;

  return (
    <div style={styles.page}>
      {/* Slim brand strip — each tab owns its own hero heading (the Command tab
          renders the "SOVEREIGN COMMAND CENTER" header), so no duplicate title. */}
      <header style={styles.head}>
        <div style={styles.kicker}>Build Believe Fit · Admin</div>
      </header>

      <nav style={styles.tabs} role="tablist" aria-label="Command Center surfaces">
        {TABS.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* key={activeTab} forces a clean unmount/remount on every swap — no state
          can bleed between surfaces, and the swap is unambiguous. A token-gated
          surface shows the unlock gate until the admin token is hydrated. */}
      <div style={styles.panel} key={activeTab}>
        {gated ? (
          <AdminTokenGate surface={activeDef.label} onUnlock={() => setTokenReady(true)} />
        ) : (
          <ActivePanel plans={plans} profile={profile} />
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 1100 },
  head: { marginBottom: '1.5rem' },
  kicker: {
    fontFamily: 'var(--hb)',
    fontSize: '.7rem',
    letterSpacing: '4px',
    textTransform: 'uppercase',
    color: 'var(--gold-deep)',
    marginBottom: '.35rem',
  },
  title: { fontFamily: 'var(--display)', fontSize: '2.6rem', letterSpacing: '1px', margin: 0 },
  tabs: {
    display: 'flex',
    gap: '.4rem',
    borderBottom: '1px solid var(--line)',
    marginBottom: '2rem',
    // Horizontally scrollable so the full tab set stays reachable on a narrow
    // (mobile) column instead of overflowing off-screen — the Phase 9.5 defect.
    overflowX: 'auto',
    flexWrap: 'nowrap',
    WebkitOverflowScrolling: 'touch',
  },
  tab: {
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--hb)',
    fontSize: '.82rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'rgba(249,245,255,.55)',
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    padding: '.7rem 1rem',
    marginBottom: '-1px',
    cursor: 'pointer',
    transition: 'color .15s ease, border-color .15s ease',
  },
  tabActive: { color: 'var(--wht)', borderBottomColor: 'var(--yel)' },
  panel: {},
};
