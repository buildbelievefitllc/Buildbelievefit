// ═══════════════════════════════════════════════════════════════════════════
// _shared/cardio-core.ts — the mechanical bridge + prescription matrix + gram engine
// ───────────────────────────────────────────────────────────────────────────
// Deterministic core for bbf-smart-cardio-router (CARDIO blueprint Parts 1–2). Pure
// functions, zero I/O, zero Claude/TTS. Composes with the shipped recovery band via
// applyTierCeiling — the ONE ceiling-composition operator ("gentlest wins", §1.3).
//
// THE GRAM STANDARD: EE via MET × body_mass_g × 1.75e-5; sweat/rehydration are integer
// grams (§0.1). Zone 2 < Tempo < HIIT. Kilograms never appear.
// ═══════════════════════════════════════════════════════════════════════════

import { type CardioTier, applyTierCeiling } from './cardio-readiness.ts';
export { applyTierCeiling };
export type { CardioTier };

export type MechState = 'danger' | 'caution' | 'clear';
export type SportProfile = 'atp_pc' | 'glycolytic';

// §0.1 constants (exact — 3.5/(200×1000) = 1.75e-5)
export const GRAM_MET_KCAL = 0.0000175;
export const MET_BY_TIER: Record<CardioTier, number> = { 'Zone 2': 6.0, 'Tempo': 8.5, 'HIIT': 11.0 };
export const K_SWEAT: Record<CardioTier, number> = { 'Zone 2': 0.00015, 'Tempo': 0.00022, 'HIIT': 0.00030 };
export const CAP_FRACTION: Record<CardioTier, number> = { 'Zone 2': 0.70, 'Tempo': 0.80, 'HIIT': 0.90 };
export const TALK_TEST: Record<CardioTier, string> = {
  'Zone 2': 'conversational pace — full sentences',
  'Tempo': 'phrases only',
  'HIIT': 'single words between reps',
};

// ── Part 1 · Mechanical ceiling (§1.3) ───────────────────────────────────────
export interface MechInputs {
  acwr_axial: number | null; acwr_impact: number | null; acwr_knee: number | null; acwr_total: number | null;
  monotony_total: number | null;
  debt_sum_au: number | null;       // Σ debt_au over all muscle groups
  chronic_total_au: number | null;  // C_total (total-vector chronic EWMA)
  max_lower_debt_ratio: number | null;
  shadow_active: boolean;
  mandatory_prehab_today: boolean;
}
export function deriveMechState(i: MechInputs): { state: MechState; fired: string[] } {
  const d: string[] = [];
  if (i.acwr_axial != null && i.acwr_axial > 1.50) d.push('D1'); // axial spike
  if (i.acwr_impact != null && i.acwr_impact > 1.50) d.push('D2'); // impact spike
  if (i.shadow_active) d.push('D3'); // 48h shadow
  if (i.debt_sum_au != null && i.chronic_total_au != null && i.debt_sum_au >= 2.0 * i.chronic_total_au) d.push('D4');
  if (i.monotony_total != null && i.acwr_total != null && i.monotony_total > 2.0 && i.acwr_total > 1.30) d.push('D5');
  if (d.length) return { state: 'danger', fired: d };
  const c: string[] = [];
  for (const [name, v] of [['axial', i.acwr_axial], ['impact', i.acwr_impact], ['knee', i.acwr_knee]] as Array<[string, number | null]>) {
    if (v != null && v > 1.30 && v <= 1.50) c.push(`C1:${name}`);
  }
  if (i.max_lower_debt_ratio != null && i.max_lower_debt_ratio >= 1.40) c.push('C2');
  if (i.mandatory_prehab_today) c.push('C3');
  if (c.length) return { state: 'caution', fired: c };
  return { state: 'clear', fired: [] }; // incl. all-null inputs → fail-open
}
export function mechCeiling(state: MechState): { tier: CardioTier | null; hr_frac: number | null; rpe_cap: number | null; work_rest: string | null } {
  if (state === 'danger') return { tier: 'Zone 2', hr_frac: 0.70, rpe_cap: 5, work_rest: null };
  if (state === 'caution') return { tier: 'Tempo', hr_frac: 0.80, rpe_cap: 7, work_rest: '1:2' };
  return { tier: null, hr_frac: null, rpe_cap: null, work_rest: null };
}

// ── Native heart-rate math (§2.3, Tanaka — no wearables) ─────────────────────
export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age >= 5 && age <= 100 ? age : null;
}
export function hrMaxEst(age: number): number { return Math.round(208 - 0.7 * age); } // Tanaka
// hr cap in bpm for the effective tier, with mechanical DANGER→0.70 / CAUTION≤0.80 overrides.
export function hrCapBpm(age: number | null, tier: CardioTier, mech: MechState): number | null {
  if (age == null) return null;
  let frac = CAP_FRACTION[tier];
  if (mech === 'danger') frac = Math.min(frac, 0.70);
  else if (mech === 'caution') frac = Math.min(frac, 0.80);
  return Math.round(hrMaxEst(age) * frac);
}

// ── Part 2 · Prescription matrix (§2.2) ──────────────────────────────────────
export interface MatrixEntry { structure: Record<string, unknown>; met: number; work_rest: string; }
export function matrixFor(tier: CardioTier, profile: SportProfile): MatrixEntry {
  if (tier === 'HIIT') {
    return profile === 'atp_pc'
      ? { structure: { work_s: 12, rest_s: 60, reps_min: 8, reps_max: 12, kind: 'alactic_sprint' }, met: 11.0, work_rest: '1:5' }
      : { structure: { work_s: 45, rest_s_min: 45, rest_s_max: 90, reps_min: 6, reps_max: 10, kind: 'glycolytic_hard' }, met: 11.0, work_rest: '1:1-1:2' };
  }
  if (tier === 'Tempo') {
    return profile === 'atp_pc'
      ? { structure: { work_s: 60, rest_s: 120, blocks_min: 5, blocks_max: 8, kind: 'strong' }, met: 8.5, work_rest: '1:2' }
      : { structure: { work_s: 240, rest_s: 120, blocks_min: 3, blocks_max: 5, kind: 'threshold' }, met: 8.5, work_rest: '2:1' };
  }
  return { structure: { kind: 'continuous', blocks: 1 }, met: 6.0, work_rest: 'steady-state' };
}

// A simple time-based tier router (minutes → tier; shorter = more intense). The
// recovery + mechanical ceilings then clamp it via applyTierCeiling.
export function timeBasedTier(availableMinutes: number): CardioTier {
  if (availableMinutes <= 20) return 'HIIT';
  if (availableMinutes <= 40) return 'Tempo';
  return 'Zone 2';
}

// ── Debt-scaled dose (§2.4) ──────────────────────────────────────────────────
export type DebtClass = 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';
export function debtClass(maxDebtRatio: number | null): DebtClass {
  if (maxDebtRatio == null) return 'UNKNOWN';
  if (maxDebtRatio >= 1.40) return 'HIGH';
  if (maxDebtRatio >= 0.90) return 'MODERATE';
  return 'LOW';
}
export function debtScale(cls: DebtClass): number { return cls === 'HIGH' ? 0.70 : cls === 'MODERATE' ? 0.85 : 1.00; }
export function durationMin(availableMinutes: number, scale: number): number {
  return Math.min(Math.max(Math.round(availableMinutes * scale), 10), availableMinutes);
}

// ── Gram-denominated session outputs (§0.1) ──────────────────────────────────
export function eeKcal(tier: CardioTier, bodyMassG: number, durationMinutes: number): number {
  return Math.round(MET_BY_TIER[tier] * bodyMassG * GRAM_MET_KCAL * durationMinutes);
}
export function sweatLossG(tier: CardioTier, bodyMassG: number, durationMinutes: number, heatFactor = 1.0): number {
  return Math.round(bodyMassG * K_SWEAT[tier] * heatFactor * durationMinutes);
}
export function rehydrationG(sweatG: number): number { return Math.round(1.5 * sweatG); } // 150% replacement

// Sport → energy-system profile (linemen/throwers = ATP-PC; field/court = glycolytic).
export function sportProfile(sport: string | null, position: string | null): SportProfile {
  const s = String(sport ?? '').toLowerCase(), p = String(position ?? '').toLowerCase();
  if (s === 'football' && /line|big|tackle|guard|center/.test(p)) return 'atp_pc';
  if (/throw|shot|discus|power|sprint/.test(p)) return 'atp_pc';
  return 'glycolytic';
}

// The full composition: (time tier ⊓ readiness ceiling) ⊓ mechanical ceiling.
export function composeEffectiveTier(timeTier: CardioTier, readinessCeiling: CardioTier | null, mechTier: CardioTier | null): CardioTier {
  return applyTierCeiling(applyTierCeiling(timeTier, readinessCeiling), mechTier);
}
