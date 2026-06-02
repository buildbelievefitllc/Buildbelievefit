// src/components/vault/Nutrition.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Nutrition Locker — rebuilt (feature/ui-nutrition-rebuild).
//
// The clunky stacked layout is replaced by the prototype's clean, day-by-day
// experience:
//   • CUISINE selector (American / Mexican / Brazilian) swaps the active plan.
//   • Monday → Sunday interactive day-tabs (defaults to today).
//   • A conic-gradient macro wheel + P/C/F/KCAL legend + macro volume-ratio bar.
//   • Tappable meal cards (mark a meal done → the wheel + progress fill).
// The Sovereign Vault's 16/8 fasting-window visualiser is retained at the top
// (dynamic, sourced from the athlete's metabolic tier).
//
// NOTE: the cuisine plans are STATIC MOCK DATA (see cuisineMeals.js) driving the
// UI; per-athlete personalisation of a cuisine plan is a backend follow-up.
// The Mindset Engine has been removed entirely — it does not belong in Nutrition.

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { parseFastingWindow } from '../../lib/vaultApi.js';
import {
  rosterCall, updateTargets, compilePlan, toErrorMessage,
  TARGET_MAX, CUISINE_STYLES,
} from '../../lib/rosterApi.js';
import { CUISINES, CUISINE_PLANS, dayTotals, todayIndex } from './cuisineMeals.js';
import './vault.css';
import './nutrition.css';

const DONE_KEY = 'bbf.vault.nut.done.v1';
const EMPTY = [];

// Macro accent colours (legend boxes + volume-ratio segments).
const MACRO_COLORS = { p: '#ff5d5d', c: '#4dc3ff', f: '#ffb547' };

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
function isSnack(slot) {
  return /snack|lanche|ceia/i.test(slot || '');
}

// ── Done-state persistence (one node per uid → { cuisine: { day: idx[] } }) ───
function readUserDone(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
    return all?.[uid] && typeof all[uid] === 'object' ? all[uid] : {};
  } catch { return {}; }
}
function writeUserDone(uid, node) {
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
    all[uid] = node;
    localStorage.setItem(DONE_KEY, JSON.stringify(all));
  } catch { /* private-mode / quota — value holds in component state */ }
}

// ── Fasting-window visualiser (dynamic, current-time aware) ──────────────────
function FastingWindow({ now, fasting, tier }) {
  if (!fasting) {
    return (
      <div className="pg-card">
        <div className="pg-fast-top"><span className="pg-fast-title">Fasting Window</span></div>
        <div className="pg-meal-empty" style={{ color: 'var(--mut)' }}>
          No fasting protocol assigned yet — your coach sets your metabolic tier.
        </div>
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

// ── Conic macro wheel — consumed vs target (fills as meals are completed) ─────
function MacroWheel({ consumed, target }) {
  const hasTarget = target > 0;
  const frac = hasTarget ? Math.min(consumed / target, 1) : 0;
  const over = hasTarget && consumed > target;
  const deg = frac * 360;
  const ring = hasTarget
    ? `conic-gradient(from 0deg, var(--purp), var(--yel) ${deg}deg, #241a32 ${deg}deg 360deg)`
    : 'conic-gradient(#241a32 0 100%)';
  const pct = hasTarget ? Math.round((consumed / target) * 100) : 0;

  return (
    <div className="nl-wheel" role="img" aria-label={`${consumed} of ${target} kcal logged`}>
      <div className="nl-wheel-ring" style={{ background: ring }} />
      <div className="nl-wheel-hole">
        <span className="nl-wheel-kcal">{consumed.toLocaleString()}</span>
        <span className="nl-wheel-sub">/ {target.toLocaleString()} kcal</span>
        {hasTarget ? <span className={`nl-wheel-pct${over ? ' is-over' : ''}`}>{pct}%</span> : null}
      </div>
    </div>
  );
}

// ── Daily fuel card · wheel + P/C/F/KCAL legend + volume-ratio bar ───────────
function DailyFuel({ consumed, totals, doneCount, mealCount }) {
  const legend = [
    { k: 'PROTEIN', cur: consumed.p, tgt: totals.p, u: 'g', color: MACRO_COLORS.p },
    { k: 'CARBS', cur: consumed.c, tgt: totals.c, u: 'g', color: MACRO_COLORS.c },
    { k: 'FAT', cur: consumed.f, tgt: totals.f, u: 'g', color: MACRO_COLORS.f },
    { k: 'KCAL', cur: consumed.kcal, tgt: totals.kcal, u: '', color: 'var(--yel)' },
  ];

  // Macro volume ratio (share of total calories) — the day's composition.
  const pCal = totals.p * 4;
  const cCal = totals.c * 4;
  const fCal = totals.f * 9;
  const calSum = pCal + cCal + fCal || 1;
  const ratio = {
    p: Math.round((pCal / calSum) * 100),
    c: Math.round((cCal / calSum) * 100),
    f: Math.round((fCal / calSum) * 100),
  };

  const progPct = mealCount ? Math.round((doneCount / mealCount) * 100) : 0;

  return (
    <div className="pg-card">
      <div className="nl-fuel-title">Today’s Fuel</div>

      <MacroWheel consumed={consumed.kcal} target={totals.kcal} />

      <div className="nl-legend">
        {legend.map((m) => (
          <div key={m.k} className="nl-legend-box" style={{ borderTopColor: m.color }}>
            <div className="nl-legend-lbl">{m.k}</div>
            <div className="nl-legend-val">{m.cur.toLocaleString()}{m.u}</div>
            <div className="nl-legend-tgt">/ {m.tgt.toLocaleString()}{m.u}</div>
          </div>
        ))}
      </div>

      <div className="nl-ratio" aria-label="Macro volume ratio">
        <div className="nl-ratio-track">
          <div className="nl-ratio-seg" style={{ width: `${ratio.p}%`, background: MACRO_COLORS.p }} />
          <div className="nl-ratio-seg" style={{ width: `${ratio.c}%`, background: MACRO_COLORS.c }} />
          <div className="nl-ratio-seg" style={{ width: `${ratio.f}%`, background: MACRO_COLORS.f }} />
        </div>
        <div className="nl-ratio-legend">
          <span className="nl-ratio-key"><span className="nl-ratio-dot" style={{ background: MACRO_COLORS.p }} />Protein {ratio.p}%</span>
          <span className="nl-ratio-key"><span className="nl-ratio-dot" style={{ background: MACRO_COLORS.c }} />Carbs {ratio.c}%</span>
          <span className="nl-ratio-key"><span className="nl-ratio-dot" style={{ background: MACRO_COLORS.f }} />Fat {ratio.f}%</span>
        </div>
      </div>

      <div className="nl-mealprog">
        <span className="nl-mealprog-lbl">{doneCount} / {mealCount} meals · {progPct}%</span>
        <div className="nl-mealprog-track">
          <div className="nl-mealprog-fill" style={{ width: `${progPct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Meal card (tap to mark done) ─────────────────────────────────────────────
function MealCard({ meal, done, onToggle }) {
  const snack = isSnack(meal.m);
  const macros = `${meal.kcal} KCAL · ${meal.p}P / ${meal.c}C / ${meal.f}F`;
  return (
    <button
      type="button"
      className={`nl-meal${snack ? ' is-snack' : ''}${done ? ' is-done' : ''}`}
      onClick={onToggle}
      aria-pressed={done}
      aria-label={`${meal.m}: ${meal.i}. ${macros}. ${done ? 'Completed' : 'Mark complete'}`}
    >
      <span className="nl-meal-check" aria-hidden="true">✓</span>
      <span className="nl-meal-body">
        <span className="nl-meal-slot">{meal.m}</span>
        <div className="nl-meal-ing">{meal.i}</div>
        <span className="nl-meal-macros">{macros}</span>
      </span>
    </button>
  );
}

// ── Admin oversight console (coach-only) ─────────────────────────────────────
// The administrative layer inside the Nutrition Locker. Rendered ONLY for
// admin/trainer sessions — the boundary is enforced HERE (isAdmin gate) AND again
// server-side by the admin gateway every rosterCall passes through. Lets the head
// coach swap between active athletes, dial in their cuisine + macro targets, and
// recompile their AI performance plan against the live orchestration engine.
function cuisineLabel(id) {
  return (CUISINE_STYLES.find((s) => s.id === id) || {}).label || id;
}

function NumField({ label, value, onChange, disabled, accent }) {
  return (
    <label className="nc-field" style={{ borderTopColor: accent }}>
      <span className="nc-lbl">{label}</span>
      <input
        className="nc-input"
        type="number"
        min="0"
        max={TARGET_MAX}
        step="1"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function NutritionCoachConsole() {
  const [roster, setRoster] = useState(EMPTY);
  const [rosterErr, setRosterErr] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(true);

  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [cuisine, setCuisine] = useState(CUISINE_STYLES[0].id);
  const [macros, setMacros] = useState({ tdee_target: '', macro_p: '', macro_c: '', macro_f: '' });

  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [status, setStatus] = useState(null); // { kind:'ok'|'err', msg }

  // Load the roster once on mount.
  useEffect(() => {
    let cancelled = false;
    rosterCall('roster')
      .then((b) => { if (!cancelled) setRoster(Array.isArray(b.clients) ? b.clients : []); })
      .catch((e) => { if (!cancelled) setRosterErr(toErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoadingRoster(false); });
    return () => { cancelled = true; };
  }, []);

  // Load the selected athlete's detail → seed the macro inputs from their targets.
  // State is reset synchronously in the select handler (a user event), so this
  // effect mutates state ONLY inside the async callbacks — keeping it clear of
  // react-hooks/set-state-in-effect (mirrors vaultApi.useVaultProfile).
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    rosterCall('detail', { id: selectedId })
      .then((b) => {
        if (cancelled) return;
        const c = b.client || {};
        setDetail(c);
        setMacros({
          tdee_target: c.tdee_target ?? '',
          macro_p: c.macro_p ?? '',
          macro_c: c.macro_c ?? '',
          macro_f: c.macro_f ?? '',
        });
      })
      .catch((e) => { if (!cancelled) setStatus({ kind: 'err', msg: toErrorMessage(e) }); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Swap the active athlete. Resets the detail/macro/status state here (in the
  // user event) so the effect above stays side-effect-pure on its async path.
  function selectAthlete(id) {
    setSelectedId(id);
    setDetail(null);
    setMacros({ tdee_target: '', macro_p: '', macro_c: '', macro_f: '' });
    setStatus(null);
    setLoadingDetail(Boolean(id));
  }

  const setField = (k, v) => setMacros((m) => ({ ...m, [k]: v }));
  const busy = saving || compiling;

  async function saveMacros() {
    if (busy || !selectedId) return;
    setSaving(true);
    setStatus(null);
    try {
      const b = await updateTargets(selectedId, macros);
      setDetail((d) => ({ ...(d || {}), ...(b.client || {}) }));
      setStatus({ kind: 'ok', msg: 'Macro targets saved.' });
    } catch (e) {
      setStatus({ kind: 'err', msg: toErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function compile() {
    if (busy || !selectedId) return;
    setCompiling(true);
    setStatus(null);
    try {
      const b = await compilePlan(selectedId, { tdee_target: macros.tdee_target, cuisine });
      const days = Array.isArray(b.plan?.days) ? b.plan.days.length : 0;
      setStatus({
        kind: 'ok',
        msg: `Compiled — ${days}-day ${cuisineLabel(cuisine)} plan generated${b.persisted ? ' and saved to the athlete' : ''}.`,
      });
    } catch (e) {
      setStatus({ kind: 'err', msg: toErrorMessage(e) });
    } finally {
      setCompiling(false);
    }
  }

  return (
    <section className="nc-console" aria-label="Coach oversight console">
      <header className="nc-head">
        <span className="nc-badge">Coach Console</span>
        <h3 className="nc-title">AI Performance Studio</h3>
      </header>

      <label className="nc-field nc-field-wide">
        <span className="nc-lbl">Client Roster</span>
        <select
          className="nc-select"
          value={selectedId}
          onChange={(e) => selectAthlete(e.target.value)}
          disabled={loadingRoster || busy}
          aria-label="Select an athlete"
        >
          <option value="">{loadingRoster ? 'Loading roster…' : 'Select an athlete…'}</option>
          {roster.map((c) => (
            <option key={c.id} value={c.id}>{c.name || c.uid}</option>
          ))}
        </select>
      </label>
      {rosterErr ? <div className="nc-status is-err" role="alert">{rosterErr}</div> : null}

      {!selectedId ? (
        <div className="nc-hint">Select an athlete to set their cuisine, macro targets, and recompile their plan.</div>
      ) : loadingDetail ? (
        <div className="nc-status">Loading {detail?.name || 'athlete'}…</div>
      ) : (
        <>
          <div className="nc-grid">
            <label className="nc-field">
              <span className="nc-lbl">Cuisine Style</span>
              <select
                className="nc-select"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                disabled={busy}
                aria-label="Cuisine style"
              >
                {CUISINE_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <NumField label="Target KCAL" value={macros.tdee_target} onChange={(v) => setField('tdee_target', v)} disabled={busy} accent="var(--yel)" />
            <NumField label="Protein (g)" value={macros.macro_p} onChange={(v) => setField('macro_p', v)} disabled={busy} accent="#ff5d5d" />
            <NumField label="Carbs (g)" value={macros.macro_c} onChange={(v) => setField('macro_c', v)} disabled={busy} accent="#4dc3ff" />
            <NumField label="Fats (g)" value={macros.macro_f} onChange={(v) => setField('macro_f', v)} disabled={busy} accent="#ffb547" />
          </div>

          <div className="nc-actions">
            <button type="button" className="nc-btn nc-btn-ghost" onClick={saveMacros} disabled={busy}>
              {saving ? 'Saving…' : 'Save Macros'}
            </button>
            <button type="button" className="nc-btn nc-btn-primary" onClick={compile} disabled={busy}>
              {compiling ? 'Compiling…' : 'Compile AI Performance Plan'}
            </button>
          </div>
        </>
      )}

      {status ? (
        <div className={`nc-status ${status.kind === 'ok' ? 'is-ok' : 'is-err'}`} role="status">
          {status.msg}
        </div>
      ) : null}
    </section>
  );
}

export default function Nutrition({ profile }) {
  const { user, isAdmin } = useAuth();
  const uid = user?.username || user?.id || 'guest';

  const [cuisineId, setCuisineId] = useState(CUISINES[0].id);
  const [dayIdx, setDayIdx] = useState(() => todayIndex());

  const plan = CUISINE_PLANS[cuisineId];
  const day = plan.days[dayIdx];
  const totals = useMemo(() => dayTotals(day), [day]);

  // Completed-meal indexes — one persisted store for the user, keyed live by the
  // active cuisine + day (no effect needed; the lookup is derived each render).
  const dayName = day.day;
  const [doneStore, setDoneStore] = useState(() => readUserDone(uid));
  const done = doneStore?.[cuisineId]?.[dayName] || EMPTY;

  const toggleMeal = (idx) => {
    setDoneStore((prev) => {
      const cur = prev?.[cuisineId]?.[dayName] || [];
      const nextArr = cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx];
      const next = { ...prev, [cuisineId]: { ...(prev[cuisineId] || {}), [dayName]: nextArr } };
      writeUserDone(uid, next);
      return next;
    });
  };

  // Consumed macros = sum of completed meals.
  const consumed = useMemo(() => {
    return day.meals.reduce(
      (acc, m, i) => (done.includes(i)
        ? { kcal: acc.kcal + m.kcal, p: acc.p + m.p, c: acc.c + m.c, f: acc.f + m.f }
        : acc),
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
  }, [day, done]);

  const fasting = useMemo(
    () => parseFastingWindow(profile?.metabolicTier, profile?.fastingHours),
    [profile?.metabolicTier, profile?.fastingHours],
  );

  // Live clock so the fasting marker + status track the real time of day.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayI = todayIndex();

  return (
    <div className="pg-nut">
      {isAdmin ? <NutritionCoachConsole /> : null}

      <div className="nl-head-row">
        <div>
          <h2 className="pg-nut-head">Nutrition Plan</h2>
          <div className="pg-nut-meta">Your personalized 7-day meal plan</div>
        </div>
        <label className="nl-cuisine">
          <span className="nl-cuisine-lbl">Cuisine Style</span>
          <select
            className="nl-cuisine-select"
            value={cuisineId}
            onChange={(e) => setCuisineId(e.target.value)}
            aria-label="Cuisine style"
          >
            {CUISINES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
      </div>

      <FastingWindow now={now} fasting={fasting} tier={profile?.metabolicTier} />

      <div className="nl-day-head">
        <div className="nl-day-head-cuisine">{plan.label} · {dayName}</div>
        <div className="nl-day-head-cal">{totals.kcal.toLocaleString()} kcal / day</div>
        <div className="nl-day-head-goal">🎯 {plan.goal}</div>
      </div>

      <div className="nl-daynav" role="tablist" aria-label="Day of week">
        {plan.days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            role="tab"
            aria-selected={i === dayIdx}
            className={`nl-day-pill${i === dayIdx ? ' is-active' : ''}${i === todayI ? ' is-today' : ''}`}
            onClick={() => setDayIdx(i)}
          >
            {d.day.slice(0, 3)}
          </button>
        ))}
      </div>

      <DailyFuel
        consumed={consumed}
        totals={totals}
        doneCount={done.length}
        mealCount={day.meals.length}
      />

      <div>
        <div className="nl-meal-hint">Tap a meal to log it — your fuel wheel fills as you go.</div>
        {day.meals.map((m, i) => (
          <MealCard key={m.m + i} meal={m} done={done.includes(i)} onToggle={() => toggleMeal(i)} />
        ))}
      </div>
    </div>
  );
}
