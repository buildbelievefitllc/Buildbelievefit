const assert = require('assert');

// Mock localStorage
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = String(value);
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

const CNS_ENGINE = require('./cns-engine.js');

function runTests() {
  console.log('Running tests for CNS_ENGINE.calculateSRS...');

  // Reset localStorage before each test
  localStorage.clear();

  // Test 1: Default values
  console.log('Test 1: Default values');
  let result = CNS_ENGINE.calculateSRS();
  assert.strictEqual(result.score, 96, 'Default score should be 96');
  assert.strictEqual(result.components.hrv, 100, 'Default HRV score should be 100');
  assert.strictEqual(result.components.total, 100, 'Default Total Sleep score should be 100');
  assert.strictEqual(result.components.deep, 75, 'Default Deep Sleep score should be 75');
  assert.strictEqual(result.components.acwr, 100, 'Default ACWR score should be 100');
  assert.strictEqual(result.penalty, 0, 'Default penalty should be 0');

  // Test 2: Perfect values
  console.log('Test 2: Perfect values');
  result = CNS_ENGINE.calculateSRS({ hrvDeviation: 0, totalSleep: 8, deepSleep: 2, acwr: 1.0 });
  assert.strictEqual(result.score, 100, 'Perfect values score should be 100');
  assert.strictEqual(result.components.deep, 100, 'Deep Sleep score should be 100');

  // Test 3: Poor values testing exact component math
  console.log('Test 3: Poor values exact math');
  result = CNS_ENGINE.calculateSRS({ hrvDeviation: -15, totalSleep: 6, deepSleep: 0.5, acwr: 1.4 });
  assert.strictEqual(result.components.hrv, 40, 'HRV score should be 40');
  assert.strictEqual(result.components.total, 75, 'Total Sleep score should be 75');
  assert.strictEqual(result.components.deep, 25, 'Deep Sleep score should be 25');
  assert.strictEqual(Math.round(result.components.acwr), 70, 'ACWR score should be 70');
  assert.strictEqual(result.score, 51, 'Weighted score should be 51');

  // Test 4: Penalty application
  console.log('Test 4: Penalty application');
  result = CNS_ENGINE.calculateSRS({ hrvDeviation: 0, totalSleep: 8, deepSleep: 2, acwr: 1.6 });
  assert.strictEqual(result.components.acwr, 0, 'ACWR score should be 0 for > 1.5');
  assert.strictEqual(result.penalty, 15, 'Penalty should be 15 for ACWR > 1.5');
  assert.strictEqual(result.score, 70, 'Score should be 85 (components) - 15 (penalty) = 70');

  // Test 5: Edge cases
  console.log('Test 5: Edge cases');
  // Over-limit values clamping to max
  result = CNS_ENGINE.calculateSRS({ hrvDeviation: 10, totalSleep: 10, deepSleep: 3, acwr: 1.0 });
  assert.strictEqual(result.score, 100, 'Over-limit values should clamp to max score 100');
  assert.strictEqual(result.components.hrv, 100, 'Over-limit HRV clamped to 100');

  // Extreme low values clamping to 0 and not dropping below 0 despite penalty
  result = CNS_ENGINE.calculateSRS({ hrvDeviation: -30, totalSleep: 0, deepSleep: 0, acwr: 2.0 });
  assert.strictEqual(result.components.hrv, 0, 'Extreme low HRV clamped to 0');
  assert.strictEqual(result.components.total, 0, '0 sleep clamped to 0');
  assert.strictEqual(result.components.deep, 0, '0 deep sleep clamped to 0');
  assert.strictEqual(result.components.acwr, 0, 'Extreme high ACWR clamped to 0');
  assert.strictEqual(result.penalty, 15, 'Penalty applied');
  assert.strictEqual(result.score, 0, 'Score should clamp to 0, not be negative');

  console.log('All tests passed!');
}

try {
  runTests();
} catch (error) {
  console.error('Test failed!');
  console.error(error);
  process.exit(1);
}
