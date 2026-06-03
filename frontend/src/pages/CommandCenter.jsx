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

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CommandRoster from '../components/command/CommandRoster.jsx';
import ClientHub from '../components/command/ClientHub.jsx';
import AccessControl from '../components/command/AccessControl.jsx';
import RiskTelemetry from '../components/command/RiskTelemetry.jsx';
import Comlink from '../components/command/Comlink.jsx';
import NutritionLocker from '../components/command/NutritionLocker.jsx';
import AdminLanguageRoadmap from '../components/command/AdminLanguageRoadmap.jsx';
import Settings from '../components/vault/Settings.jsx';
import Generator from '../components/vault/Generator.jsx';
import SportsPortal from '../components/sports/SportsPortal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { useVaultProfile, selectPlans } from '../lib/vaultApi.js';

// Command Center surfaces — the executive workspace ONLY. The personal client
// training tabs (Program · Prehab · client Nutrition) were purged from here: they
// belong exclusively to the Sovereign Client Vault and were cross-contaminating the
// admin view (CEO directive · Command Center Declutter).
//
// AUTH: every data-backed surface here authorizes server-side. With the Advanced
// Auth Elevation, the logged-in admin's SESSION token auto-unlocks them all (the
// edge functions validate it via _bbf_uid_from_vault_token + an admin-role check),
// so there is NO manual "paste admin token" step — the gate is gone.
const TABS = [
  // "Founder Five" master-detail roster is the Command Center centerpiece (default).
  { id: 'roster', labelKey: 'cmd-tab-roster', Panel: ClientHub },
  { id: 'command', labelKey: 'cmd-tab-command', Panel: CommandRoster },
  // Executive Access Control — tier visibility + reassignment + the account kill switch.
  { id: 'access', labelKey: 'cmd-tab-access', Panel: AccessControl },
  { id: 'telemetry', labelKey: 'cmd-tab-telemetry', Panel: RiskTelemetry },
  // Client Analytics no longer lives as a standalone surface — the 30/60/90-day
  // analytics + body composition now render INSIDE the Client Database Hub dossier,
  // scoped to the selected athlete (where their data actually lives).
  { id: 'comlink', labelKey: 'cmd-tab-comlink', Panel: Comlink },
  // Admin-only generative diet suite (Nutrition Locker) — targets another athlete.
  { id: 'nutrition-locker', labelKey: 'cmd-tab-nutrition-locker', Panel: NutritionLocker },
  // BBF Sports Portal & Athlete Database — live youth-athlete records.
  { id: 'sports', labelKey: 'cmd-tab-sports', Panel: SportsPortal },
  // Admin tools that remain in the executive workspace.
  { id: 'generator', labelKey: 'vault-tab-generator', Panel: Generator },
  { id: 'settings', labelKey: 'vault-tab-settings', Panel: Settings },
  // CEO-only Language Mastery Protocol. Static content (no token gate); the whole
  // /command route is AdminGuard-gated, so this tab never renders for an athlete.
  { id: 'language', labelKey: 'cmd-tab-language', Panel: AdminLanguageRoadmap },
];

const DEFAULT_TAB = TABS[0].id;

export default function CommandCenter() {
  // The URL segment is the source of truth for the active surface — deep-linkable,
  // and the left sidebar (MasterLayout) + the segmented tabs both push here so the
  // navigation is genuinely router-driven. Unknown / absent ⇒ the default roster.
  const { tab } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const activeDef = TABS.find((item) => item.id === tab) ?? TABS[0];
  const activeTab = activeDef.id;
  const ActivePanel = activeDef.Panel;

  const selectTab = (id) => navigate(id === DEFAULT_TAB ? '/command' : `/command/${id}`);

  // Player-Coach data: the admin's own plan envelope + profile metrics, sourced
  // exactly like the client Vault so Generator/Settings render identically. The
  // coaching panels ignore these extra props.
  const { user, session } = useAuth();
  const uid = user?.username || user?.id || '';
  const { data: profile } = useVaultProfile(uid);
  const plans = useMemo(() => selectPlans(session), [session]);

  return (
    <div style={styles.page}>
      {/* Slim brand strip — each tab owns its own hero heading (the Command tab
          renders the "SOVEREIGN COMMAND CENTER" header), so no duplicate title. */}
      <header style={styles.head}>
        <div style={styles.kicker}>{t('cmd-kicker')}</div>
      </header>

      <nav style={styles.tabs} role="tablist" aria-label="Command Center surfaces">
        {TABS.map((item) => {
          const active = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(item.id)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>

      {/* key={activeTab} forces a clean unmount/remount on every swap — no state
          can bleed between surfaces, and the swap is unambiguous. No token gate:
          the admin session authorizes every surface server-side. */}
      <div style={styles.panel} key={activeTab}>
        <ActivePanel plans={plans} profile={profile} />
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
