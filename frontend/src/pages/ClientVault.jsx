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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useVaultProfile, selectPlans } from '../lib/vaultApi.js';
import VaultHeader from '../components/vault/VaultHeader.jsx';
import VaultHub from '../components/vault/VaultHub.jsx';
import Program from '../components/vault/Program.jsx';
import Nutrition from '../components/vault/Nutrition.jsx';
import Settings from '../components/vault/Settings.jsx';
import SmartCardio from '../components/vault/SmartCardio.jsx';
import Generator from '../components/vault/Generator.jsx';
import Prehab from '../components/vault/Prehab.jsx';
import '../components/vault/vault.css';

// `adminOnly` tabs are coach/CEO surfaces — they are filtered out of the nav AND
// their body is guarded below, so a standard athlete (e.g. Jacky, role 'client')
// can neither see the chip nor force the tab into view. The real write boundary is
// still server-side (the admin token on bbf-admin-roster); this is the UI gate.
const TABS = [
  { id: 'hub', label: 'Hub', icon: '▦' },
  { id: 'program', label: 'Program', icon: '▤' },
  { id: 'generator', label: 'Generator', icon: '✦', adminOnly: true, testid: 'vault-tab-generator' },
  { id: 'cardio', label: 'Smart Cardio', icon: '♥', testid: 'vault-tab-cardio' },
  { id: 'prehab', label: 'Prehab', icon: '✚', testid: 'vault-tab-prehab' },
  { id: 'nutrition', label: 'Nutrition', icon: '◆' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export default function ClientVault() {
  const { user, session, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  // Only admins ever see admin-only surfaces (the Generator). Non-admins get a nav
  // that doesn't contain the tab at all, so there's no chip to click and no id to
  // route to — and the body switch below double-gates it.
  const visibleTabs = useMemo(() => TABS.filter((t) => !t.adminOnly || isAdmin), [isAdmin]);

  // The login slug IS the profile key (bbf_get_profile_metrics resolves uid).
  const uid = user?.username || user?.id || '';
  const displayName = user?.displayName || 'Athlete';

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
          {/* Technical identity (slug) lives in the top bar; the friendly
              "Welcome, <Name>" greeting is owned by the Hub blueprint hero. */}
          <span className="cv-greet">@{user?.username || 'athlete'}</span>
          {/* Secure cross-over to the admin side — rendered only for the admin
              tier (akeem / coach / trainer). /command is AdminGuard-gated, so the
              toggle is a convenience, never the security boundary. */}
          {isAdmin ? (
            <button
              type="button"
              className="cv-command"
              onClick={() => navigate('/command')}
            >
              Command Center
            </button>
          ) : null}
          <button type="button" className="cv-signout" onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <div className="cv-container">
        {/* Persistent client-profile header — stays fixed above the nested nav on
            every tab (faithful to the AI Studio prototype). */}
        <VaultHeader
          profile={profile}
          plans={plans}
          displayName={displayName}
          slug={user?.username || ''}
          programKey={user?.programKey}
          isAdmin={isAdmin}
        />

        <nav className="cv-tabs" role="tablist" aria-label="Vault surfaces">
          {visibleTabs.map((t) => {
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id)}
                className={`cv-tab${active ? ' is-active' : ''}`}
                data-testid={t.testid}
              >
                {t.icon ? <span className="cv-tab-icon" aria-hidden="true">{t.icon}</span> : null}
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* key={activeTab} forces a clean unmount/remount per swap — no state can
            bleed between surfaces (same guard the Command Center uses). */}
        <div key={activeTab}>
          {activeTab === 'hub' && (
            <VaultHub
              profile={profile}
              isLoading={profileLoading}
              error={profileError}
            />
          )}
          {activeTab === 'program' && <Program plans={plans} profile={profile} />}
          {activeTab === 'generator' && isAdmin && <Generator />}
          {activeTab === 'cardio' && <SmartCardio />}
          {activeTab === 'prehab' && <Prehab />}
          {activeTab === 'nutrition' && <Nutrition plans={plans} profile={profile} />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </div>
    </div>
  );
}
