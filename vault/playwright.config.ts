// ═══════════════════════════════════════════════════════════════════════
// vault/playwright.config.ts
//
// Phase 4.3f · Triad Verification Protocol · Functional Gauntlet · the
// Playwright E2E config that drives `vault/e2e/vault-smoke.spec.ts`
// against the production-mode preview build.
//
// LOCAL USAGE
//   1. `npx playwright install chromium --with-deps`  (once per machine)
//   2. `npm run test:e2e`                              (auto-builds via
//                                                       the pretest:e2e
//                                                       hook, starts
//                                                       vite preview, runs
//                                                       the suite)
//
// CI USAGE
//   The `webServer.reuseExistingServer` flag is gated on `!process.env.CI`
//   so a CI runner always starts a fresh preview server per shard. The
//   server bind is hardened with `--strictPort` so port collisions fail
//   loudly rather than silently drifting to a different port the tests
//   can't reach.
//
// ARCHITECTURAL NOTES (why this exists)
//   The Vault SPA went from "wireframe" to "live wire" across the Phase
//   4.3a → 4.3e sprints (commits 431b053 → 391e0bb). Every action button
//   now writes to a real Supabase table or fires an edge function. The
//   triad verification gauntlet (Visual + Functional + Behavioral)
//   guards three load-bearing properties of the SPA:
//
//     · ROUTER LOCK · the shell pre-mounts all 6 tabs and toggles
//       visibility via `display: none/block` (Phase 4.3b commit f2a5405) ·
//       per-tab React state must survive rapid switches. Regressions
//       here would silently re-mount components, drop typed form
//       state, and re-fire `getUserMedia` permission prompts.
//     · DOUBLE-SUBMIT SHIELD · every action button (Phase 4.3d / 4.3e
//       commits e3918dc / 391e0bb) gates network IO behind an
//       `isSubmitting` boolean · disables the button + flips the label
//       to "<verb>ing…" for the full async window · early-returns in
//       the handler bounce spam-clicks. Regressions here would let one
//       UX spam-click translate into N duplicate bbf_logs rows.
//     · DATA LAYER INTERCEPT · the data layer (Phase 4.3d / 4.3e
//       `supabaseClient.ts` additions) routes every write through
//       named insert functions. The shield's PROMISE is "1 user
//       intent → 1 network round-trip" regardless of UI spam. The
//       intercept counts POSTs to verify the promise empirically.
// ═══════════════════════════════════════════════════════════════════════

import { defineConfig, devices } from '@playwright/test';

const PREVIEW_PORT = 4173;
const BASE_URL     = `http://localhost:${PREVIEW_PORT}/vault/`;

export default defineConfig({
  testDir: './e2e',
  // E2E tests serialize against a single preview server · workers: 1.
  fullyParallel: false,
  workers: 1,
  // CI: be strict; local: allow retry to absorb flaky environments.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // List reporter is the cleanest signal for the closure logs.
  reporter: [['list']],
  expect: {
    timeout: 7_500,
  },
  // 60s total per test · ample headroom for the spam-click + delayed
  // mock response sequences. The slowest test (Test 2 with 800ms
  // simulated round-trip) lands in <2s in practice.
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
    // Trace + screenshot only on failure · zero overhead on green runs.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // `vite preview` serves dist/ under base `/vault/` · the pretest:e2e
    // npm hook builds dist/ before this command runs.
    command: `npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
