// src/lib/athleteBlueprint.js
// ─────────────────────────────────────────────────────────────────────────────
// THE ATHLETE BLUEPRINT — orchestration layer that fuses the THREE existing
// engines into one unified plan from a single athlete profile. Pure wiring; the
// engines are untouched.
//
//   1 · FIELD WORK   → buildSportsProtocol (lib/sportsEngine.js)
//   2 · WEIGHT ROOM  → generateProgram + toAssignedPlan (vault/generatorEngine.js)
//   3 · FUEL         → bbf_compute_macro_targets RPC (TDEE, server-side, never a
//                      client guess) → buildMealPlan (lib/nutritionEngine.js)
//
// IMMUTABLE LAWS honored here:
//   • NO duplicate strength work — the sports protocol's "Strength Foundation"
//     block is dropped; the weight room (generateProgram) owns barbell strength.
//   • Barbell back squat + crunches are excluded by BOTH engines already
//     (sportsEngine Immutable Laws · generatorEngine BLACKLIST) — we never undo it.
//   • TDEE comes from the SQL RPC, not arithmetic in the client.

import { supabase } from './supabaseClient.js';
import { buildSportsProtocol } from './sportsEngine.js';
import { generateProgram, toAssignedPlan } from '../components/vault/generatorEngine.js';
import { buildMealPlan } from './nutritionEngine.js';

// ── PHASE 2 · The Intelligence Layer — sport+position → engine pre-sets ──────────
// Maps a discipline/position onto the weight-room goal + split architecture (and a
// nutrition lean). Every value is a sane DEFAULT the athlete can override.
//   goal ∈ generatorEngine GOALS (hypertrophy|strength|endurance|general)
//   arch ∈ generatorEngine SPLITS (full|upper-lower|ppl|bro|arnold)
const POSITION_PRESET = {
  football: {
    OL: { goal: 'strength', arch: 'upper-lower' }, DL: { goal: 'strength', arch: 'upper-lower' },
    TE: { goal: 'hypertrophy', arch: 'upper-lower' }, LB: { goal: 'hypertrophy', arch: 'upper-lower' },
    QB: { goal: 'general', arch: 'full' }, WR: { goal: 'general', arch: 'full' },
    RB: { goal: 'general', arch: 'full' }, DB: { goal: 'general', arch: 'full' }, S: { goal: 'general', arch: 'full' },
    default: { goal: 'general', arch: 'full' },
  },
  basketball: {
    PG: { goal: 'general', arch: 'full' }, SG: { goal: 'general', arch: 'full' },
    SF: { goal: 'general', arch: 'upper-lower' }, PF: { goal: 'hypertrophy', arch: 'upper-lower' },
    C: { goal: 'strength', arch: 'upper-lower' }, default: { goal: 'general', arch: 'full' },
  },
  soccer: { GK: { goal: 'general', arch: 'full' }, default: { goal: 'endurance', arch: 'full' } },
  baseball: {
    P: { goal: 'general', arch: 'full' }, C: { goal: 'hypertrophy', arch: 'upper-lower' },
    IF: { goal: 'general', arch: 'full' }, OF: { goal: 'general', arch: 'full' }, default: { goal: 'general', arch: 'full' },
  },
  softball: {
    P: { goal: 'general', arch: 'full' }, C: { goal: 'hypertrophy', arch: 'upper-lower' },
    IF: { goal: 'general', arch: 'full' }, OF: { goal: 'general', arch: 'full' }, default: { goal: 'general', arch: 'full' },
  },
  volleyball: {
    MB: { goal: 'hypertrophy', arch: 'upper-lower' }, OPP: { goal: 'hypertrophy', arch: 'upper-lower' },
    OH: { goal: 'general', arch: 'full' }, S: { goal: 'general', arch: 'full' }, LIB: { goal: 'general', arch: 'full' },
    default: { goal: 'general', arch: 'full' },
  },
  track: { default: { goal: 'general', arch: 'full' } },
  default: { default: { goal: 'general', arch: 'full' } },
};

// The athlete-facing label for the pre-set goal (what the UI reads back).
export const GOAL_LABEL = {
  strength: { en: 'Strength / Mass', es: 'Fuerza / Masa', pt: 'Força / Massa' },
  hypertrophy: { en: 'Hypertrophy', es: 'Hipertrofia', pt: 'Hipertrofia' },
  endurance: { en: 'Endurance', es: 'Resistencia', pt: 'Resistência' },
  general: { en: 'Athleticism', es: 'Atletismo', pt: 'Atletismo' },
};

export function presetsForAthlete({ sportId, positionCode } = {}) {
  const sport = POSITION_PRESET[sportId] || POSITION_PRESET.default;
  const preset = sport[positionCode] || sport.default || POSITION_PRESET.default.default;
  return { goal: preset.goal, arch: preset.arch };
}

// ── Profile → engine-input translators ───────────────────────────────────────
export function levelToExperience(level) {
  const n = Number(level);
  return n >= 3 ? 'advanced' : n === 2 ? 'intermediate' : 'beginner';
}
export function tierToPhase(tier) {
  if (tier === 'collegiate') return 3;
  if (tier === 'high_school') return 2;
  return 1; // youth / middle_school
}
export function levelForTier(tier) {
  if (tier === 'collegiate') return 3;
  if (tier === 'high_school') return 2;
  return 1; // youth / middle_school — beginner loading
}
function sexToGender(sex) {
  const s = String(sex || '').toLowerCase();
  return s === 'female' || s === 'f' ? 'female' : s === 'any' ? 'any' : 'male';
}
// Nutrition lean from the training goal — youth never "cut"; mass goals run a small
// surplus, everything else maintains (growth-safe).
function nutritionGoal(goal) {
  return goal === 'strength' || goal === 'hypertrophy' ? 'gain' : 'maintain';
}

// Strip the sports protocol's strength block — the weight room owns barbell strength
// (IMMUTABLE LAW: no duplicate strength work).
function fieldWorkOnly(protocol) {
  if (!protocol || !Array.isArray(protocol.blocks)) return protocol;
  return { ...protocol, blocks: protocol.blocks.filter((b) => !/strength foundation/i.test(b.title || '')) };
}

// ── PHASE 3 · Engine execution — fuse the three pillars from one profile ─────────
// Returns { profile, preset, sportProtocol, program, assignedPlan, nutrition, macros,
//           nutritionError }. The macro RPC is server-authoritative; a failure leaves
//           nutrition null (field + weight room still build) with the slug surfaced.
export async function buildAthleteBlueprint(profile = {}) {
  const preset = presetsForAthlete(profile);
  const goal = profile.goal || preset.goal;
  const arch = profile.arch || preset.arch;
  const level = profile.level || levelForTier(profile.currentTier);

  // 1 · FIELD WORK (field/court drills — strength block removed to avoid duplication)
  const sportProtocol = fieldWorkOnly(buildSportsProtocol({
    sport: profile.sportId,
    age: Number(profile.age) || null,
    experience: levelToExperience(level),
    goal,
    targetPhase: tierToPhase(profile.currentTier),
  }));

  // 2 · WEIGHT ROOM (the barbell/dumbbell session — the strength pillar)
  const program = generateProgram({
    goal,
    level: String(level),
    days: String(profile.days || 3),
    loc: profile.loc || 'any-home',
    arch,
    gender: sexToGender(profile.sex),
    intensifier: 'none',         // youth — no advanced intensifier overlays
    dur: String(profile.dur || 45),
    warmups: true,
  });
  const assignedPlan = toAssignedPlan(program);

  // 3 · FUEL (TDEE from the SQL RPC — never a client guess — then meal scaling)
  let macros = null;
  let nutrition = null;
  let nutritionError = null;
  try {
    const { data, error } = await supabase.rpc('bbf_compute_macro_targets', {
      p_age: Number(profile.age) || null,
      p_sex: profile.sex || 'male',
      p_weight_lb: Number(profile.weightLb) || null,
      p_height_ft: Number(profile.heightFt) || null,
      p_height_in: Number(profile.heightIn) || 0,
      p_activity: 1.725,           // youth athlete — very active
      p_goal: nutritionGoal(goal),
    });
    if (error) {
      nutritionError = error.message || 'macro_rpc_failed';
    } else if (data && data.ok) {
      macros = data;
      // Youth division is locked to 'none' (no 16/8 fasting for minors).
      nutrition = buildMealPlan({ tdee: data.tdee_target, dietary_profile: profile.dietary || 'Omnivore', fasting_window: 'none' });
    } else {
      nutritionError = (data && data.error) || 'missing_anthropometrics';
    }
  } catch (e) {
    nutritionError = e?.message || 'macro_rpc_unreachable';
  }

  return {
    profile: { ...profile, goal, arch, level },
    preset,
    sportProtocol,
    program,
    assignedPlan,
    nutrition,
    macros,
    nutritionError,
    generated_at: new Date().toISOString(),
  };
}
