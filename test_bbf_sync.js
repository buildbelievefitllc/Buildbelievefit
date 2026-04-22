global.window = {
  ENV_SUPABASE_URL: 'https://test-url.supabase.co',
  ENV_SUPABASE_KEY: 'test-key-123'
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

const bbfSync = require('./bbf-sync.js');

const env = bbfSync.testEnv();
if (env.SUPA_URL !== 'https://test-url.supabase.co') {
  console.error('SUPA_URL mismatch:', env.SUPA_URL);
  process.exit(1);
}
if (env.SUPA_KEY !== 'test-key-123') {
  console.error('SUPA_KEY mismatch:', env.SUPA_KEY);
  process.exit(1);
}
console.log('Tests passed!');
