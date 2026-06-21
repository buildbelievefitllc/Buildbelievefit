// src/components/vault/SovereignClientHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Client Hub — the daily auto-regulation check-in (Vault "Check-In" tab).
//
// State machine (CEO order, Sovereign Auto-Regulation Engine):
//   TACO SWITCH   — master input governor: Manual Baseline ⇄ Autonomous Wearable Sync
//   PLATFORM GATE — under Autonomous: Android/Samsung (LIVE) vs iOS/Apple (locked)
//   iOS           — premium "Deployment Pending" lock; no active sync path
//   ANDROID       — "Synchronize Vitals" → useHealthConnectSync (native bridge +
//                   legacy bbf-wearable-ingest dual-write) → raw recovery payload →
//                   bbf_upsert_daily_biometrics (returns trailing series) →
//                   runSovereignEngine (deterministic, client-side) →
//                   bbf_log_daily_protocol → render score / vitals / directives.
//
// MATERIAL UPGRADE (Sovereign Dossier): the verdict renders as an asymmetric
// intelligence brief — readiness dial (SVG arc, mode-tinted) on the verdict
// column, telemetry strip + directive log on the intel column. The whole dossier
// carries the [data-bbf-mode] Agentic Handshake channel, so its ambient chrome
// morphs with the computed mode. Null-integrity: the four vital slots ALWAYS
// render — a missed sync window ghosts the slot ("No Signal") instead of
// collapsing the layout. No placeholder data: every figure is the live native
// payload, the engine's protocol, or the stored ledger.
//
// Hook discipline: the mount ledger read comes off the SHARED biometric store
// (useBiometricLedger — same payload Smart Cardio / Nutrition / Program consume,
// zero duplicate RPCs); the sync pipeline runs in a useCallback handler — no
// effect loops. Aesthetic: LOCKED brand tokens (Bebas/Barlow, purple/gold) via
// vault CSS variables; the void palette is surface only.

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useHealthConnectSync } from '../../lib/healthConnectSync.js';
import { runVitalsPipeline, runManualVitalsPipeline, useVitalsSyncStatus } from '../../lib/vitalsPipeline.js';
import { saveManualBaseline, manualSubjective, useManualBaselineToday } from '../../lib/manualBaseline.js';
import MindsetIntercept from './MindsetIntercept.jsx';
import RecoveryPrescriptionCard from './RecoveryPrescriptionCard.jsx';
import './sovereignHub.css';

// Handshake diagnostic — its own chunk; only the Check-In tab ever pulls it in.
const HealthConnectStatus = lazy(() => import('./HealthConnectStatus.jsx'));

const GOVERNOR_KEY = 'bbf-sch-governor'; // 'manual' | 'auto'
const PLATFORM_KEY = 'bbf-sch-platform'; // 'android' | 'ios' | ''


function readPref(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode — non-fatal */ }
}



export default function SovereignClientHub({ refreshKey = 0 }) {
  const { t } = useLang();
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';
  const { available: bridgeUp, syncing, sync } = useHealthConnectSync();

  // ── Governor + platform (persisted; lazy init keeps reads out of render churn) ──
  const [governor, setGovernor] = useState(() => readPref(GOVERNOR_KEY, ['manual', 'auto'], 'manual'));
  const [platform, setPlatform] = useState(() => readPref(PLATFORM_KEY, ['android', 'ios'], ''));

  const pickGovernor = useCallback((mode) => {
    setGovernor(mode);
    writePref(GOVERNOR_KEY, mode);
  }, []);
  const pickPlatform = useCallback((p) => {
    setPlatform(p);
    writePref(PLATFORM_KEY, p);
  }, []);

  // ── Launch-pull diagnostic: the auto force-pull's raw outcome (no longer
  // swallowed). Renders the EXACT native error so a permissions lock vs a plugin
  // desync vs a timeout is visible, not a silent fallback to the stale row. ──
  const syncStatus = useVitalsSyncStatus();

  // ── The sync pipeline (Android path) ──
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleSync = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      // Shared Sovereign pipeline (native read → ledger → engine → protocol →
      // broadcast). Same orchestration the launch auto-pull runs — one source.
      await runVitalsPipeline(sync);
    } catch (e) {
      setErr((e && e.message) || 'Synchronization failed.');
    } finally {
      setBusy(false);
    }
  }, [busy, sync]);

  // ── Manual Health Input (governor = manual) ──────────────────────────────────
  // A subjective baseline the athlete types in: it writes to Dexie (bbf_floor_v1)
  // AND runs the SAME pipeline a wearable read uses, so the engine scores it with
  // equal validity and the dossier paints a live verdict immediately.
  const savedBaseline = useManualBaselineToday(uid);
  const [form, setForm] = useState({ sleep_hours: '', sleep_quality: 7, stress_level: 4, active_kcal: '' });
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [manualErr, setManualErr] = useState(null);
  const hydrated = useRef(false);

  // Re-populate the form ONCE from today's stored baseline — never clobber typing.
  useEffect(() => {
    if (hydrated.current || !savedBaseline) return;
    hydrated.current = true;
    setForm({
      sleep_hours: savedBaseline.sleep_hours ?? '',
      sleep_quality: savedBaseline.sleep_quality ?? 7,
      stress_level: savedBaseline.stress_level ?? 4,
      active_kcal: savedBaseline.active_kcal ?? '',
    });
  }, [savedBaseline]);

  const setField = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedOk(false);
  }, []);

  const handleSaveBaseline = useCallback(async () => {
    if (savingBaseline) return;
    setSavingBaseline(true);
    setManualErr(null);
    try {
      // 1 · Local-first write to Dexie (bbf_floor_v1) — the row carries a recovery
      //     snapshot in the EXACT shape the Health Connect bridge emits.
      const record = await saveManualBaseline(uid, form);
      // 2 · Same pipeline as a wearable sync → ledger → engine → protocol → broadcast.
      await runManualVitalsPipeline(record.recovery, manualSubjective(form));
      setSavedOk(true);
    } catch (e) {
      setManualErr((e && e.message) || 'Could not save your baseline.');
    } finally {
      setSavingBaseline(false);
    }
  }, [savingBaseline, uid, form]);


  const working = busy || syncing;

  return (
    <section className="sch" data-testid="sovereign-client-hub">
      <header className="sch-head">
        <div>
          <div className="sch-kicker">{t('sch-kicker')}</div>
          <h2 className="sch-title">{t('sch-title')}</h2>
        </div>
        {savedOk ? (
          <span className="sch-stamp is-live">{t('sch-stamp-live')}</span>
        ) : null}
      </header>

      {/* ── LAUNCH SYNC DIAGNOSTIC — surfaces the auto force-pull's raw failure ── */}
      {syncStatus.state === 'error' && syncStatus.error ? (
        <div className="sch-diag" role="alert" data-testid="sch-sync-diag">
          <div className="sch-diag-top">
            <span className="sch-diag-glyph" aria-hidden="true">⚠</span>
            <span className="sch-diag-title">
              {t('sch-diag-title')}
              {syncStatus.source === 'launch' ? ` · ${t('sch-diag-launch')}` : ''}
            </span>
          </div>
          <code className="sch-diag-raw">{syncStatus.error}</code>
          <p className="sch-diag-hint">{t('sch-diag-hint')}</p>
        </div>
      ) : null}

      {/* ── TACO SWITCH — master input governor ── */}
      <div className="sch-card">
        <div className="sch-label">{t('sch-governor')}</div>
        <div className="sch-switch" role="group" aria-label={t('sch-governor')}>
          <button
            type="button"
            aria-pressed={governor === 'manual'}
            className={`sch-seg${governor === 'manual' ? ' is-on' : ''}`}
            onClick={() => pickGovernor('manual')}
            data-testid="sch-governor-manual"
          >
            {t('sch-gov-manual')}
          </button>
          <button
            type="button"
            aria-pressed={governor === 'auto'}
            className={`sch-seg${governor === 'auto' ? ' is-on' : ''}`}
            onClick={() => pickGovernor('auto')}
            data-testid="sch-governor-auto"
          >
            {t('sch-gov-auto')}
          </button>
        </div>
      </div>

      {/* ── DYNAMIC MINDSET INTERCEPT — self-gates on readiness; auto-mounts the
          Champion Mindset player when the day's verdict is below optimal. ── */}
      <MindsetIntercept />

      {governor === 'manual' ? (
        /* ── MANUAL HEALTH INPUT — subjective baseline override ── */
        <div className="sch-card sch-manual" data-testid="sch-manual-input">
          <div className="sch-manual-title">{t('sch-mi-title')}</div>
          <p className="sch-body">{t('sch-mi-intro')}</p>

          <div className="sch-mi-grid">
            {/* Sleep duration (hours) */}
            <label className="sch-field">
              <span className="sch-field-k">{t('sch-mi-sleep-h')}</span>
              <input
                type="number" min="0" max="24" step="0.5" inputMode="decimal"
                className="sch-num" placeholder="7.5"
                value={form.sleep_hours}
                onChange={(e) => setField('sleep_hours', e.target.value)}
                data-testid="sch-mi-sleep-h"
              />
            </label>

            {/* Active calorie burn (kcal) */}
            <label className="sch-field">
              <span className="sch-field-k">{t('sch-mi-burn')}</span>
              <input
                type="number" min="0" max="20000" step="10" inputMode="numeric"
                className="sch-num" placeholder="350"
                value={form.active_kcal}
                onChange={(e) => setField('active_kcal', e.target.value)}
                data-testid="sch-mi-burn"
              />
            </label>

            {/* Sleep quality 1–10 */}
            <label className="sch-field sch-field--range">
              <span className="sch-field-k">
                {t('sch-mi-sleep-q')} <span className="sch-field-val">{form.sleep_quality}/10</span>
              </span>
              <input
                type="range" min="1" max="10" step="1" className="sch-range"
                value={form.sleep_quality}
                onChange={(e) => setField('sleep_quality', Number(e.target.value))}
                aria-valuetext={`${form.sleep_quality} / 10`}
                data-testid="sch-mi-sleep-q"
              />
            </label>

            {/* Subjective stress 1–10 */}
            <label className="sch-field sch-field--range">
              <span className="sch-field-k">
                {t('sch-mi-stress')} <span className="sch-field-val">{form.stress_level}/10</span>
              </span>
              <input
                type="range" min="1" max="10" step="1" className="sch-range"
                value={form.stress_level}
                onChange={(e) => setField('stress_level', Number(e.target.value))}
                aria-valuetext={`${form.stress_level} / 10`}
                data-testid="sch-mi-stress"
              />
            </label>
          </div>

          <button
            type="button"
            className={`sch-save${savingBaseline ? ' is-working' : ''}`}
            onClick={handleSaveBaseline}
            disabled={savingBaseline}
            data-testid="sch-mi-save"
          >
            {savingBaseline ? t('sch-mi-saving') : t('sch-mi-save')}
          </button>
          {savedOk ? <div className="sch-mi-ok" role="status" data-testid="sch-mi-ok">{t('sch-mi-saved')}</div> : null}
          {manualErr ? <div className="sch-error" role="alert">{manualErr}</div> : null}
          <p className="sch-mi-hint">{t('sch-mi-hint')}</p>
        </div>
      ) : (
        <>
          {/* ── PLATFORM GATE ── */}
          <div className="sch-card">
            <div className="sch-label">{t('sch-platform')}</div>
            <div className="sch-platforms" role="group" aria-label={t('sch-platform')}>
              <button
                type="button"
                aria-pressed={platform === 'android'}
                className={`sch-plat${platform === 'android' ? ' is-on' : ''}`}
                onClick={() => pickPlatform('android')}
                data-testid="sch-platform-android"
              >
                <span className="sch-plat-name">Android / Samsung</span>
                <span className="sch-plat-sub is-live">{t('sch-conduit-live')}</span>
              </button>
              <button
                type="button"
                aria-pressed={platform === 'ios'}
                className={`sch-plat${platform === 'ios' ? ' is-on' : ''}`}
                onClick={() => pickPlatform('ios')}
                data-testid="sch-platform-ios"
              >
                <span className="sch-plat-name">iOS / Apple</span>
                <span className="sch-plat-sub">{t('sch-conduit-pending')}</span>
              </button>
            </div>
          </div>

          {platform === 'ios' ? (
            /* ── iOS — premium locked state, no active sync path ── */
            <div className="sch-card sch-ios" aria-disabled="true" data-testid="sch-ios-pending">
              <div className="sch-ios-glyph" aria-hidden="true">◈</div>
              <div className="sch-ios-title">{t('sch-ios-title')}</div>
              <p className="sch-body">{t('sch-ios-body')}</p>
            </div>
          ) : null}

          {platform === 'android' ? (
            /* ── ANDROID — the live conduit ── */
            <div className="sch-card sch-android">
              <button
                type="button"
                className={`sch-sync${working ? ' is-working' : ''}`}
                onClick={handleSync}
                disabled={working}
                data-testid="sch-sync-btn"
              >
                {working ? t('sch-syncing') : t('sch-sync')}
              </button>
              {!bridgeUp ? <div className="sch-note">{t('sch-bridge-note')}</div> : null}
              {err ? <div className="sch-error" role="alert">{err}</div> : null}
            </div>
          ) : null}

        </>
      )}

      {/* ── VERDICT — the Sovereign Dossier. Adults don't see it here — their
          readiness flows silently to Program / Cardio / Prehab via the shared
          biometric store. The explicit readiness dashboard lives only in the
          Sports Portal (SportsHub ReadinessBanner) for youth athletes. ── */}

      {/* ── TODAY'S PRESCRIPTION — clinical sports-science playlist; youth athletes
          only (user.sportsProfile non-null). Adult lifestyle clients use the
          manual volume directives above; the prescription engine is sport-specific. ── */}
      {user?.sportsProfile ? <RecoveryPrescriptionCard refreshKey={refreshKey} /> : null}

      {/* ── HEALTH CONNECT STATUS — the zero-guess handshake diagnostic ── */}
      <Suspense fallback={null}>
        <HealthConnectStatus />
      </Suspense>
    </section>
  );
}
