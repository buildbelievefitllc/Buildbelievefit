// src/lib/manualBaseline.js
// ─────────────────────────────────────────────────────────────────────────────
// Manual Health Input — the athlete's subjective baseline when no wearable is in
// play (CEO order: zero manual labor, but the human can always self-report).
//
// LOCAL-FIRST (Dexie `bbf_floor_v1`, table `manualBaseline`): "Save Baseline"
// writes here FIRST — same local-first stance as the Floor logger — so the entry
// survives offline / reload and re-populates the form via useLiveQuery.
//
// EQUAL-VALIDITY CONTRACT: every saved row carries a `recovery` snapshot in the
// EXACT shape the Health Connect bridge emits (healthConnectBridge.readRecovery →
// healthConnectSync). That snapshot flows through the SAME pipeline a wearable
// sync uses (mapRecoveryToBiometricDay → bbf_upsert_daily_biometrics →
// runSovereignEngine → bbf_log_daily_protocol), so the engine scores a typed-in
// baseline identically to a watch read — no second-class manual path.
//
// The objective metrics (sleep minutes, active kcal) land on the durable ledger
// through that pipeline; the subjective sliders (sleep quality, stress) ride into
// the engine as the recovery-axis proxy and are kept on the local row for recall.

import { useLiveQuery } from 'dexie-react-hooks';
import { floorDb, manualBaselineId } from './floorDb.js';

// Local calendar date 'YYYY-MM-DD' (en-CA renders ISO order in local time) —
// mirrors useDailyReadiness.localToday so the manual day and the readiness day agree.
export function manualToday() {
  return new Date().toLocaleDateString('en-CA');
}

function num(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(x) {
  const n = num(x);
  return n === null ? null : Math.round(n);
}
// Clamp a subjective 1–10 slider; null when unset.
function scale1to10(x) {
  const n = num(x);
  return n === null ? null : Math.max(1, Math.min(10, Math.round(n)));
}

// Form inputs → the canonical recovery payload (the Health Connect bridge shape).
// hrv_ms is null (a human baseline has no HRV). sleep hours → minutes; active kcal
// passes through. daily_steps is the athlete's END-OF-DAY total when entered — it
// becomes the authoritative count for the day (the upsert COALESCEs steps, so a
// blank value preserves the wearable's autonomous count rather than wiping it).
// `source: 'manual_input'` tags provenance.
export function manualToRecovery(form, dateStr = manualToday()) {
  const f = form || {};
  const hours = num(f.sleep_hours);
  return {
    reading_date: dateStr,
    readiness_score: null,
    hrv_ms: null,
    sleep_minutes: hours === null ? null : Math.round(hours * 60),
    active_kcal: intOrNull(f.active_kcal),
    daily_steps: intOrNull(f.daily_steps),
    stress_level: scale1to10(f.stress_level),
    recorded_at: new Date().toISOString(),
    source: 'manual_input',
  };
}

// The subjective recovery-axis inputs the engine consumes (runSovereignEngine's
// 3rd arg). `input_source: 'manual'` makes the verdict log its provenance.
export function manualSubjective(form) {
  const f = form || {};
  return {
    sleep_quality: scale1to10(f.sleep_quality),
    stress_level: scale1to10(f.stress_level),
    input_source: 'manual',
  };
}

// Persist the athlete's manual baseline for a day (idempotent put on [uid+date]).
// Stores the raw slider state (for form recall) + the recovery snapshot (the
// equal-validity contract). Returns the written record.
export async function saveManualBaseline(uid, form, dateStr = manualToday()) {
  const slug = String(uid || '').trim().toLowerCase();
  if (!slug) throw new Error('Sign in to save a manual baseline.');
  const record = {
    id: manualBaselineId(slug, dateStr),
    uid: slug,
    date: dateStr,
    sleep_hours: num(form?.sleep_hours),
    sleep_quality: scale1to10(form?.sleep_quality),
    stress_level: scale1to10(form?.stress_level),
    active_kcal: intOrNull(form?.active_kcal),
    daily_steps: intOrNull(form?.daily_steps),
    recovery: manualToRecovery(form, dateStr),
    updatedAt: Date.now(),
  };
  await floorDb.manualBaseline.put(record);
  return record;
}

// Live today's manual baseline for an athlete (re-populates the form on reload).
// Returns undefined while loading, then the record or null.
export function useManualBaselineToday(uid) {
  const slug = String(uid || '').trim().toLowerCase();
  const date = manualToday();
  return useLiveQuery(
    () => (slug ? floorDb.manualBaseline.get(manualBaselineId(slug, date)) : null),
    [slug, date],
  );
}
