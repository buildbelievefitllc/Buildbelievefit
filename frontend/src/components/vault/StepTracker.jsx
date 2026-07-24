// src/components/vault/StepTracker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Live Step Tracker card — surfaces the native hardware pedometer (Android
// TYPE_STEP_COUNTER / iOS CMPedometer via PedometerBridge) as live daily-step
// progress on the Check-In surface. Starts capture on mount, stops on unmount.
//
// Renders NOTHING off-device (no bridge / no step sensor) so the web/PWA build and
// sensorless devices show no dead UI. Trilingual via the local-map pattern (reads
// `lang` from useLang) — structural i18n without touching the shared dictionary.
//
// Daily total = the day's Health Connect / manual baseline (dayBaseline prop, from
// the ledger's daily_steps) + the live session delta from the sensor; the next
// Health Connect sync reconciles it with the authoritative aggregate.

import { useEffect } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import {
  useStepTracker,
  startStepTracking,
  stopStepTracking,
  setDayBaseline,
  DEFAULT_STEP_GOAL,
} from '../../lib/stepTracker.js';
import './stepTracker.css';

const L = {
  kicker: { en: 'Live Activity', es: 'Actividad en Vivo', pt: 'Atividade ao Vivo' },
  title: { en: 'Step Tracker', es: 'Contador de Pasos', pt: 'Contador de Passos' },
  steps: { en: 'steps', es: 'pasos', pt: 'passos' },
  ofGoal: { en: 'of', es: 'de', pt: 'de' },
  remaining: { en: 'to go', es: 'faltan', pt: 'faltam' },
  reached: { en: 'Goal reached', es: 'Meta alcanzada', pt: 'Meta atingida' },
  live: { en: 'LIVE', es: 'EN VIVO', pt: 'AO VIVO' },
  session: { en: 'this session', es: 'esta sesión', pt: 'esta sessão' },
};

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function StepTracker({ dayBaseline = 0, goal = DEFAULT_STEP_GOAL }) {
  const { lang } = useLang();
  const tr = (m) => (m && (m[lang] || m.en)) || '';
  const st = useStepTracker();

  // Begin live capture on mount; tear down on unmount. Baseline + goal seeded here.
  useEffect(() => {
    startStepTracking({ dayBaseline, goal });
    return () => { stopStepTracking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-seed the day baseline if the ledger's daily_steps refreshes after mount.
  useEffect(() => { setDayBaseline(dayBaseline); }, [dayBaseline]);

  // No hardware sensor / not the native shell → render nothing (never a dead card).
  if (!st.available) return null;

  const { progress } = st;
  return (
    <div className="st-card" data-testid="step-tracker" data-bbf-reached={progress.reached ? '1' : '0'}>
      <div className="st-head">
        <span className="st-kicker">◈ {tr(L.kicker)}</span>
        {st.active ? (
          <span className="st-live"><span className="st-dot" aria-hidden="true" />{tr(L.live)}</span>
        ) : null}
      </div>
      <div className="st-title">{tr(L.title)}</div>
      <div className="st-count">
        <span className="st-steps">{fmt(progress.steps)}</span>
        <span className="st-goal">{tr(L.ofGoal)} {fmt(progress.goal)} {tr(L.steps)}</span>
      </div>
      <div
        className="st-bar"
        role="progressbar"
        aria-valuenow={progress.pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="st-fill" style={{ width: `${progress.pct}%` }} />
      </div>
      <div className="st-foot">
        <span>{progress.reached ? `✓ ${tr(L.reached)}` : `${fmt(progress.remaining)} ${tr(L.remaining)}`}</span>
        {st.sessionSteps > 0 ? (
          <span className="st-session">+{fmt(st.sessionSteps)} {tr(L.session)}</span>
        ) : null}
      </div>
    </div>
  );
}
