// src/lib/bbf-readiness-engine.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Readiness Engine — regression lock for the v2 weighted-average
// rebuild (the zero-out fix + the Manual Health Input recovery axis).
//
// Pure module, no bundler needed. Run with Node's native TS stripping:
//   node --experimental-strip-types --test src/lib/bbf-readiness-engine.test.mjs
// Not imported by the app and not matched by ESLint's {js,jsx} glob, so it is
// inert at build time — it exists to prove the math, and to fail loudly if the
// "null ≠ zero" contract ever regresses.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReadinessProtocol,
  runSovereignEngine,
  subjectiveRecoveryScore,
} from './bbf-readiness-engine.ts';

const base = { date: '2026-06-14', prior_day_kcal: null, baseline_hrv_ms: 60, baseline_samples: 5 };

test('THE ZERO-OUT BUG: HRV=0 and sleep=0 never fabricate a 0 score or a breach', () => {
  const p = computeReadinessProtocol({ ...base, hrv_ms: 0, sleep_minutes: 0 });
  assert.equal(p.readiness_score, null, 'score must be null, not 0');
  assert.equal(p.mode, 'INSUFFICIENT_TELEMETRY', 'must not be SYSTEM_BREACH');
});

test('a phantom 0 HRV drops its weight; real sleep still carries the score', () => {
  const p = computeReadinessProtocol({ ...base, hrv_ms: 0, sleep_minutes: 450 });
  assert.ok(p.readiness_score > 80, `expected sleep-driven score, got ${p.readiness_score}`);
  assert.notEqual(p.mode, 'SYSTEM_BREACH');
});

test('backward compatibility: a full-data day scores exactly 0.6*hrv + 0.4*sleep', () => {
  // hrv=60 (r=1.0 → 80), sleep=480 (→100): 0.6*80 + 0.4*100 = 88
  const p = computeReadinessProtocol({ ...base, hrv_ms: 60, sleep_minutes: 480 });
  assert.equal(p.readiness_score, 88);
  assert.equal(p.mode, 'PRIME_EXECUTION');
});

test('an HRV-only day is weighted on HRV alone (sleep weight dropped)', () => {
  const p = computeReadinessProtocol({ ...base, hrv_ms: 60, sleep_minutes: null });
  assert.equal(p.readiness_score, 80);
});

test('Manual Health Input: subjective recovery carries the axis with equal validity', () => {
  const p = computeReadinessProtocol({
    ...base, baseline_hrv_ms: null, baseline_samples: 0,
    hrv_ms: null, sleep_minutes: 450, sleep_quality: 9, stress_level: 2, input_source: 'manual',
  });
  assert.ok(p.readiness_score > 0, 'manual baseline must produce a real, actionable score');
  assert.equal(p.inputs.source, 'manual');
  assert.equal(p.inputs.sleep_quality, 9);
  assert.ok(p.directives.some((d) => /subjective recovery/i.test(d)));
});

test('subjectiveRecoveryScore inverts stress and maps quality 1–10 → 0–100', () => {
  assert.ok(subjectiveRecoveryScore(null, 1) > subjectiveRecoveryScore(null, 10));
  assert.equal(subjectiveRecoveryScore(10, null), 100);
  assert.equal(subjectiveRecoveryScore(1, null), 0);
  assert.equal(subjectiveRecoveryScore(null, null), null);
});

test('the clinical floor override is intact: a REAL low HRV still breaches', () => {
  const p = computeReadinessProtocol({ ...base, hrv_ms: 30, sleep_minutes: 450 });
  assert.equal(p.mode, 'SYSTEM_BREACH');
});

test('runSovereignEngine threads the manual subjective object (3rd arg)', () => {
  const day = { date: '2026-06-14', hrv_ms: null, sleep_minutes: 480, active_calories_burned: null, daily_steps: null };
  const p = runSovereignEngine(day, [day], { sleep_quality: 8, stress_level: 3, input_source: 'manual' });
  assert.equal(p.engine, 'sovereign-readiness-engine/v2');
  assert.ok(p.readiness_score > 0);
});
