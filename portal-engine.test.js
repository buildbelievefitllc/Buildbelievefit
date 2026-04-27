const assert = require('assert');

// Mock localStorage
global.localStorage = {
  data: {},
  getItem(key) {
    if (this.shouldThrow) {
      throw new Error('Mock localStorage error');
    }
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
    this.shouldThrow = false;
  }
};

// Mock document
global.document = {
  getElementById: function(id) {
    return {
      textContent: '',
      style: {}
    };
  }
};

const BBF_PORTAL = require('./portal-engine.js');

function runTests() {
  console.log('Running tests for toggleTrialAccess...');

  // Reset mocks before test
  localStorage.clear();

  // Setup data for success path
  localStorage.setItem('bbf_v7', JSON.stringify({
    u: {
      'test-uid': {
        trial_status: 'inactive'
      }
    }
  }));

  // Mock console.error
  let errorLogged = false;
  let loggedMessage = '';
  const originalConsoleError = console.error;
  console.error = function(msg, err) {
    errorLogged = true;
    loggedMessage = msg;
  };

  try {
    // Test 1: Error path
    console.log('Test 1: Error path in toggleTrialAccess');
    localStorage.shouldThrow = true;

    // Mock the toggle element
    const mockToggleEl = {
      classList: {
        toggle: function(className, force) {}
      }
    };

    // Call the function
    BBF_PORTAL.toggleTrial('test-uid', mockToggleEl);

    // Assert error was caught and logged
    assert.strictEqual(errorLogged, true, 'console.error should have been called');
    assert.strictEqual(loggedMessage, 'Toggle trial error:', 'console.error should log the correct message');
  } finally {
    // Restore console.error
    console.error = originalConsoleError;
  }

  console.log('All tests passed!');
}

try {
  runTests();
} catch (error) {
  console.error('Test failed!');
  console.error(error);
  process.exit(1);
}
