// src/components/vault/nutritionEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// Native Nutrition Engine — the rule-based counterpart to generatorEngine.js.
// PURE MATH, ZERO AI. Two responsibilities:
//
//   1. Mifflin-St Jeor TDEE + macro math (calcTDEE / calcMacros) — the SINGLE
//      source of truth, ported VERBATIM from the legacy TDEE widget (the same math
//      TDEECalculator.jsx renders). Both the calculator and the Pathfinder intake
//      import from here so the number a prospect sees == the number we stage.
//
//   2. The Portion Scaler (scaleMealPlan) — takes a base meal template from the
//      established catalog (cuisineMeals.js) and mathematically scales every meal's
//      ingredients, calories, and macros to land each DAY on the prospect's exact
//      tdee_target. No fixed-calorie templates: the foods themselves are rescaled.
//
// Output is the canonical meal_plan shape the Vault renders + the DB stores:
//   { name, cal, goal, days:[ { day, meals:[ { m, i, kcal, p, c, f } ] } ] }
// Per-meal macros are also folded into the `i` text because the Vault derives its
// macro wheel from the ingredient-line text (vaultApi.parseMealPlan → sumDayMacros).

// ── Mifflin-St Jeor (VERBATIM — do not re-derive) ────────────────────────────
// BMR × activity factor. wt in lb, height in ft+in; returns maintenance kcal.
export function calcTDEE(age, sex, wt, ft, ins, act) {
  const kg = wt * 0.453592;
  const cm = ((ft * 12) + ins) * 2.54;
  const bmr = sex === 'male'
    ? (10 * kg) + (6.25 * cm) - (5 * age) + 5
    : (10 * kg) + (6.25 * cm) - (5 * age) - 161;
  return Math.round(bmr * act);
}
// Protein from bodyweight (1.0 g/lb on a surplus, else 0.9), fat at 25% kcal,
// carbs as the remainder. Returns grams { p, c, f }.
export function calcMacros(cal, wt, adj) {
  const p = Math.round(wt * (adj > 0 ? 1.0 : 0.9));
  const f = Math.round((cal * 0.25) / 9);
  const c = Math.max(0, Math.round((cal - (p * 4) - (f * 9)) / 4));
  return { p, c, f };
}

// ── Portion Scaler ───────────────────────────────────────────────────────────
// Parse a leading quantity token from an ingredient segment: integer ("3"),
// decimal ("1.5"), fraction ("1/2"), or mixed ("1 1/2"). Returns a number or null.
function parseQty(tok) {
  const t = tok.trim();
  if (/^\d+\s+\d+\/\d+$/.test(t)) { const [w, fr] = t.split(/\s+/); const [a, b] = fr.split('/'); return parseInt(w, 10) + parseInt(a, 10) / parseInt(b, 10); }
  if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split('/'); return parseInt(a, 10) / parseInt(b, 10); }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}
// Round to the nearest cooking-friendly quarter, never below 1/4 (so a scaled-down
// ingredient is reduced, never silently dropped to zero).
function roundQuarter(x) { const r = Math.round(x * 4) / 4; return r < 0.25 ? 0.25 : r; }
// Format a quarter-rounded number as a readable mixed fraction ("3/4", "1 1/2", "2").
function fmtQty(x) {
  const whole = Math.floor(x + 1e-9);
  const frac = x - whole;
  const fracStr = frac >= 0.74 ? ' 3/4' : frac >= 0.49 ? ' 1/2' : frac >= 0.24 ? ' 1/4' : '';
  if (whole === 0) return fracStr.trim() || '0';
  return `${whole}${fracStr}`;
}
// Scale the leading quantity of one comma-separated ingredient segment by factor f.
// Segments without a leading quantity (e.g. "Mixed Greens", "Salsa") pass through.
function scaleSegment(seg, f) {
  const s = seg.trim();
  const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s+(.*)$/);
  if (!m) return s;
  const qty = parseQty(m[1]);
  if (qty == null) return s;
  return `${fmtQty(roundQuarter(qty * f))} ${m[2]}`;
}
function scaleIngredients(line, f) {
  if (!line) return '';
  return line.split(',').map((seg) => scaleSegment(seg, f)).join(', ');
}

// Scale a base template (cuisineMeals shape) so every DAY lands on targetKcal —
// each day is scaled by its OWN total, so template day-to-day variance is absorbed.
// Best-effort safe: returns null when the template or target is unusable (the
// caller then stages the TDEE/macros alone — never a fixed-calorie fallback plan).
export function scaleMealPlan(template, targetKcal, opts = {}) {
  const target = Math.round(Number(targetKcal) || 0);
  const days = Array.isArray(template?.days) ? template.days : [];
  if (target <= 0 || !days.length) return null;

  const outDays = days.map((d) => {
    const meals = Array.isArray(d.meals) ? d.meals : [];
    const dayKcal = meals.reduce((s, m) => s + (Number(m.kcal) || 0), 0);
    const f = dayKcal > 0 ? target / dayKcal : 1;
    return {
      day: d.day || '',
      meals: meals.map((m) => {
        const kcal = Math.round((Number(m.kcal) || 0) * f);
        const p = Math.round((Number(m.p) || 0) * f);
        const c = Math.round((Number(m.c) || 0) * f);
        const fat = Math.round((Number(m.f) || 0) * f);
        const ing = scaleIngredients(m.i || '', f);
        const ann = Number(m.kcal) ? ` (~${kcal} cal / ${p}g P / ${c}g C / ${fat}g F)` : '';
        return { m: m.m || '', i: `${ing}${ann}`, kcal, p, c, f: fat };
      }),
    };
  });

  return {
    name: opts.name || 'BBF Native Plan',
    cal: `~${target.toLocaleString()} cal/day`,
    goal: opts.goal || '',
    days: outDays,
  };
}
