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

const { toggleTournamentMode, isTournamentMode } = require('./filter-engine.js');

function runTests() {
  console.log('Running tests for toggleTournamentMode...');

  // Reset localStorage before each test
  localStorage.clear();

  // Test 1: Initial state (should be false/off)
  console.log('Test 1: Initial state');
  assert.strictEqual(isTournamentMode(), false, 'isTournamentMode should be false initially');

  // Test 2: toggleTournamentMode(true) - Explicitly set to true
  console.log('Test 2: Explicitly set to true');
  let result = toggleTournamentMode(true);
  assert.strictEqual(result, true, 'toggleTournamentMode(true) should return true');
  assert.strictEqual(localStorage.getItem('bbf_tournament_mode'), 'on', 'localStorage should be "on"');
  assert.strictEqual(isTournamentMode(), true, 'isTournamentMode should be true');

  // Test 3: toggleTournamentMode(false) - Explicitly set to false
  console.log('Test 3: Explicitly set to false');
  result = toggleTournamentMode(false);
  assert.strictEqual(result, false, 'toggleTournamentMode(false) should return false');
  assert.strictEqual(localStorage.getItem('bbf_tournament_mode'), 'off', 'localStorage should be "off"');
  assert.strictEqual(isTournamentMode(), false, 'isTournamentMode should be false');

  // Test 4: toggleTournamentMode() - Toggle from false to true
  console.log('Test 4: Toggle from false to true');
  localStorage.setItem('bbf_tournament_mode', 'off');
  result = toggleTournamentMode();
  assert.strictEqual(result, true, 'Toggling from "off" should return true');
  assert.strictEqual(localStorage.getItem('bbf_tournament_mode'), 'on', 'localStorage should be "on"');
  assert.strictEqual(isTournamentMode(), true, 'isTournamentMode should be true');

  // Test 5: toggleTournamentMode() - Toggle from true to false
  console.log('Test 5: Toggle from true to false');
  localStorage.setItem('bbf_tournament_mode', 'on');
  result = toggleTournamentMode();
  assert.strictEqual(result, false, 'Toggling from "on" should return false');
  assert.strictEqual(localStorage.getItem('bbf_tournament_mode'), 'off', 'localStorage should be "off"');
  assert.strictEqual(isTournamentMode(), false, 'isTournamentMode should be false');

  // Test 6: toggleTournamentMode() - Toggle when localStorage is empty
  console.log('Test 6: Toggle when localStorage is empty');
  localStorage.clear();
  result = toggleTournamentMode();
  assert.strictEqual(result, true, 'Toggling when empty should return true (default behavior)');
  assert.strictEqual(localStorage.getItem('bbf_tournament_mode'), 'on', 'localStorage should be "on"');
  assert.strictEqual(isTournamentMode(), true, 'isTournamentMode should be true');

  console.log('All tests passed!');
}

try {
  runTests();
} catch (error) {
  console.error('Test failed!');
  console.error(error);
  process.exit(1);
}
