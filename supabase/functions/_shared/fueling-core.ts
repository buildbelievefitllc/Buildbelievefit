// ═══════════════════════════════════════════════════════════════════════════
// _shared/fueling-core.ts — the gram-native 3-tier fueling engine (deterministic)
// ───────────────────────────────────────────────────────────────────────────
// Single source of truth for the fueling math the cold-start orchestrator AND
// bbf-fueling-sentinel both use. Pure functions, zero I/O, zero Claude. Every macro
// output is an INTEGER of grams; the RED-S / energy / band clamps live in ONE place
// (assembleMacros) so the safety floor can never drift between callers.
//
// THE GRAM STANDARD: body_mass_g / lean_mass_g are integer BIGINT grams in, macros
// are integer grams out. kcal is energy (not mass) and stays kcal. No kilograms.
// ═══════════════════════════════════════════════════════════════════════════

export interface FuelProfile { carb_coeff: number; protein_coeff: number; fat_floor_pct: number; }
export interface FuelCfg {
  rmr_base: number; rmr_lean_coeff: number;
  af: { twice_daily: number; days_ge_6: number; default: number };
  profiles: Record<string, FuelProfile>;
  carb_load?: { ramp_start: number; ramp_peak: number };
  creatine?: { load_coeff: number; maint_coeff: number };
}
export interface ClampCfg {
  C1_energy_floor_rmr_mult: number; C2_red_s_kcal_per_g_ffm: number;
  C3_protein_coeff_min: number; C3_protein_coeff_max: number;
  C4_carb_coeff_min: number; C4_carb_coeff_max: number; C5_fat_floor_pct_min: number;
}
export interface Tier2Cfg {
  vol_anticipated: Record<string, number>;
  states: Record<string, { protein_coeff: number; carb_mult: number; fat_floor_pct: number }>;
}
export interface Tier3Cfg {
  fingerprint: { lambda_fp: number; heavy_mult: number; confidence_gate: number; min_obs: number; cv_max: number };
  carb_modulation: Record<string, number>;
  carb_load_abs: { t48_t24: number; t24_t0: number; competition: number };
  protein_by_phase: Record<string, number>;
  predicted_volume_ratio: { clamp_min: number; clamp_max: number };
}

export const FUEL_FALLBACK: FuelCfg = {
  rmr_base: 500, rmr_lean_coeff: 0.022, af: { twice_daily: 2.0, days_ge_6: 1.725, default: 1.55 },
  profiles: {
    general: { carb_coeff: 0.0040, protein_coeff: 0.0018, fat_floor_pct: 0.20 },
    atp_pc: { carb_coeff: 0.0040, protein_coeff: 0.0018, fat_floor_pct: 0.20 },
    glycolytic_60: { carb_coeff: 0.0060, protein_coeff: 0.0018, fat_floor_pct: 0.20 },
    glycolytic_1_3h: { carb_coeff: 0.0080, protein_coeff: 0.0018, fat_floor_pct: 0.20 },
    glycolytic_4h: { carb_coeff: 0.0100, protein_coeff: 0.0018, fat_floor_pct: 0.20 },
  },
  carb_load: { ramp_start: 0.0110, ramp_peak: 0.0120 },
  creatine: { load_coeff: 0.0003, maint_coeff: 0.00003 },
};
export const CLAMP_FALLBACK: ClampCfg = {
  C1_energy_floor_rmr_mult: 1.10, C2_red_s_kcal_per_g_ffm: 0.030,
  C3_protein_coeff_min: 0.0014, C3_protein_coeff_max: 0.0026,
  C4_carb_coeff_min: 0.0020, C4_carb_coeff_max: 0.0120, C5_fat_floor_pct_min: 0.20,
};

const clampNum = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function resolveProfileKey(sport: string | null, sessionMinutes: number | null): string {
  const s = String(sport ?? '').trim().toLowerCase();
  const gly = ['soccer', 'basketball', 'volleyball', 'tennis', 'mma', 'boxing', 'softball'];
  if (!s || s === 'general') return 'general';
  if (gly.includes(s)) {
    const m = sessionMinutes ?? 60;
    if (m >= 240) return 'glycolytic_4h';
    if (m >= 60) return 'glycolytic_1_3h';
    return 'glycolytic_60';
  }
  return 'atp_pc';
}

export interface MacroResult {
  rmr_kcal: number; tdee_kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  clamps_fired: string[];
}

// THE CLAMP ENGINE — protein law → fat floor → carbs absorb remainder, with C1–C5
// applied. Assembly order is deterministic; every output is an integer of grams.
// This is the ONLY place the RED-S floor is enforced.
export function assembleMacros(input: {
  rmrKcal: number; tdeeKcal: number; bodyMassG: number; leanMassG: number;
  carbCoeff: number; proteinCoeff: number; fatFloorPct: number; clamp: ClampCfg;
}): MacroResult {
  const { clamp } = input;
  const fired: string[] = [];

  // Coefficient bands (C3, C4) + fat floor (C5).
  const pC = clampNum(input.proteinCoeff, clamp.C3_protein_coeff_min, clamp.C3_protein_coeff_max);
  if (pC !== input.proteinCoeff) fired.push('C3');
  const cC = clampNum(input.carbCoeff, clamp.C4_carb_coeff_min, clamp.C4_carb_coeff_max);
  if (cC !== input.carbCoeff) fired.push('C4');
  const fFloor = Math.max(input.fatFloorPct, clamp.C5_fat_floor_pct_min);
  if (fFloor !== input.fatFloorPct) fired.push('C5');

  // Energy floors: C1 (≥1.10×RMR) and C2 (RED-S: ≥0.030 kcal/g FFM) — raise, never cut.
  let tdee = Math.round(input.tdeeKcal);
  const c1 = Math.round(clamp.C1_energy_floor_rmr_mult * input.rmrKcal);
  if (tdee < c1) { tdee = c1; fired.push('C1'); }
  const c2 = Math.ceil(clamp.C2_red_s_kcal_per_g_ffm * input.leanMassG);
  if (tdee < c2) { tdee = c2; fired.push('C2_red_s'); }

  // Protein is law; fat holds its floor; carbs absorb the remainder (integers).
  const proteinG = Math.round(pC * input.bodyMassG);
  let carbsG = Math.round(cC * input.bodyMassG);
  const fatKcal = Math.max(fFloor * tdee, tdee - 4 * proteinG - 4 * carbsG);
  const fatG = Math.round(fatKcal / 9);
  const carbKcal = tdee - 4 * proteinG - Math.round(fatKcal);
  if (carbKcal >= 0) carbsG = Math.round(carbKcal / 4);

  return { rmr_kcal: input.rmrKcal, tdee_kcal: tdee, protein_g: proteinG, carbs_g: Math.max(0, carbsG), fat_g: Math.max(0, fatG), clamps_fired: fired };
}

export function activityFactor(fuel: FuelCfg, trainingDaysWk: number | null, twiceDaily: boolean): number {
  return twiceDaily ? fuel.af.twice_daily : (trainingDaysWk ?? 0) >= 6 ? fuel.af.days_ge_6 : fuel.af.default;
}
export function rmrKcal(fuel: FuelCfg, leanMassG: number): number {
  return Math.round(fuel.rmr_base + fuel.rmr_lean_coeff * leanMassG);
}
export function creatineGrams(fuel: FuelCfg, bodyMassG: number, phase: 'load' | 'maint'): number {
  const coeff = phase === 'load' ? (fuel.creatine?.load_coeff ?? 0.0003) : (fuel.creatine?.maint_coeff ?? 0.00003);
  return Math.round(coeff * bodyMassG * 10) / 10; // creatine_g is NUMERIC (tenths of a gram)
}

// ── TIER 1 · FOUNDATION (static baseline) ────────────────────────────────────
export interface FoundationArgs {
  bodyMassG: number; leanMassG: number; trainingDaysWk: number | null;
  twiceDaily: boolean; profileKey: string; atpPc?: boolean;
}
export function foundationTargets(fuel: FuelCfg, clamp: ClampCfg, a: FoundationArgs) {
  const profile = fuel.profiles[a.profileKey] || fuel.profiles.general || FUEL_FALLBACK.profiles.general;
  const rmr = rmrKcal(fuel, a.leanMassG);
  const af = activityFactor(fuel, a.trainingDaysWk, a.twiceDaily);
  const tdee = Math.round(rmr * af);
  const macros = assembleMacros({
    rmrKcal: rmr, tdeeKcal: tdee, bodyMassG: a.bodyMassG, leanMassG: a.leanMassG,
    carbCoeff: profile.carb_coeff, proteinCoeff: profile.protein_coeff, fatFloorPct: profile.fat_floor_pct, clamp,
  });
  return {
    ...macros, af,
    creatine_g: a.atpPc ? creatineGrams(fuel, a.bodyMassG, 'load') : null,
    coefficients: { carb_coeff: profile.carb_coeff, protein_coeff: profile.protein_coeff, af, profile: a.profileKey, rmr_base: fuel.rmr_base },
  };
}

// ── TIER 2 · PERFORMANCE (readiness recalibration → tomorrow) ────────────────
// state ∈ breach|strain|standard|prime. RMR share is untouchable; only the ACTIVITY
// margin scales with anticipated volume. Recovery-forcing macro re-split follows.
export function recalibrateTomorrow(fuel: FuelCfg, clamp: ClampCfg, t2: Tier2Cfg, a: {
  bodyMassG: number; leanMassG: number; trainingDaysWk: number | null; twiceDaily: boolean;
  profileKey: string; state: string;
}) {
  const profile = fuel.profiles[a.profileKey] || fuel.profiles.general;
  const rmr = rmrKcal(fuel, a.leanMassG);
  const afBase = activityFactor(fuel, a.trainingDaysWk, a.twiceDaily);
  const vol = t2.vol_anticipated[a.state] ?? 1.0;
  const afDyn = 1 + (afBase - 1) * vol;         // only the activity margin scales
  const tdee = Math.round(rmr * afDyn);
  const st = t2.states[a.state] ?? { protein_coeff: profile.protein_coeff, carb_mult: 1.0, fat_floor_pct: profile.fat_floor_pct };
  const macros = assembleMacros({
    rmrKcal: rmr, tdeeKcal: tdee, bodyMassG: a.bodyMassG, leanMassG: a.leanMassG,
    carbCoeff: profile.carb_coeff * st.carb_mult, proteinCoeff: st.protein_coeff, fatFloorPct: st.fat_floor_pct, clamp,
  });
  const recoveryForced = a.state === 'strain' || a.state === 'breach';
  return {
    ...macros, af: afDyn, day_type: recoveryForced ? 'recovery_forced' : 'standard',
    coefficients: { carb_coeff: profile.carb_coeff * st.carb_mult, protein_coeff: st.protein_coeff, af: afDyn, vol_anticipated: vol, state: a.state, profile: a.profileKey },
  };
}

// ── TIER 3 · SOVEREIGN (predictive periodization) ────────────────────────────
export function predictedVolumeRatio(t3: Tier3Cfg, fWeekday: number, fMean: number): number {
  if (fMean <= 0) return 1.0;
  return clampNum(fWeekday / fMean, t3.predicted_volume_ratio.clamp_min, t3.predicted_volume_ratio.clamp_max);
}
export function proteinCoeffForPhase(t3: Tier3Cfg, phase: string, postHeavy: boolean, tier2Coeff: number, clamp: ClampCfg): number {
  const base = t3.protein_by_phase[phase] ?? t3.protein_by_phase.maintenance ?? 0.0018;
  const adder = postHeavy ? (t3.protein_by_phase.post_heavy_adder ?? 0.0002) : 0;
  return clampNum(Math.max(base + adder, tier2Coeff), clamp.C3_protein_coeff_min, clamp.C3_protein_coeff_max); // recovery wins
}
// Carb coefficient for a scheduled day: absolute in a carb-load window, else the
// Tier-2 carb coeff × the day-type modulation multiplier.
export function carbCoeffForDay(t3: Tier3Cfg, args: {
  tier2CarbCoeff: number; dayType: string; inWindow: false | 't48_t24' | 't24_t0' | 'competition';
}): number {
  if (args.inWindow) return t3.carb_load_abs[args.inWindow];
  const mult = t3.carb_modulation[args.dayType] ?? 1.0;
  return args.tier2CarbCoeff * mult;
}
// EWMA fingerprint update for one weekday (called on that weekday's own day).
export function updateFingerprintEwma(prev: number, todayStrain: number, lambda: number): number {
  return lambda * todayStrain + (1 - lambda) * prev;
}
// Prediction confidence for a weekday (0..1): matures with observations, penalized by variability.
export function fingerprintConfidence(t3: Tier3Cfg, observationCount: number, cv: number | null): number {
  const obsTerm = Math.min(observationCount / (t3.fingerprint.min_obs || 4), 1);
  const cvTerm = 1 - Math.min(cv ?? 0, 1);
  return clampNum(obsTerm * cvTerm, 0, 1);
}
export function isPredictedHeavy(t3: Tier3Cfg, fWeekday: number, fMean: number): boolean {
  return fMean > 0 && fWeekday >= t3.fingerprint.heavy_mult * fMean;
}

// Integer-grams re-affirmation for anything about to touch the DB.
export const gInt = (v: number): number => Math.round(v);
