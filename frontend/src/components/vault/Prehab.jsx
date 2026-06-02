// src/components/vault/Prehab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Prehab & Recovery Matrix — Diagnostic Engine.
//
// Rebuilt from the basic yellow friction selector into a high-fidelity, dark-mode
// brutalist diagnostic engine (three wired modules):
//   1. Respiratory Infrastructure Coach — a static-release hold timer with an
//      expanding breathing orb (inhale/exhale cue), 30/45/60s presets, and
//      Start / Pause / Reset transport.
//   2. Dynamic Joint Symptom Mobility Planner — three biomechanical range
//      selectors that compile into a clinical DIAGNOSTIC REPORT (keyed codes).
//   3. Protocol for Selected Region — the corrective movement deck with pill
//      data-chips (sets/reps/duration), cue directives, an embedded video slot,
//      and a circular "% PROTOCOL DONE" tracker driven by Mark-Done state.
//
// All copy + protocol data is static ground-truth (see prehabProtocol.js); the
// per-athlete read path is a backend follow-up. Mounted in ClientVault and the
// Command Center Player-Coach panel — both render <Prehab /> (no props).

import { useEffect, useMemo, useRef, useState } from 'react';
import { PLANNER, PROTOCOL, compileReport } from './prehabProtocol.js';
import './prehab.css';

const PRESETS = [30, 45, 60];

// ── Module 1 · Respiratory Infrastructure Coach ──────────────────────────────
function RespiratoryCoach() {
  const [duration, setDuration] = useState(30); // mission default: 30s
  const [remaining, setRemaining] = useState(30);
  const [running, setRunning] = useState(false);
  const tickRef = useRef(null);

  // Countdown — one interval, torn down on pause/unmount/completion.
  useEffect(() => {
    if (!running) return undefined;
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { setRunning(false); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const selectPreset = (s) => {
    setRunning(false);
    setDuration(s);
    setRemaining(s);
  };
  const start = () => { if (remaining > 0) setRunning(true); };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setRemaining(duration); };

  // Breathing phase: 8s cycle (4s inhale / 4s exhale) while the hold runs.
  const elapsed = duration - remaining;
  const inhaling = running && (elapsed % 8) < 4;
  const orbState = !running ? 'is-idle' : (inhaling ? 'is-inhale' : 'is-exhale');
  const cue = !running
    ? 'Hold ready — press start'
    : (inhaling ? 'Breathe in deeply (expand diaphragm)' : 'Breathe out slowly (full release)');
  const sub = !running
    ? 'Synchronize the hold under the expanding respiratory cue'
    : (inhaling ? 'Focus on expanding intercostal rib structures wide' : 'Empty the lungs and sink the ribs down');

  return (
    <section className="pde-card" aria-label="Respiratory Infrastructure Coach">
      <div className="pde-kicker">Decompression Engine</div>
      <div className="pde-titlerow">
        <h3 className="pde-title"><span className="pde-spark">✦</span> Respiratory Infrastructure Coach</h3>
        <span className="pde-badge">{inhaling ? 'Inhale Phase' : running ? 'Exhale Phase' : 'Inhale Phase'}</span>
      </div>
      <p className="pde-desc">
        Performance breathing expands cellular water distribution, lowers cortisol parameters, and
        stabilizes muscle fibers. Synchronize your prehab holdings under the expanding respiratory cue below.
      </p>

      <div className="pde-orb-wrap">
        <div className={`pde-orb ${orbState}`} role="timer" aria-label={`${remaining} seconds remaining`}>
          <div className="pde-orb-core"><span className="pde-orb-count">{remaining}s</span></div>
        </div>
        <div className="pde-orb-cue"><span aria-hidden="true">🫁</span> {cue}</div>
        <div className="pde-orb-sub">{sub}</div>
      </div>

      <div className="pde-timer">
        <div className="pde-timer-top">
          <span className="pde-timer-lbl">Static Release Hold Timer</span>
          <div className="pde-presets" role="group" aria-label="Hold duration">
            {PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                className={`pde-preset${duration === s ? ' is-active' : ''}`}
                aria-pressed={duration === s}
                onClick={() => selectPreset(s)}
              >
                {s} Seconds
              </button>
            ))}
          </div>
        </div>
        <div className="pde-transport">
          <button type="button" className="pde-btn pde-btn--primary" onClick={start} disabled={running || remaining === 0}>
            ▶ Start Hold
          </button>
          <button type="button" className="pde-btn" onClick={pause} disabled={!running}>⏸ Pause</button>
          <button type="button" className="pde-btn" onClick={reset}>↻ Reset</button>
        </div>
      </div>
    </section>
  );
}

// ── Module 2 · Dynamic Joint Symptom Mobility Planner + Diagnostic Report ─────
function MobilityPlanner() {
  const [selections, setSelections] = useState(
    () => Object.fromEntries(PLANNER.map((q) => [q.id, q.default])),
  );
  const [compiled, setCompiled] = useState(false);

  const report = useMemo(() => compileReport(selections), [selections]);
  const setSel = (id, value) => { setSelections((p) => ({ ...p, [id]: value })); setCompiled(false); };

  return (
    <section className="pde-card" aria-label="Dynamic Joint Symptom Mobility Planner">
      <div className="pde-kicker">Structural Assessment</div>
      <h3 className="pde-title"><span className="pde-spark">〽</span> Dynamic Joint Symptom Mobility Planner</h3>
      <p className="pde-desc">
        Evaluate physical thresholds before high-load squats or bench presses. Answer the biomechanical
        range selectors to compile a customized corrective activation protocol immediately.
      </p>

      <div className="pde-grid3">
        {PLANNER.map((q) => (
          <label key={q.id} className="pde-field">
            <span className="pde-field-lbl">{q.label}</span>
            <select
              className="pde-select"
              value={selections[q.id]}
              onChange={(e) => setSel(q.id, e.target.value)}
            >
              {q.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <button type="button" className="pde-run" onClick={() => setCompiled(true)}>
        Run Mobility Compilation
      </button>

      {compiled ? (
        <div className="pde-report" role="status">
          <div className="pde-report-head">⚠ Diagnostic Report Keyed Codes:</div>
          <pre className="pde-report-body">
            <span className="h">### BBF Biomechanical Correction Strategy Compiled</span>
            {report.map((r, i) => (
              <span key={i}>
                {'\n\n'}
                <span className={r.status === 'ok' ? 'ok' : 'warn'}>{r.status === 'ok' ? '✅' : '⚠'} {r.title}:</span>
                {' '}{r.body}
              </span>
            ))}
            {'\n\n'}
            <span className="act">↳ Actionable: Load your pre-selected Prehab Exercise protocols from the listing deck below to unlock these restricted pathways.</span>
          </pre>
        </div>
      ) : null}
    </section>
  );
}

// ── Circular % tracker ───────────────────────────────────────────────────────
function ProtocolRing({ pct }) {
  const SIZE = 52;
  const STROKE = 5;
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="pde-ring-wrap">
      <div className="pde-ring">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle className="pde-ring-track" cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" strokeWidth={STROKE} />
          <circle
            className="pde-ring-arc"
            cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
        </svg>
        <span className="pde-ring-num">{pct}%</span>
      </div>
      <span className="pde-ring-lbl">Protocol<br />Done</span>
    </div>
  );
}

// ── Module 3 · Protocol for Selected Region ──────────────────────────────────
function ProtocolDeck() {
  const [done, setDone] = useState(() => new Set());
  const toggle = (key) => setDone((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const total = PROTOCOL.exercises.length;
  const pct = total ? Math.round((done.size / total) * 100) : 0;

  return (
    <section className="pde-card" aria-label="Protocol for selected region">
      <div className="pde-proto-head">
        <div>
          <div className="pde-kicker">Protocol for Selected Region</div>
          <h3 className="pde-proto-title"><span aria-hidden="true">🦴</span> {PROTOCOL.title}</h3>
        </div>
        <ProtocolRing pct={pct} />
      </div>

      <div className="pde-quote">
        <span className="pde-quote-ic" aria-hidden="true">ⓘ</span>
        <p className="pde-quote-txt">{PROTOCOL.quote}</p>
      </div>

      {PROTOCOL.exercises.map((ex, i) => {
        const isDone = done.has(ex.key);
        return (
          <article
            key={ex.key}
            className={`pde-ex${isDone ? ' is-done' : ''}`}
            data-testid="prehab-routine"
          >
            <div className="pde-ex-main">
              <div className="pde-ex-top">
                <span className="pde-ex-idx">{i + 1}</span>
                <span className="pde-ex-name" data-testid="prehab-routine-name">{ex.name}</span>
                <button
                  type="button"
                  className="pde-mark"
                  aria-pressed={isDone}
                  onClick={() => toggle(ex.key)}
                >
                  {isDone ? '✓ Done' : '› Mark Done'}
                </button>
              </div>

              <div className="pde-chips">
                <span className="pde-chip" data-testid="prehab-routine-sets">{ex.sets} Sets</span>
                <span className="pde-chip" data-testid="prehab-routine-reps">{ex.reps}</span>
                <span className="pde-chip">{ex.duration}</span>
              </div>

              <p className="pde-ex-desc" data-testid="prehab-routine-cue">{ex.desc}</p>

              <div className="pde-cues">
                <div className="pde-cues-head">Cues &amp; Directives</div>
                {ex.cues.map((c, ci) => (
                  <div className="pde-cue" key={ci}>
                    <span className="pde-cue-arrow" aria-hidden="true">›</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pde-video" aria-label={`${ex.name} demonstration video`}>
              <button type="button" className="pde-video-btn" aria-label="Play demonstration">▶</button>
              <span className="pde-video-cap">Video Directive</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default function Prehab() {
  return (
    <div className="pde" data-testid="prehab-module">
      <RespiratoryCoach />
      <MobilityPlanner />
      <ProtocolDeck />
    </div>
  );
}
