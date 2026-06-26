// supabase/functions/_shared/cardio-readiness.ts
// ═══════════════════════════════════════════════════════════════════════════
// PHASE 10 — THE RECOVERY BAND (deterministic · NEVER delegated to Claude).
// ───────────────────────────────────────────────────────────────────────────
// The third deterministic guardrail in the Smart Cardio engine, beside the
// minute-based tier router (routeTier) and the CNS-fatigue down-regulation
// (evaluateCns). Where those read TIME and TRAINING LOAD, this reads TODAY'S
// MORNING RECOVERY (the Sovereign Readiness verdict: score + mode + HRV vs
// baseline + sleep) and maps it onto an intensity BAND — a hard ceiling on the
// modality tier, the RPE, and the interval structure the prescription may use.
//
// "The engine dictates intensity bands based on today's recovery."
//
//   recovery_state  trigger                                   ceiling  rpe  structure
//   ─────────────   ───────────────────────────────────────   ───────  ───  ─────────────
//   breach          mode BREACH ∨ score<40 ∨ HRV ≪ baseline    Zone 2    5   steady, no intervals
//   strain          mode STRAIN ∨ score 40–64                  Tempo     7   long-rest 1:2
//   standard        mode STANDARD ∨ score 65–84                (none)    8   standard 1:1
//   prime           mode PRIME ∨ score ≥85                     (none)  9–10  aggressive 2:1
//   unknown         no usable telemetry                        (none)  (none) full prescription
//
// FAIL-OPEN (same doctrine as evaluateCns + the calibration brain): absent or
// unparseable telemetry resolves to `unknown` → NO ceiling, NO clamp. A missing
// morning check-in NEVER restricts the athlete; it just doesn't add a brake.
// The band is purely ADDITIVE on top of the existing time + CNS guardrails.
//
// Zero imports (pure functions only) so this INLINES cleanly into the
// single-file edge-deploy bundles (bbf-agentic-cardio, bbf-cardio-prescription).
// The repo multi-file copy here is the canonical source of truth.
// ═══════════════════════════════════════════════════════════════════════════

export type CardioTier = 'HIIT' | 'Tempo' | 'Zone 2';
export type RecoveryState = 'breach' | 'strain' | 'standard' | 'prime' | 'unknown';

export interface ReadinessInputs {
  score?: number | null;            // Sovereign Readiness 0–100
  mode?: string | null;             // PRIME_EXECUTION | STANDARD_OPERATIONS | SYSTEM_STRAIN | SYSTEM_BREACH
  hrv_ms?: number | null;           // this morning's HRV
  hrv_baseline_ms?: number | null;  // the athlete's rolling HRV baseline
  sleep_hours?: number | null;      // last night's sleep in hours
}

export interface RecoveryBand {
  recovery_state: RecoveryState;
  tier_ceiling: CardioTier | null;  // hard ceiling on the modality tier (null = no ceiling)
  rpe_ceiling: number | null;       // hard ceiling on prescribed RPE (null = no ceiling)
  work_rest_ratio: string | null;   // interval structure, e.g. "1:2" | "1:1" | "2:1"
  interval_directive: string;       // imperative structure instruction for the writer
  recovery_note: string;            // one-line human summary (prompt context + UI fallback)
  inputs: {                         // the resolved telemetry that drove the verdict (for the UI/log)
    score: number | null;
    mode: string | null;
    hrv_ms: number | null;
    hrv_baseline_ms: number | null;
    hrv_pct_of_baseline: number | null;
    sleep_hours: number | null;
  };
}

// Tier severity rank — lower = gentler. Used to take the MIN (most conservative)
// tier between the time/CNS verdict and the recovery ceiling.
const TIER_RANK: Record<CardioTier, number> = { 'Zone 2': 0, 'Tempo': 1, 'HIIT': 2 };

// Recovery-state severity rank — lower = more conservative. 'unknown' sits ABOVE
// every real state so it never wins the min and therefore never clamps.
const STATE_RANK: Record<RecoveryState, number> = {
  breach: 0, strain: 1, standard: 2, prime: 3, unknown: 99,
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Score → state. Bands per the CEO table; null score contributes nothing.
function stateFromScore(score: number | null): RecoveryState | null {
  if (score === null) return null;
  if (score < 40) return 'breach';
  if (score < 65) return 'strain';
  if (score < 85) return 'standard';
  return 'prime';
}

// Sovereign Readiness mode → state. Unknown/absent mode contributes nothing.
function stateFromMode(mode: string | null): RecoveryState | null {
  switch (String(mode || '').toUpperCase()) {
    case 'SYSTEM_BREACH':       return 'breach';
    case 'SYSTEM_STRAIN':       return 'strain';
    case 'STANDARD_OPERATIONS': return 'standard';
    case 'PRIME_EXECUTION':     return 'prime';
    default:                    return null;
  }
}

// The band parameters for each resolved recovery state.
function bandForState(state: RecoveryState): Omit<RecoveryBand, 'recovery_note' | 'inputs'> {
  switch (state) {
    case 'breach':
      return { recovery_state: 'breach', tier_ceiling: 'Zone 2', rpe_ceiling: 5, work_rest_ratio: null,
        interval_directive: 'Steady-state ONLY — no intervals, no surges. Hold an even, conversational effort the entire working block.' };
    case 'strain':
      return { recovery_state: 'strain', tier_ceiling: 'Tempo', rpe_ceiling: 7, work_rest_ratio: '1:2',
        interval_directive: 'Conservative, long-rest intervals at a 1:2 work-to-rest ratio. Keep the work bouts honest and the recovery generous.' };
    case 'prime':
      return { recovery_state: 'prime', tier_ceiling: null, rpe_ceiling: 10, work_rest_ratio: '2:1',
        interval_directive: 'Aggressive intervals at a 2:1 work-to-rest ratio with extended work blocks — the athlete is primed to attack.' };
    case 'standard':
      return { recovery_state: 'standard', tier_ceiling: null, rpe_ceiling: 8, work_rest_ratio: '1:1',
        interval_directive: 'Standard intervals at a 1:1 work-to-rest ratio.' };
    default:
      return { recovery_state: 'unknown', tier_ceiling: null, rpe_ceiling: null, work_rest_ratio: null,
        interval_directive: 'No morning readiness on file — write the full prescription for the mandated tier.' };
  }
}

function noteForState(state: RecoveryState, i: RecoveryBand['inputs']): string {
  const bits: string[] = [];
  if (i.score !== null) bits.push(`readiness ${i.score}/100`);
  if (i.mode) bits.push(i.mode.replace(/_/g, ' ').toLowerCase());
  if (i.hrv_ms !== null && i.hrv_pct_of_baseline !== null) bits.push(`HRV ${i.hrv_ms}ms (${i.hrv_pct_of_baseline}% of baseline)`);
  if (i.sleep_hours !== null) bits.push(`sleep ${i.sleep_hours}h`);
  const telem = bits.length ? bits.join(' · ') : 'no telemetry';
  switch (state) {
    case 'breach':   return `Recovery breached (${telem}). Capped at Zone 2, RPE 5 — rebuild the engine before you redline it.`;
    case 'strain':   return `System strained (${telem}). Capped at Tempo, RPE 7 — bank recovery for tomorrow's output.`;
    case 'prime':    return `Primed (${telem}). Cleared for aggressive intervals — attack it.`;
    case 'standard': return `Standard recovery (${telem}). Full standard prescription, RPE up to 8.`;
    default:         return 'No morning readiness on file — full prescription, no recovery clamp.';
  }
}

// THE BAND. Pure + deterministic. Combines the score-derived and mode-derived
// states (taking the MORE CONSERVATIVE of the two — safety-first), with a strong
// HRV suppression able to force a breach on its own.
export function deriveReadinessBand(input: ReadinessInputs): RecoveryBand {
  const score = num(input.score);
  const mode = (typeof input.mode === 'string' && input.mode) ? input.mode : null;
  const hrv = num(input.hrv_ms);
  const base = num(input.hrv_baseline_ms);
  const sleep = num(input.sleep_hours);

  const hrvPct = (hrv !== null && base !== null && base > 0) ? Math.round((hrv / base) * 100) : null;
  // A deep HRV drop (>20% below the athlete's own baseline) is an autonomic red
  // flag and forces a breach regardless of the self-reported score.
  const hrvBreach = hrvPct !== null && hrvPct < 80;

  const candidates: RecoveryState[] = [];
  const s1 = stateFromScore(score); if (s1) candidates.push(s1);
  const s2 = stateFromMode(mode);   if (s2) candidates.push(s2);
  if (hrvBreach) candidates.push('breach');

  const state: RecoveryState = candidates.length
    ? candidates.reduce((a, b) => (STATE_RANK[b] < STATE_RANK[a] ? b : a))
    : 'unknown';

  const inputs: RecoveryBand['inputs'] = {
    score, mode, hrv_ms: hrv, hrv_baseline_ms: base, hrv_pct_of_baseline: hrvPct, sleep_hours: sleep,
  };
  const band = bandForState(state);
  return { ...band, recovery_note: noteForState(state, inputs), inputs };
}

// EFFECTIVE TIER = the gentler of the incoming tier (time + CNS) and the recovery
// ceiling. A null ceiling (unknown / prime / standard) leaves the tier untouched.
export function applyTierCeiling(tier: CardioTier, ceiling: CardioTier | null): CardioTier {
  if (!ceiling) return tier;
  return TIER_RANK[ceiling] < TIER_RANK[tier] ? ceiling : tier;
}
