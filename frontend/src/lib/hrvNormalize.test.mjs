// src/lib/hrvNormalize.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Regression lock for the RMSSD → readiness-payload normalization. Pure module,
// no bundler needed; not matched by ESLint's {js,jsx} glob (inert at build time).
//   node --experimental-strip-types --test src/lib/hrvNormalize.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHrvMs, HRV_MAX_PLAUSIBLE_MS } from './hrvNormalize.js';

test('null-integrity: empty/absent/non-finite/≤0 never fabricate a 0', () => {
  for (const x of [null, undefined, '', NaN, Infinity, -Infinity, 0, -5, '  ']) {
    assert.equal(normalizeHrvMs(x), null, `input ${String(x)} must normalize to null`);
  }
});

test('genuine LOW HRV survives (a real suppression must reach the engine breach floor)', () => {
  // 18ms overtrained reading must NOT be clamped up to 20/35 — the engine needs it.
  assert.equal(normalizeHrvMs(18), 18);
  assert.equal(normalizeHrvMs(34.9), 34.9);
});

test('normal readings pass through, rounded to 1 decimal', () => {
  assert.equal(normalizeHrvMs(60), 60);
  assert.equal(normalizeHrvMs('72.4'), 72.4);
  assert.equal(normalizeHrvMs(88.049), 88);
  assert.equal(normalizeHrvMs(88.06), 88.1);
});

test('implausible-high readings are dropped (unit error), never clamped', () => {
  assert.equal(normalizeHrvMs(HRV_MAX_PLAUSIBLE_MS + 1), null);
  assert.equal(normalizeHrvMs(50000), null, 'a µs-encoded value drops to null, not 400');
  // Exactly at the ceiling is still accepted.
  assert.equal(normalizeHrvMs(HRV_MAX_PLAUSIBLE_MS), HRV_MAX_PLAUSIBLE_MS);
});
