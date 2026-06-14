// src/lib/autoRegulation.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Regression lock for the "missing data never punishes" contract — the bug where
// a manual 100% entry (or a steps-only wearable day) dropped Program sets 4→2 and
// locked Prehab/Cardio. Two null→0 coercions were at fault:
//   1) useDailyReadiness.deriveDailyReadiness num(null) → 0 → isSuppressed (0<35)
//      → phantom breach for any HRV-null (manual) ledger row.
//   2) autoRegulation.deriveVolumeDirective Number(null) → 0 → 0<40 breach for a
//      null (INSUFFICIENT_TELEMETRY) score.
// This file locks #2 against the real function. (#1 lives in a React/Supabase
// import graph that can't load under bare node; it's the same null-guard, covered
// by build + the manual smoke verification.)
//
// Run: node --test src/lib/autoRegulation.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveVolumeDirective, scaleSetCount } from './autoRegulation.js';

test('a NULL score (INSUFFICIENT / steps-only) → none, full volume — never punishes', () => {
  const d = deriveVolumeDirective({ score: null, mode: 'INSUFFICIENT_TELEMETRY', isSuppressed: false, hasData: true });
  assert.equal(d.state, 'none');
  assert.equal(d.setFactor, 1);
  assert.equal(scaleSetCount(4, d.setFactor), 4);
});

test('manual 100% (PRIME, not suppressed) → full volume, no lock', () => {
  const d = deriveVolumeDirective({ score: 100, mode: 'PRIME_EXECUTION', isSuppressed: false, hasData: true });
  assert.equal(d.state, 'full');
  assert.equal(scaleSetCount(4, d.setFactor), 4);
  assert.equal(d.axialSwap, false);
  assert.equal(d.lockHiit, false);
});

test('isSuppressed is the breach lever — a phantom true would slice 4→2 (must be derived correctly upstream)', () => {
  const d = deriveVolumeDirective({ score: 100, mode: 'PRIME_EXECUTION', isSuppressed: true, hasData: true });
  assert.equal(d.state, 'breach');
  assert.equal(scaleSetCount(4, d.setFactor), 2);
});

test('genuine low readiness still regulates: <40 breach, 40–84 adaptive', () => {
  assert.equal(deriveVolumeDirective({ score: 38, mode: 'SYSTEM_BREACH', hasData: true }).state, 'breach');
  assert.equal(deriveVolumeDirective({ score: 70, mode: 'STANDARD_OPERATIONS', hasData: true }).state, 'adaptive');
  assert.equal(deriveVolumeDirective({ score: 90, mode: 'PRIME_EXECUTION', hasData: true }).state, 'full');
});

test('no telemetry at all (hasData false) → none', () => {
  assert.equal(deriveVolumeDirective({ hasData: false }).state, 'none');
});
