// supabase/functions/_shared/wearable-core.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Offline, deterministic verification of the wearable ingestion core. Pure ESM,
// no network, no Deno — run with:  node supabase/functions/_shared/wearable-core.test.mjs
// Exits non-zero on the first failed assertion (CI/green-gate friendly).
//
// The ACWR expectations here are the SAME numbers asserted against the SQL helper
// _bbf_wearable_acwr() on the branch DB, proving the JS edge path and the SQL read
// boundary agree.

import assert from 'node:assert/strict';
import {
  normalizeReading, computeAcwr, addDays,
  sdnn, clampHrv, mifflinStJeorBMR, HRV_MIN_MS, HRV_MAX_MS,
} from './wearable-core.mjs';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('wearable-core — normalization');

check('whoop payload → ULU strain + readiness', () => {
  const r = normalizeReading('whoop', {
    date: '2026-06-01',
    cycle: { day_strain: 14.2, average_heart_rate: 88 },
    recovery: { recovery_score: 66, resting_heart_rate: 52, hrv_rmssd_milli: 78 },
    sleep: { total_in_bed_time_milli: 28800000 }, // 480 min
  });
  assert.equal(r.source, 'whoop');
  assert.equal(r.reading_date, '2026-06-01');
  assert.equal(r.strain, 68);          // round(14.2/21*100)
  assert.equal(r.readiness_score, 66);
  assert.equal(r.resting_hr, 52);
  assert.equal(r.hrv_ms, 78);
  assert.equal(r.sleep_minutes, 480);
  assert.equal(r.active_kcal, null);   // no kilojoule/active in payload → null (not 0)
});

check('oura payload → activity score as ULU', () => {
  const r = normalizeReading('oura', {
    day: '2026-06-01',
    readiness: { score: 72 },
    activity: { score: 80 },
    sleep: { total_sleep_duration: 27000 }, // 450 min
    resting_heart_rate: 55, hrv: 65,
  });
  assert.equal(r.strain, 80);
  assert.equal(r.readiness_score, 72);
  assert.equal(r.resting_hr, 55);
  assert.equal(r.hrv_ms, 65);
  assert.equal(r.sleep_minutes, 450);
});

check('apple payload → active energy as ULU, readiness null', () => {
  const r = normalizeReading('apple', {
    date: '2026-06-01',
    active_energy_kcal: 720,
    resting_heart_rate: 58, hrv_sdnn_ms: 60, sleep_minutes: 430,
  });
  assert.equal(r.strain, 72);             // round(min(1,720/1000)*100)
  assert.equal(r.readiness_score, null);  // HealthKit has no readiness
  assert.equal(r.resting_hr, 58);
  assert.equal(r.hrv_ms, 60);
  assert.equal(r.active_kcal, 720);       // ACTIVE burn is now first-class (not folded into strain only)
  assert.equal(r.bmr, null);              // no anthropometrics → no BMR
  assert.equal(r.total_kcal, null);
});

check('apple active energy caps at 100 ULU', () => {
  const r = normalizeReading('apple', { date: '2026-06-01', active_energy_kcal: 4200 });
  assert.equal(r.strain, 100);
  assert.equal(r.active_kcal, 4200);      // raw active burn preserved even past the strain cap
});

console.log('wearable-core — HRV (SDNN / clamp)');

check('sdnn — population SD of NN intervals; <2 samples → null', () => {
  assert.equal(sdnn([800, 900]), 50);     // mean 850, var 2500 → sd 50
  assert.equal(sdnn([800]), null);        // a lone sample cannot express variability
  assert.equal(sdnn([]), null);
  assert.equal(sdnn(undefined), null);
});

check('hrv clamps to athletic band; ≤0 and missing stay null', () => {
  assert.equal(clampHrv(78), 78);         // in-band untouched
  assert.equal(clampHrv(5), HRV_MIN_MS);  // implausible low → 20 ms floor (still < 35 breach)
  assert.equal(clampHrv(4000), HRV_MAX_MS); // sensor glitch → 200 ms ceiling
  assert.equal(clampHrv(0), null);        // 0 = Health Connect no-record → null, NOT a 20 ms reading
  assert.equal(clampHrv(null), null);     // missing stays missing — never fabricated
});

check('apple raw HRV samples → SDNN, clamped into band', () => {
  const samples = [800, 900, 850, 950, 870];
  const r = normalizeReading('apple', { date: '2026-06-01', active_energy_kcal: 500, hrv_samples: samples });
  assert.equal(r.hrv_ms, clampHrv(sdnn(samples))); // raw intervals win over any pre-calc
  assert.ok(r.hrv_ms >= HRV_MIN_MS && r.hrv_ms <= HRV_MAX_MS);
});

console.log('wearable-core — energy (BMR / active split)');

check('Mifflin-St Jeor BMR — male & female; incomplete anthro → null', () => {
  assert.equal(mifflinStJeorBMR({ sex: 'male', weight_kg: 80, height_cm: 180, age: 30 }), 1780);
  assert.equal(mifflinStJeorBMR({ sex: 'female', weight_kg: 65, height_cm: 165, age: 28 }), 1380); // round(1380.25)
  assert.equal(mifflinStJeorBMR({ sex: 'male', weight_kg: 80 }), null);
});

check('apple total energy − BMR → active_kcal (the BMR/active distinction)', () => {
  const r = normalizeReading('apple', {
    date: '2026-06-01',
    total_energy_kcal: 2400,
    profile: { sex: 'male', weight_kg: 80, height_cm: 180, age: 30 }, // BMR 1780
  });
  assert.equal(r.bmr, 1780);
  assert.equal(r.active_kcal, 620);       // max(0, 2400 − 1780) — only ACTIVE drives the tracker
  assert.equal(r.total_kcal, 2400);
  assert.equal(r.strain, 62);             // round(min(1,620/1000)*100)
});

check('whoop kilojoules → active_kcal (kJ→kcal)', () => {
  const r = normalizeReading('whoop', {
    date: '2026-06-01',
    cycle: { day_strain: 10, kilojoule: 8368 }, // ≈ 2000 kcal
    recovery: { recovery_score: 70, hrv_rmssd_milli: 90 },
  });
  assert.equal(r.active_kcal, Math.round(8368 * 0.239006));
  assert.equal(r.hrv_ms, 90);
});

check('oura active_calories → active_kcal', () => {
  const r = normalizeReading('oura', {
    day: '2026-06-01', readiness: { score: 75 }, activity: { score: 60, active_calories: 540 },
  });
  assert.equal(r.strain, 60);
  assert.equal(r.active_kcal, 540);
});

check('manual active_kcal passthrough', () => {
  const r = normalizeReading('manual', { reading_date: '2026-06-01', strain: 40, active_kcal: 350, hrv_ms: 55 });
  assert.equal(r.strain, 40);
  assert.equal(r.active_kcal, 350);
  assert.equal(r.hrv_ms, 55);
});

check('unsupported source throws', () => {
  assert.throws(() => normalizeReading('garmin', { date: '2026-06-01' }), /unsupported_source/);
});

check('missing reading_date throws', () => {
  assert.throws(() => normalizeReading('manual', { strain: 50 }), /missing_reading_date/);
});

console.log('wearable-core — ACWR');

// Helper: build a flat series of `strain` for `days` ending at asOf.
function flatSeries(asOf, days, strain) {
  const out = [];
  for (let i = 0; i < days; i++) out.push({ reading_date: addDays(asOf, -i), strain });
  return out;
}

check('flat 50 ULU for 28 days → ACWR 1.0, optimal', () => {
  const a = computeAcwr(flatSeries('2026-06-28', 28, 50), { asOf: '2026-06-28' });
  assert.equal(a.acute, 50);
  assert.equal(a.chronic, 50);
  assert.equal(a.acwr, 1);
  assert.equal(a.flag, 'optimal');
  assert.equal(a.chronic_days_with_data, 28);
});

check('acute spike → ACWR 1.6, high_risk (the branch-DB parity case)', () => {
  // Days 1..21 @30 ULU, days 22..28 (the acute window) @60 ULU. as_of = day 28.
  const series = [];
  for (let i = 0; i < 28; i++) {
    const dayIndex = 28 - i;                  // i=0 → day28 (today) … i=27 → day1
    series.push({ reading_date: addDays('2026-06-28', -i), strain: dayIndex >= 22 ? 60 : 30 });
  }
  const a = computeAcwr(series, { asOf: '2026-06-28' });
  assert.equal(a.acute, 60);                  // 7 days @60 / 7
  assert.equal(a.chronic, 37.5);              // (21*30 + 7*60) / 28
  assert.equal(a.acwr, 1.6);
  assert.equal(a.flag, 'high_risk');
});

check('thin history → insufficient_data', () => {
  const a = computeAcwr(flatSeries('2026-06-28', 5, 50), { asOf: '2026-06-28' });
  assert.equal(a.flag, 'insufficient_data');  // < 14 chronic days with data
});

check('multiple sources same day collapse to MAX strain', () => {
  const series = [
    ...flatSeries('2026-06-28', 28, 20),
    { reading_date: '2026-06-28', strain: 90 }, // a second source today
  ];
  const a = computeAcwr(series, { asOf: '2026-06-28' });
  // today's 90 replaces the 20 in both windows' sums.
  assert.equal(a.acute, round2((6 * 20 + 90) / 7));
  assert.equal(a.chronic, round2((27 * 20 + 90) / 28));
});
function round2(n) { return Math.round(n * 100) / 100; }

console.log(`\n✅ wearable-core: ${passed} checks passed`);
