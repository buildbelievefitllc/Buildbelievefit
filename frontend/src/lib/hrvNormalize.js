// src/lib/hrvNormalize.js
// ─────────────────────────────────────────────────────────────────────────────
// Final client-side normalization of a raw RMSSD (ms) reading before it lands on
// the readiness payload (bbf_daily_biometrics.hrv_ms → the recovery axis the
// deterministic readiness engine scores).
//
// The NATIVE layer (HealthConnectManager.readRecovery) already does the heavy lift:
// it queries HeartRateVariabilityRmssdRecord over a ROLLING 24h window, separates
// daytime spot checks from the overnight baseline, and emits the recovery anchor
// (overnight resting mean, else the latest reading) as `hrv_ms`. This module is the
// last-mile sanitize on the JS side so the SAME guarantee holds for any non-native
// source (manual entry, a future HealthKit bridge, a replayed payload).
//
// NULL-INTEGRITY (mirrors biometricsApi/num + the engine's vital()): '' | null |
// undefined | non-finite | ≤0 → null, never a fabricated 0 (a 0 would trip the
// engine's HRV_BREACH floor and force a phantom breach onto every regulated surface).
//
// We DROP implausible-high readings (unit/encoding errors) but deliberately do NOT
// clamp genuine LOW HRV upward — a real suppression (e.g. 18ms, overtrained) must
// survive intact so the engine's breach detection (HRV_BREACH_MS = 35) can fire.

// Plausible adult RMSSD ceiling. Real values effectively never exceed ~250ms; a
// reading past this is a unit error (e.g. µs, or an SDNN/other metric mislabeled),
// so it is dropped to null rather than clamped — fabricated recovery is worse than
// absent recovery (the engine handles null deterministically as INSUFFICIENT).
export const HRV_MAX_PLAUSIBLE_MS = 400;

export function normalizeHrvMs(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return null; // no/zero HRV → null (never 0)
  if (n > HRV_MAX_PLAUSIBLE_MS) return null; // implausible → drop, don't clamp
  // Round to 1 decimal — RMSSD is reported to sub-ms precision by some providers,
  // but the ledger and 14-day baseline math don't need the noise floor.
  return Math.round(n * 10) / 10;
}
