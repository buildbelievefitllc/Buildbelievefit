import { defineConfig, devices } from '@playwright/test';

/**
 * Build Believe Fit — Playwright config for the Coach's Cave admin surface.
 *
 * Mirrors playwright.vault.config.ts (builds ../frontend, serves the Vite preview)
 * but pins the browser to the PRE-INSTALLED system chromium under /opt/pw-browsers
 * via launchOptions.executablePath — the managed egress policy blocks
 * cdn.playwright.dev, so Playwright cannot download its own browser here.
 */
const CAVE_URL = process.env.BBF_CAVE_URL || 'http://127.0.0.1:4178';
const USE_LOCAL_SERVER = !process.env.BBF_CAVE_URL;
const CHROMIUM_EXE =
  process.env.BBF_CHROMIUM_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/coach-cave.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: CAVE_URL,
    actionTimeout: 15_000,
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: CHROMIUM_EXE },
  },
  projects: [
    { name: 'cave-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  ...(USE_LOCAL_SERVER
    ? {
        webServer: {
          command:
            'npm --prefix ../frontend run build && npm --prefix ../frontend run preview -- --port 4178 --strictPort --host 127.0.0.1',
          url: CAVE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
          env: {
            // Inert build-time Supabase config so createClient() doesn't throw and
            // every real call is same-origin (the spec intercepts them all).
            VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || CAVE_URL,
            VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'e2e-anon-key',
          },
        },
      }
    : {}),
});
