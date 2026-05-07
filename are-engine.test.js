const assert = require('assert');
const ARE_ENGINE = require('./are-engine.js');
const { auditConcurrent } = ARE_ENGINE;

function runTests() {
  console.log('Running tests for auditConcurrent...');

  // Test 1: Non-strength goal + Zone 4 -> No interference
  console.log('Test 1: Non-strength goal + Zone 4');
  let result = auditConcurrent('cardio', { type: 'hiit' });
  assert.strictEqual(result.interference, false);
  assert.strictEqual(result.tier, 'green');

  // Test 2: Strength goal + Non-Zone 4 -> No interference
  console.log('Test 2: Strength goal + Non-Zone 4');
  result = auditConcurrent('maximize 1rm', { type: 'steady state', intensity: 5, hr: 140 });
  assert.strictEqual(result.interference, false);
  assert.strictEqual(result.tier, 'green');

  // Test 3: Strength goal + Zone 4 (via type='hiit') -> Interference
  console.log('Test 3: Strength goal + Zone 4 (via type)');
  result = auditConcurrent('powerlift', { type: 'hiit' });
  assert.strictEqual(result.interference, true);
  assert.strictEqual(result.tier, 'red');

  // Test 4: Strength goal + Zone 4 (via intensity>=8) -> Interference
  console.log('Test 4: Strength goal + Zone 4 (via intensity)');
  result = auditConcurrent('strength', { intensity: 8 });
  assert.strictEqual(result.interference, true);
  assert.strictEqual(result.tier, 'red');

  // Test 5: Strength goal + Zone 4 (via zone='z4') -> Interference
  console.log('Test 5: Strength goal + Zone 4 (via zone)');
  result = auditConcurrent('max strength', { zone: 'z4' });
  assert.strictEqual(result.interference, true);
  assert.strictEqual(result.tier, 'red');

  // Test 6: Strength goal + Zone 4 (via zone='4') -> Interference
  console.log('Test 6: Strength goal + Zone 4 (via zone=4)');
  result = auditConcurrent('max strength', { zone: '4' });
  assert.strictEqual(result.interference, true);
  assert.strictEqual(result.tier, 'red');

  // Test 7: Strength goal + Zone 4 (via hr>=162) -> Interference
  console.log('Test 7: Strength goal + Zone 4 (via hr)');
  result = auditConcurrent('1rm', { hr: 162 });
  assert.strictEqual(result.interference, true);
  assert.strictEqual(result.tier, 'red');

  // Test 8: Edge cases (null/undefined userGoal or sessionLog)
  console.log('Test 8: Edge cases');
  result = auditConcurrent(null, null);
  assert.strictEqual(result.interference, false);
  assert.strictEqual(result.tier, 'green');

  result = auditConcurrent(undefined, undefined);
  assert.strictEqual(result.interference, false);
  assert.strictEqual(result.tier, 'green');

  result = auditConcurrent('', {});
  assert.strictEqual(result.interference, false);
  assert.strictEqual(result.tier, 'green');

  console.log('All tests passed!');
}

try {
  runTests();
} catch (error) {
  console.error('Test failed!');
  console.error(error);
  process.exit(1);
}

const { auditVolume } = ARE_ENGINE;

function runVolumeTests() {
  console.log('Running tests for auditVolume...');

  // Test 1: Null or Undefined
  console.log('Test 1: Null or Undefined');
  let result = auditVolume(null);
  assert.deepStrictEqual(result.groups, []);
  assert.deepStrictEqual(result.violations, []);

  result = auditVolume(undefined);
  assert.deepStrictEqual(result.groups, []);
  assert.deepStrictEqual(result.violations, []);

  // Test 2: Untrained (0 sets)
  console.log('Test 2: Untrained (0 sets)');
  result = auditVolume({ chest: 0 });
  assert.strictEqual(result.groups.length, 1);
  assert.strictEqual(result.groups[0].tier, 'none');
  assert.strictEqual(result.groups[0].yieldPct, 0);

  // Test 3: Sub-MV (1-4 sets)
  console.log('Test 3: Sub-MV (1-4 sets)');
  result = auditVolume({ back: 4 });
  assert.strictEqual(result.groups.length, 1);
  assert.strictEqual(result.groups[0].tier, 'mv');
  assert.strictEqual(result.groups[0].yieldPct, 5.4); // YIELD_LOW

  // Test 4: MEV Zone (5-9 sets)
  console.log('Test 4: MEV Zone (5-9 sets)');
  result = auditVolume({ legs: 6 });
  assert.strictEqual(result.groups[0].tier, 'mev');
  assert.strictEqual(result.groups[0].yieldPct, 6.6); // YIELD_MID

  // Test 5: MAV Achieved (10-19 sets)
  console.log('Test 5: MAV Achieved (10-19 sets)');
  result = auditVolume({ shoulders: 15 });
  assert.strictEqual(result.groups[0].tier, 'mav');
  assert.strictEqual(result.groups[0].yieldPct, 9.8); // YIELD_HIGH

  // Test 6: MRV Exceeded (20+ sets)
  console.log('Test 6: MRV Exceeded (20+ sets)');
  result = auditVolume({ arms: 22 });
  assert.strictEqual(result.groups[0].tier, 'mrv');
  assert.strictEqual(result.groups[0].yieldPct, 9.8); // YIELD_HIGH
  assert.strictEqual(result.violations.length, 1);
  assert.strictEqual(result.violations[0].muscle, 'arms');
  assert.strictEqual(result.violations[0].sets, 22);

  // Test 7: Multiple groups
  console.log('Test 7: Multiple groups');
  result = auditVolume({ chest: 2, back: 6, legs: 12, arms: 25 });
  assert.strictEqual(result.groups.length, 4);
  assert.strictEqual(result.violations.length, 1);
  assert.strictEqual(result.violations[0].muscle, 'arms');

  console.log('auditVolume tests passed!');
}

try {
  runVolumeTests();
} catch (error) {
  console.error('auditVolume tests failed!');
  console.error(error);
  process.exit(1);
}
