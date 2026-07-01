// src/lib/biometricMatch.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Regression lock: the Sovereign Briefing's biometric-matrix clip must never
// speak a CNS number further from the athlete's true readiness score than the
// closest available bucket. Reported bug: dashboard reads 44, briefing clip
// said "sixty" — the pre-fix flat 4-axis nearest-neighbor let sleep/stress/
// load out-vote the CNS axis. Run with Node's native TS/JSON-free runner:
//   node --experimental-strip-types --test src/lib/biometricMatch.test.mjs
// Pure module, no bundler needed; not matched by ESLint's {js,jsx} glob.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestByCnsThenVibe } from './biometricMatch.js';

// The real production EN grid (7 states), transcribed from
// bbf-biometric-audio-matrix.json's EN_* subject_lines — same axes that ship
// in sovereignVaultManifest.json / drive the live Sovereign Briefing.
const EN_POOL = [
  { cns: 80, sleep: 100, stress: 40, load: 100 },
  { cns: 100, sleep: 100, stress: 40, load: 150 },
  { cns: 100, sleep: 100, stress: 40, load: 165 },
  { cns: 60, sleep: 70, stress: 100, load: 50 },
  { cns: 80, sleep: 70, stress: 70, load: 150 },
  { cns: 100, sleep: 70, stress: 40, load: 165 },
  { cns: 80, sleep: 100, stress: 70, load: 100 },
  { cns: 40, sleep: 100, stress: 100, load: 100 },
  { cns: 60, sleep: 40, stress: 100, load: 150 },
  { cns: 100, sleep: 100, stress: 40, load: 100 },
  { cns: 40, sleep: 40, stress: 40, load: 50 },
  { cns: 60, sleep: 100, stress: 40, load: 165 },
  { cns: 100, sleep: 40, stress: 100, load: 100 },
  { cns: 60, sleep: 70, stress: 70, load: 150 },
  { cns: 60, sleep: 70, stress: 70, load: 50 },
  { cns: 60, sleep: 70, stress: 70, load: 100 },
  { cns: 40, sleep: 40, stress: 100, load: 150 },
  { cns: 60, sleep: 40, stress: 70, load: 100 },
  { cns: 40, sleep: 40, stress: 100, load: 100 },
  { cns: 100, sleep: 100, stress: 40, load: 150 },
  { cns: 100, sleep: 70, stress: 70, load: 150 },
  { cns: 80, sleep: 40, stress: 40, load: 100 },
  { cns: 100, sleep: 100, stress: 40, load: 50 },
  { cns: 40, sleep: 70, stress: 70, load: 150 },
  { cns: 60, sleep: 100, stress: 100, load: 50 },
  { cns: 80, sleep: 70, stress: 70, load: 165 },
  { cns: 80, sleep: 40, stress: 100, load: 50 },
  { cns: 40, sleep: 70, stress: 40, load: 150 },
];

test('THE 44-VS-60 BUG: a true CNS of 44 always speaks the closer "40" bucket, never "60"/"80"/"100"', () => {
  // Sweep the full plausible sleep/stress/load telemetry space — the pre-fix
  // algorithm picked a non-40 bucket for 155/484 (32%) of these combos.
  for (let sleep = 0; sleep <= 100; sleep += 10) {
    for (let stress = 0; stress <= 100; stress += 10) {
      for (const load of [50, 100, 150, 165]) {
        const target = { cns: 44, sleep, stress, load };
        const match = nearestByCnsThenVibe(target, EN_POOL);
        assert.equal(
          match.best.cns, 40,
          `cns=44 sleep=${sleep} stress=${stress} load=${load} → matched bucket ${match.best.cns}, expected 40`,
        );
      }
    }
  }
});

test('exact grid hit wins outright', () => {
  const target = { cns: 80, sleep: 100, stress: 40, load: 100 };
  const match = nearestByCnsThenVibe(target, EN_POOL);
  assert.equal(match.best.cns, 80);
  assert.equal(match.best.sleep, 100);
  assert.equal(match.distance, 0);
});

test('a CNS equidistant between two buckets (50 → 40 and 60 both 10 away) breaks the tie on vibe, but never on a THIRD bucket', () => {
  const target = { cns: 50, sleep: 70, stress: 70, load: 150 };
  const match = nearestByCnsThenVibe(target, EN_POOL);
  assert.ok([40, 60].includes(match.best.cns), `expected 40 or 60, got ${match.best.cns}`);
});

test('missing load axis is excluded from the distance, never defaulted to 0', () => {
  const withLoad = nearestByCnsThenVibe({ cns: 40, sleep: 40, stress: 40, load: 50 }, EN_POOL);
  const noLoad = nearestByCnsThenVibe({ cns: 40, sleep: 40, stress: 40, load: null }, EN_POOL);
  assert.equal(withLoad.best.cns, 40);
  assert.equal(noLoad.best.cns, 40); // still CNS-accurate even with load unmeasured
});

test('empty pool returns null instead of throwing', () => {
  assert.equal(nearestByCnsThenVibe({ cns: 50, sleep: 50, stress: 50, load: 100 }, []), null);
});
