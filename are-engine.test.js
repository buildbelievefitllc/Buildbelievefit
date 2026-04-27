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
