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

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { personalFor, personalReadiness } from '../../lib/personalTouches.js';
import { useHealthConnectSync } from '../../lib/healthConnectSync.js';
import { useBiometricLedger } from '../../lib/useDailyReadiness.js';
import { runVitalsPipeline, runManualVitalsPipeline, useVitalsSyncStatus } from '../../lib/vitalsPipeline.js';
import { saveManualBaseline, manualSubjective, useManualBaselineToday } from '../../lib/manualBaseline.js';
import { useProgramDay } from '../../lib/useProgramDay.js';
import MindsetIntercept from './MindsetIntercept.jsx';
import RecoveryPrescriptionCard from './RecoveryPrescriptionCard.jsx';
import SovereignBriefingCard from './SovereignBriefingCard.jsx';
import { SequenceNext } from './SovereignSequence.jsx';
import ContextualVoiceover from './ContextualVoiceover.jsx';
import { AUDIO_CTX_HUB_CHECKIN } from '../../lib/contextualVoiceover.js';
import './sovereignHub.css';

// Handshake diagnostic — its own chunk; only the Check-In tab ever pulls it in.
const HealthConnectStatus = lazy(() => import('./HealthConnectStatus.jsx'));

const GOVERNOR_KEY = 'bbf-sch-governor'; // 'manual' | 'auto'
const PLATFORM_KEY = 'bbf-sch-platform'; // 'android' | 'ios' | ''

// Execution-mode chrome: dictionary key + handshake channel. Channel colors are
// semantic dashboard state (like the dossier's risk verdicts), not brand marks.
const MODE_META = {
  PRIME_EXECUTION: { tKey: 'sch-mode-prime', cls: 'prime' },
  STANDARD_OPERATIONS: { tKey: 'sch-mode-standard', cls: 'standard' },
  SYSTEM_STRAIN: { tKey: 'sch-mode-strain', cls: 'strain' },
  SYSTEM_BREACH: { tKey: 'sch-mode-breach', cls: 'breach' },
  INSUFFICIENT_TELEMETRY: { tKey: 'sch-mode-insufficient', cls: 'none' },
};

function readPref(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode — non-fatal */ }
}

function hasVal(x) {
  return x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
}
function fmt(n, dp = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return dp ? v.toFixed(dp) : Math.round(v).toLocaleString();
}
function fmtSleep(min) {
  const v = Number(min);
  if (!Number.isFinite(v)) return '—';
  return `${Math.floor(v / 60)}h ${String(Math.round(v % 60)).padStart(2, '0')}m`;
}

// ── Readiness dial — the dossier centerpiece. Pure SVG arc; stroke rides the
// Agentic Handshake --mode-flag channel so the ring tints with the verdict. ──
const DIAL_R = 56;
const DIAL_C = 2 * Math.PI * DIAL_R;

function ReadinessDial({ score }) {
  const has = hasVal(score);
  const pct = has ? Math.min(100, Math.max(0, Number(score))) : 0;
  return (
    <div className={`sch-dial${has ? '' : ' is-void'}`}>
      <svg className="sch-dial-svg" viewBox="0 0 128 128" aria-hidden="true">
        <circle className="sch-dial-track" cx="64" cy="64" r={DIAL_R} />
        <circle
          className="sch-dial-fill"
          cx="64" cy="64" r={DIAL_R}
          strokeDasharray={`${((pct / 100) * DIAL_C).toFixed(2)} ${DIAL_C.toFixed(2)}`}
        />
      </svg>
      <div className="sch-dial-core">
        <span className="sch-score" data-testid="sch-score">{has ? fmt(score) : '—'}</span>
        <span className="sch-dial-cap">/ 100</span>
      </div>
    </div>
  );
}

export default function SovereignClientHub({ refreshKey = 0, onSequence, prescribedLoad = null }) {
  const { t } = useLang();
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';
  // Account-specific warm copy (gated by uid; null for everyone else).
  const personal = personalFor(uid);
  const { available: bridgeUp, syncing, sync } = useHealthConnectSync();
  // Squad schedule / Loop Breaker override state — feeds the Sovereign Briefing's
  // squad-intercept routing below (relocated here from the Hub tab).
  const program = useProgramDay();

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

  // ── Ledger continuity off the SHARED biometric store (no duplicate RPC) ──
  const { ledger: ledgerRes } = useBiometricLedger();
  const ledger = ledgerRes && ledgerRes.ok ? ledgerRes : null;

  // ── Launch-pull diagnostic: the auto force-pull's raw outcome (no longer
  // swallowed). Renders the EXACT native error so a permissions lock vs a plugin
  // desync vs a timeout is visible, not a silent fallback to the stale row. ──
  const syncStatus = useVitalsSyncStatus();

  // ── The sync pipeline (Android path) ──
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [live, setLive] = useState(null); // { day, protocol }

  const handleSync = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      // Shared Sovereign pipeline (native read → ledger → engine → protocol →
      // broadcast). Same orchestration the launch auto-pull runs — one source.
      const result = await runVitalsPipeline(sync);
      setLive(result);
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
  const [form, setForm] = useState({ sleep_hours: '', sleep_quality: 7, stress_level: 4, active_kcal: '', daily_steps: '' });
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
      const result = await runManualVitalsPipeline(record.recovery, manualSubjective(form));
      setLive(result);
      setSavedOk(true);
    } catch (e) {
      setManualErr((e && e.message) || 'Could not save your baseline.');
    } finally {
      setSavingBaseline(false);
    }
  }, [savingBaseline, uid, form]);

  // ── View-model: live result wins; else the stored ledger (real data only) ──
  const view = useMemo(() => {
    if (live) {
      const p = live.protocol;
      return {
        provenance: 'live',
        date: p.date,
        score: p.readiness_score,
        mode: p.mode,
        volume: p.training_volume_modifier,
        carb: p.carb_target_pct,
        fat: p.fat_target_pct,
        protein: p.protein_target_pct,
        cardio: p.cardio_directive,
        directives: p.directives,
        vitals: live.day,
      };
    }
    const lp = ledger && ledger.latest_protocol ? ledger.latest_protocol : null;
    const lb = ledger && Array.isArray(ledger.series) && ledger.series.length ? ledger.series[0] : null;
    if (!lp && !lb) return null;
    const log = (lp && lp.directive_log) || {};
    const carb = lp ? Number(lp.carb_target_pct) : NaN;
    const fat = lp ? Number(lp.fat_target_pct) : NaN;
    const protein = Number.isFinite(Number(log.protein_target_pct))
      ? Number(log.protein_target_pct)
      : (Number.isFinite(carb) && Number.isFinite(fat) ? 100 - carb - fat : null);
    return {
      provenance: 'ledger',
      date: (lp && lp.date) || (lb && lb.date) || null,
      score: lp ? lp.readiness_score : null,
      mode: log.mode || null,
      volume: lp ? lp.training_volume_modifier : null,
      carb: Number.isFinite(carb) ? carb : null,
      fat: Number.isFinite(fat) ? fat : null,
      protein,
      cardio: log.cardio || null,
      directives: Array.isArray(log.directives) ? log.directives : [],
      vitals: lb,
    };
  }, [live, ledger]);

  const modeMeta = (view && view.mode && MODE_META[view.mode]) || null;
  const working = busy || syncing;

  // Telemetry strip — the slots ALWAYS render once a verdict exists; a missing
  // vital ghosts its slot instead of collapsing the grid (null-integrity). CNS
  // pivot: the HRV slot is removed (the device never writes HRV to Health Connect);
  // Active Calories now pulls from the ledger, populated by Smart Cardio sync.
  const vitalSlots = view ? [
    { id: 'sleep', label: t('sch-sleep'), raw: view.vitals ? view.vitals.sleep_minutes : null, render: fmtSleep },
    { id: 'burn', label: `${t('sch-burn')} (kcal)`, raw: view.vitals ? view.vitals.active_calories_burned : null, render: (x) => fmt(x) },
    { id: 'steps', label: t('sch-steps'), raw: view.vitals ? view.vitals.daily_steps : null, render: (x) => fmt(x) },
  ] : [];

  return (
    <section className="sch" data-testid="sovereign-client-hub">
      <header className="sch-head">
        <div>
          <div className="sch-kicker">{t('sch-kicker')}</div>
          <h2 className="sch-title">{t('sch-title')}</h2>
        </div>
        {view ? (
          <span className={`sch-stamp${view.provenance === 'live' ? ' is-live' : ''}`}>
            {view.provenance === 'live' ? t('sch-stamp-live') : t('sch-stamp-ledger')}
            {view.date ? ` · ${view.date}` : ''}
          </span>
        ) : null}
      </header>

      {/* ── CONTEXTUAL VOICEOVER — Coach Akeem explains WHY the baseline check-in
          matters before any load is prescribed. Static clip, paused by default. ── */}
      <ContextualVoiceover
        audioKey={AUDIO_CTX_HUB_CHECKIN}
        testId="ctx-vo-hub-checkin"
        title={{ en: 'Start With Your Baseline', es: 'Empieza Por Tu Línea Base', pt: 'Comece Pela Sua Base' }}
        sub={{
          en: 'Why we capture sleep, stress and readiness before we prescribe a single rep.',
          es: 'Por qué capturamos sueño, estrés y preparación antes de prescribir una sola repetición.',
          pt: 'Por que capturamos sono, estresse e prontidão antes de prescrever uma única repetição.',
        }}
      />

      {/* ── PERSONAL DEDICATION — account-specific (gated); warm note over the chrome ── */}
      {personal && personal.dedication ? (
        <div className="sch-card" data-testid="sch-dedication" style={{ background: 'linear-gradient(180deg, rgba(106,13,173,.30), rgba(9,9,9,.25))', border: '1px solid rgba(245,200,0,.45)' }}>
          <div style={{ fontFamily: 'var(--hb,"Barlow Condensed")', fontSize: '.66rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#f5c800', marginBottom: 6 }}>♥ {personal.dedication.kicker}</div>
          <h3 style={{ fontFamily: 'var(--display,"Bebas Neue")', fontStyle: 'italic', fontSize: '1.5rem', lineHeight: 1.05, color: '#f9f5ff', margin: '0 0 10px' }}>{personal.dedication.title}</h3>
          {personal.dedication.lines.map((l, i) => (
            <p key={i} style={{ fontFamily: 'var(--bd,"Barlow Condensed")', fontSize: '.95rem', lineHeight: 1.5, color: 'rgba(255,255,255,.86)', margin: '0 0 7px' }}>{l}</p>
          ))}
          <p style={{ fontFamily: 'var(--bd,"Barlow Condensed")', fontSize: '.9rem', fontStyle: 'italic', color: '#f5c800', margin: '8px 0 0' }}>{personal.dedication.sign}</p>
        </div>
      ) : null}

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

            {/* End-of-day step count — the authoritative daily total. Entered here it
                OVERRIDES the wearable's running estimate for the day (never adds), and
                a blank value preserves whatever the autonomous sync already captured. */}
            <label className="sch-field">
              <span className="sch-field-k">{t('sch-mi-steps')}</span>
              <input
                type="number" min="0" max="200000" step="100" inputMode="numeric"
                className="sch-num" placeholder="8,000"
                value={form.daily_steps}
                onChange={(e) => setField('daily_steps', e.target.value)}
                data-testid="sch-mi-steps"
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

      {/* ── VERDICT — the Sovereign Dossier (shared by both governors: a manual
          baseline paints the SAME brief as a wearable sync) ── */}
      {view ? (
        <div className="sch-dossier" data-bbf-mode={modeMeta ? modeMeta.cls : 'none'}>
          {/* Column A — the verdict */}
          <div className="sch-card sch-verdict">
            <div className="sch-label">{t('sch-readiness')}</div>
            <ReadinessDial score={view.score} />
            {modeMeta ? (
              <span className={`sch-mode sch-mode--${modeMeta.cls}`}>{t(modeMeta.tKey)}</span>
            ) : null}
            {personal && view.mode ? (
              <p data-testid="sch-mom-readiness" style={{ fontFamily: 'var(--bd,"Barlow Condensed")', fontSize: '.92rem', lineHeight: 1.45, color: '#f5c800', margin: '8px 0 0', textAlign: 'center' }}>
                {personalReadiness(uid, view.mode)}
              </p>
            ) : null}
            <div className="sch-volume">
              <span className="sch-volume-k">{t('sch-volume')}</span>
              <span className="sch-volume-v">
                {view.volume === null || view.volume === undefined ? '—' : `×${Number(view.volume).toFixed(2)}`}
              </span>
            </div>
          </div>

          {/* Column B — telemetry + directives intel */}
          <div className="sch-intel">
            <div className="sch-card">
              <div className="sch-label">{t('sch-vitals')}</div>
              <div className="sch-vitals">
                {vitalSlots.map((s) => {
                  const has = hasVal(s.raw);
                  return (
                    <div key={s.id} className={`sch-vital${has ? '' : ' is-void'}`}>
                      <span className="sch-vital-v">{has ? s.render(s.raw) : '—'}</span>
                      <span className="sch-vital-k">{s.label}</span>
                      {!has ? <span className="sch-vital-void">{t('sch-no-signal')}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sch-card">
              <div className="sch-label">{t('sch-directives')}</div>

              {view.carb !== null && view.fat !== null && view.protein !== null ? (
                <div className="sch-macros">
                  <div className="sch-macro-bar" aria-hidden="true">
                    <span className="sch-macro-seg is-carb" style={{ width: `${view.carb}%` }} />
                    <span className="sch-macro-seg is-fat" style={{ width: `${view.fat}%` }} />
                    <span className="sch-macro-seg is-protein" style={{ width: `${view.protein}%` }} />
                  </div>
                  <div className="sch-macro-legend">
                    <span>{t('sch-carbs')} {fmt(view.carb)}%</span>
                    <span>{t('sch-fat')} {fmt(view.fat)}%</span>
                    <span>{t('sch-protein')} {fmt(view.protein)}%</span>
                  </div>
                </div>
              ) : null}

              {view.cardio ? (
                <div className="sch-cardio">
                  <span className="sch-cardio-k">{t('sch-cardio')}</span>
                  <span className="sch-cardio-v">{view.cardio}</span>
                </div>
              ) : null}

              {view.directives && view.directives.length ? (
                <ol className="sch-log">
                  {view.directives.map((d, i) => (
                    <li key={i}>
                      <span className="sch-log-idx" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                      {d}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>
        </div>
      ) : governor === 'auto' && platform !== 'ios' ? (
        /* ── AWAITING TELEMETRY — premium empty dossier, never a blank pane ── */
        <div className="sch-card sch-await" data-testid="sch-awaiting">
          <span className="sch-await-ring" aria-hidden="true" />
          <div className="sch-await-title">{t('sch-awaiting-title')}</div>
          <p className="sch-body">{t('sch-awaiting-body')}</p>
        </div>
      ) : null}

      {/* ── SOVEREIGN AUDIO — relocated from the Hub tab (CEO order): the briefing now
          "pops up" here, right after today's readiness verdict exists (a fresh save
          OR today's stored ledger), instead of sitting always-playable ahead of the
          check-in. The card self-gates on having real data (see SovereignBriefingCard),
          so this is a belt-and-suspenders `view` check for correct visual placement. ── */}
      {view ? (
        <SovereignBriefingCard
          overrideActive={program.isOverride}
          overrideRef={program.briefScriptReference}
          programLoad={prescribedLoad}
        />
      ) : null}

      {/* ── TODAY'S PRESCRIPTION — the actionable recovery protocol, sitting directly
          below the readiness / live-telemetry dossier. Self-fetches the latest
          engine-generated playlist; refreshKey bumps after a post-workout check-in. ── */}
      <RecoveryPrescriptionCard refreshKey={refreshKey} />

      {/* ── SOVEREIGN SEQUENCE · STEP 2 — surfaces once the baseline verdict exists
          (a fresh save OR today's stored ledger). Routes to RECOVERY (equipment-free
          prep), NOT the diagnostic Prehab. Adult-only (gated on onSequence). ── */}
      {view && onSequence ? (
        <SequenceNext label={t('svs-cta-2')} onClick={() => onSequence('recovery')} testid="sovereign-step-2" />
      ) : null}

      {/* ── HEALTH CONNECT STATUS — the zero-guess handshake diagnostic ── */}
      <Suspense fallback={null}>
        <HealthConnectStatus />
      </Suspense>
    </section>
  );
}
