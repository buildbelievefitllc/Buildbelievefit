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
//   • A client-selectable FASTING PACE (CEO override: intermittent fasting is now
//     fully OPTIONAL). 16/8 is no longer hardcoded — the athlete picks a pace
//     (Off · 12:12 · 14:10 · 16:8 · 18:6 · 20:4) and the eating-window visualiser
//     renders dynamically from that choice. Defaults to Off unless a coach tier is
//     assigned; the selection persists locally per user.
//
// NOTE: the cuisine plans are STATIC MOCK DATA (see cuisineMeals.js) driving the
// UI; per-athlete personalisation of a cuisine plan is a backend follow-up.
// The Mindset Engine has been removed entirely — it does not belong in Nutrition.

import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { parseFastingWindow } from '../../lib/vaultApi.js';
import {
  rosterCall, updateTargets, compilePlan, toErrorMessage,
  TARGET_MAX, CUISINE_STYLES,
} from '../../lib/rosterApi.js';
import { hasAdminToken } from '../../lib/adminAuth.js';
import AdminTokenGate from '../command/AdminTokenGate.jsx';
import { CUISINES, CUISINE_PLANS, dayTotals, todayIndex } from './cuisineMeals.js';
import './vault.css';
import './nutrition.css';

const DONE_KEY = 'bbf.vault.nut.done.v1';
const PACE_KEY = 'bbf.vault.nut.fastpace.v1';
const EMPTY = [];

// Clean fallback for a meal that loads without auto-generated prep steps (legacy
// data, or a generation that returned macros but no instructions). NEVER surface a
// "coach protocol pending" dead-end — the workflow is automated, not coach-gated.
const PREP_FALLBACK = 'Standard macro preparation.';

// Macro accent colours (legend boxes + volume-ratio segments).
const MACRO_COLORS = { p: '#ff5d5d', c: '#4dc3ff', f: '#ffb547' };

// ── Fasting Pace (CEO override: intermittent fasting is OPTIONAL) ─────────────
// The full menu of time-restricted-feeding intervals. `off` is the default state
// for clients not fasting (no eating-window restriction). fast + eat = 24h so the
// shape matches parseFastingWindow()'s { fast, eat } contract verbatim.
const FASTING_PACES = [
  { id: 'off',   short: 'Disabled',  fast: 0,  eat: 24 },
  { id: '12:12', short: 'Circadian', fast: 12, eat: 12 },
  { id: '14:10', short: 'Primer',    fast: 14, eat: 10 },
  { id: '16:8',  short: 'Standard',  fast: 16, eat: 8 },
  { id: '18:6',  short: 'Advanced',  fast: 18, eat: 6 },
  { id: '20:4',  short: 'Warrior',   fast: 20, eat: 4 },
];

// Map a parsed { fast, eat } window onto a known pace id (for seeding the selector
// from a coach-assigned metabolic tier). Returns null when there is no match.
function paceIdFromWindow(win) {
  if (!win) return null;
  const hit = FASTING_PACES.find((p) => p.id !== 'off' && p.fast === win.fast && p.eat === win.eat);
  return hit ? hit.id : null;
}

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

// ── Fasting-pace persistence (one node per uid → paceId) ─────────────────────
function readUserPace(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(PACE_KEY) || '{}');
    const id = all?.[uid];
    return FASTING_PACES.some((p) => p.id === id) ? id : null;
  } catch { return null; }
}
function writeUserPace(uid, paceId) {
  try {
    const all = JSON.parse(localStorage.getItem(PACE_KEY) || '{}');
    all[uid] = paceId;
    localStorage.setItem(PACE_KEY, JSON.stringify(all));
  } catch { /* private-mode / quota — value holds in component state */ }
}

// ── Fasting-window visualiser (dynamic, current-time aware) ──────────────────
// `fasting` is null when the pace is Off — time-restricted feeding is optional,
// so this renders an "unrestricted" state rather than a "not assigned" error.
function FastingWindow({ now, fasting, tier }) {
  if (!fasting) {
    return (
      <div className="nl-fast-window is-off">
        <div className="pg-fast-top">
          <span className="pg-fast-title">Eating Window</span>
          <span className="pg-fast-status is-eating">🍽 Unrestricted</span>
        </div>
        <div className="nl-fast-offmsg">
          Time-restricted feeding is <b>off</b> — pick a Fasting Pace above to map your eating window.
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
    <div className="nl-fast-window">
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

// ── Fasting Pace card — the client-controlled selector + the live window ─────
// The selector is the single source of truth for the displayed eating window;
// 16/8 is just one option, never a hardcoded default.
function FastingPaceCard({ now, paceId, onSelectPace, tier }) {
  const selected = FASTING_PACES.find((p) => p.id === paceId) || FASTING_PACES[0];
  const fasting = selected.id === 'off' ? null : { fast: selected.fast, eat: selected.eat };

  return (
    <div className="pg-card nl-fast">
      <div className="nl-fast-head">
        <span className="nl-fast-kicker">Fasting Pace</span>
        <span className="nl-fast-note">Time-restricted feeding · optional</span>
      </div>

      <div className="nl-pace" role="radiogroup" aria-label="Fasting pace">
        {FASTING_PACES.map((p) => {
          const active = p.id === paceId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`nl-pace-chip${active ? ' is-active' : ''}${p.id === 'off' ? ' is-off' : ''}`}
              onClick={() => onSelectPace(p.id)}
            >
              <span className="nl-pace-ratio">{p.id === 'off' ? 'Off' : p.id}</span>
              <span className="nl-pace-desc">{p.short}</span>
            </button>
          );
        })}
      </div>

      <FastingWindow now={now} fasting={fasting} tier={tier} />
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

// ── Meal thumbnail — real image_url, else a brutalist BBF wireframe skeleton ──
// The plan data MAY carry an `image_url` per meal; until the backend maps one (and
// if a mapped URL 404s) we fall back to an intentional dark-mode placeholder so the
// card never shows a broken-image glyph.
function MealThumb({ src }) {
  const [broken, setBroken] = useState(false);
  const url = (src || '').trim();
  if (url && !broken) {
    return (
      <span className="nl-meal-thumb">
        <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span className="nl-meal-thumb nl-meal-thumb--ph" aria-hidden="true">
      <span className="nl-meal-thumb-mark">BBF</span>
    </span>
  );
}

// Accept an instructions ARRAY or a newline-delimited STRING → clean step list.
function normalizeInstructions(instructions) {
  if (Array.isArray(instructions)) {
    return instructions.map((s) => String(s || '').trim()).filter(Boolean);
  }
  if (typeof instructions === 'string') {
    return instructions.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// ── Meal card — thumbnail · tap-to-log body · Prep Instructions drawer ────────
// The card is a container (not one big button) so the "mark done" control and the
// "Prep Instructions" toggle are separate, non-nested interactive elements.
function MealCard({ meal, done, onToggle }) {
  const [prepOpen, setPrepOpen] = useState(false);
  const snack = isSnack(meal.m);
  const macros = `${meal.kcal} KCAL · ${meal.p}P / ${meal.c}C / ${meal.f}F`;
  const steps = normalizeInstructions(meal.instructions);

  return (
    <div className={`nl-meal${snack ? ' is-snack' : ''}${done ? ' is-done' : ''}`}>
      <button
        type="button"
        className="nl-meal-main"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={`${meal.m}: ${meal.i}. ${macros}. ${done ? 'Completed' : 'Mark complete'}`}
      >
        <span className="nl-meal-check" aria-hidden="true">✓</span>
        <MealThumb src={meal.image_url} />
        <span className="nl-meal-body">
          <span className="nl-meal-slot">{meal.m}</span>
          <div className="nl-meal-ing">{meal.i}</div>
          <span className="nl-meal-macros">{macros}</span>
        </span>
      </button>

      <div className="nl-meal-prep-wrap">
        <button
          type="button"
          className="nl-meal-prep-btn"
          aria-expanded={prepOpen}
          onClick={() => setPrepOpen((o) => !o)}
        >
          <span>🍳 Prep Instructions</span>
          <span className="nl-meal-prep-caret" aria-hidden="true">{prepOpen ? '▲' : '▼'}</span>
        </button>
        {prepOpen ? (
          steps.length ? (
            <ol className="nl-meal-prep-list">
              {steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          ) : (
            // Failsafe (CEO · Zero-Labor Doctrine): prep steps are now AUTO-GENERATED
            // by the meal engine from each meal's ingredients. Legacy/edge meals that
            // load without an instructions array degrade to a clean macro-prep line —
            // never the old "Awaiting coach protocol" dead placeholder.
            <div className="nl-meal-prep-empty">{PREP_FALLBACK}</div>
          )
        ) : null}
      </div>
    </div>
  );
}

// ── Admin oversight console (coach-only · Command Center surface) ─────────────
// The administrative layer inside the Nutrition Locker. Rendered ONLY on the
// Sovereign Command Center routing (/command) AND for admin/trainer sessions — the
// boundary is enforced HERE (route + isAdmin gate, so it can never leak into the
// personal Client Profile Hub at /vault) AND again server-side by the admin gateway
// every rosterCall passes through. Lets the head coach swap between active athletes,
// dial in their cuisine + macro targets, and recompile their AI performance plan
// against the live orchestration engine.
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

// The AI Performance Studio is an ADMIN console whose calls (rosterApi) replay the
// X-BBF-Admin-Token. The Nutrition Locker isn't behind the Command Center's token
// gate, so mount the console only once the token is hydrated — otherwise its
// roster/compile calls 401. Until then, the unlock gate hydrates it (shared store,
// so unlocking any admin surface satisfies this too; never bundled, §7).
function NutritionStudioGate() {
  const [ready, setReady] = useState(hasAdminToken);
  if (ready) return <NutritionCoachConsole />;
  return (
    <section className="nc-console" aria-label="Coach oversight console">
      <header className="nc-head">
        <span className="nc-badge">Coach Console</span>
        <h3 className="nc-title">AI Performance Studio</h3>
      </header>
      <AdminTokenGate surface="the AI Performance Studio" onUnlock={() => setReady(true)} />
    </section>
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

  // SURFACE GATE (forensic fix · Nutrition Locker logic leak) — the coach console
  // (athlete-selection dropdown + admin-token gate) is a COMMAND CENTER surface
  // ONLY. It must never render in the personal Client Profile Hub (/vault), where
  // the locker defaults strictly to the AUTHENTICATED USER'S OWN profile (uid +
  // the passed `profile`). Gate on the ROUTE, not the role: the CEO trains as a
  // Player-Coach and reads as `isAdmin` everywhere, so the old role-only check
  // leaked the dropdown — and its 401-on-admin-token path — into his own vault.
  // /command is the Sovereign Command Center routing (AdminGuard-gated); only there
  // do the admin controls mount.
  const onCommandSurface = useLocation().pathname.startsWith('/command');

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

  // Fasting Pace — client-controlled (CEO override: IF is optional). Seed from a
  // saved choice, else a coach-assigned tier, else Off. Persisted per user; never
  // auto-overridden once the athlete has chosen.
  const [paceId, setPaceId] = useState(() => {
    const saved = readUserPace(uid);
    if (saved) return saved;
    return paceIdFromWindow(parseFastingWindow(profile?.metabolicTier, profile?.fastingHours)) || 'off';
  });
  const selectPace = (id) => {
    setPaceId(id);
    writeUserPace(uid, id);
  };

  // Live clock so the fasting marker + status track the real time of day.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayI = todayIndex();

  return (
    <div className="pg-nut">
      {isAdmin && onCommandSurface ? <NutritionStudioGate /> : null}

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

      {/* Fasting Pace selector + daily macro tracking, side by side. */}
      <div className="nl-fastfuel">
        <FastingPaceCard
          now={now}
          paceId={paceId}
          onSelectPace={selectPace}
          tier={profile?.metabolicTier}
        />
        <DailyFuel
          consumed={consumed}
          totals={totals}
          doneCount={done.length}
          mealCount={day.meals.length}
        />
      </div>

      <div>
        <div className="nl-meal-hint">Tap a meal to log it — your fuel wheel fills as you go.</div>
        {day.meals.map((m, i) => (
          // key includes cuisine + day so switching tabs remounts each card —
          // resetting its local prep-drawer / broken-thumbnail state for the new meal.
          <MealCard key={`${cuisineId}-${dayName}-${i}`} meal={m} done={done.includes(i)} onToggle={() => toggleMeal(i)} />
        ))}
      </div>
    </div>
  );
}
