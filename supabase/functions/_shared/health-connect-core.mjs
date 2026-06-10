// supabase/functions/_shared/health-connect-core.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Google Health Connect ingestion core — pure, portable ESM (no Deno/Node APIs),
// so the Deno edge function (bbf-health-sync) AND the offline Node test/simulator
// import the SAME logic. Two responsibilities:
//
//   1. normalizeHealthConnect(payload) — map the on-device Health Connect export
//      (flat keys OR raw record arrays) onto the canonical reading shape stored
//      in bbf_readiness (telemetry columns added by the health-connect migration).
//   2. cnsFlags(reading) — deterministic CNS-compromise flags. These thresholds
//      are the SINGLE source of truth shared by bbf-health-sync (instant feedback
//      to the Android app) and bbf-agentic-peaking (the Agent Override trigger).
//
// ── DATA CONTRACT — canonical normalized reading ─────────────────────────────
//   {
//     reading_date:  'YYYY-MM-DD',   // the calendar day the metrics represent
//     hrv_ms:        number|null,    // HRV RMSSD in ms (HeartRateVariabilityRmssdRecord)
//     resting_hr:    number|null,    // bpm (RestingHeartRateRecord)
//     sleep_minutes: number|null,    // total sleep duration (SleepSessionRecord)
//     recorded_at:   ISO string|null,
//     raw:           object          // original payload, retained for audit
//   }
//
// ── ACCEPTED PAYLOAD SHAPES ──────────────────────────────────────────────────
//   Flat (the Android bridge pre-aggregates before pushing):
//     { date, hrv_ms, resting_heart_rate, total_sleep_minutes }
//   Records (raw Health Connect record dump — we aggregate here):
//     { date, records: {
//         HeartRateVariabilityRmssd: [{ heartRateVariabilityMillis, time }],
//         RestingHeartRate:          [{ beatsPerMinute, time }],
//         SleepSession:              [{ startTime, endTime } | { durationMinutes }],
//     } }
//   Aggregation: HRV = mean of samples (1dp) · RHR = mean (rounded) ·
//   sleep = Σ session durations in whole minutes.
// ─────────────────────────────────────────────────────────────────────────────

// CNS-compromise thresholds (CEO spec — mirrored by bbf-agentic-peaking).
export const HRV_FLOOR_MS = 35;        // HRV RMSSD below this → CNS compromised
export const SLEEP_FLOOR_MINUTES = 240; // total sleep below this → CNS compromised
export const RHR_ELEVATED_BPM = 80;    // informational flag only, not a trigger

function num(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function round(n, dp = 0) { const f = 10 ** dp; return Math.round(n * f) / f; }

// Coerce a value to a 'YYYY-MM-DD' date string, or null if unparseable.
export function toDateStr(v) {
  if (!v) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function mean(values) {
  const xs = values.filter((v) => v !== null);
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Aggregate a raw Health Connect record dump → flat metrics.
function aggregateRecords(records) {
  const hrvSamples = (records.HeartRateVariabilityRmssd || records.heartRateVariabilityRmssd || [])
    .map((r) => num(r.heartRateVariabilityMillis ?? r.hrv_ms));
  const rhrSamples = (records.RestingHeartRate || records.restingHeartRate || [])
    .map((r) => num(r.beatsPerMinute ?? r.bpm));

  let sleepMinutes = null;
  for (const s of records.SleepSession || records.sleepSession || []) {
    let mins = num(s.durationMinutes);
    if (mins === null && s.startTime && s.endTime) {
      const t0 = Date.parse(s.startTime);
      const t1 = Date.parse(s.endTime);
      if (!Number.isNaN(t0) && !Number.isNaN(t1) && t1 > t0) {
        mins = Math.round((t1 - t0) / 60000);
      }
    }
    if (mins !== null) sleepMinutes = (sleepMinutes ?? 0) + mins;
  }

  const hrvMean = mean(hrvSamples);
  const rhrMean = mean(rhrSamples);
  return {
    hrv_ms: hrvMean === null ? null : round(hrvMean, 1),
    resting_hr: rhrMean === null ? null : Math.round(rhrMean),
    sleep_minutes: sleepMinutes,
  };
}

// ── normalizeHealthConnect ────────────────────────────────────────────────────
export function normalizeHealthConnect(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};

  let hrv_ms = num(p.hrv_ms ?? p.hrv ?? p.heartRateVariabilityMillis);
  let resting_hr = num(p.resting_heart_rate ?? p.resting_hr ?? p.restingHeartRate);
  let sleep_minutes = num(p.total_sleep_minutes ?? p.sleep_minutes ?? p.totalSleepMinutes);

  // Raw record dump path — aggregate; flat keys win if both are present.
  if (p.records && typeof p.records === 'object') {
    const agg = aggregateRecords(p.records);
    if (hrv_ms === null) hrv_ms = agg.hrv_ms;
    if (resting_hr === null) resting_hr = agg.resting_hr;
    if (sleep_minutes === null) sleep_minutes = agg.sleep_minutes;
  }

  const reading_date = toDateStr(p.date ?? p.reading_date ?? p.day);
  if (!reading_date) throw new Error('missing_reading_date');
  if (hrv_ms === null && resting_hr === null && sleep_minutes === null) {
    throw new Error('empty_metrics');
  }
  if (hrv_ms !== null && (hrv_ms < 0 || hrv_ms > 500)) throw new Error('invalid_hrv_ms');
  if (resting_hr !== null && (resting_hr < 20 || resting_hr > 220)) throw new Error('invalid_resting_hr');
  if (sleep_minutes !== null && (sleep_minutes < 0 || sleep_minutes > 2880)) throw new Error('invalid_sleep_minutes');

  return {
    reading_date,
    hrv_ms,
    resting_hr,
    sleep_minutes: sleep_minutes === null ? null : Math.round(sleep_minutes),
    recorded_at: p.recorded_at ?? p.timestamp ?? null,
    raw: p,
  };
}

// ── cnsFlags — the deterministic CNS gate ────────────────────────────────────
// `compromised` is the Agent Override trigger: HRV floor OR sleep floor breach.
// RHR elevation is surfaced but does NOT trip the override on its own.
export function cnsFlags(reading) {
  const hrv = num(reading?.hrv_ms);
  const sleep = num(reading?.sleep_minutes);
  const rhr = num(reading?.resting_hr);

  const triggers = [];
  if (hrv !== null && hrv < HRV_FLOOR_MS) triggers.push(`hrv_ms ${hrv} < ${HRV_FLOOR_MS}`);
  if (sleep !== null && sleep < SLEEP_FLOOR_MINUTES) triggers.push(`sleep_minutes ${sleep} < ${SLEEP_FLOOR_MINUTES}`);

  return {
    hrv_compromised: hrv !== null && hrv < HRV_FLOOR_MS,
    sleep_compromised: sleep !== null && sleep < SLEEP_FLOOR_MINUTES,
    rhr_elevated: rhr !== null && rhr >= RHR_ELEVATED_BPM,
    compromised: triggers.length > 0,
    triggers,
  };
}
