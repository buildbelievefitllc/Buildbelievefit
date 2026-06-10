// supabase/functions/_shared/health-connect-core.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Offline, deterministic verification of the Health Connect ingestion core.
// Pure ESM, no network, no Deno — run with:
//   node supabase/functions/_shared/health-connect-core.test.mjs
// Exits non-zero on the first failed assertion (CI/green-gate friendly).

import assert from 'node:assert/strict';
import {
  normalizeHealthConnect, cnsFlags,
  HRV_FLOOR_MS, SLEEP_FLOOR_MINUTES,
} from './health-connect-core.mjs';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('health-connect-core — normalization');

check('flat payload (Android bridge pre-aggregated)', () => {
  const r = normalizeHealthConnect({
    date: '2026-06-10',
    hrv_ms: 62.4,
    resting_heart_rate: 54,
    total_sleep_minutes: 451,
  });
  assert.equal(r.reading_date, '2026-06-10');
  assert.equal(r.hrv_ms, 62.4);
  assert.equal(r.resting_hr, 54);
  assert.equal(r.sleep_minutes, 451);
});

check('raw record dump → aggregated metrics', () => {
  const r = normalizeHealthConnect({
    date: '2026-06-10',
    records: {
      HeartRateVariabilityRmssd: [
        { heartRateVariabilityMillis: 30, time: '2026-06-10T06:01:00Z' },
        { heartRateVariabilityMillis: 34, time: '2026-06-10T06:31:00Z' },
      ],
      RestingHeartRate: [{ beatsPerMinute: 71 }, { beatsPerMinute: 73 }],
      SleepSession: [
        { startTime: '2026-06-10T01:30:00Z', endTime: '2026-06-10T04:00:00Z' }, // 150 min
        { durationMinutes: 65 },
      ],
    },
  });
  assert.equal(r.hrv_ms, 32);           // mean(30, 34)
  assert.equal(r.resting_hr, 72);       // round(mean(71, 73))
  assert.equal(r.sleep_minutes, 215);   // 150 + 65
});

check('missing date throws', () => {
  assert.throws(() => normalizeHealthConnect({ hrv_ms: 50 }), /missing_reading_date/);
});

check('all-null metrics throw', () => {
  assert.throws(() => normalizeHealthConnect({ date: '2026-06-10' }), /empty_metrics/);
});

check('out-of-range resting_hr throws', () => {
  assert.throws(
    () => normalizeHealthConnect({ date: '2026-06-10', resting_heart_rate: 300 }),
    /invalid_resting_hr/,
  );
});

console.log('health-connect-core — CNS flags');

check('compromised CNS: HRV + sleep floors breached', () => {
  const f = cnsFlags({ hrv_ms: 28, resting_hr: 72, sleep_minutes: 215 });
  assert.equal(f.hrv_compromised, true);
  assert.equal(f.sleep_compromised, true);
  assert.equal(f.compromised, true);
  assert.equal(f.triggers.length, 2);
});

check('healthy CNS: no triggers', () => {
  const f = cnsFlags({ hrv_ms: 68, resting_hr: 52, sleep_minutes: 460 });
  assert.equal(f.compromised, false);
  assert.deepEqual(f.triggers, []);
});

check('boundary values do NOT trip (floor is strict <)', () => {
  const f = cnsFlags({ hrv_ms: HRV_FLOOR_MS, sleep_minutes: SLEEP_FLOOR_MINUTES });
  assert.equal(f.compromised, false);
});

check('null metrics never trip', () => {
  const f = cnsFlags({ hrv_ms: null, resting_hr: null, sleep_minutes: null });
  assert.equal(f.compromised, false);
});

console.log(`\nhealth-connect-core: ${passed} checks passed`);
