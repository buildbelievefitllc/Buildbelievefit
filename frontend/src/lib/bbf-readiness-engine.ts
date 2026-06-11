// src/lib/bbf-readiness-engine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Readiness Engine — the deterministic auto-regulation brain.
//
// PURE module: no React, no network, no Deno/Node APIs. Inputs are today's
// biometric day + the trailing ledger series (from bbf_upsert_daily_biometrics);
// output is the day's protocol: Sovereign Readiness Score, execution mode,
// training-volume modifier, macro split, cardio order, and a directive log
// explaining every decision. NO LLM call — the model router (CLAUDE.md §4)
// deliberately plays no part here.
//
// CLINICAL FLOORS — mirror wearableApi.js (HRV_BREACH_MS / SLEEP_BREACH_MIN) and
// the Dev-Tools "Simulate CNS Breach" payload (HRV<35, sleep<240). Do not drift
// the two files apart: the dossier's breach verdict and this engine's SYSTEM
// BREACH must agree on the same athlete.
//
// SCORING MODEL (documented, deterministic):
//   baseline  = mean HRV of the last ≤14 ledger days BEFORE today (≥3 samples;
//               else today's own HRV seeds calibration — honest r=1.0, never an
//               invented population constant).
//   hrvScore  = linear in r = hrv/baseline:  r ≤ 0.60 → 0 · r = 1.00 → 80 · r ≥ 1.10 → 100
//   sleepScore= min(sleep / 480, 1) × 100            (480 min = 8 h target)
//   base      = 0.6·hrvScore + 0.4·sleepScore        (re-weighted if one is missing)
//   PENALTIES (the ordered strain×suppression interaction):
//     prior-day kcal ≥ 600 AND hrv < 35       → −30   (CNS alarm — heavy penalty)
//     prior-day kcal ≥ 600 AND r < 0.85       → −15   (under-recovered from load)
//   MODES: ≥85 PRIME_EXECUTION · ≥65 STANDARD_OPERATIONS · ≥45 SYSTEM_STRAIN ·
//          <45 SYSTEM_BREACH
//   HARD OVERRIDES (after scoring): hrv < 35 → SYSTEM_BREACH regardless of score;
//          sleep < 240 → demoted to at most SYSTEM_STRAIN.

export const ENGINE_VERSION = 'sovereign-readiness-engine/v1';

// Clinical floors — keep in lockstep with wearableApi.js.
export const HRV_BREACH_MS = 35;
export const SLEEP_BREACH_MIN = 240;

export const SLEEP_TARGET_MIN = 480; // 8 h
export const HIGH_STRAIN_KCAL = 600; // ≥60 ULU on the wearable-core kcal/1000 scale

const HRV_BASELINE_WINDOW_DAYS = 14;
const MIN_BASELINE_SAMPLES = 3;

export type BiometricDay = {
  date: string; // 'YYYY-MM-DD'
  hrv_ms: number | null;
  sleep_minutes: number | null;
  active_calories_burned: number | null;
  daily_steps: number | null;
};

export type Mode =
  | 'PRIME_EXECUTION'
  | 'STANDARD_OPERATIONS'
  | 'SYSTEM_STRAIN'
  | 'SYSTEM_BREACH'
  | 'INSUFFICIENT_TELEMETRY';

export type Protocol = {
  date: string;
  readiness_score: number | null;
  mode: Mode;
  mode_label: string;
  training_volume_modifier: number;
  carb_target_pct: number;
  fat_target_pct: number;
  protein_target_pct: number;
  cardio_directive: string;
  directives: string[];
  baseline_hrv_ms: number | null;
  baseline_samples: number;
  prior_day_kcal: number | null;
  engine: string;
  inputs: { hrv_ms: number | null; sleep_minutes: number | null };
};

// Per-mode protocol table: volume × macro split (carb/fat/protein, Σ=100) × cardio.
// Breach shifts fuel toward fat/protein for recovery; carbs scale with clearance.
export const MODE_PROTOCOL: Record<
  Mode,
  { label: string; volume: number; carb: number; fat: number; protein: number; cardio: string }
> = {
  PRIME_EXECUTION: {
    label: 'Prime Execution',
    volume: 1.0,
    carb: 50, fat: 20, protein: 30,
    cardio: 'Cleared for high-intensity work — Zone 4–5 interval window open.',
  },
  STANDARD_OPERATIONS: {
    label: 'Standard Operations',
    volume: 0.85,
    carb: 45, fat: 25, protein: 30,
    cardio: 'Tempo / Zone 3 cleared — cap efforts at threshold.',
  },
  SYSTEM_STRAIN: {
    label: 'System Strain',
    volume: 0.6,
    carb: 35, fat: 30, protein: 35,
    cardio: 'Zone 2 only — 30-minute ceiling, conversational pace.',
  },
  SYSTEM_BREACH: {
    label: 'System Breach',
    volume: 0.0,
    carb: 25, fat: 40, protein: 35,
    cardio: 'No cardio load. 20-minute restorative walk + breathwork only.',
  },
  INSUFFICIENT_TELEMETRY: {
    label: 'Insufficient Telemetry',
    volume: 1.0,
    carb: 45, fat: 25, protein: 30,
    cardio: 'No telemetry — execute the assigned program as written.',
  },
};

function num(x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// addDays('YYYY-MM-DD', n) → 'YYYY-MM-DD' (UTC-safe; mirrors wearable-core.mjs).
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Rolling HRV baseline from the ledger: mean of the last ≤14 non-null HRV days
// strictly BEFORE `asOfDate`. Returns { baseline, samples }.
export function computeHrvBaseline(
  series: BiometricDay[] | null | undefined,
  asOfDate: string,
): { baseline: number | null; samples: number } {
  const prior = (series || [])
    .filter((r) => r && typeof r.date === 'string' && r.date < asOfDate && num(r.hrv_ms) !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first
    .slice(0, HRV_BASELINE_WINDOW_DAYS);
  if (prior.length < MIN_BASELINE_SAMPLES) return { baseline: null, samples: prior.length };
  const sum = prior.reduce((acc, r) => acc + (num(r.hrv_ms) as number), 0);
  return { baseline: round(sum / prior.length, 1), samples: prior.length };
}

// Core scorer — pure function of the day's inputs + resolved baseline/prior strain.
export function computeReadinessProtocol(args: {
  date: string;
  hrv_ms: number | null;
  sleep_minutes: number | null;
  prior_day_kcal: number | null;
  baseline_hrv_ms: number | null;
  baseline_samples?: number;
}): Protocol {
  const hrv = num(args.hrv_ms);
  const sleep = num(args.sleep_minutes);
  const priorKcal = num(args.prior_day_kcal);
  const baselineSamples = args.baseline_samples ?? 0;
  const directives: string[] = [];

  // No vitals at all → the engine refuses to invent a verdict.
  if (hrv === null && sleep === null) {
    const p = MODE_PROTOCOL.INSUFFICIENT_TELEMETRY;
    return finalize('INSUFFICIENT_TELEMETRY', null, p, args.date, null, baselineSamples, priorKcal, hrv, sleep, [
      'No HRV or sleep telemetry in window — manual baseline governs today.',
    ]);
  }

  // Baseline: real history when available; else today's own HRV seeds calibration.
  let baseline = num(args.baseline_hrv_ms);
  if (baseline === null && hrv !== null) {
    baseline = hrv;
    directives.push(
      `Calibration day — fewer than ${MIN_BASELINE_SAMPLES} ledger days; today's HRV (${round(hrv, 1)} ms) seeds the baseline.`,
    );
  } else if (baseline !== null) {
    directives.push(`HRV baseline ${round(baseline, 1)} ms over ${baselineSamples} ledger day(s).`);
  }

  // Component scores.
  const r = hrv !== null && baseline !== null && baseline > 0 ? hrv / baseline : null;
  const hrvScore = r === null ? null : clamp(((r - 0.6) / 0.5) * 100, 0, 100);
  const sleepScore = sleep === null ? null : clamp((sleep / SLEEP_TARGET_MIN) * 100, 0, 100);

  let base: number;
  if (hrvScore !== null && sleepScore !== null) {
    base = 0.6 * hrvScore + 0.4 * sleepScore;
  } else if (hrvScore !== null) {
    base = hrvScore;
    directives.push('Sleep telemetry missing — score weighted on HRV alone.');
  } else {
    base = sleepScore as number;
    directives.push('HRV telemetry missing — score weighted on sleep alone.');
  }

  // The ordered strain × suppression interaction (heavy penalty).
  let penalty = 0;
  if (priorKcal !== null && priorKcal >= HIGH_STRAIN_KCAL) {
    if (hrv !== null && hrv < HRV_BREACH_MS) {
      penalty = 30;
      directives.push(
        `CNS alarm — prior-day strain ${round(priorKcal)} kcal with HRV severely suppressed (${round(hrv, 1)} ms < ${HRV_BREACH_MS} ms): −30.`,
      );
    } else if (r !== null && r < 0.85) {
      penalty = 15;
      directives.push(
        `Under-recovered from prior-day strain ${round(priorKcal)} kcal (HRV at ${round(r * 100)}% of baseline): −15.`,
      );
    }
  }

  const score = round(clamp(base - penalty, 0, 100));

  // Mode from score, then the hard clinical overrides.
  let mode: Mode =
    score >= 85 ? 'PRIME_EXECUTION'
    : score >= 65 ? 'STANDARD_OPERATIONS'
    : score >= 45 ? 'SYSTEM_STRAIN'
    : 'SYSTEM_BREACH';

  if (hrv !== null && hrv < HRV_BREACH_MS && mode !== 'SYSTEM_BREACH') {
    mode = 'SYSTEM_BREACH';
    directives.push(`Override — HRV ${round(hrv, 1)} ms breaches the ${HRV_BREACH_MS} ms floor: SYSTEM BREACH forced.`);
  }
  if (sleep !== null && sleep < SLEEP_BREACH_MIN && (mode === 'PRIME_EXECUTION' || mode === 'STANDARD_OPERATIONS')) {
    mode = 'SYSTEM_STRAIN';
    directives.push(`Override — sleep ${sleep} min under the ${SLEEP_BREACH_MIN} min floor: demoted to SYSTEM STRAIN.`);
  }

  const p = MODE_PROTOCOL[mode];
  directives.push(
    `Mode ${p.label.toUpperCase()} — volume ×${p.volume.toFixed(2)}, fuel ${p.carb}C/${p.fat}F/${p.protein}P.`,
  );
  return finalize(mode, score, p, args.date, baseline, baselineSamples, priorKcal, hrv, sleep, directives);
}

function finalize(
  mode: Mode,
  score: number | null,
  p: (typeof MODE_PROTOCOL)[Mode],
  date: string,
  baseline: number | null,
  baselineSamples: number,
  priorKcal: number | null,
  hrv: number | null,
  sleep: number | null,
  directives: string[],
): Protocol {
  return {
    date,
    readiness_score: score,
    mode,
    mode_label: p.label,
    training_volume_modifier: p.volume,
    carb_target_pct: p.carb,
    fat_target_pct: p.fat,
    protein_target_pct: p.protein,
    cardio_directive: p.cardio,
    directives,
    baseline_hrv_ms: baseline,
    baseline_samples: baselineSamples,
    prior_day_kcal: priorKcal,
    engine: ENGINE_VERSION,
    inputs: { hrv_ms: hrv, sleep_minutes: sleep },
  };
}

// Convenience runner: today's day + the ledger series (as returned by
// bbf_upsert_daily_biometrics / bbf_get_biometric_ledger, newest first) →
// the day's Protocol. Derives the baseline and the PRIOR day's strain itself.
export function runSovereignEngine(today: BiometricDay, series: BiometricDay[]): Protocol {
  const { baseline, samples } = computeHrvBaseline(series, today.date);
  const priorDate = addDays(today.date, -1);
  const priorRow = (series || []).find((r) => r && r.date === priorDate) || null;
  return computeReadinessProtocol({
    date: today.date,
    hrv_ms: num(today.hrv_ms),
    sleep_minutes: num(today.sleep_minutes),
    prior_day_kcal: priorRow ? num(priorRow.active_calories_burned) : null,
    baseline_hrv_ms: baseline,
    baseline_samples: samples,
  });
}
