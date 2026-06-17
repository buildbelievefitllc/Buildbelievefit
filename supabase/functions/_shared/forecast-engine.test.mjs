// supabase/functions/_shared/forecast-engine.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Offline, deterministic verification of the 1RM forecast engine. Pure ESM, no
// network, no Deno — run with:  node supabase/functions/_shared/forecast-engine.test.mjs
// Exits non-zero on the first failed assertion (green-gate friendly).

import assert from 'node:assert/strict';
import {
  epley1RM, brzycki1RM, estimate1RM, roundToPlate,
  linearRegression, forecastLift,
} from './forecast-engine.mjs';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`  ✓ ${name}`); }

console.log('forecast-engine — named-model estimators');

check('Epley: 5 reps @ 225 → 262.5', () => {
  assert.equal(epley1RM(225, 5), 262.5);            // 225 · (1 + 5/30)
});
check('Brzycki: 5 reps @ 225 → 253.125', () => {
  assert.equal(brzycki1RM(225, 5), 253.125);        // 225 · 36/(37−5)
});
check('Blended estimate: 5 reps @ 225 → 257.8125', () => {
  assert.equal(estimate1RM(225, 5), 257.8125);      // (262.5 + 253.125)/2
});
check('A true single is its own 1RM (no Epley inflation)', () => {
  assert.equal(epley1RM(315, 1), 315);
  assert.equal(brzycki1RM(315, 1), 315);
  assert.equal(estimate1RM(315, 1), 315);
});
check('Brzycki guards reps≥37 by falling back to Epley', () => {
  assert.equal(brzycki1RM(100, 40), epley1RM(100, 40));
});
check('roundToPlate snaps to 2.5 lb', () => {
  assert.equal(roundToPlate(257.8125), 257.5);
  assert.equal(roundToPlate(294.77), 295);
});

console.log('forecast-engine — OLS regression');

check('perfect line → slope 2, intercept 0, r²=1', () => {
  const { slope, intercept, r2 } = linearRegression([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]);
  assert.equal(slope, 2);
  assert.equal(intercept, 0);
  assert.equal(r2, 1);
});
check('flat-but-consistent line → slope 0, r²=1', () => {
  const { slope, r2 } = linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]);
  assert.equal(slope, 0);
  assert.equal(r2, 1);
});

console.log('forecast-engine — full forecastLift');

// 5 weekly sessions, +5 lb/week on a 5RM → clean uptrend on "ex_0".
const uptrend = [
  { exercise_key: 'ex_0', day_key: '2026-05-13_d1', weight_lbs: 225, reps: 5, rpe: 8 },
  { exercise_key: 'ex_0', day_key: '2026-05-20_d1', weight_lbs: 230, reps: 5, rpe: 8 },
  { exercise_key: 'ex_0', day_key: '2026-05-27_d1', weight_lbs: 235, reps: 5, rpe: 8 },
  { exercise_key: 'ex_0', day_key: '2026-06-03_d1', weight_lbs: 240, reps: 5, rpe: 8 },
  { exercise_key: 'ex_0', day_key: '2026-06-10_d1', weight_lbs: 245, reps: 5, rpe: 8 },
];

check('uptrend → +5% monthly cap, High confidence, uptrend cue', () => {
  const r = forecastLift(uptrend, 'Back Squat', 'en');
  // current e1RM (245×5) ≈ 280.73; +5% cap ≈ 294.77 → snaps to 295 lb.
  assert.equal(r.projected_1rm, '295 lbs');
  assert.equal(r.confidence_score, 'High');
  assert.match(r.agent_insight, /third top set/);
});

check('locale routes the cue (es / pt) deterministically', () => {
  assert.match(forecastLift(uptrend, 'x', 'es').agent_insight, /^Agrega/);
  assert.match(forecastLift(uptrend, 'x', 'pt').agent_insight, /^Adicione/);
});

check('stalled top set → Moderate confidence, stall cue', () => {
  const flat = [
    { exercise_key: 'ex_1', day_key: '2026-05-27_d1', weight_lbs: 200, reps: 5 },
    { exercise_key: 'ex_1', day_key: '2026-06-03_d1', weight_lbs: 200, reps: 5 },
    { exercise_key: 'ex_1', day_key: '2026-06-10_d1', weight_lbs: 200, reps: 5 },
  ];
  const r = forecastLift(flat, 'Bench Press', 'en');
  assert.equal(r.confidence_score, 'Moderate');
  assert.match(r.agent_insight, /plateaued/);
});

check('no data → N/A, Low, log-more cue', () => {
  const r = forecastLift([], 'Deadlift', 'en');
  assert.equal(r.projected_1rm, 'N/A');
  assert.equal(r.confidence_score, 'Low');
});

console.log(`\nforecast-engine: ${passed} checks passed.`);
