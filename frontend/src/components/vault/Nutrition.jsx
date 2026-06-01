// src/components/vault/Nutrition.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 — Client Vault · Nutrition (assigned fueling plan).
// Phase 20.1 — Visual reconstruction: the Nutrition tab becomes a premium
// dashboard for the Sovereign Vault's 16/8 intermittent-fasting protocol —
//   • a live 16/8 fasting-window visualizer (current-time aware, no backend),
//   • a 2800 kcal daily-goal progress tracker with quick-log + macro targets,
//   • the coach-assigned meal plan (session.plans.meal_plan) in a styled card.
//
// Styling lives in the scoped vault.css (.pg-*). The fasting clock is pure
// client-side (current time); calorie intake is buffered locally per day
// (parity with the weight buffer) — backend is locked, so nothing here writes
// to Supabase. Tuned to read elite at a 360px mobile viewport (gym floor).

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Empty } from '../command/primitives.jsx';
import './vault.css';

const KCAL_GOAL = 2800;   // daily calorie goal (per directive)
const EAT_START = 12;     // 16/8 eating window opens 12:00
const EAT_END = 20;       // closes 20:00 → 8h eat · 16h fast
const KCAL_KEY = 'bbf.vault.kcal.v1';

// Macro targets derived from the 2800 goal — a standard performance split
// (35% protein / 40% carbs / 25% fat). Shown as targets, not tracked intake.
const MACROS = [
  { k: 'Protein', g: Math.round((KCAL_GOAL * 0.35) / 4) },
  { k: 'Carbs', g: Math.round((KCAL_GOAL * 0.40) / 4) },
  { k: 'Fat', g: Math.round((KCAL_GOAL * 0.25) / 9) },
];

function todayKey() { return new Date().toISOString().slice(0, 10); }

function fmtHM(hoursFloat) {
  const h = Math.floor(hoursFloat);
  const m = Math.round((hoursFloat - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatStamp(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function readKcal(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(KCAL_KEY) || '{}');
    return Number(all?.[uid]?.[todayKey()] || 0);
  } catch { return 0; }
}
function writeKcal(uid, val) {
  try {
    const all = JSON.parse(localStorage.getItem(KCAL_KEY) || '{}');
    all[uid] = all[uid] || {};
    all[uid][todayKey()] = val;
    localStorage.setItem(KCAL_KEY, JSON.stringify(all));
  } catch { /* private-mode / quota — value holds in component state */ }
}

// ── 16/8 fasting-window visualizer (current-time aware) ──────────────────────
function FastingWindow({ now }) {
  const h = now.getHours() + now.getMinutes() / 60;
  const eating = h >= EAT_START && h < EAT_END;
  const nowPct = (h / 24) * 100;
  const winLeft = (EAT_START / 24) * 100;
  const winWidth = ((EAT_END - EAT_START) / 24) * 100;

  let sub;
  if (eating) {
    sub = <>Eating window open — <b>{fmtHM(EAT_END - h)}</b> left to fuel.</>;
  } else {
    const until = h < EAT_START ? EAT_START - h : (24 - h) + EAT_START;
    sub = <>Fasting — <b>{fmtHM(until)}</b> until your window opens.</>;
  }

  return (
    <div className="pg-card">
      <div className="pg-fast-top">
        <span className="pg-fast-title">16 / 8 Fasting Window</span>
        <span className={`pg-fast-status ${eating ? 'is-eating' : 'is-fasting'}`}>
          {eating ? '🍽 Eating' : '🌙 Fasting'}
        </span>
      </div>
      <div className="pg-fast-track" role="img" aria-label={`Eating window noon to 8pm. It is currently ${eating ? 'inside' : 'outside'} the window.`}>
        <div className="pg-fast-window" style={{ left: `${winLeft}%`, width: `${winWidth}%` }} />
        <div className="pg-fast-now" style={{ left: `${nowPct}%` }} />
      </div>
      <div className="pg-fast-axis">
        <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
      </div>
      <div className="pg-fast-sub">{sub}</div>
    </div>
  );
}

// ── 2800 kcal daily-goal tracker (local quick-log) ───────────────────────────
function CalorieGoal({ uid }) {
  const [consumed, setConsumed] = useState(() => readKcal(uid));
  const [input, setInput] = useState('');

  const pct = Math.min(consumed / KCAL_GOAL, 1) * 100;
  const over = consumed > KCAL_GOAL;
  const remaining = KCAL_GOAL - consumed;

  const add = (n) => {
    const v = Math.max(0, consumed + n);
    setConsumed(v);
    writeKcal(uid, v);
  };
  const onAdd = () => {
    const n = parseInt(input, 10);
    if (!Number.isNaN(n) && n !== 0) { add(n); setInput(''); }
  };
  const reset = () => { setConsumed(0); writeKcal(uid, 0); };

  return (
    <div className="pg-card">
      <div className="pg-kcal-top">
        <span className="pg-kcal-title">Today’s Fuel</span>
        <span className="pg-kcal-nums">
          <b>{consumed.toLocaleString()}</b> <span className="pg-kcal-goal">/ {KCAL_GOAL.toLocaleString()} kcal</span>
        </span>
      </div>

      <div className="pg-kcal-bar">
        <div className={`pg-kcal-fill${over ? ' is-over' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="pg-kcal-rem">
        {over
          ? <><b>{Math.abs(remaining).toLocaleString()}</b> kcal over goal</>
          : <><b>{remaining.toLocaleString()}</b> kcal remaining</>}
      </div>

      <div className="pg-kcal-chips">
        {[300, 500, 750].map((n) => (
          <button key={n} type="button" className="pg-kcal-chip" onClick={() => add(n)}>+{n}</button>
        ))}
      </div>
      <div className="pg-kcal-log">
        <input
          className="pg-kcal-input"
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="log kcal"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Log calories consumed"
        />
        <button type="button" className="pg-kcal-add" onClick={onAdd}>Add</button>
      </div>
      {consumed > 0 ? <button type="button" className="pg-kcal-reset" onClick={reset}>Reset today</button> : null}

      <div className="pg-macros">
        {MACROS.map((m) => (
          <div key={m.k} className="pg-macro">
            <div className="pg-macro-k">{m.k}</div>
            <div className="pg-macro-v">{m.g}</div>
            <div className="pg-macro-u">g target</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Nutrition({ plans }) {
  const { user } = useAuth();
  const uid = user?.username || user?.id || 'guest';
  const mealPlan = plans?.mealPlan || '';
  const stamp = formatStamp(plans?.generatedAt);

  // Live clock so the fasting marker + status track the real time of day.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pg-nut">
      <div>
        <h2 className="pg-nut-head">Fueling Plan</h2>
        {stamp ? <div className="pg-nut-meta">Generated {stamp}</div> : null}
      </div>

      <FastingWindow now={now} />
      <CalorieGoal uid={uid} />

      <div className="pg-card">
        <div className="pg-meal-title">Assigned Meal Plan</div>
        {mealPlan ? (
          <pre className="pg-meal-text">{mealPlan}</pre>
        ) : (
          <Empty>
            No fueling plan assigned yet — your coach is dialing in your macros. It
            will appear here automatically the next time you sign in.
          </Empty>
        )}
      </div>
    </div>
  );
}
