// src/components/vault/SmartCardio.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 22 — Smart Cardio (Client Vault surface). Restores the legacy Phase 10
// engine with a persistent backend:
//   • Cardio Configurator — interactive selectors (Duration · Pacing · Equipment
//     · Kinetic Modality) that drive, fully client-side (zero API/token burn):
//       – the Dynamic CRP Formula card (Cardio-Respiratory Prescription index),
//       – the Respiratory Sync visual timer (a breath-pacer orb), and
//       – the Metabolic Timeline Breakdown (phase grid w/ O₂-utilization metrics).
//   • Agentic GPS — the proactive generator (bbf-agentic-cardio): enter a time
//     budget → routed modality + CNS-aware minute-by-minute protocol + ROI.
//   • Zone legend — HIIT / Tempo / Zone-2 (the legacy time-budget routing).
//   • Active protocols — target duration + intensity + the minute-by-minute
//     prescription, treadmill-readable monospace (legacy .cardio-protocol).
//   • History — previously logged sessions.
//   • Logger — write a completed session (token-gated RPC), then refetch.
//
// ISOLATION: touches only cardioApi / agenticCardioApi + cardio.css. Never imports
// or edits T2's ProgramGrid / programData / programApi.

import { useEffect, useState } from 'react';
import { useCardio, logCardio, CARDIO_ZONES } from '../../lib/cardioApi.js';
import AgenticCardio from './AgenticCardio.jsx';
import './cardio.css';

function fmtDate(d) {
  if (!d) return '—';
  const t = Date.parse(d);
  if (Number.isNaN(t)) return String(d);
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function zoneMeta(z) {
  return CARDIO_ZONES[z] || { label: z, blurb: '', accent: '#FF4500' };
}

export default function SmartCardio() {
  const { data, isLoading, error, refetch } = useCardio();

  return (
    <div className="bbf-cardio">
      <div className="bbf-cardio__head">
        <h2 className="bbf-cardio__title">Smart Cardio</h2>
        <span className="bbf-cardio__kicker">Conditioning Engine</span>
      </div>
      <p className="bbf-cardio__sub">
        The engine routes between HIIT (&lt; 20 min), Tempo (20–35 min), and Zone 2 (&gt; 35 min) —
        each protocol is built for your time budget. Log every session to keep your conditioning honest.
      </p>

      {/* Cardio Configurator — selectors → CRP formula, respiratory sync, timeline.
          Fully client-side scaffolding: it derives, it does not call the engine. */}
      <CardioConfigurator />

      {/* Proactive GPS generator — bbf-agentic-cardio */}
      <AgenticCardio />

      {/* Zone legend */}
      <div className="bbf-cardio__zones">
        {Object.entries(CARDIO_ZONES).map(([id, z]) => (
          <div key={id} className="bbf-cardio__zone" style={{ '--zone-accent': z.accent }}>
            <div className="bbf-cardio__zone-name">{z.label}</div>
            <div className="bbf-cardio__zone-blurb">{z.blurb}</div>
          </div>
        ))}
      </div>

      {isLoading ? <div className="bbf-cardio__loading">Loading your cardio protocols…</div> : null}
      {!isLoading && error ? <div className="bbf-cardio__error" role="alert">{error}</div> : null}

      {!isLoading && !error && data ? (
        <>
          <ActiveProtocols protocols={data.protocols} />
          <LogSession onLogged={refetch} />
          <History logs={data.logs} />
        </>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cardio Configurator — selector domain + derivation (pure, client-side)
// ─────────────────────────────────────────────────────────────────────────────

const DURATION_OPTS = [
  { value: 15, label: '15 min · Express' },
  { value: 30, label: '30 min · Standard' },
  { value: 45, label: '45 min · Extended' },
  { value: 60, label: '60 min · Endurance' },
];

// Each pacing tier carries the physiological constants the formula reads:
//   vo2 = working %VO₂max · hr = %HRmax label · breath = inhale/hold/exhale (s)
const PACING_OPTS = {
  zone2: { label: 'Zone 2 · Aerobic Base', accent: '#22c55e', vo2: 0.65, hr: '60–70%', breath: [4, 0, 6], intensity: 1.0 },
  tempo: { label: 'Tempo · Threshold', accent: '#F59E0B', vo2: 0.80, hr: '76–85%', breath: [3, 0, 4], intensity: 1.35 },
  hiit: { label: 'HIIT · Max Effort', accent: '#FF4500', vo2: 0.92, hr: '86–95%', breath: [2, 1, 2], intensity: 1.7 },
  fasted: { label: 'Fasted Steady-State', accent: '#9D27C9', vo2: 0.60, hr: '55–65%', breath: [4, 2, 6], intensity: 0.9 },
};

const EQUIPMENT_OPTS = {
  treadmill: { label: 'Treadmill', efficiency: 1.0 },
  rower: { label: 'Rower (Erg)', efficiency: 1.15 },
  bike: { label: 'Assault Bike', efficiency: 1.2 },
  road: { label: 'Outdoor / Road', efficiency: 1.05 },
  rope: { label: 'Jump Rope', efficiency: 1.25 },
  elliptical: { label: 'Elliptical', efficiency: 0.9 },
};

const MODALITY_OPTS = {
  cyclical: { label: 'Cyclical · Low-Impact', factor: 1.0 },
  ballistic: { label: 'Ballistic · Plyometric', factor: 1.3 },
  hybrid: { label: 'Mixed-Modal · Hybrid', factor: 1.15 },
  carry: { label: 'Loaded Carry · Resisted', factor: 1.4 },
};

// The Dynamic CRP (Cardio-Respiratory Prescription) index. Deterministic:
//   CRP = Duration × Intensity × Modality ÷ Mechanical-Efficiency
function computeCRP({ duration, pacing, equipment, modality }) {
  const p = PACING_OPTS[pacing];
  const e = EQUIPMENT_OPTS[equipment];
  const m = MODALITY_OPTS[modality];
  const raw = (duration * p.intensity * m.factor) / e.efficiency;
  const index = Math.round(raw);
  // Crude steady-state kcal proxy: ~9 kcal/CRP-unit, rounded to the nearest 5.
  const kcal = Math.round((raw * 9) / 5) * 5;
  return {
    index,
    kcal,
    vo2: Math.round(p.vo2 * 100),
    hr: p.hr,
    intensity: p.intensity,
    modalityFactor: m.factor,
    efficiency: e.efficiency,
  };
}

// Metabolic Timeline Breakdown. Splits the session into physiological phases and
// attaches an O₂-utilization metric (%VO₂max) to each. HIIT/ballistic work gets a
// surge band; everything tapers through a cool-down.
function buildTimeline({ duration, pacing }) {
  const p = PACING_OPTS[pacing];
  const peak = p.vo2; // working %VO₂max (0–1)
  const warm = Math.max(3, Math.round(duration * 0.12));
  const cool = Math.max(3, Math.round(duration * 0.12));
  const workTotal = Math.max(1, duration - warm - cool);

  const phases = [];
  phases.push({ key: 'warmup', label: 'Warm-Up', mins: warm, o2: Math.round((peak * 0.5) * 100), note: 'Vascular priming · capillary recruitment' });
  phases.push({ key: 'activation', label: 'Activation', mins: Math.max(2, Math.round(workTotal * 0.18)), o2: Math.round((peak * 0.78) * 100), note: 'Aerobic system online · fat-ox ramp' });

  const primary = Math.max(1, workTotal - Math.max(2, Math.round(workTotal * 0.18)));
  if (pacing === 'hiit') {
    phases.push({ key: 'work', label: 'Surge Intervals', mins: primary, o2: Math.round(peak * 100), note: 'EPOC debt · glycolytic + max O₂ flux' });
  } else if (pacing === 'tempo') {
    phases.push({ key: 'work', label: 'Threshold Block', mins: primary, o2: Math.round(peak * 100), note: 'Lactate clearance at steady ceiling' });
  } else {
    phases.push({ key: 'steady', label: 'Steady Effort', mins: primary, o2: Math.round(peak * 100), note: 'Mitochondrial density · fat oxidation' });
  }

  phases.push({ key: 'cooldown', label: 'Cool-Down', mins: cool, o2: Math.round((peak * 0.45) * 100), note: 'Parasympathetic return · HR recovery' });
  return phases;
}

const PHASE_ACCENT = {
  warmup: '#F5CF60', activation: '#F59E0B', work: '#FF4500', steady: '#9D27C9', cooldown: '#8b1abf',
};

function CardioConfigurator() {
  const [duration, setDuration] = useState(30);
  const [pacing, setPacing] = useState('zone2');
  const [equipment, setEquipment] = useState('treadmill');
  const [modality, setModality] = useState('cyclical');

  const crp = computeCRP({ duration, pacing, equipment, modality });
  const timeline = buildTimeline({ duration, pacing });
  const pacingMeta = PACING_OPTS[pacing];

  return (
    <section className="bbf-cfg" style={{ '--cfg-accent': pacingMeta.accent }}>
      <div className="bbf-cfg__head">
        <span className="bbf-cardio__kicker" style={{ color: pacingMeta.accent }}>Cardio Configurator</span>
        <h3 className="bbf-cardio__title" style={{ fontSize: '1.3rem' }}>Dial In the Prescription</h3>
        <p className="bbf-cfg__sub">
          Set the four variables — the engine derives your CRP index, paces your breathing, and maps the
          metabolic timeline live. No tokens spent: this is a real-time prescription preview.
        </p>
      </div>

      {/* Selectors */}
      <div className="bbf-cfg__selectors">
        <div className="bbf-cardio__field">
          <label htmlFor="cfg-dur">Duration</label>
          <select id="cfg-dur" className="bbf-input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATION_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="bbf-cardio__field">
          <label htmlFor="cfg-pace">Pacing</label>
          <select id="cfg-pace" className="bbf-input" value={pacing} onChange={(e) => setPacing(e.target.value)}>
            {Object.entries(PACING_OPTS).map(([id, o]) => <option key={id} value={id}>{o.label}</option>)}
          </select>
        </div>
        <div className="bbf-cardio__field">
          <label htmlFor="cfg-equip">Equipment</label>
          <select id="cfg-equip" className="bbf-input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            {Object.entries(EQUIPMENT_OPTS).map(([id, o]) => <option key={id} value={id}>{o.label}</option>)}
          </select>
        </div>
        <div className="bbf-cardio__field">
          <label htmlFor="cfg-mod">Kinetic Modality</label>
          <select id="cfg-mod" className="bbf-input" value={modality} onChange={(e) => setModality(e.target.value)}>
            {Object.entries(MODALITY_OPTS).map(([id, o]) => <option key={id} value={id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <CRPFormulaCard crp={crp} duration={duration} />
      {/* key={pacing} remounts the pacer with fresh state when the breath
          pattern changes — avoids a synchronous setState-in-effect reset. */}
      <RespiratorySync key={pacing} breath={pacingMeta.breath} accent={pacingMeta.accent} />
      <MetabolicTimeline phases={timeline} crp={crp} />
    </section>
  );
}

// ── Dynamic CRP Formula card ─────────────────────────────────────────────────
function CRPFormulaCard({ crp, duration }) {
  return (
    <div className="bbf-crp">
      <div className="bbf-crp__glow" aria-hidden="true" />
      <div className="bbf-crp__body">
        <div className="bbf-crp__kicker">Dynamic CRP Formula</div>
        <div className="bbf-crp__formula" aria-label="Cardio-Respiratory Prescription formula">
          <span className="bbf-crp__term">CRP</span>
          <span className="bbf-crp__op">=</span>
          <span className="bbf-crp__frac">
            <span className="bbf-crp__num">Duration × Intensity × Modality</span>
            <span className="bbf-crp__bar" />
            <span className="bbf-crp__den">Mechanical Efficiency</span>
          </span>
        </div>
        <div className="bbf-crp__plug" aria-hidden="true">
          {duration} × {crp.intensity.toFixed(2)} × {crp.modalityFactor.toFixed(2)} ÷ {crp.efficiency.toFixed(2)}
        </div>
        <div className="bbf-crp__metrics">
          <div className="bbf-crp__metric bbf-crp__metric--hero">
            <span className="bbf-crp__metric-val">{crp.index}</span>
            <span className="bbf-crp__metric-lbl">CRP Index</span>
          </div>
          <div className="bbf-crp__metric">
            <span className="bbf-crp__metric-val">{crp.vo2}<span className="bbf-crp__metric-unit">%</span></span>
            <span className="bbf-crp__metric-lbl">Working VO₂max</span>
          </div>
          <div className="bbf-crp__metric">
            <span className="bbf-crp__metric-val">{crp.hr}</span>
            <span className="bbf-crp__metric-lbl">Target HRmax</span>
          </div>
          <div className="bbf-crp__metric">
            <span className="bbf-crp__metric-val">{crp.kcal}<span className="bbf-crp__metric-unit"> kcal</span></span>
            <span className="bbf-crp__metric-lbl">Est. Burn</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Respiratory Sync visual timer ────────────────────────────────────────────
// Drives a breath-pacer orb through inhale → hold → exhale, each step lasting the
// pacing tier's prescribed seconds. The whole state machine is derived purely from
// a single monotonic `elapsed` seconds counter (modulo the cycle length) — the
// only state updater is `e => e + 1`, which keeps it pure and StrictMode-safe. The
// orb scales via an inline CSS transition whose duration matches the active step,
// so the animation stays synced to the countdown. A 0-second step (no hold) is
// skipped.
function RespiratorySync({ breath, accent }) {
  const [inhale, hold, exhale] = breath;
  const steps = [
    { label: 'Inhale', secs: inhale, scale: 1, key: 'in' },
    ...(hold > 0 ? [{ label: 'Hold', secs: hold, scale: 1, key: 'hold' }] : []),
    { label: 'Exhale', secs: exhale, scale: 0.55, key: 'out' },
  ];
  const cycleSecs = steps.reduce((s, st) => s + st.secs, 0);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds since the current run began

  // 1-second tick — the sole, pure state update while running.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Derive the active step + its remaining seconds purely from `elapsed`.
  const tInCycle = cycleSecs ? elapsed % cycleSecs : 0;
  let acc = 0;
  let active = steps[0];
  let remaining = steps[0].secs;
  for (const st of steps) {
    if (tInCycle < acc + st.secs) {
      active = st;
      remaining = st.secs - (tInCycle - acc);
      break;
    }
    acc += st.secs;
  }

  function toggle() {
    if (running) {
      setRunning(false);
      return;
    }
    setElapsed(0); // (re)start from the top of the cycle
    setRunning(true);
  }

  return (
    <div className="bbf-resp" style={{ '--resp-accent': accent }}>
      <div className="bbf-resp__kicker">Respiratory Sync</div>
      <div className="bbf-resp__stage">
        <div
          className={`bbf-resp__orb${running ? ' is-running' : ''}`}
          style={{
            transform: `scale(${running ? active.scale : 0.78})`,
            transitionDuration: `${running ? active.secs : 0.4}s`,
          }}
          aria-hidden="true"
        >
          <span className="bbf-resp__count">{running ? remaining : '↺'}</span>
        </div>
      </div>
      <div className="bbf-resp__phase" role="status">
        {running ? active.label : 'Paused'}
      </div>
      <div className="bbf-resp__pattern">
        Pattern · Inhale {inhale}s{hold > 0 ? ` · Hold ${hold}s` : ''} · Exhale {exhale}s
        <span className="bbf-resp__cycle"> ({cycleSecs}s cycle)</span>
      </div>
      <button type="button" className="bbf-resp__btn" onClick={toggle}>
        {running ? 'Pause Pacer' : 'Start Breath Pacer →'}
      </button>
    </div>
  );
}

// ── Metabolic Timeline Breakdown ─────────────────────────────────────────────
function MetabolicTimeline({ phases, crp }) {
  const total = phases.reduce((s, p) => s + p.mins, 0);
  return (
    <div className="bbf-metab">
      <div className="bbf-metab__head">
        <span className="bbf-metab__kicker">Metabolic Timeline Breakdown</span>
        <span className="bbf-metab__total">{total} min · peak {crp.vo2}% VO₂max</span>
      </div>
      <div className="bbf-metab__grid" role="list">
        {phases.map((ph) => {
          const accent = PHASE_ACCENT[ph.key] || '#FF4500';
          const pct = total ? Math.round((ph.mins / total) * 100) : 0;
          return (
            <div key={ph.key} className="bbf-metab__row" role="listitem" style={{ '--metab-accent': accent }}>
              <div className="bbf-metab__row-top">
                <span className="bbf-metab__phase">{ph.label}</span>
                <span className="bbf-metab__mins">{ph.mins} min · {pct}%</span>
              </div>
              <div className="bbf-metab__o2">
                <div className="bbf-metab__o2-track">
                  <div className="bbf-metab__o2-fill" style={{ width: `${ph.o2}%` }} />
                </div>
                <span className="bbf-metab__o2-val">{ph.o2}% O₂</span>
              </div>
              <div className="bbf-metab__note">{ph.note}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActiveProtocols({ protocols }) {
  return (
    <section>
      <h3 className="bbf-cardio__section-h">Active Protocols</h3>
      {protocols.length === 0 ? (
        <div className="bbf-cardio__empty">
          No cardio protocol assigned yet — your coach is dialing in your conditioning. It will appear here once assigned.
        </div>
      ) : (
        <div className="bbf-cardio__protocols">
          {protocols.map((p) => {
            const z = zoneMeta(p.zone);
            return (
              <article key={p.id} className="bbf-cardio__protocol">
                <div className="bbf-cardio__protocol-top">
                  <span className="bbf-cardio__protocol-title">{p.title || z.label}</span>
                  <span className="bbf-cardio__pill" style={{ color: z.accent }}>{z.label}</span>
                </div>
                <div className="bbf-cardio__targets">
                  <div className="bbf-cardio__target">
                    <span className="bbf-cardio__target-val">{p.target_duration_min}<span style={{ fontSize: '.9rem' }}> min</span></span>
                    <span className="bbf-cardio__target-lbl">Target Duration</span>
                  </div>
                  {p.intensity ? (
                    <div className="bbf-cardio__target">
                      <span className="bbf-cardio__target-val" style={{ fontSize: '1.2rem' }}>{p.intensity}</span>
                      <span className="bbf-cardio__target-lbl">Intensity</span>
                    </div>
                  ) : null}
                </div>
                {p.protocol_detail ? <div className="bbf-cardio__detail">{p.protocol_detail}</div> : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function History({ logs }) {
  return (
    <section>
      <h3 className="bbf-cardio__section-h">Session History</h3>
      {logs.length === 0 ? (
        <div className="bbf-cardio__empty">No sessions logged yet. Log your first cardio session below.</div>
      ) : (
        <div className="bbf-cardio__logs">
          {logs.map((l) => {
            const z = zoneMeta(l.zone);
            const meta = [l.intensity, l.avg_hr ? `${l.avg_hr} bpm` : null, l.notes].filter(Boolean).join(' · ');
            return (
              <div key={l.id} className="bbf-cardio__log" style={{ '--zone-accent': z.accent }}>
                <span className="bbf-cardio__log-date">{fmtDate(l.session_date)}</span>
                <span className="bbf-cardio__log-main">
                  <span className="bbf-cardio__log-zone">{z.label}</span>
                  {meta ? <span className="bbf-cardio__log-meta">{meta}</span> : null}
                </span>
                <span className="bbf-cardio__log-dur">{l.duration_min}<span> min</span></span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LogSession({ onLogged }) {
  const [zone, setZone] = useState('zone2');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind:'ok'|'err', text }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const dur = parseInt(duration, 10);
    if (!dur || dur <= 0 || dur > 600) {
      setMsg({ kind: 'err', text: 'Enter a duration between 1 and 600 minutes.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await logCardio({
        zone,
        duration_min: dur,
        intensity: intensity.trim() || undefined,
        avg_hr: avgHr.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setMsg({ kind: 'ok', text: 'Session logged. Conditioning stays honest. 🔥' });
      setDuration(''); setIntensity(''); setAvgHr(''); setNotes('');
      onLogged?.();
    } catch (err) {
      setMsg({ kind: 'err', text: err?.message || 'Could not log session. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="bbf-cardio__section-h">Log a Session</h3>
      <form className="bbf-cardio__logger" onSubmit={submit}>
        <div className="bbf-cardio__row">
          <div className="bbf-cardio__field">
            <label htmlFor="bc-zone">Zone</label>
            <select id="bc-zone" className="bbf-input" value={zone} disabled={busy} onChange={(e) => setZone(e.target.value)}>
              {Object.entries(CARDIO_ZONES).map(([id, z]) => <option key={id} value={id}>{z.label}</option>)}
            </select>
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="bc-dur">Duration (min)</label>
            <input id="bc-dur" className="bbf-input" type="number" inputMode="numeric" min="1" max="600"
              value={duration} disabled={busy} onChange={(e) => setDuration(e.target.value)} placeholder="40" />
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="bc-int">Intensity</label>
            <input id="bc-int" className="bbf-input" type="text" value={intensity} disabled={busy}
              onChange={(e) => setIntensity(e.target.value)} placeholder="RPE 7 / 65-75% HRmax" />
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="bc-hr">Avg HR (bpm)</label>
            <input id="bc-hr" className="bbf-input" type="number" inputMode="numeric" min="40" max="230"
              value={avgHr} disabled={busy} onChange={(e) => setAvgHr(e.target.value)} placeholder="142" />
          </div>
        </div>
        <div className="bbf-cardio__field" style={{ marginBottom: '.8rem' }}>
          <label htmlFor="bc-notes">Notes</label>
          <input id="bc-notes" className="bbf-input" type="text" value={notes} disabled={busy}
            onChange={(e) => setNotes(e.target.value)} placeholder="How it felt, splits, terrain…" />
        </div>
        <div className="bbf-cardio__actions">
          <button type="submit" className="bbf-cardio__btn" disabled={busy}>{busy ? 'Logging…' : 'Log Session →'}</button>
          {msg ? <span className={`bbf-cardio__msg bbf-cardio__msg--${msg.kind}`} role="status">{msg.text}</span> : null}
        </div>
      </form>
    </section>
  );
}
