// supabase/functions/_shared/wearable-core.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Wearable ingestion core — pure, portable ESM (no Deno/Node APIs), so the Deno
// edge function (bbf-wearable-ingest) AND the offline Node test import the SAME
// logic. Two responsibilities:
//
//   1. normalizeReading(source, payload) — map a raw Whoop / Apple / Oura / manual
//      payload onto the canonical reading shape stored in bbf_wearable_readings.
//   2. computeAcwr(series, opts) — acute:chronic workload ratio from a strain
//      series. The SQL helper _bbf_wearable_acwr() in the migration is a VERBATIM
//      mirror of this formula + thresholds; the two MUST stay in sync (both are
//      pinned to identical numbers by the test suite + the branch-DB check).
//
// ── DATA CONTRACT — canonical normalized reading ─────────────────────────────
//   {
//     source:          'whoop' | 'apple' | 'oura' | 'manual',
//     reading_date:    'YYYY-MM-DD',   // the calendar day the metrics represent
//     readiness_score: number|null,    // 0–100 recovery/readiness (Whoop recovery,
//                                       //   Oura readiness; Apple has none → null)
//     strain:          number,         // 0–100 Universal Load Unit (ULU) — the
//                                       //   source-agnostic acute daily load
//     resting_hr:      number|null,    // bpm
//     hrv_ms:          number|null,    // ms — RMSSD/SDNN; computed by SDNN from raw
//                                       //   NN/RR samples when present, else the
//                                       //   source's pre-calc value; CLAMPED 20–200 ms
//                                       //   (athletic band; null stays null).
//     active_kcal:     number|null,    // ACTIVE energy burned (NOT BMR-inclusive) —
//                                       //   the workload-tracker / strain input.
//     bmr:             number|null,    // Mifflin-St Jeor resting baseline (kcal/day),
//                                       //   only when sex+weight+height+age supplied.
//     total_kcal:      number|null,    // reported total, else bmr + active_kcal.
//     sleep_minutes:   number|null,
//     recorded_at:     ISO string|null,// source measurement timestamp, if given
//     raw:             object          // original payload, retained for audit
//   }
//
// ── ENERGY: BMR baseline vs ACTIVE burn ──────────────────────────────────────
//   Only ACTIVE energy drives the workload tracker (strain/ACWR). BMR (Mifflin-St
//   Jeor) is the metabolic baseline kept SEPARATE — folding it in would add
//   ~1500 kcal/day and saturate the 0–100 scale. When a source reports only TOTAL
//   energy and BMR is computable, active = max(0, total − BMR).
//
// ── STRAIN → ULU normalization (documented, deterministic) ───────────────────
//   Whoop:  cycle.day_strain is 0–21      → ULU = round(strain / 21 * 100)
//   Oura:   activity.score is already 0–100 → ULU = round(score)
//   Apple:  active_kcal                    → ULU = round(min(1, kcal / 1000) * 100)
//           (1000 kcal of active burn ≙ a maximal day)
//   manual: caller supplies strain (0–100) directly.
// ─────────────────────────────────────────────────────────────────────────────

export const SOURCES = ['whoop', 'apple', 'oura', 'manual'];

// Strain normalization constants (documented above).
const WHOOP_STRAIN_MAX = 21;       // Whoop day-strain scale ceiling
const APPLE_ACTIVE_KCAL_FULL = 1000; // active kcal that maps to a maximal (100 ULU) day

// ACWR windows + thresholds (mirrored in SQL).
export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;
export const MIN_CHRONIC_DAYS_WITH_DATA = 14; // below this the ratio is not yet meaningful

// HRV plausible athletic band (SDNN/RMSSD). The 20 ms floor sits BELOW the readiness
// engine's 35 ms breach floor, so clamping can never lift a genuine sub-breach
// reading out of breach; the 200 ms ceiling rejects sensor-glitch extremes.
export const HRV_MIN_MS = 20;
export const HRV_MAX_MS = 200;

const KJ_TO_KCAL = 0.239006; // Whoop reports energy in kilojoules

function num(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function round(n, dp = 0) { const f = 10 ** dp; return Math.round(n * f) / f; }

// Coerce a value to a 'YYYY-MM-DD' date string, or null if unparseable.
export function toDateStr(v) {
  if (!v) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function ulu(value, lo = 0, hi = 100) {
  if (value === null) return null;
  return clamp(round(value), lo, hi);
}

// ── HRV — raw NN/RR intervals → SDNN; clamp to the athletic band ─────────────
// SDNN: population standard deviation of successive NN/RR interval samples (ms) —
// the canonical short-term time-domain HRV metric. ≥2 valid samples required, else
// null (a single sample cannot express variability — never fabricate one).
export function sdnn(intervalsMs) {
  const xs = (Array.isArray(intervalsMs) ? intervalsMs : [])
    .map((v) => num(v))
    .filter((v) => v !== null && v > 0);
  if (xs.length < 2) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

// Clamp a PRESENT, POSITIVE hrv value into [HRV_MIN_MS, HRV_MAX_MS]. Missing OR
// ≤0 stays NULL — Health Connect reports a no-record as 0, and a missing HRV must
// never be fabricated into a 20 ms near-breach reading (null ≠ zero; mirrors the
// readiness engine's vital() and the ledger sanitize migration).
export function clampHrv(v) {
  const n = num(v);
  if (n === null || n <= 0) return null;
  return clamp(round(n, 1), HRV_MIN_MS, HRV_MAX_MS);
}

// Resolve HRV for a source: raw interval samples (→ SDNN) win when present, else the
// source's pre-calculated RMSSD/SDNN; the result is clamped to the athletic band.
function resolveHrv(rawIntervals, precalc) {
  const fromRaw = sdnn(rawIntervals);
  return clampHrv(fromRaw !== null ? fromRaw : precalc);
}

// ── ENERGY — BMR baseline vs ACTIVE burn ─────────────────────────────────────
// Mifflin-St Jeor resting metabolic rate (kcal/day). Distinguishes the metabolic
// BMR baseline from the wearable's ACTIVE burn so only active energy drives the
// workload tracker. Null unless sex + weight(kg) + height(cm) + age are all present.
export function mifflinStJeorBMR(bio) {
  const b = bio || {};
  const w = num(b.weight_kg ?? b.weightKg);
  const h = num(b.height_cm ?? b.heightCm);
  const a = num(b.age);
  const sex = String(b.sex ?? b.biological_sex ?? '').trim().toLowerCase();
  if (w === null || h === null || a === null || !sex) return null;
  const sexConst = sex.startsWith('m') ? 5 : sex.startsWith('f') ? -161 : null;
  if (sexConst === null) return null;
  return round(10 * w + 6.25 * h - 5 * a + sexConst);
}

// Anthropometrics for the BMR calc, from a nested profile or top-level keys.
function anthroFrom(p) {
  if (p.profile && typeof p.profile === 'object') return p.profile;
  if (p.bio && typeof p.bio === 'object') return p.bio;
  if (p.athlete && typeof p.athlete === 'object') return p.athlete;
  return {
    weight_kg: p.weight_kg ?? p.weightKg,
    height_cm: p.height_cm ?? p.heightCm,
    age: p.age,
    sex: p.sex ?? p.biological_sex,
  };
}

// The ACTIVE kcal a source reports (never total/BMR-inclusive). Whoop reports
// kilojoules → converted to kcal; the others report active kcal directly.
function sourceActiveKcal(src, p) {
  if (src === 'whoop') {
    const cycle = p.cycle || {};
    const direct = num(cycle.active_calories ?? cycle.active_energy_kcal ?? p.active_energy_kcal);
    if (direct !== null) return round(direct);
    const kj = num(cycle.kilojoule ?? cycle.kilojoules ?? p.kilojoule);
    return kj === null ? null : round(kj * KJ_TO_KCAL);
  }
  if (src === 'oura') {
    const activity = p.activity || {};
    return num(activity.active_calories ?? activity.cal_active ?? p.active_kcal ?? p.active_energy_kcal);
  }
  if (src === 'apple') {
    return num(p.active_energy_kcal ?? p.activeEnergyBurned ?? p.active_energy ?? p.active_calories);
  }
  return num(p.active_kcal ?? p.active_energy_kcal); // manual
}

// Total reported energy (if any), used for the BMR/active split.
function sourceTotalKcal(p) {
  const activity = p.activity || {};
  return num(p.total_energy_kcal ?? p.total_calories ?? activity.cal_total ?? p.total_kcal);
}

// Resolve { active_kcal, bmr, total_kcal }. When only TOTAL energy is reported and
// BMR is computable, active = max(0, total − BMR) — the explicit BMR/active split.
function resolveEnergy(src, p) {
  const bmr = mifflinStJeorBMR(anthroFrom(p));
  let active = sourceActiveKcal(src, p);
  const total = sourceTotalKcal(p);
  if (active === null && total !== null && bmr !== null) {
    active = Math.max(0, round(total - bmr));
  }
  const total_kcal = total !== null
    ? total
    : (bmr !== null && active !== null ? round(bmr + active) : null);
  return { active_kcal: active, bmr, total_kcal };
}

// ── normalizeReading ──────────────────────────────────────────────────────────
export function normalizeReading(source, payload) {
  const src = String(source || '').toLowerCase();
  if (!SOURCES.includes(src)) {
    throw new Error(`unsupported_source: ${source}`);
  }
  const p = payload && typeof payload === 'object' ? payload : {};
  const energy = resolveEnergy(src, p);

  let reading;
  if (src === 'whoop') {
    const cycle = p.cycle || {};
    const recovery = p.recovery || {};
    const sleep = p.sleep || {};
    const strainNative = num(cycle.day_strain ?? cycle.strain);
    reading = {
      reading_date: toDateStr(p.date ?? cycle.date ?? recovery.date),
      readiness_score: ulu(num(recovery.recovery_score ?? recovery.score)),
      strain: strainNative === null ? null : clamp(round((strainNative / WHOOP_STRAIN_MAX) * 100), 0, 100),
      resting_hr: num(recovery.resting_heart_rate ?? cycle.resting_heart_rate),
      hrv_ms: resolveHrv(
        recovery.hrv_samples ?? recovery.rr_intervals ?? recovery.nn_intervals,
        recovery.hrv_rmssd_milli ?? recovery.hrv_ms,
      ),
      sleep_minutes: msToMin(num(sleep.total_in_bed_time_milli ?? sleep.total_sleep_milli)) ?? num(sleep.sleep_minutes),
      recorded_at: p.recorded_at ?? cycle.updated_at ?? null,
    };
  } else if (src === 'oura') {
    const readiness = p.readiness || {};
    const activity = p.activity || {};
    const sleep = p.sleep || {};
    reading = {
      reading_date: toDateStr(p.day ?? p.date ?? readiness.day),
      readiness_score: ulu(num(readiness.score)),
      strain: ulu(num(activity.score ?? p.strain)),
      resting_hr: num(p.resting_heart_rate ?? readiness.resting_heart_rate),
      hrv_ms: resolveHrv(
        p.hrv_samples ?? readiness.hrv_samples ?? p.rr_intervals,
        p.hrv ?? readiness.hrv_balance ?? p.hrv_ms,
      ),
      sleep_minutes: secToMin(num(sleep.total_sleep_duration)) ?? num(sleep.sleep_minutes),
      recorded_at: p.recorded_at ?? p.timestamp ?? null,
    };
  } else if (src === 'apple') {
    // Apple's strain is derived from ACTIVE burn (energy.active_kcal — which already
    // honors a total−BMR split when only total energy was reported).
    const activeForStrain = energy.active_kcal;
    reading = {
      reading_date: toDateStr(p.date),
      // HealthKit exposes no readiness score; leave null rather than invent one.
      readiness_score: ulu(num(p.readiness_score)),
      strain: activeForStrain === null ? null : clamp(round(Math.min(1, activeForStrain / APPLE_ACTIVE_KCAL_FULL) * 100), 0, 100),
      resting_hr: num(p.resting_heart_rate ?? p.restingHeartRate),
      hrv_ms: resolveHrv(
        p.hrv_samples ?? p.heartRateVariabilitySamples ?? p.nn_intervals ?? p.rr_intervals,
        p.hrv_sdnn_ms ?? p.hrv_ms ?? p.heartRateVariabilitySDNN,
      ),
      sleep_minutes: num(p.sleep_minutes),
      recorded_at: p.recorded_at ?? null,
    };
  } else { // manual
    reading = {
      reading_date: toDateStr(p.reading_date ?? p.date),
      readiness_score: ulu(num(p.readiness_score)),
      strain: ulu(num(p.strain)),
      resting_hr: num(p.resting_hr),
      hrv_ms: resolveHrv(p.nn_intervals ?? p.rr_intervals ?? p.hrv_samples, p.hrv_ms),
      sleep_minutes: num(p.sleep_minutes),
      recorded_at: p.recorded_at ?? null,
    };
  }

  // Energy fields are first-class on every reading (no longer folded into strain
  // only / bypassed): active_kcal feeds the workload tracker; bmr/total_kcal carry
  // the metabolic split when anthropometrics are present.
  reading.active_kcal = energy.active_kcal;
  reading.bmr = energy.bmr;
  reading.total_kcal = energy.total_kcal;

  if (!reading.reading_date) throw new Error('missing_reading_date');
  if (reading.strain === null) throw new Error('missing_strain');

  return { source: src, ...reading, raw: p };
}

function msToMin(ms) { return ms === null ? null : Math.round(ms / 60000); }
function secToMin(s) { return s === null ? null : Math.round(s / 60); }

// ── computeAcwr ────────────────────────────────────────────────────────────────
// series: [{ reading_date:'YYYY-MM-DD', strain:number }, ...] (any order, may span
//   multiple sources). One load value per day is used (the day's MAX strain), then
//   averaged over the rolling window. Missing days contribute 0 to the sum but the
//   denominator is always the full window length (standard rolling-average ACWR).
export function computeAcwr(series, opts = {}) {
  const asOf = toDateStr(opts.asOf) || toDateStr(new Date().toISOString());
  const acuteDays = opts.acuteDays || ACUTE_DAYS;
  const chronicDays = opts.chronicDays || CHRONIC_DAYS;

  // Collapse to one (max) strain per day.
  const byDay = new Map();
  for (const r of series || []) {
    const d = toDateStr(r.reading_date ?? r.date);
    const s = num(r.strain);
    if (d === null || s === null) continue;
    byDay.set(d, Math.max(byDay.get(d) ?? 0, s));
  }

  let acuteSum = 0;
  let chronicSum = 0;
  let chronicDaysWithData = 0;
  for (let i = 0; i < chronicDays; i++) {
    const day = addDays(asOf, -i);
    const v = byDay.get(day);
    if (v === undefined) continue;
    chronicSum += v;
    chronicDaysWithData += 1;
    if (i < acuteDays) acuteSum += v;
  }

  const acute = round(acuteSum / acuteDays, 2);
  const chronic = round(chronicSum / chronicDays, 2);
  const acwr = chronic > 0 ? round(acute / chronic, 3) : null;
  const flag = flagFor(acwr, chronicDaysWithData, chronic);

  return {
    as_of: asOf,
    acute_days: acuteDays,
    chronic_days: chronicDays,
    chronic_days_with_data: chronicDaysWithData,
    acute,
    chronic,
    acwr,
    flag,
  };
}

// Thresholds (sports-science ACWR "sweet spot" 0.8–1.3; danger > 1.5). Mirrored in SQL.
export function flagFor(acwr, chronicDaysWithData, chronic) {
  if (acwr === null || chronic <= 0 || chronicDaysWithData < MIN_CHRONIC_DAYS_WITH_DATA) return 'insufficient_data';
  if (acwr < 0.8) return 'detraining';
  if (acwr <= 1.3) return 'optimal';
  if (acwr <= 1.5) return 'caution';
  return 'high_risk';
}

// addDays('YYYY-MM-DD', n) → 'YYYY-MM-DD' (UTC-safe).
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
