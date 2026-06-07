import { defineConfig, devices } from '@playwright/test';

/**
 * Build Believe Fit — Playwright config for the Sovereign Studio v3 suite.
 *
 * Distinct from playwright.config.ts (the marketing funnel) and
 * playwright.vault.config.ts (the React Vault): this targets the standalone
 * content tool `bbf-sovereign-studio-v3.html` at the repo root — the PNG +
 * Reel video export pipeline. Plain static HTML/JS, so the local server just
 * serves the repo root (no build step). The html2canvas PNG path is stubbed
 * in-spec, so the suite is hermetic and CI-safe.
 *
 *   BBF_STUDIO_URL   — run against a deployed origin instead of the local server.
 *   PW_CHROMIUM_PATH — override the Chromium executable (e.g. a pre-provisioned
 *                      browser) when `npx playwright install` can't reach the CDN.
 */
const BASE_URL = process.env.BBF_STUDIO_URL || 'http://127.0.0.1:4175';
const USE_LOCAL_SERVER = !process.env.BBF_STUDIO_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/studio-v3.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // the recorder tests run in real time — keep them serial
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: ['--no-sandbox', '--ignore-certificate-errors', '--autoplay-policy=no-user-gesture-required'],
      ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(USE_LOCAL_SERVER
    ? {
        webServer: {
          command: 'python3 -m http.server 4175 --bind 127.0.0.1 --directory ..',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      }
    : {}),
});
