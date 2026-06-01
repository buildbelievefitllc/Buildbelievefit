import { defineConfig, devices } from '@playwright/test';

/**
 * Build Believe Fit — Playwright config for the React Sovereign Vault suite.
 *
 * Distinct from playwright.config.ts (the static root PWA): the Vault lives in
 * the Vite app under ../frontend, so this config builds it and serves the
 * production output (frontend/dist) via `vite preview`.
 *
 * Target resolution:
 *   - Set BBF_VAULT_URL to run against a deployed Vault origin.
 *   - Leave it unset to build ../frontend and serve it locally on :4174.
 */
const VAULT_URL = process.env.BBF_VAULT_URL || 'http://127.0.0.1:4174';
const USE_LOCAL_SERVER = !process.env.BBF_VAULT_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/vault-logging.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: VAULT_URL,
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'vault-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'vault-mobile', use: { ...devices['Pixel 7'] } },
  ],
  ...(USE_LOCAL_SERVER
    ? {
        webServer: {
          command:
            'npm --prefix ../frontend install && npm --prefix ../frontend run build && npm --prefix ../frontend run preview -- --port 4174 --strictPort --host 127.0.0.1',
          url: VAULT_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
          env: {
            // Point the Supabase client at the preview origin so the spec's
            // intercepts are same-origin (no CORS preflight). Both values are
            // inert: the spec mocks every network call and no real backend
            // lives at this origin. CI may override with real VITE_* env.
            VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || VAULT_URL,
            VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'e2e-anon-key',
          },
        },
      }
    : {}),
});
