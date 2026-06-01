import { defineConfig, devices } from '@playwright/test';

/**
 * Build Believe Fit — Playwright E2E configuration (Terminal 4 lane).
 *
 * Target resolution:
 *   - Set BBF_BASE_URL to run against a deployed surface, e.g.:
 *       BBF_BASE_URL=https://buildbelievefit.fitness npm test
 *   - Leave it unset to spin up a local static server over the repo root
 *     (the PWA is plain static HTML/JS — no build step required).
 *
 * The local server serves the parent directory (repo root) so specs can
 * navigate to /index.html, /bbf-app.html, etc.
 */
const BASE_URL = process.env.BBF_BASE_URL || 'http://127.0.0.1:4173';
const USE_LOCAL_SERVER = !process.env.BBF_BASE_URL;

export default defineConfig({
  testDir: './tests',
  // The static-PWA suite only. The React Vault suite has its own config
  // (playwright.vault.config.ts) because it serves a Vite build, not the root.
  testMatch: '**/sales-funnel.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  ...(USE_LOCAL_SERVER
    ? {
        webServer: {
          command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory ..',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      }
    : {}),
});
