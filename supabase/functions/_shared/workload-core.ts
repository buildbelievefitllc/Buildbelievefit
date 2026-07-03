// ═══════════════════════════════════════════════════════════════════════════
// _shared/workload-core.ts — the gram-effort workload / prehab / recovery engine
// ───────────────────────────────────────────────────────────────────────────
// Deterministic core for bbf-workload-sentinel (PREHAB blueprint Parts 1–3). Pure
// functions, zero I/O, zero Claude, seeded only. The sentinel does the DB reads and
// feeds this the raw rows; this returns rollups, risk scores, and recovery variants.
//
// THE GRAM STANDARD: load_g / effective_load_g / tonnage_g are integer BIGINT grams.
// strain_au is gram-effort units (grams × rpe/10) — a NUMERIC intensity measure, not
// a mass, so it may carry a fraction; every column that IS a mass stays an integer.
// ═══════════════════════════════════════════════════════════════════════════

export const VECTORS = ['axial', 'knee_dominant', 'hip_hinge', 'shoulder_load', 'elbow_load', 'impact'] as const;
export type Vector = typeof VECTORS[number];

// joint zone → weighted vectors (§2.2)
export const JOINT_VECTOR_MAP: Record<string, Array<{ v: Vector; w: number }>> = {
  knee: [{ v: 'knee_dominant', w: 0.60 }, { v: 'axial', w: 0.25 }, { v: 'impact', w: 0.15 }],
  lower_back: [{ v: 'axial', w: 0.55 }, { v: 'hip_hinge', w: 0.35 }, { v: 'knee_dominant', w: 0.10 }],
  shoulder: [{ v: 'shoulder_load', w: 0.85 }, { v: 'elbow_load', w: 0.15 }],
  elbow: [{ v: 'elbow_load', w: 0.80 }, { v: 'shoulder_load', w: 0.20 }],
  hamstring: [{ v: 'hip_hinge', w: 0.70 }, { v: 'impact', w: 0.30 }],
  ankle: [{ v: 'impact', w: 0.80 }, { v: 'knee_dominant', w: 0.20 }],
};

export interface TaxonomyRow {
  pattern_name: string; detect_regex: string; veto_regex: string | null;
  axial_coeff: number; knee_coeff: number; hip_coeff: number; shoulder_coeff: number;
  elbow_coeff: number; impact_coeff: number; bodyweight_load_coeff: number; muscle_groups: string[];
}
export interface RawSet { drill_name: string | null; reps: number | null; load_g: number | null; weight_lbs: number | null; rpe: number | null; }

const GRAMS_PER_POUND = 453.59237;
const EPS = 1;

// Match a drill name to its taxonomy row (detect wins unless veto excludes); the
// 'general' pattern is the guaranteed fallthrough (strain is never dropped to zero).
export function matchTaxonomy(drillName: string | null, taxonomy: TaxonomyRow[]): TaxonomyRow | null {
  const name = String(drillName ?? '').trim();
  let general: TaxonomyRow | null = null;
  for (const row of taxonomy) {
    if (row.pattern_name === 'general') { general = row; continue; }
    try {
      if (row.veto_regex && new RegExp(row.veto_regex, 'i').test(name)) continue;
      if (new RegExp(row.detect_regex, 'i').test(name)) return row;
    } catch { /* a malformed regex never blocks the pipeline */ }
  }
  return general;
}

export function vectorCoeff(row: TaxonomyRow, v: Vector): number {
  switch (v) {
    case 'axial': return row.axial_coeff;
    case 'knee_dominant': return row.knee_coeff;
    case 'hip_hinge': return row.hip_coeff;
    case 'shoulder_load': return row.shoulder_coeff;
    case 'elbow_load': return row.elbow_coeff;
    case 'impact': return row.impact_coeff;
  }
}

// Per-set gram-effort strain, fanned out to vectors + muscle groups. load_g is the
// generated column; fall back to the exact conversion if a legacy row lacks it.
export interface SetStrain {
  effective_load_g: number; tonnage_g: number; strain_au: number; reps: number; rpe: number;
  vector_strain: Record<Vector, number>; muscle_groups: string[];
}
export function computeSetStrain(set: RawSet, row: TaxonomyRow, bodyMassG: number): SetStrain {
  const loadG = set.load_g != null ? Math.round(set.load_g)
    : set.weight_lbs != null ? Math.round(set.weight_lbs * GRAMS_PER_POUND) : 0; // gram boundary (integer)
  const effLoadG = loadG + Math.round(bodyMassG * (row.bodyweight_load_coeff ?? 0)); // integer grams
  const reps = Math.max(0, Math.round(set.reps ?? 0));
  const rpe = set.rpe != null && Number.isFinite(set.rpe) ? set.rpe : 7; // null RPE → 7 (neutral)
  const tonnageG = reps * effLoadG; // integer grams moved
  const strainAu = tonnageG * (rpe / 10); // effort-weighted grams
  const vector_strain = {} as Record<Vector, number>;
  for (const v of VECTORS) vector_strain[v] = strainAu * vectorCoeff(row, v);
  return { effective_load_g: effLoadG, tonnage_g: tonnageG, strain_au: strainAu, reps, rpe, vector_strain, muscle_groups: row.muscle_groups ?? [] };
}

// ── EWMA / ACWR (§1.5) ───────────────────────────────────────────────────────
// Roll a prior EWMA forward to `today`, decaying across any gap days (L=0), then
// applying today's load. λ_acute = 2/(7+1)=0.25 · λ_chronic = 2/(28+1)≈0.0690.
export function rollEwma(prev: { a: number; c: number } | null, todayL: number, gapDays: number, lambdaA = 0.25, lambdaC = 0.0689655): { a: number; c: number } {
  let a = prev?.a ?? todayL;
  let c = prev?.c ?? todayL;
  if (prev) {
    // decay across the empty days between the last computed day and yesterday
    for (let i = 1; i < gapDays; i++) { a = (1 - lambdaA) * a; c = (1 - lambdaC) * c; }
    a = lambdaA * todayL + (1 - lambdaA) * a;
    c = lambdaC * todayL + (1 - lambdaC) * c;
  }
  return { a, c };
}
export function acwr(a: number, c: number): number { return a / Math.max(c, EPS); }

// f_acwr risk ramp (§2.3)
export function fAcwr(x: number | null): number {
  if (x == null || (x >= 0.80 && x <= 1.30)) return 0;
  if (x < 0.80) return 0.30;
  if (x <= 1.80) return (x - 1.30) / 0.50;
  return 1.0;
}

// Foster monotony + weekly strain over a 7-day series of daily strain (§1.5).
export function monotony(last7: number[]): { monotony: number; weekly_strain: number; flag: boolean } {
  if (!last7.length) return { monotony: 0, weekly_strain: 0, flag: false };
  const mean = last7.reduce((s, x) => s + x, 0) / last7.length;
  const variance = last7.reduce((s, x) => s + (x - mean) ** 2, 0) / last7.length;
  const sd = Math.sqrt(variance);
  const m = mean / Math.max(sd, EPS);
  return { monotony: m, weekly_strain: last7.reduce((s, x) => s + x, 0) * m, flag: m > 2.0 };
}

// ── Injury history factor H_j (§2.3, the learning term) ──────────────────────
export interface InjuryRow { joint_zone: string; severity: number; resolved_on: string | null; recurrence_count: number; sensitivity_coefficient: number; }
export function historyFactor(rows: InjuryRow[], today: string): number {
  const now = new Date(`${today}T00:00:00Z`).getTime();
  let sum = 0;
  for (const r of rows) {
    const resolved = r.resolved_on ? new Date(`${r.resolved_on}T00:00:00Z`).getTime() : now;
    const months = Math.max(0, (now - resolved) / (1000 * 60 * 60 * 24 * 30.4375));
    sum += (r.severity / 10) * Math.exp(-months / 12) * (r.recurrence_count >= 2 ? 1.25 : 1.0) * (r.sensitivity_coefficient ?? 1.0);
  }
  return Math.min(1, Math.max(0, sum));
}

// ── Composite joint risk R_j ∈ [0,100] (§2.3) ────────────────────────────────
export interface RiskWeights { acwr: number; spike: number; history: number; readiness: number; monotony: number; }
export const RISK_WEIGHTS_FALLBACK: RiskWeights = { acwr: 0.35, spike: 0.20, history: 0.25, readiness: 0.10, monotony: 0.10 };
export function jointRisk(joint: string, ctx: {
  acwrByVector: Partial<Record<Vector, number | null>>;
  spikeByVector: Partial<Record<Vector, boolean>>;
  monoFlagByVector: Partial<Record<Vector, boolean>>;
  H_j: number; readinessScore: number | null; weights: RiskWeights;
}): number {
  const map = JOINT_VECTOR_MAP[joint] ?? [];
  const acwrComponent = map.reduce((s, { v, w }) => s + w * fAcwr(ctx.acwrByVector[v] ?? null), 0);
  const spikeComponent = map.some(({ v, w }) => w >= 0.25 && ctx.spikeByVector[v]) ? 1.0 : 0;
  const dominant = map[0]?.v;
  const monoComponent = dominant && ctx.monoFlagByVector[dominant] ? 1.0 : 0;
  const readinessComponent = ctx.readinessScore == null ? 0 : Math.min(1, Math.max(0, (85 - ctx.readinessScore) / 45));
  const w = ctx.weights;
  const composite = w.acwr * acwrComponent + w.spike * spikeComponent + w.history * ctx.H_j + w.readiness * readinessComponent + w.monotony * monoComponent;
  return Math.round(100 * Math.min(1, Math.max(0, composite)));
}
export function riskToPriority(r: number): 'mandatory' | 'strong' | 'advisory' | 'baseline' {
  if (r >= 70) return 'mandatory';
  if (r >= 45) return 'strong';
  if (r >= 25) return 'advisory';
  return 'baseline';
}

// RPE spike detector (§1.5): intensity climbing while today's strain also spikes.
export function rpeSpike(meanRpe7d: number | null, meanRpe28d: number | null, strainToday: number, meanDailyStrain28d: number | null): boolean {
  if (meanRpe7d == null || meanRpe28d == null || meanDailyStrain28d == null) return false;
  return (meanRpe7d - meanRpe28d >= 1.5) && (strainToday >= 1.25 * meanDailyStrain28d);
}

// ── Recovery debt (§3.2 / §3.3) ──────────────────────────────────────────────
export function overnightDecay(debt: number, sleepHours: number | null, hoursElapsed: number): number {
  const sleepFactor = Math.min((sleepHours ?? 8) / 8, 1.0);
  const halfLifeH = 36 / Math.max(sleepFactor, 0.5); // 36h at full sleep → up to 72h starved
  return debt * Math.pow(0.5, hoursElapsed / halfLifeH);
}
export function debtRatio(debt: number, chronicTotal: number): number { return debt / Math.max(chronicTotal, EPS); }
export function prepVariant(ratio: number): 'deep' | 'standard_plus' | 'standard' | 'light' {
  if (ratio >= 1.40) return 'deep';
  if (ratio >= 0.90) return 'standard_plus';
  if (ratio >= 0.40) return 'standard';
  return 'light';
}
