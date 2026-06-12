// src/lib/biometricsApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Biometric Ledger client — thin wrappers over the vault-token-gated
// RPCs from 20260611100000_bbf_sovereign_biometric_ledger.sql:
//
//   bbf_upsert_daily_biometrics(token, day)      → { ok, biometric_id, series }
//   bbf_log_daily_protocol(token, protocol)      → { ok, protocol_id }
//   bbf_get_biometric_ledger(token, days)        → { ok, as_of, series, latest_protocol }
//
// The series (trailing 28 days, newest first) is the readiness engine's baseline
// substrate. Same auth idiom as wearableApi.js: the athlete's own vault session
// token authorizes every call — no shared secret ever reaches the client (§7).

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Null/undefined/'' guard FIRST — Number(null) is 0, not NaN. Without it a
// no-watch night ("not measured" → null hrv/sleep) lands as 0 on the ledger and
// the engine reads a zero-sleep athlete (SYSTEM_BREACH) instead of emitting
// INSUFFICIENT_TELEMETRY. Mirrors the engine's own num() in bbf-readiness-engine.ts.
function num(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// Safe integer cast preserving null. The calorie metric arrives from the native
// bridge as a kcal Double (e.g. the Samsung total−BMR fallback = 264.6) and the
// ledger column is an integer kcal count — round it, but keep null as null so a
// genuinely absent burn never becomes a fabricated 0 (null-integrity).
function intOrNull(x) {
  const n = num(x);
  return n === null ? null : Math.round(n);
}

// Native HealthConnectBridge recovery JSON → a bbf_daily_biometrics day row.
export function mapRecoveryToBiometricDay(recovery) {
  const r = recovery || {};
  return {
    date: r.reading_date || null,
    hrv_ms: num(r.hrv_ms),
    sleep_minutes: num(r.sleep_minutes),
    active_calories_burned: intOrNull(r.active_kcal),
    daily_steps: num(r.daily_steps),
  };
}

// Engine Protocol → the row shape bbf_log_daily_protocol persists. The columns the
// ledger queries on are first-class; the full verdict rides in directive_log.
export function toProtocolRow(protocol) {
  const p = protocol || {};
  return {
    date: p.date,
    readiness_score: p.readiness_score,
    training_volume_modifier: p.training_volume_modifier,
    carb_target_pct: p.carb_target_pct,
    fat_target_pct: p.fat_target_pct,
    directive_log: {
      engine: p.engine,
      mode: p.mode,
      mode_label: p.mode_label,
      cardio: p.cardio_directive,
      protein_target_pct: p.protein_target_pct,
      directives: p.directives || [],
      baseline_hrv_ms: p.baseline_hrv_ms,
      baseline_samples: p.baseline_samples,
      prior_day_kcal: p.prior_day_kcal,
      inputs: p.inputs || null,
    },
  };
}

async function rpc(fn, args) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session' };
  const { data, error } = await supabase.rpc(fn, { p_session_token: token, ...args });
  if (error) return { ok: false, error: error.message || 'network' };
  return data || { ok: false, error: 'unknown' };
}

// Upsert today's vitals; returns the trailing 28-day series (newest first).
export function syncBiometricDay(day) {
  return rpc('bbf_upsert_daily_biometrics', { p_day: day });
}

// Persist the engine's computed protocol for the day.
export function logDailyProtocol(protocolRow) {
  return rpc('bbf_log_daily_protocol', { p_protocol: protocolRow });
}

// Mount fetch: trailing series + the most recent stored protocol.
export function fetchBiometricLedger(days = 28) {
  return rpc('bbf_get_biometric_ledger', { p_days: days });
}
