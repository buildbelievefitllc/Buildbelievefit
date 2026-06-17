// supabase/functions/_shared/prehab-matrix.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Offline, deterministic verification of the prehab lookup matrix. Pure ESM —
// run with:  node supabase/functions/_shared/prehab-matrix.test.mjs
// Exits non-zero on the first failed assertion.

import assert from 'node:assert/strict';
import { detectZone, selectPrehabMatrix } from './prehab-matrix.mjs';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`  ✓ ${name}`); }

function assertShape(matrix) {
  assert.equal(matrix.length, 3);
  for (const m of matrix) {
    for (const k of ['name', 'duration', 'focus', 'reason']) {
      assert.equal(typeof m[k], 'string');
      assert.ok(m[k].length > 0, `${k} non-empty`);
    }
  }
}

console.log('prehab-matrix — zone detection');

check('low back → lumbar', () => assert.equal(detectZone('lower back tight after deadlifts'), 'lumbar'));
check('knee → knee', () => assert.equal(detectZone('knee pain going down stairs'), 'knee'));
check('"upper back" beats generic "back" (thoracic precedence)', () => assert.equal(detectZone('upper back stiff'), 'thoracic'));
check('shoulder (es) → shoulder', () => assert.equal(detectZone('dolor en el hombro'), 'shoulder'));
check('ankle (es) → ankle', () => assert.equal(detectZone('tobillo rígido'), 'ankle'));
check('no zone words → null', () => assert.equal(detectZone('feeling pretty good today'), null));
check('empty → null', () => assert.equal(detectZone(''), null));

console.log('prehab-matrix — matrix selection');

check('lumbar friction → Hinge Integrity drills + friction-aware reason', () => {
  const { matrix, zone } = selectPrehabMatrix('lower back tight', 'en');
  assert.equal(zone, 'lumbar');
  assertShape(matrix);
  assert.equal(matrix[0].name, 'Quadruped Rockback Hip Mobilization');
  assert.match(matrix[0].reason, /Addresses your reported friction \(lower back tight\)/);
});

check('knee friction → patellar tracking protocol', () => {
  const { matrix, zone } = selectPrehabMatrix('knee pain on stairs', 'en');
  assert.equal(zone, 'knee');
  assert.match(matrix[0].name, /Foam Roll/);
});

check('Spanish shoulder → localized name + Spanish reason', () => {
  const { matrix, zone } = selectPrehabMatrix('dolor en el hombro', 'es');
  assert.equal(zone, 'shoulder');
  assert.equal(matrix[0].name, 'Liberación del pectoral menor en marco');
  assert.match(matrix[0].reason, /^Atiende la fricción que reportaste/);
});

check('Portuguese knee → Portuguese reason', () => {
  const { matrix, zone } = selectPrehabMatrix('dor no joelho', 'pt');
  assert.equal(zone, 'knee');
  assert.match(matrix[0].reason, /^Atende a fricção que você relatou/);
});

check('no friction + workload → general baseline, post-session reason', () => {
  const { matrix, zone } = selectPrehabMatrix('', 'en', { workloadCount: 5 });
  assert.equal(zone, 'general');
  assert.equal(matrix[0].name, 'Cat-Cow Spinal Flow');
  assert.match(matrix[0].reason, /Post-session reset after today's 5 logged sets/);
});

check('no friction, no workload → general baseline, standalone reason', () => {
  const { matrix, zone } = selectPrehabMatrix('', 'en');
  assert.equal(zone, 'general');
  assertShape(matrix);
  assert.match(matrix[0].reason, /^A universal segmental reset/);
});

check('unrecognized friction → general protocol but still acknowledges it', () => {
  const { matrix, zone } = selectPrehabMatrix('feeling pretty good today', 'en');
  assert.equal(zone, 'general');
  assert.match(matrix[0].reason, /Addresses your reported friction \(feeling pretty good today\)/);
});

console.log(`\nprehab-matrix: ${passed} checks passed.`);
