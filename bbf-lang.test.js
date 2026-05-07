const assert = require('assert');

// Mock DOM & Browser Environment before requiring bbf-lang.js
global.window = {};
global.document = {
  readyState: 'complete',
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {}
};
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

// Require the module. It's an IIFE that attaches to window.BBF_LANG
require('./bbf-lang.js');

const { set, get, t } = global.window.BBF_LANG;

function runTests() {
  console.log('Running tests for BBF_LANG.t...');

  // Clear state
  localStorage.clear();

  // Test 1: Default language (should be 'en')
  console.log('Test 1: Default language translation');
  set('en');
  let result = t('nav-services');
  assert.strictEqual(result, 'Services', 'English translation for "nav-services" should be "Services"');

  // Test 2: Switch to Spanish
  console.log('Test 2: Spanish language translation');
  set('es');
  result = t('nav-services');
  assert.strictEqual(result, 'Servicios', 'Spanish translation for "nav-services" should be "Servicios"');

  // Test 3: Switch to Portuguese
  console.log('Test 3: Portuguese language translation');
  set('pt');
  result = t('nav-services');
  assert.strictEqual(result, 'Serviços', 'Portuguese translation for "nav-services" should be "Serviços"');

  // Test 4: Unknown key fallback
  console.log('Test 4: Unknown key fallback');
  result = t('unknown-key-123');
  assert.strictEqual(result, 'unknown-key-123', 'Should return the key itself if not found in dictionary');

  // Test 5: Missing translation for a specific language
  console.log('Test 5: Missing translation fallback');
  // Inject a mock entry missing Portuguese
  global.window.BBF_LANG.D['mock-incomplete-key'] = { en: 'Incomplete', es: 'Incompleto' };
  set('pt');
  result = t('mock-incomplete-key');
  assert.strictEqual(result, 'mock-incomplete-key', 'Should return the key if translation for current language is missing');

  console.log('All tests passed!');
}

try {
  runTests();
} catch (error) {
  console.error('Test failed!');
  console.error(error);
  process.exit(1);
}
