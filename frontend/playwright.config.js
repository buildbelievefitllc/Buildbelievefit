// playwright.config.js — integration specs for the four go-live UI fixes.
// Serves the app via `vite` dev and drives the real components through the
// e2e/harness mount page. Dummy Supabase env keeps the client constructible;
// no spec makes a live network call (all data is mocked via props).

import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Bucket/clip playback in specs must not be gated on a synthetic user gesture.
    // --enable-unsafe-swiftshader: recent Chromium gates software WebGL behind this
    // flag, so the 3D Anatomy viewport paints a real <canvas> on GPU-less CI too.
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--enable-unsafe-swiftshader'] },
  },
  // Pin the pre-installed Chromium in this environment (the bundled build id differs
  // from what @playwright/test 1.61 would auto-download; downloads are disabled here).
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: {
        executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
        args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--enable-unsafe-swiftshader'],
      },
    },
  }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'https://ihclbceghxpuawymlvgi.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'harness-anon-key-not-used-for-network',
    },
  },
});
