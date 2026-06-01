// src/pages/ClientVault.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 — Client Vault interior (THE authenticated athlete surface).
//
// Supersedes the Phase 12 holding card. When buildbelievefit.fitness runs on the
// React engine, authenticated NON-admin users (role client / athlete) land HERE.
// This is now the real tabbed Sovereign Vault, not a placeholder:
//
//   Hub       → personal dashboard (live profile metrics + consistency heatmap)
//   Program   → assigned training protocol (session.plans.workout_plan)
//   Nutrition → assigned fueling plan      (session.plans.meal_plan)
//
// Architecture: this shell owns the SINGLE fetch-on-land (useVaultProfile →
// bbf_get_profile_metrics RPC) and the plan envelope (selectPlans(session)), then
// passes both down. No tab re-fetches — one network read per landing. The tab
// pattern (segmented role=tablist, key=activeTab remount) mirrors the admin
// CommandCenter so the two surfaces stay visually and behaviorally consistent.
//
// Isolation: lives entirely within pages/ClientVault.jsx + components/vault/*; it
// imports only shared, read-only primitives. It never touches the public
// MarketingLanding route or the admin Command Center.

import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useVaultProfile, selectPlans } from '../lib/vaultApi.js';
import VaultHub from '../components/vault/VaultHub.jsx';
import Program from '../components/vault/Program.jsx';
import Nutrition from '../components/vault/Nutrition.jsx';

const TABS = [
  { id: 'hub', label: 'Hub' },
  { id: 'program', label: 'Program' },
  { id: 'nutrition', label: 'Nutrition' },
];

export default function ClientVault() {
  const { user, session, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  // The login slug IS the profile key (bbf_get_profile_metrics resolves uid).
  const uid = user?.username || user?.id || '';
  const who = user?.username ? `@${user.username}` : 'Athlete';

  // Single fetch-on-land; shared across every tab.
  const { data: profile, isLoading: profileLoading, error: profileError } = useVaultProfile(uid);
  const plans = useMemo(() => selectPlans(session), [session]);

  return (
    <div style={styles.screen}>
      <header style={styles.topbar}>
        <div style={styles.brand}>
          <span style={styles.logo}>
            BUILD BELIEVE <span style={{ color: 'var(--yel)' }}>FIT</span>
          </span>
          <span style={styles.kicker}>Sovereign Vault</span>
        </div>
        <div style={styles.who}>
          <span style={styles.greeting}>Welcome, {who}</span>
          <button type="button" style={styles.signout} onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <div style={styles.container}>
        <nav style={styles.tabs} role="tablist" aria-label="Vault surfaces">
          {TABS.map((t) => {
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id)}
                style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* key={activeTab} forces a clean unmount/remount per swap — no state can
            bleed between surfaces (same guard the Command Center uses). */}
        <div style={styles.panel} key={activeTab}>
          {activeTab === 'hub' && (
            <VaultHub profile={profile} isLoading={profileLoading} error={profileError} />
          )}
          {activeTab === 'program' && <Program plans={plans} profile={profile} />}
          {activeTab === 'nutrition' && <Nutrition plans={plans} profile={profile} />}
        </div>
      </div>
    </div>
  );
}

const styles = {
  screen: {
    minHeight: '100%',
    background: 'linear-gradient(180deg, var(--purp) 0%, var(--blk) 40%)',
    paddingBottom: 'calc(2rem + var(--sb))',
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: 'calc(1.1rem + var(--st)) 1.2rem 1.1rem',
    borderBottom: '1px solid var(--line)',
  },
  brand: { display: 'flex', flexDirection: 'column', gap: '.2rem' },
  logo: { fontFamily: 'var(--hb)', fontSize: '1.3rem', fontWeight: 900, letterSpacing: '3px' },
  kicker: {
    fontFamily: 'var(--hb)',
    fontSize: '.68rem',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: 'var(--gold-deep)',
  },
  who: { display: 'flex', alignItems: 'center', gap: '1rem' },
  greeting: { fontFamily: 'var(--bd)', fontSize: '.95rem', fontWeight: 700, color: 'var(--mut)' },
  signout: {
    fontFamily: 'var(--hb)',
    fontSize: '.74rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'var(--gold-soft)',
    background: 'none',
    border: '1px solid rgba(245,200,0,.3)',
    borderRadius: 10,
    padding: '.6rem .9rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  container: { maxWidth: 1100, margin: '0 auto', padding: '1.6rem 1.2rem 0' },
  tabs: {
    display: 'flex',
    gap: '.4rem',
    borderBottom: '1px solid var(--line)',
    marginBottom: '2rem',
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
