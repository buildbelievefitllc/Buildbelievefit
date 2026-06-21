// src/lib/nutritionEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// NATIVE NUTRITION ENGINE (DB-driven meal selection + scaling). Deterministic,
// rule-based, ZERO AI spend. The sibling of lib/sportsEngine.js (training) — both
// feed the unified intake-staging pipeline.
//
// NOTE: distinct from components/vault/nutritionEngine.js, which computes TDEE/macros
// (calcTDEE/calcMacros) and portion-scales the CUISINE CATALOG (scaleMealPlan). THIS
// engine selects from the verified BBF meal DATABASE (lib/data/bbf_meal_database.json),
// filters by dietary profile, applies the 16/8 fasting protocol, and scales every
// meal's grams + macros to the athlete's exact TDEE.
//
//   buildMealPlan({ tdee, dietary_profile: 'Omnivore'|'Vegetarian'|'Vegan', is_fasting })
//     → a meal_plan object in the staged contract { days:[{day,meals:[{m,i,…}]}] }
//       (so the existing Nutrition tab renders it) | null when it can't build one.
//
// ⚠️ The DB is currently a SAMPLE scaffold — replace lib/data/bbf_meal_database.json
//    with the 30 verified BBF meals (same schema) before this ships to production.

import MEALS from './data/bbf_meal_database.json';

// Dietary nesting: a stricter meal always fits a looser profile (vegan ⊆ veg ⊆ omni).
const DIET_ALLOWED = {
  Omnivore: new Set(['Omnivore', 'Vegetarian', 'Vegan']),
  Vegetarian: new Set(['Vegetarian', 'Vegan']),
  Vegan: new Set(['Vegan']),
};

// Allergen SAFETY NET. The meal DB carries names, not allergen tags, so we infer
// allergens from the meal name by keyword and STRICTLY exclude any match (youth
// dietary safety — when in doubt, drop the meal). `allergens` is the canonical key
// list ('peanut'|'dairy'|'gluten') the Athlete Blueprint derives from the intake's
// dietary_restrictions multi-select.
const ALLERGEN_KEYWORDS = {
  peanut: ['peanut'],
  dairy: ['yogurt', 'cheese', 'feta', 'paneer', 'halloumi', 'mozzarella', 'cottage', 'whey', 'milk', 'cream', 'butter'],
  gluten: ['wheat', 'rye', 'bread', 'toast', 'pita', 'pasta', 'couscous', 'farro', 'barley', 'soba', 'oat'],
};
function mealHasAllergen(meal, allergens) {
  if (!Array.isArray(allergens) || !allergens.length) return false;
  const name = String(meal?.name || '').toLowerCase();
  return allergens.some((a) => (ALLERGEN_KEYWORDS[a] || []).some((kw) => name.includes(kw)));
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (v) => Math.round(num(v));

// First meal of a given slot in the (already diet-filtered) pool — deterministic.
function pickMeal(pool, type) {
  return pool.find((m) => String(m.meal_type || '').toLowerCase() === type) || null;
}

export function buildMealPlan({ tdee, dietary_profile = 'Omnivore', fasting_window = 'none', allergens = [] } = {}) {
  const target = num(tdee);
  if (target <= 0 || !Array.isArray(MEALS) || !MEALS.length) return null;

  const allow = DIET_ALLOWED[dietary_profile] || DIET_ALLOWED.Omnivore;
  // Diet profile AND the allergen safety net — a flagged allergen meal never enters the pool.
  const pool = MEALS.filter((m) => m && allow.has(m.dietary_profile) && !mealHasAllergen(m, allergens));

  // Clone selections so the imported DB is never mutated.
  const clone = (m) => (m ? { ...m } : null);
  let breakfast = clone(pickMeal(pool, 'breakfast'));
  let lunch = clone(pickMeal(pool, 'lunch'));
  let dinner = clone(pickMeal(pool, 'dinner'));
  if (!lunch || !dinner) return null; // need at least Lunch + Dinner to build a plan

  // ── Fasting protocol. 16/8 → DROP Breakfast and distribute its calories + macros
  //    EVENLY into Lunch + Dinner. 12/12 & 14/10 are time-restricted feeding windows
  //    that KEEP all three meals (only the eating window narrows) — no meal dropped.
  //    'none' → all three meals, scaled. (Youth are locked to 'none' upstream.) ─────
  if (fasting_window === '16/8' && breakfast) {
    const half = (v) => num(v) / 2;
    [lunch, dinner].forEach((m) => {
      m.calories = num(m.calories) + half(breakfast.calories);
      m.protein_g = num(m.protein_g) + half(breakfast.protein_g);
      m.carbs_g = num(m.carbs_g) + half(breakfast.carbs_g);
      m.fat_g = num(m.fat_g) + half(breakfast.fat_g);
      m.serving_g = num(m.serving_g) + half(breakfast.serving_g);
    });
    breakfast = null;
  }

  const selected = [breakfast, lunch, dinner].filter(Boolean);
  const combinedCalories = selected.reduce((s, m) => s + num(m.calories), 0);
  if (combinedCalories <= 0) return null;

  // ── Scaling multiplier: hit the athlete's exact TDEE. Scale grams + macros. ────
  const multiplier = target / combinedCalories;
  const scaled = selected.map((m) => ({
    ...m,
    serving_g: round(m.serving_g * multiplier),
    calories: round(m.calories * multiplier),
    protein_g: round(m.protein_g * multiplier),
    carbs_g: round(m.carbs_g * multiplier),
    fat_g: round(m.fat_g * multiplier),
  }));

  // Render into the STAGED meal_plan contract (days[].meals[] = { m, i, instructions }),
  // embedding scaled macros in `i` in the format the Nutrition tab already parses, plus
  // the structured fields for any consumer that wants them.
  const days = [{
    day: 'Daily',
    meals: scaled.map((m) => ({
      m: m.meal_type,
      i: `${String(m.name).replace(/^SAMPLE — /, '')} — ${m.serving_g}g (~${m.calories} cal / ${m.protein_g}g P / ${m.carbs_g}g C / ${m.fat_g}g F)`,
      serving_g: m.serving_g,
      calories: m.calories,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
    })),
  }];

  return {
    engine: 'bbf-native-nutrition-engine',
    generated_at: new Date().toISOString(),
    goal: `Native ${dietary_profile} Plan${fasting_window && fasting_window !== 'none' ? ` · ${fasting_window} Window` : ''}`,
    cal: target,
    calorie_target: target,
    dietary_profile,
    fasting_window: fasting_window || 'none',
    allergens_excluded: Array.isArray(allergens) ? allergens : [],
    scaling_multiplier: Math.round(multiplier * 1000) / 1000,
    days,
  };
}
