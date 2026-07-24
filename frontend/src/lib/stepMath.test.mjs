// src/lib/stepMath.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Regression lock for the live-steps daily-progress math. Pure module, no bundler;
// not matched by ESLint's {js,jsx} glob (inert at build time).
//   node --experimental-strip-types --test src/lib/stepMath.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STEP_GOAL,
  clampGoal,
  composeDailySteps,
  computeStepProgress,
} from './stepMath.js';

test('clampGoal: positive integers pass; junk falls back to the default', () => {
  assert.equal(clampGoal(8000), 8000);
  assert.equal(clampGoal('12000'), 12000);
  assert.equal(clampGoal(7500.6), 7501);
  for (const bad of [null, undefined, '', 0, -1, NaN, Infinity, 'x']) {
    assert.equal(clampGoal(bad), DEFAULT_STEP_GOAL, `${String(bad)} → default`);
  }
});

test('composeDailySteps: baseline + live session delta, floored at 0', () => {
  assert.equal(composeDailySteps(4000, 250), 4250);
  assert.equal(composeDailySteps(0, 0), 0);
  assert.equal(composeDailySteps(-100, 300), 300, 'negative baseline floors to 0');
  assert.equal(composeDailySteps(4000, null), 4000, 'null session → baseline only');
  assert.equal(composeDailySteps(null, null), 0);
});

test('computeStepProgress: pct clamps 0–100, remaining + reached are honest', () => {
  const p = computeStepProgress(2500, 10000);
  assert.deepEqual(p, { steps: 2500, goal: 10000, pct: 25, remaining: 7500, reached: false });

  const done = computeStepProgress(10000, 10000);
  assert.equal(done.pct, 100);
  assert.equal(done.remaining, 0);
  assert.equal(done.reached, true);

  const over = computeStepProgress(13000, 10000);
  assert.equal(over.pct, 100, 'pct never exceeds 100 (bar stays bounded)');
  assert.equal(over.remaining, 0);
  assert.equal(over.reached, true);
});

test('computeStepProgress: null-safe inputs and default goal', () => {
  const p = computeStepProgress(null);
  assert.equal(p.goal, DEFAULT_STEP_GOAL);
  assert.equal(p.steps, 0);
  assert.equal(p.pct, 0);
  assert.equal(p.reached, false);
});
