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
// NO placeholder data: every rendered figure is the live native payload, the
// engine's computed protocol, or the athlete's stored ledger (mount fetch).
// Hook discipline: mount fetch sets state only from async callbacks (guarded by a
// cancelled flag); the sync pipeline runs in a useCallback handler — no effect
// loops. Aesthetic: LOCKED brand tokens (Bebas/Barlow, purple/gold) via vault CSS
// variables; matte-black is surface only.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useHealthConnectSync } from '../../lib/healthConnectSync.js';
import { PROTOCOL_UPDATED_EVENT } from '../../lib/useDailyReadiness.js';
import { runSovereignEngine } from '../../lib/bbf-readiness-engine';
import {
  mapRecoveryToBiometricDay,
  toProtocolRow,
  syncBiometricDay,
  logDailyProtocol,
  fetchBiometricLedger,
} from '../../lib/biometricsApi.js';
import './sovereignHub.css';

const GOVERNOR_KEY = 'bbf-sch-governor'; // 'manual' | 'auto'
const PLATFORM_KEY = 'bbf-sch-platform'; // 'android' | 'ios' | ''

// Execution-mode chrome: dictionary key + status class. Status colors are
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

export default function SovereignClientHub() {
  const { t } = useLang();
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

  // ── Ledger continuity: last stored state on mount (async-only setState) ──
  const [ledger, setLedger] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchBiometricLedger()
      .then((res) => { if (!cancelled && res && res.ok) setLedger(res); })
      .catch(() => { /* ledger optional on mount — sync still works */ });
    return () => { cancelled = true; };
  }, []);

  // ── The sync pipeline (Android path) ──
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [live, setLive] = useState(null); // { day, protocol }

  const handleSync = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      // 1 · Native read (+ legacy ACWR ingest dual-write inside the hook).
      const envelope = await sync();
      // 2 · Land the day on the biometric ledger → trailing 28-day series back.
      const day = mapRecoveryToBiometricDay(envelope.recovery);
      const up = await syncBiometricDay(day);
      if (!up || !up.ok) throw new Error(up && up.error ? `Ledger write failed — ${up.error}.` : 'Ledger write failed.');
      // 3 · Deterministic readiness verdict from REAL history.
      const protocol = runSovereignEngine(day, up.series || []);
      // 4 · Persist the protocol, then render.
      const logged = await logDailyProtocol(toProtocolRow(protocol));
      if (!logged || !logged.ok) throw new Error(logged && logged.error ? `Protocol log failed — ${logged.error}.` : 'Protocol log failed.');
      setLive({ day, protocol });
      // Broadcast the fresh verdict — Cardio / Nutrition / Program re-regulate
      // live off the shared useDailyReadiness channel, no reload.
      try {
        window.dispatchEvent(new CustomEvent(PROTOCOL_UPDATED_EVENT, { detail: { date: protocol.date } }));
      } catch { /* non-fatal */ }
    } catch (e) {
      setErr((e && e.message) || 'Synchronization failed.');
    } finally {
      setBusy(false);
    }
  }, [busy, sync]);

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

      {governor === 'manual' ? (
        /* ── MANUAL BASELINE — autonomous modulation offline ── */
        <div className="sch-card sch-manual">
          <div className="sch-manual-title">{t('sch-manual-title')}</div>
          <p className="sch-body">{t('sch-manual-body')}</p>
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

          {/* ── VERDICT — readiness, vitals, directives (real data only) ── */}
          {view ? (
            <div className="sch-results">
              <div className="sch-card sch-score-card">
                <div className="sch-label">{t('sch-readiness')}</div>
                <div className="sch-score-row">
                  <div className="sch-score" data-testid="sch-score">
                    {view.score === null || view.score === undefined ? '—' : fmt(view.score)}
                  </div>
                  {modeMeta ? (
                    <span className={`sch-mode sch-mode--${modeMeta.cls}`}>{t(modeMeta.tKey)}</span>
                  ) : null}
                </div>
              </div>

              {view.vitals ? (
                <div className="sch-card">
                  <div className="sch-label">{t('sch-vitals')}</div>
                  <div className="sch-vitals">
                    <div className="sch-vital">
                      <span className="sch-vital-v">{fmt(view.vitals.hrv_ms, 1)}</span>
                      <span className="sch-vital-k">{t('sch-hrv')} (ms)</span>
                    </div>
                    <div className="sch-vital">
                      <span className="sch-vital-v">{fmtSleep(view.vitals.sleep_minutes)}</span>
                      <span className="sch-vital-k">{t('sch-sleep')}</span>
                    </div>
                    <div className="sch-vital">
                      <span className="sch-vital-v">{fmt(view.vitals.active_calories_burned)}</span>
                      <span className="sch-vital-k">{t('sch-burn')} (kcal)</span>
                    </div>
                    <div className="sch-vital">
                      <span className="sch-vital-v">{fmt(view.vitals.daily_steps)}</span>
                      <span className="sch-vital-k">{t('sch-steps')}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="sch-card">
                <div className="sch-label">{t('sch-directives')}</div>

                <div className="sch-volume">
                  <span className="sch-volume-k">{t('sch-volume')}</span>
                  <span className="sch-volume-v">
                    {view.volume === null || view.volume === undefined ? '—' : `×${Number(view.volume).toFixed(2)}`}
                  </span>
                </div>

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
                  <ul className="sch-log">
                    {view.directives.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
