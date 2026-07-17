// src/components/vault/BodyweightCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Vault · THE WEIGH-IN — the adult client's own bodyweight tracker.
//
// The one goal-input the Vault was missing: a client logs their weight toward a
// numeric goal and sees the trend, on a GENTLE weekly cadence. Deliberately NOT
// daily — day-to-day fluctuation is discouraging noise; a weekly reading is the
// signal. The card surfaces a soft "weigh-in due" state once the 7-day window
// has elapsed (there is no server push in this app; the due-date is derived from
// the data and shown when the client opens the Vault).
//
// Self-contained + self-gating (mirrors EagleEyeNudgeCard): fetches the client's
// own vault-gated envelope, renders nothing without a session/profile, degrades
// silently — never throws at the client. Adult-only by mount: it lives in
// VaultHub, which the youth Sports Hub never renders. THE GRAM STANDARD holds —
// grams on the wire, lb/kg only at the input/display boundary.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import {
  getBodyweight, logBodyweight, setWeightGoal, isWeighInDue,
  gToUnit, unitToG, MIN_BODY_MASS_G, MAX_BODY_MASS_G,
} from '../../lib/bodyweightApi.js';

const UNIT_KEY = 'bbf_weight_unit';
function readUnit() {
  try { return localStorage.getItem(UNIT_KEY) === 'kg' ? 'kg' : 'lb'; } catch { return 'lb'; }
}

const BW_L10N = {
  en: {
    kicker: 'The Weigh-In', due: 'Weigh-in due',
    current: 'Current', goal: 'Goal', noGoal: 'Set a goal',
    setGoal: 'Set goal', save: 'Save', cancel: 'Cancel', clear: 'Clear',
    logLabel: 'Log this week’s weight', log: 'Log weigh-in', logging: 'Saving…',
    placeholder: 'Your weight',
    firstPrompt: 'Log your first weigh-in to start tracking toward your goal.',
    reached: 'Goal reached — hold the line. ✓',
    toGo: (v, u) => `${v} ${u} to go`,
    past: (v, u) => `${v} ${u} past goal`,
    nextOn: (d) => `Next weigh-in: ${d}`,
    weeklyNote: 'We check weekly, not daily — day-to-day swings are just noise.',
    dueNote: 'It’s been a week. Step on the scale when you’re ready — same time of day is best.',
    goalPrompt: 'Set your target weight', outOfRange: 'Enter a realistic weight.',
    trend: 'Trend', lastN: 'last few weigh-ins',
  },
  es: {
    kicker: 'El Pesaje', due: 'Pesaje pendiente',
    current: 'Actual', goal: 'Meta', noGoal: 'Fijar meta',
    setGoal: 'Fijar meta', save: 'Guardar', cancel: 'Cancelar', clear: 'Borrar',
    logLabel: 'Registra tu peso de esta semana', log: 'Registrar pesaje', logging: 'Guardando…',
    placeholder: 'Tu peso',
    firstPrompt: 'Registra tu primer pesaje para empezar a avanzar hacia tu meta.',
    reached: 'Meta alcanzada — mantén la línea. ✓',
    toGo: (v, u) => `faltan ${v} ${u}`,
    past: (v, u) => `${v} ${u} pasado la meta`,
    nextOn: (d) => `Próximo pesaje: ${d}`,
    weeklyNote: 'Medimos cada semana, no a diario — las variaciones diarias son solo ruido.',
    dueNote: 'Ha pasado una semana. Súbete a la báscula cuando estés listo — mejor a la misma hora.',
    goalPrompt: 'Fija tu peso objetivo', outOfRange: 'Ingresa un peso realista.',
    trend: 'Tendencia', lastN: 'últimos pesajes',
  },
  pt: {
    kicker: 'A Pesagem', due: 'Pesagem pendente',
    current: 'Atual', goal: 'Meta', noGoal: 'Definir meta',
    setGoal: 'Definir meta', save: 'Salvar', cancel: 'Cancelar', clear: 'Limpar',
    logLabel: 'Registre seu peso desta semana', log: 'Registrar pesagem', logging: 'Salvando…',
    placeholder: 'Seu peso',
    firstPrompt: 'Registre sua primeira pesagem para começar a avançar rumo à meta.',
    reached: 'Meta alcançada — mantenha a linha. ✓',
    toGo: (v, u) => `faltam ${v} ${u}`,
    past: (v, u) => `${v} ${u} além da meta`,
    nextOn: (d) => `Próxima pesagem: ${d}`,
    weeklyNote: 'Medimos por semana, não por dia — variações diárias são apenas ruído.',
    dueNote: 'Já faz uma semana. Suba na balança quando quiser — de preferência no mesmo horário.',
    goalPrompt: 'Defina seu peso-alvo', outOfRange: 'Digite um peso realista.',
    trend: 'Tendência', lastN: 'últimas pesagens',
  },
};

// Minimal inline sparkline of the weigh-in series (grams). Endpoint dot emphasized.
function Sparkline({ series }) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const gs = series.map((p) => Number(p.g));
  const min = Math.min(...gs);
  const max = Math.max(...gs);
  const span = max - min || 1;
  const W = 132;
  const H = 34;
  const step = W / (gs.length - 1);
  const pts = gs.map((g, i) => [i * step, H - 3 - ((g - min) / span) * (H - 6)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [ex, ey] = pts[pts.length - 1];
  return (
    <svg className="bw-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--yel)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r="3" fill="var(--yel)" />
    </svg>
  );
}

export default function BodyweightCard() {
  const { lang } = useLang();
  const L = BW_L10N[lang] || BW_L10N.en;

  const [env, setEnv] = useState(undefined);   // undefined=loading · null=hidden · object=data
  const [unit, setUnit] = useState(readUnit);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [goalBusy, setGoalBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    queueMicrotask(async () => {
      const res = await getBodyweight();
      if (!alive.current) return;
      // Hide on no session / no profile — the Vault only mounts for authed adults,
      // but a card should never surface an auth error to the client.
      setEnv(res && res.ok ? res : null);
    });
    return () => { alive.current = false; };
  }, []);

  const pickUnit = (u) => { setUnit(u); try { localStorage.setItem(UNIT_KEY, u); } catch { /* private mode */ } };

  const submitLog = async () => {
    if (busy) return;
    const grams = unitToG(input, unit);
    if (!grams || grams < MIN_BODY_MASS_G || grams > MAX_BODY_MASS_G) { setErr(L.outOfRange); return; }
    setBusy(true); setErr(null);
    const res = await logBodyweight(grams);
    setBusy(false);
    if (res && res.ok) { setEnv(res); setInput(''); } else { setErr(L.outOfRange); }
  };

  const submitGoal = async () => {
    if (goalBusy) return;
    const grams = unitToG(goalInput, unit);
    if (!grams || grams < MIN_BODY_MASS_G || grams > MAX_BODY_MASS_G) { setErr(L.outOfRange); return; }
    setGoalBusy(true); setErr(null);
    const res = await setWeightGoal(grams);
    setGoalBusy(false);
    if (res && res.ok) { setEnv(res); setGoalOpen(false); setGoalInput(''); }
  };

  const clearGoal = async () => {
    setGoalBusy(true);
    const res = await setWeightGoal(null);
    setGoalBusy(false);
    if (res && res.ok) { setEnv(res); setGoalOpen(false); setGoalInput(''); }
  };

  if (env === undefined) return <section className="bw-card bw-card--loading" data-testid="bodyweight-card" aria-busy="true" />;
  if (env === null) return null;

  const u = unit;
  const currentDisp = gToUnit(env.current_g, u);
  const goalDisp = gToUnit(env.goal_g, u);
  const due = isWeighInDue(env);
  const hasReadings = Number(env.count) > 0;

  // Progress toward goal (works for loss OR gain): (start-current)/(start-goal).
  let pct = null;
  let deltaLine = null;
  if (env.goal_g != null && env.current_g != null) {
    const deltaG = env.current_g - env.goal_g;               // + = above goal, − = below
    const near = Math.abs(deltaG) < unitToG(u === 'kg' ? 0.2 : 0.4, u) - 0; // within ~½ lb / 0.2 kg
    if (near) deltaLine = { text: L.reached, reached: true };
    else {
      const absDisp = gToUnit(Math.abs(deltaG), u);
      deltaLine = { text: (deltaG > 0 ? L.toGo : L.toGo)(absDisp, u), reached: false };
      // (both directions read as "to go" toward the target)
    }
    if (env.start_g != null && env.start_g !== env.goal_g) {
      const raw = (env.start_g - env.current_g) / (env.start_g - env.goal_g);
      pct = Math.max(0, Math.min(100, Math.round(raw * 100)));
    }
  }

  const nextDisp = env.next_due_on
    ? new Date(`${env.next_due_on}T00:00:00`).toLocaleDateString(lang === 'en' ? undefined : lang, { month: 'short', day: 'numeric' })
    : null;

  return (
    <section className={`bw-card${due ? ' is-due' : ''}`} data-testid="bodyweight-card" aria-live="polite">
      <div className="bw-head">
        <span className="bw-kicker">◉ {L.kicker}</span>
        {due && hasReadings ? <span className="bw-due-pill" data-testid="bw-due">{L.due}</span> : null}
        <div className="bw-unit" role="group" aria-label="units">
          <button type="button" className={`bw-unit-btn${u === 'lb' ? ' is-on' : ''}`} onClick={() => pickUnit('lb')} data-testid="bw-unit-lb">lb</button>
          <button type="button" className={`bw-unit-btn${u === 'kg' ? ' is-on' : ''}`} onClick={() => pickUnit('kg')} data-testid="bw-unit-kg">kg</button>
        </div>
      </div>

      {/* current + goal readout */}
      <div className="bw-readout">
        <div className="bw-current">
          <span className="bw-current-val" data-testid="bw-current">{currentDisp != null ? currentDisp : '—'}</span>
          <span className="bw-current-u">{u}</span>
          <span className="bw-current-lbl">{L.current}</span>
        </div>
        {Array.isArray(env.series) && env.series.length >= 2 ? (
          <div className="bw-trend">
            <Sparkline series={env.series} />
            <span className="bw-trend-lbl">{L.lastN}</span>
          </div>
        ) : null}
      </div>

      {/* goal + progress */}
      {goalOpen ? (
        <div className="bw-goal-edit" data-testid="bw-goal-edit">
          <label className="bw-goal-lbl">{L.goalPrompt}</label>
          <div className="bw-goal-row">
            <input className="bw-input" type="number" inputMode="decimal" value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)} placeholder={`${L.goal} (${u})`} data-testid="bw-goal-input" />
            <button type="button" className="bw-btn" onClick={submitGoal} disabled={goalBusy} data-testid="bw-goal-save">{L.save}</button>
            {env.goal_g != null ? <button type="button" className="bw-btn bw-btn--ghost" onClick={clearGoal} disabled={goalBusy}>{L.clear}</button> : null}
            <button type="button" className="bw-btn bw-btn--ghost" onClick={() => { setGoalOpen(false); setErr(null); }}>{L.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="bw-goal">
          <button type="button" className="bw-goal-chip" onClick={() => { setGoalOpen(true); setGoalInput(goalDisp != null ? String(goalDisp) : ''); }} data-testid="bw-goal-chip">
            {env.goal_g != null ? `${L.goal}: ${goalDisp} ${u}` : `＋ ${L.noGoal}`}
          </button>
          {deltaLine ? <span className={`bw-delta${deltaLine.reached ? ' is-reached' : ''}`} data-testid="bw-delta">{deltaLine.text}</span> : null}
        </div>
      )}
      {pct != null ? (
        <div className="bw-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="bw-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      {/* the weigh-in composer */}
      <div className="bw-log">
        <label className="bw-log-lbl" htmlFor="bw-weight-input">{L.logLabel}</label>
        <div className="bw-log-row">
          <input
            id="bw-weight-input"
            className="bw-input"
            type="number"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitLog(); }}
            placeholder={`${L.placeholder} (${u})`}
            disabled={busy}
            data-testid="bw-input"
          />
          <button type="button" className="bw-btn bw-btn--gold" onClick={submitLog} disabled={busy || !input.trim()} data-testid="bw-log">
            {busy ? L.logging : L.log}
          </button>
        </div>
        {err ? <p className="bw-err" role="alert" data-testid="bw-err">{err}</p> : null}
      </div>

      {/* the gentle cadence line — the whole point: weekly, never daily */}
      <div className="bw-cadence" data-testid="bw-cadence">
        {!hasReadings ? (
          <span className="bw-cadence-first">{L.firstPrompt}</span>
        ) : due ? (
          <span className="bw-cadence-due">{L.dueNote}</span>
        ) : (
          <>
            <span className="bw-cadence-next">{nextDisp ? L.nextOn(nextDisp) : ''}</span>
            <span className="bw-cadence-note">{L.weeklyNote}</span>
          </>
        )}
      </div>
    </section>
  );
}
