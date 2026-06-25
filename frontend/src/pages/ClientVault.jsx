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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import LangToggle from '../components/LangToggle.jsx';
import { useVaultProfile, selectPlans } from '../lib/vaultApi.js';
import { useVaultSessionGuard } from '../lib/sessionGuard.js';
import { useEntitlement } from '../lib/useEntitlement.js';
import { useCalibration } from '../lib/useCalibration.js';
import { useDailyReadiness, handshakeChannel } from '../lib/useDailyReadiness.js';
import { useAutoVitalsSync } from '../lib/vitalsPipeline.js';
import VaultHeader from '../components/vault/VaultHeader.jsx';
import VaultHub from '../components/vault/VaultHub.jsx';
import Program from '../components/vault/Program.jsx';
import Nutrition from '../components/vault/Nutrition.jsx';
import Settings from '../components/vault/Settings.jsx';
import SmartCardio from '../components/vault/SmartCardio.jsx';
import Generator from '../components/vault/Generator.jsx';
import Prehab from '../components/vault/Prehab.jsx';
import Recovery from '../components/vault/Recovery.jsx';
import ChampionMindset from '../components/vault/ChampionMindset.jsx';
import SovereignClientHub from '../components/vault/SovereignClientHub.jsx';
import PostWorkoutCheckInModal from '../components/vault/PostWorkoutCheckInModal.jsx';
import TierGate from '../components/TierGate.jsx';
import ComlinkFAB from '../components/vault/ComlinkFAB.jsx';
import Concierge from '../components/vault/Concierge.jsx';
import CalibrationGate from '../components/vault/CalibrationGate.jsx';
import CalibrationMilestones from '../components/vault/CalibrationMilestones.jsx';
import { TAB_FEATURE } from '../lib/entitlements.js';
import { SESSION_COMPLETE_EVENT } from '../lib/sessionFeedbackApi.js';
import { LockIcon } from '../components/vault/icons.jsx';
import '../components/vault/vault.css';

// Agentic Handshake impact classes: under SYSTEM_STRAIN / SYSTEM_BREACH the
// shell visually recedes the high-output surfaces and pulses the recovery
// protocols (pure CSS via [data-bbf-mode] — tabs stay fully clickable; the hard
// regulation already lives inside each surface via useDailyReadiness).
const TABS = [
  { id: 'hub', labelKey: 'vault-tab-hub', icon: '▦' },
  // Sovereign Auto-Regulation check-in (wearable sync → readiness protocol).
  // Gated on the Baseline 'readiness' feature (see TAB_FEATURE).
  { id: 'checkin', labelKey: 'vault-tab-checkin', icon: '◉', testid: 'vault-tab-checkin', impact: 'recovery' },
  { id: 'program', labelKey: 'vault-tab-program', icon: '▤', impact: 'high' },
  { id: 'generator', labelKey: 'vault-tab-generator', icon: '✦', impact: 'high' },
  { id: 'cardio', labelKey: 'vault-tab-cardio', icon: '♥', testid: 'vault-tab-cardio', impact: 'high' },
  { id: 'prehab', labelKey: 'vault-tab-prehab', icon: '✚', testid: 'vault-tab-prehab', impact: 'recovery' },
  { id: 'recovery', labelKey: 'vault-tab-recovery', icon: '❂', testid: 'vault-tab-recovery', impact: 'recovery' },
  { id: 'nutrition', labelKey: 'vault-tab-nutrition', icon: '◆' },
  // Champion Mindset is tier-gated by the Upsell Funnel: every Online Fitness tier,
  // Fuel Sovereign (top Online Nutrition), + God Mode unlock it; lower Nutrition +
  // Youth see the UpgradeOverlay. See lib/entitlements.js.
  { id: 'mindset', labelKey: 'vault-tab-mindset', icon: '❖', testid: 'vault-tab-mindset' },
  { id: 'settings', labelKey: 'vault-tab-settings', icon: '⚙' },
];

// Mode → trilingual chip label (shares the Check-In hub's dictionary keys).
const MODE_TKEY = {
  PRIME_EXECUTION: 'sch-mode-prime',
  STANDARD_OPERATIONS: 'sch-mode-standard',
  SYSTEM_STRAIN: 'sch-mode-strain',
  SYSTEM_BREACH: 'sch-mode-breach',
  INSUFFICIENT_TELEMETRY: 'sch-mode-insufficient',
};

export default function ClientVault() {
  const { user, session, signOut, isAdmin } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  // Post-Workout Check-In — opened by a SESSION_COMPLETE_EVENT dispatched from the
  // workout loggers (FloorLogger exit-with-work / SmartCardio "Complete & Sync").
  // On success it bumps checkInRefresh, which the Check-In hub's
  // RecoveryPrescriptionCard reads to refetch the freshly generated playlist.
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInRefresh, setCheckInRefresh] = useState(0);
  useEffect(() => {
    const onSessionComplete = () => setCheckInOpen(true);
    window.addEventListener(SESSION_COMPLETE_EVENT, onSessionComplete);
    return () => window.removeEventListener(SESSION_COMPLETE_EVENT, onSessionComplete);
  }, []);

  // Kill-switch enforcement: if the CEO locks this account from the Command Center,
  // the athlete's vault_token is revoked server-side; this heartbeat detects it and
  // ejects to /login. No-op for admins (never lockable) and fails safe on a blip.
  useVaultSessionGuard();

  // Vault Upsell Funnel — resolve the athlete's live subscription tier → which tabs
  // unlock. Every tab stays VISIBLE; a locked tab swaps its body for the
  // UpgradeOverlay (visibility as a sales tool). Fail-open: admins / active trial /
  // any unresolved tier read as full access, so a payer is never falsely padlocked.
  const ent = useEntitlement();
  // 30-Day Biometric Calibration — the orthogonal TIME gate layered over the tier
  // funnel. Same fail-open doctrine: graduated / undatable athletes read as full access.
  const cal = useCalibration();
  const activeMeta = TABS.find((tab) => tab.id === activeTab);

  // The login slug IS the profile key (bbf_get_profile_metrics resolves uid).
  const uid = user?.username || user?.id || '';
  const displayName = user?.displayName || 'Athlete';

  // Single fetch-on-land; shared across every tab.
  const { data: profile, isLoading: profileLoading, error: profileError } = useVaultProfile(uid);
  const plans = useMemo(() => selectPlans(session), [session]);

  // Agentic Handshake — the day's verdict (off the shared biometric store, same
  // payload the Check-In / Cardio / Nutrition / Program surfaces consume) drives
  // the [data-bbf-mode] channel: the screen's ambient glow, the topbar edge, the
  // readiness beacon, and the tab-rail emphasis all morph with the athlete's
  // computed mode. No usable telemetry → 'none' → the neutral interface.
  const { data: readiness } = useDailyReadiness();
  const handshake = handshakeChannel(readiness);

  // Stable navigate handler for the Active Directive's gate buttons — stable
  // identity keeps the memoized VaultHeader from re-painting on tab swaps.
  const onNavigate = useCallback((id) => setActiveTab(id), []);

  // Launch force-pull (desync kill): inside the BBF Lab app, read LIVE Health
  // Connect data on Vault open and land it on the ledger — the watch, not a
  // stale morning row, is the source of truth the handshake reacts to. No-op on
  // web; silent on failure; once per app session.
  useAutoVitalsSync();

  return (
    <div className="cv-screen" data-bbf-mode={handshake}>
      <header className="cv-topbar">
        <div className="cv-brand">
          <span className="cv-logo">BUILD BELIEVE <b>FIT</b></span>
          <span className="cv-kicker">{t('vault-kicker')}</span>
        </div>
        <div className="cv-who">
          {/* Readiness beacon — the living pulse of the Agentic Handshake. Renders
              only on a real same-window verdict; never invents a score. */}
          {readiness?.hasData && readiness.mode ? (
            <span
              className="cv-beacon"
              title={t('sch-readiness')}
              data-testid="cv-readiness-beacon"
            >
              <span className="cv-beacon-dot" aria-hidden="true" />
              <span className="cv-beacon-score">{readiness.score ?? '—'}</span>
              <span className="cv-beacon-mode">{t(MODE_TKEY[readiness.mode] || 'sch-mode-insufficient')}</span>
            </span>
          ) : null}
          {/* Technical identity (slug) lives in the top bar; the friendly
              "Welcome, <Name>" greeting is owned by the Hub blueprint hero. */}
          <span className="cv-greet">@{user?.username || 'athlete'}</span>
          {/* Global EN · ES · PT switcher — always reachable to the authenticated
              athlete, sat beside the cross-over / session controls. Shares the
              same LangContext the public landing uses, so the language the visitor
              picked persists straight through the login gate. */}
          <LangToggle />
          {/* Secure cross-over to the admin side — rendered only for the admin
              tier (akeem / coach / trainer). /command is AdminGuard-gated, so the
              toggle is a convenience, never the security boundary. */}
          {isAdmin ? (
            <button
              type="button"
              className="cv-command"
              onClick={() => navigate('/command')}
            >
              {t('vault-command')}
            </button>
          ) : null}
          <button type="button" className="cv-signout" onClick={signOut}>{t('shell-signout')}</button>
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
          readiness={readiness}
          onNavigate={onNavigate}
        />

        <nav className="cv-tabs" role="tablist" aria-label="Vault surfaces">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            // Padlocked tabs stay clickable — the click IS the upsell (it swaps the
            // pane for the UpgradeOverlay). The lock glyph is aria-hidden so the
            // tab's accessible name stays the plain label (keeps E2E role selectors green).
            const locked = !ent.canAccessTab(tab.id) || cal.isTabCalibrationLocked(tab.id);
            const impact = tab.impact ? ` is-impact-${tab.impact}` : '';
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`cv-tab${active ? ' is-active' : ''}${locked ? ' is-locked' : ''}${impact}`}
                data-testid={tab.testid}
              >
                {tab.icon ? <span className="cv-tab-icon" aria-hidden="true">{tab.icon}</span> : null}
                {t(tab.labelKey)}
                {locked ? <LockIcon className="cv-tab-lock" /> : null}
              </button>
            );
          })}
        </nav>

        {/* key={activeTab} forces a clean unmount/remount per swap — no state can
            bleed between surfaces (same guard the Command Center uses). */}
        <div key={activeTab}>
          {/* Phase 2: per-feature gating via the declarative <TierGate> primitive.
              hub/settings map to a null feature (never gated); the rest gate on
              TAB_FEATURE and fail-open while the tier resolves (never padlock a payer). */}
          <TierGate
            feature={TAB_FEATURE[activeTab]}
            featureLabelKey={activeMeta?.labelKey}
            testId="vault-upgrade-overlay"
          >
            {/* 30-Day Calibration TIME gate — nested INSIDE TierGate so a tier paywall
                always wins; a tier-owned-but-still-calibrating surface (Smart Cardio →
                Day 15, the Library/Generator → Day 30) shows the CalibrationLock pane. */}
            <CalibrationGate tabId={activeTab} featureLabelKey={activeMeta?.labelKey}>
              {activeTab === 'hub' && (
                <VaultHub
                  profile={profile}
                  isLoading={profileLoading}
                  error={profileError}
                  onSequence={onNavigate}
                />
              )}
              {activeTab === 'checkin' && <SovereignClientHub refreshKey={checkInRefresh} onSequence={onNavigate} />}
              {activeTab === 'program' && <Program plans={plans} profile={profile} onSequence={onNavigate} />}
              {activeTab === 'generator' && <Generator onRevertToLibrary={() => setActiveTab('program')} />}
              {activeTab === 'cardio' && <SmartCardio />}
              {activeTab === 'prehab' && <Prehab onSequence={onNavigate} />}
              {activeTab === 'recovery' && <Recovery plans={plans} onSequence={onNavigate} />}
              {activeTab === 'nutrition' && <Nutrition plans={plans} profile={profile} />}
              {activeTab === 'mindset' && <ChampionMindset />}
              {activeTab === 'settings' && <Settings />}
            </CalibrationGate>
          </TierGate>
        </div>
      </div>
      {/* Phase 2: Sovereign Comlink FAB — granularly gated (sovereign_comlink → God Tier). */}
      <ComlinkFAB />
      {/* Self-Serve Concierge — first-login welcome that lists EXACTLY the band's
          unlocked tools (server-enforced, no mirages). Self-gates + fires once. */}
      <Concierge />
      {/* 30-Day Calibration — one-time Day-15 toast + Day-30 graduation overlay.
          Shell-level so it overlays any tab; self-gates + fires once per athlete. */}
      <CalibrationMilestones />
      {/* Post-Workout Check-In — shell-level so it overlays any tab the instant a
          session completes; feeds the Dynamic Prescription engine. */}
      <PostWorkoutCheckInModal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onSuccess={() => { setCheckInOpen(false); setCheckInRefresh((n) => n + 1); }}
      />
    </div>
  );
}
