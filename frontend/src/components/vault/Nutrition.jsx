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
import { parseFastingWindow, parseMealPlan } from '../../lib/vaultApi.js';
import {
  rosterCall, updateTargets, compilePlan, toErrorMessage, TARGET_MAX,
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

// ── Coach Oversight Console (admin-only) ─────────────────────────────────────
// The administrative layer inside the Nutrition Locker, surfaced via the
// dual-toggle header. Rendered ONLY for admin/trainer sessions — the boundary is
// enforced HERE (the isAdmin toggle gate) AND server-side by the admin gateway
// every rosterCall passes through. The coach picks an athlete from the LIVE
// Supabase roster, inspects their assigned meal blueprint, then pushes a
// calorie/phase override + directive that commits to the client's record and
// recompiles their plan through the orchestration engine.

// Athletic phase presets (the prototype's "ATHLETIC PHASE ASSIGNMENT" select).
const ATHLETIC_PHASES = ['Shred Phase', 'Lean Recomp', 'Athletic Base', 'Hypertrophy Power', 'Extreme Bulk'];

// Monogram initials for the roster avatar (the profile payload carries no photo).
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// One athlete row in the COACH ROSTER SELECTION list.
function RosterRow({ client, active, onSelect }) {
  const tag = client.metabolic_tier || client.subscription_tier || client.role || 'Athlete';
  return (
    <button type="button" className={`co-row${active ? ' is-active' : ''}`} onClick={onSelect} aria-pressed={active}>
      <span className="co-ava" aria-hidden="true">{initials(client.name || client.uid)}</span>
      <span className="co-row-body">
        <span className="co-row-name">{client.name || client.uid}</span>
        <span className="co-row-tag">{tag}</span>
      </span>
      {active ? <span className="co-row-dot" aria-hidden="true" /> : null}
    </button>
  );
}

// One assigned-meal card in the "ANALYZING ATHLETE MEAL BLUE-PRINTS" grid.
function BlueprintCard({ slot, body }) {
  return (
    <div className="co-meal">
      <div className="co-meal-slot">{slot}</div>
      <div className="co-meal-body">{body || '—'}</div>
    </div>
  );
}

function CoachOversightConsole() {
  const [roster, setRoster] = useState(EMPTY);
  const [rosterErr, setRosterErr] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(true);

  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Override inputs (the "AMPLIFY NUTRITIONAL PRESCRIPTIONS" section).
  const [kcal, setKcal] = useState('');
  const [phase, setPhase] = useState('Hypertrophy Power');
  const [directive, setDirective] = useState('');

  const [pushing, setPushing] = useState(false);
  const [status, setStatus] = useState(null); // { kind:'ok'|'err', msg }

  // Load the live roster once — these are real Supabase client profiles.
  useEffect(() => {
    let cancelled = false;
    rosterCall('roster')
      .then((b) => { if (!cancelled) setRoster(Array.isArray(b.clients) ? b.clients : []); })
      .catch((e) => { if (!cancelled) setRosterErr(toErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoadingRoster(false); });
    return () => { cancelled = true; };
  }, []);

  // Load the selected athlete's full record. State is reset synchronously in the
  // row handler (a user event), so this effect mutates state ONLY inside the async
  // callbacks — clear of react-hooks/set-state-in-effect (mirrors useVaultProfile).
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    rosterCall('detail', { id: selectedId })
      .then((b) => {
        if (cancelled) return;
        const c = b.client || {};
        setDetail(c);
        setKcal(c.tdee_target ?? '');
      })
      .catch((e) => { if (!cancelled) setStatus({ kind: 'err', msg: toErrorMessage(e) }); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  function selectAthlete(id) {
    if (id === selectedId) return;
    setSelectedId(id);
    setDetail(null);
    setKcal('');
    setPhase('Hypertrophy Power');
    setDirective('');
    setStatus(null);
    setLoadingDetail(Boolean(id));
  }

  // The athlete's assigned plan ("what they got") — parsed from their stored
  // meal_plan; day one is surfaced as the representative blueprint.
  const blueprint = useMemo(() => parseMealPlan(detail?.meal_plan), [detail?.meal_plan]);
  const blueprintDay = blueprint.days[0] || null;

  // PUSH OVERSIGHT DIRECT PROTOCOL — commit the calorie override to the client's
  // record (update_target) AND recompile their plan with the phase + directive
  // folded into the generation context (compile relay → Render orchestrator).
  async function pushProtocol() {
    if (pushing || !selectedId) return;
    setPushing(true);
    setStatus(null);
    try {
      const saved = await updateTargets(selectedId, { tdee_target: kcal });
      setDetail((d) => ({ ...(d || {}), ...(saved.client || {}) }));
      const directiveLine = [`Athletic phase: ${phase}.`, directive.trim()].filter(Boolean).join(' ');
      const b = await compilePlan(selectedId, { tdee_target: kcal, phase, directive: directiveLine });
      const days = Array.isArray(b.plan?.days) ? b.plan.days.length : 0;
      setStatus({
        kind: 'ok',
        msg: `Protocol pushed — ${(kcal || detail?.tdee_target) ?? '—'} kcal · ${phase}${days ? ` · ${days}-day plan recompiled` : ''}${b.persisted ? ' and synced to the athlete' : ''}.`,
      });
    } catch (e) {
      setStatus({ kind: 'err', msg: toErrorMessage(e) });
    } finally {
      setPushing(false);
    }
  }

  const name = detail?.name || detail?.uid || '';
  const paradigm = detail?.metabolic_tier || detail?.block_priority || detail?.subscription_tier || 'Unassigned';
  const macroLine = [
    { k: 'Calories', v: detail?.tdee_target, u: ' kcal' },
    { k: 'Protein', v: detail?.macro_p, u: 'g' },
    { k: 'Carbs', v: detail?.macro_c, u: 'g' },
    { k: 'Fats', v: detail?.macro_f, u: 'g' },
  ];

  return (
    <section className="co-console" aria-label="Coach oversight console">
      {/* ── COACH ROSTER SELECTION ── */}
      <div className="co-roster">
        <div className="co-section-lbl">Coach Roster Selection{roster.length ? ` (${roster.length})` : ''}</div>
        {loadingRoster ? (
          <div className="co-note">Loading roster from the client database…</div>
        ) : rosterErr ? (
          <div className="co-note is-err" role="alert">{rosterErr}</div>
        ) : !roster.length ? (
          <div className="co-note">No athletes on the roster yet.</div>
        ) : (
          <div className="co-roster-list">
            {roster.map((c) => (
              <RosterRow key={c.id} client={c} active={c.id === selectedId} onSelect={() => selectAthlete(c.id)} />
            ))}
          </div>
        )}
        <div className="co-meta">
          Roster DB metadata — pushed modifications sync instantly with the central client database
          and adjust the athlete dashboard.
        </div>
      </div>

      {/* ── ACTIVE ATHLETE OVERSIGHT ── */}
      {!selectedId ? (
        <div className="co-empty">Select an athlete to load their blueprint and override pipeline.</div>
      ) : loadingDetail ? (
        <div className="co-note">Loading {name || 'athlete'}…</div>
      ) : (
        <div className="co-active">
          <div className="co-active-head">
            <div>
              <span className="co-badge">Active Athlete Locker Oversight</span>
              <h3 className="co-name">{name}</h3>
              <div className="co-paradigm">Current Goal Paradigm: <b>{paradigm}</b></div>
            </div>
            <div className="co-metric">
              <span className="co-metric-lbl">Goal Streak</span>
              <span className="co-metric-val">{Number(detail?.current_streak ?? 0)}</span>
            </div>
          </div>

          <div className="co-blueprint">
            <div className="co-section-lbl">🍴 Analyzing Athlete Meal Blue-Prints</div>
            {blueprintDay && blueprintDay.meals.length ? (
              <div className="co-meal-grid">
                {blueprintDay.meals.slice(0, 4).map((m, i) => (
                  <BlueprintCard key={i} slot={m.m || `Meal ${i + 1}`} body={m.i} />
                ))}
              </div>
            ) : (
              <div className="co-note">No structured meal blueprint assigned yet — push a protocol below to compile one.</div>
            )}
            <div className="co-macros">
              {macroLine.map((m) => (
                <div key={m.k} className="co-macro">
                  <span className="co-macro-k">{m.k}:</span>{' '}
                  <span className="co-macro-v">{m.v != null && m.v !== '' ? `${Number(m.v).toLocaleString()}${m.u}` : '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── OVERRIDE PIPELINE ── */}
          <div className="co-override">
            <div className="co-section-lbl">⚙ Amplify Nutritional Prescriptions (Override Inputs)</div>
            <div className="co-override-grid">
              <label className="co-field">
                <span className="co-lbl">Calorie Override Index</span>
                <input
                  className="co-input"
                  type="number" min="0" max={TARGET_MAX} step="1" inputMode="numeric"
                  value={kcal}
                  placeholder="e.g. 2800"
                  disabled={pushing}
                  onChange={(e) => setKcal(e.target.value)}
                />
              </label>
              <label className="co-field">
                <span className="co-lbl">Athletic Phase Assignment</span>
                <select className="co-input" value={phase} disabled={pushing} onChange={(e) => setPhase(e.target.value)}>
                  {ATHLETIC_PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <label className="co-field">
              <span className="co-lbl">Coach Directive Mandate (Feedback)</span>
              <textarea
                className="co-input co-textarea"
                rows={3}
                value={directive}
                disabled={pushing}
                placeholder={`Enter instructions for ${name || 'the athlete'}… e.g. Scale caloric threshold up +15% centered on the lunch sequence on heavy quad days.`}
                onChange={(e) => setDirective(e.target.value)}
              />
            </label>
            <button type="button" className="co-push" onClick={pushProtocol} disabled={pushing}>
              {pushing ? 'Pushing Protocol…' : '⤵ Push Oversight Direct Protocol'}
            </button>
            {status ? (
              <div className={`co-status ${status.kind === 'ok' ? 'is-ok' : 'is-err'}`} role="status">{status.msg}</div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

export default function Nutrition({ profile }) {
  const { user, isAdmin } = useAuth();
  const uid = user?.username || user?.id || 'guest';

  // Dual-toggle: athlete-facing scheduler vs the admin Coach Oversight Console.
  // The toggle (and the oversight view) only exist for admin/trainer sessions.
  const [mode, setMode] = useState('scheduler');

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

  const oversight = isAdmin && mode === 'oversight';

  return (
    <div className="pg-nut">
      {isAdmin ? (
        <div className="nlx-toggle" role="tablist" aria-label="Nutrition view">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'scheduler'}
            className={`nlx-tog${mode === 'scheduler' ? ' is-active' : ''}`}
            onClick={() => setMode('scheduler')}
          >
            🍴 Nutrition Scheduler
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'oversight'}
            className={`nlx-tog nlx-tog-coach${mode === 'oversight' ? ' is-active' : ''}`}
            onClick={() => setMode('oversight')}
          >
            🛡 Coach Oversight Console
          </button>
        </div>
      ) : null}

      {oversight ? <CoachOversightConsole /> : (
      <>
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
      </>
      )}
    </div>
  );
}
