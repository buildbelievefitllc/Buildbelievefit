// src/components/vault/Nutrition.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 — Client Vault · Nutrition (assigned fueling plan).
// Phase 20.1 — Visual reconstruction: premium dashboard for the fueling protocol.
// Phase 21.3 — DYNAMIC TDEE. Every target is now sourced live, never hardcoded:
//   • Fasting window  ← the user's metabolic_tier ("12:12 Foundation", "16:8", …)
//                       or an explicit somatic_fasting_hours (profile metrics RPC).
//   • Calorie goal    ← the AI meal_plan payload's `cal`, or the tdee_target column.
//   • Macros          ← the macro_p/c/f columns, else summed from the AI meal
//                       annotations.
//   • Meal plan       ← the structured AI payload, rendered as day/meal cards
//                       (never raw JSON); legacy plain-text plans still render as text.
// When a value isn't set, the UI shows an explicit empty state — it does NOT
// substitute a generalized default. The platform stays completely dynamic.

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { parseMealPlan, mealPlanFromSeed, parseFastingWindow } from '../../lib/vaultApi.js';
import { getMealPlan } from './mealData.js';
import MindsetEngine from './MindsetEngine.jsx';
import { Empty } from '../command/primitives.jsx';
import './vault.css';

const KCAL_KEY = 'bbf.vault.kcal.v1';

function todayKey() { return new Date().toISOString().slice(0, 10); }

function fmtHM(hoursFloat) {
  const h = Math.floor(hoursFloat);
  const m = Math.round((hoursFloat - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function fmtClock(hour24) {
  const h = ((hour24 % 24) + 24) % 24;
  const ampm = h < 12 ? 'a' : 'p';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ampm}`;
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

// ── Fasting-window visualizer (dynamic, current-time aware) ──────────────────
// `fasting` = { fast, eat } hours, resolved from the user's tier. The eating
// window is anchored to a 20:00 (8pm) cutoff — clinically sensible and the only
// presentation anchor; the ratio itself is fully dynamic. `tier` labels it.
function FastingWindow({ now, fasting, tier }) {
  if (!fasting) {
    return (
      <div className="pg-card">
        <div className="pg-fast-top">
          <span className="pg-fast-title">Fasting Window</span>
        </div>
        <Empty>No fasting protocol assigned yet — your coach sets your metabolic tier.</Empty>
      </div>
    );
  }

  const eatEnd = 20;                 // 8pm dinner cutoff (presentation anchor)
  const eatStart = eatEnd - fasting.eat;
  const h = now.getHours() + now.getMinutes() / 60;
  const eating = h >= eatStart && h < eatEnd;
  const nowPct = (h / 24) * 100;
  const winLeft = (eatStart / 24) * 100;
  const winWidth = (fasting.eat / 24) * 100;
  const ratioLabel = `${fasting.fast} / ${fasting.eat}`;

  let sub;
  if (eating) {
    sub = <>Eating window open — <b>{fmtHM(eatEnd - h)}</b> left to fuel.</>;
  } else {
    const until = h < eatStart ? eatStart - h : (24 - h) + eatStart;
    sub = <>Fasting — <b>{fmtHM(until)}</b> until your window opens.</>;
  }

  return (
    <div className="pg-card">
      <div className="pg-fast-top">
        <span className="pg-fast-title">{ratioLabel} Fasting Window</span>
        <span className={`pg-fast-status ${eating ? 'is-eating' : 'is-fasting'}`}>
          {eating ? '🍽 Eating' : '🌙 Fasting'}
        </span>
      </div>
      <div className="pg-fast-track" role="img" aria-label={`Eating window ${fmtClock(eatStart)} to ${fmtClock(eatEnd)}. Currently ${eating ? 'inside' : 'outside'} the window.`}>
        <div className="pg-fast-window" style={{ left: `${winLeft}%`, width: `${winWidth}%` }} />
        <div className="pg-fast-now" style={{ left: `${nowPct}%` }} />
      </div>
      <div className="pg-fast-axis">
        <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
      </div>
      <div className="pg-fast-sub">
        {sub}
        {tier ? <span className="pg-fast-tier"> · {tier}</span> : null}
      </div>
    </div>
  );
}

// ── Caloric Spin Wheel — radial intake gauge (replaces the flat bar) ─────────
// A circular dial: the gold arc sweeps from the top clockwise to the consumed
// fraction of the goal; turns red past 100%. Center shows consumed / goal. With
// no goal it shows a neutral ring + the raw logged total.
function CalorieWheel({ consumed, goal }) {
  const SIZE = 184;
  const STROKE = 16;
  const r = (SIZE - STROKE) / 2;
  const cx = SIZE / 2;
  const circ = 2 * Math.PI * r;
  const hasGoal = Number.isFinite(goal) && goal > 0;
  const frac = hasGoal ? Math.min(consumed / goal, 1) : 0;
  const over = hasGoal && consumed > goal;
  const dash = circ * frac;

  return (
    <div className="pg-wheel" role="img" aria-label={hasGoal ? `${consumed} of ${goal} kcal consumed` : `${consumed} kcal logged`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <linearGradient id="pg-wheel-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--yel)" />
            <stop offset="100%" stopColor="var(--gold-soft)" />
          </linearGradient>
        </defs>
        <circle className="pg-wheel-track" cx={cx} cy={cx} r={r} strokeWidth={STROKE} fill="none" />
        <circle
          className={`pg-wheel-arc${over ? ' is-over' : ''}`}
          cx={cx}
          cy={cx}
          r={r}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </svg>
      <div className="pg-wheel-center">
        <span className="pg-wheel-num">{consumed.toLocaleString()}</span>
        {hasGoal
          ? <span className="pg-wheel-goal">/ {goal.toLocaleString()} kcal</span>
          : <span className="pg-wheel-goal">kcal logged</span>}
        {hasGoal ? <span className={`pg-wheel-pct${over ? ' is-over' : ''}`}>{Math.round((consumed / goal) * 100)}%</span> : null}
      </div>
    </div>
  );
}

// ── Daily-fuel tracker (dynamic goal + macros, local quick-log) ──────────────
// `goal` (kcal) and `macros` ({p,c,f} grams) are dynamic and may be null — the
// tracker degrades to a logger-only state rather than inventing a target.
function CalorieGoal({ uid, goal, macros }) {
  const [consumed, setConsumed] = useState(() => readKcal(uid));
  const [input, setInput] = useState('');

  const hasGoal = Number.isFinite(goal) && goal > 0;
  const over = hasGoal && consumed > goal;
  const remaining = hasGoal ? goal - consumed : 0;

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

  const macroList = macros
    ? [
        { k: 'Protein', g: macros.p },
        { k: 'Carbs', g: macros.c },
        { k: 'Fat', g: macros.f },
      ].filter((m) => Number.isFinite(m.g) && m.g > 0)
    : [];

  return (
    <div className="pg-card">
      <div className="pg-kcal-top">
        <span className="pg-kcal-title">Today’s Fuel</span>
      </div>

      <CalorieWheel consumed={consumed} goal={goal} />

      {hasGoal ? (
        <div className="pg-kcal-rem">
          {over
            ? <><b>{Math.abs(remaining).toLocaleString()}</b> kcal over goal</>
            : <><b>{remaining.toLocaleString()}</b> kcal remaining</>}
        </div>
      ) : (
        <div className="pg-kcal-rem">No calorie target assigned yet — log freely; your coach will dial in your TDEE.</div>
      )}

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

      {macroList.length ? (
        <div className="pg-macros">
          {macroList.map((m) => (
            <div key={m.k} className="pg-macro">
              <div className="pg-macro-k">{m.k}</div>
              <div className="pg-macro-v">{m.g}</div>
              <div className="pg-macro-u">g target</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Structured meal-plan renderer (day → meal cards) ─────────────────────────
function MealPlanCard({ meal, stamp }) {
  if (meal.structured) {
    return (
      <div className="pg-card">
        <div className="pg-meal-title">
          Assigned Meal Plan
          {meal.goal ? <span className="pg-meal-goal"> · {meal.goal}</span> : null}
        </div>
        {meal.days.map((d, di) => (
          <div className="pg-meal-day" key={d.day + di}>
            <div className="pg-meal-dayhead">{d.day}</div>
            {d.meals.map((m, mi) => (
              <div className="pg-meal-item" key={m.m + mi}>
                <div className="pg-meal-when">{m.m}</div>
                <div className="pg-meal-what">{m.i}</div>
              </div>
            ))}
          </div>
        ))}
        {stamp ? <div className="pg-meal-stamp">Generated {stamp}</div> : null}
      </div>
    );
  }

  return (
    <div className="pg-card">
      <div className="pg-meal-title">Assigned Meal Plan</div>
      {meal.text ? (
        <pre className="pg-meal-text">{meal.text}</pre>
      ) : (
        <Empty>
          No fueling plan assigned yet — your coach is dialing in your macros. It
          will appear here automatically the next time you sign in.
        </Empty>
      )}
    </div>
  );
}

export default function Nutrition({ plans, profile }) {
  const { user } = useAuth();
  const uid = user?.username || user?.id || 'guest';
  const stamp = formatStamp(plans?.generatedAt);

  // Dynamic meal source: the database's AI-generated meal_plan wins; otherwise
  // fall back to the user's authorized coach-authored plan from the MP seed
  // catalog (keyed by login slug) — the same mechanism the workout grid uses for
  // the WP catalog. This is what restores the Original Five's blank nutrition.
  const dbMeal = plans?.mealPlan || '';
  const seedMeal = useMemo(() => getMealPlan(uid), [uid]);
  const meal = useMemo(
    () => (dbMeal ? parseMealPlan(dbMeal) : (seedMeal ? mealPlanFromSeed(seedMeal) : parseMealPlan(''))),
    [dbMeal, seedMeal],
  );
  const fasting = useMemo(
    () => parseFastingWindow(profile?.metabolicTier, profile?.fastingHours),
    [profile?.metabolicTier, profile?.fastingHours],
  );
  // Calorie target: AI meal-plan headline first, then the TDEE column.
  const calGoal = meal.cal ?? (Number.isFinite(profile?.tdeeTarget) ? profile.tdeeTarget : null);
  // Macros: structured columns first, then the summed AI meal annotations.
  const macros = (Number.isFinite(profile?.macroP) || Number.isFinite(profile?.macroC) || Number.isFinite(profile?.macroF))
    ? { p: profile?.macroP, c: profile?.macroC, f: profile?.macroF }
    : meal.macros;

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

      <FastingWindow now={now} fasting={fasting} tier={profile?.metabolicTier} />
      {/* Daily awareness module — mounted directly above the Caloric Spin Wheel. */}
      <MindsetEngine />
      <CalorieGoal uid={uid} goal={calGoal} macros={macros} />
      <MealPlanCard meal={meal} stamp={stamp} />
    </div>
  );
}
