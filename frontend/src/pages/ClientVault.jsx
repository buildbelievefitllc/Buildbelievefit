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
import Settings from '../components/vault/Settings.jsx';
import SmartCardio from '../components/vault/SmartCardio.jsx';
import '../components/vault/vault.css';

const TABS = [
  { id: 'hub', label: 'Hub' },
  { id: 'program', label: 'Program' },
  { id: 'cardio', label: 'Smart Cardio' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'settings', label: 'Settings' },
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
    <div className="cv-screen">
      <header className="cv-topbar">
        <div className="cv-brand">
          <span className="cv-logo">BUILD BELIEVE <b>FIT</b></span>
          <span className="cv-kicker">Sovereign Vault</span>
        </div>
        <div className="cv-who">
          <span className="cv-greet">Welcome, {who}</span>
          <button type="button" className="cv-signout" onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <div className="cv-container">
        <nav className="cv-tabs" role="tablist" aria-label="Vault surfaces">
          {TABS.map((t) => {
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id)}
                className={`cv-tab${active ? ' is-active' : ''}`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* key={activeTab} forces a clean unmount/remount per swap — no state can
            bleed between surfaces (same guard the Command Center uses). */}
        <div key={activeTab}>
          {activeTab === 'hub' && (
            <VaultHub profile={profile} isLoading={profileLoading} error={profileError} />
          )}
          {activeTab === 'program' && <Program plans={plans} profile={profile} />}
          {activeTab === 'cardio' && <SmartCardio />}
          {activeTab === 'nutrition' && <Nutrition plans={plans} profile={profile} />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </div>
    </div>
  );
}
