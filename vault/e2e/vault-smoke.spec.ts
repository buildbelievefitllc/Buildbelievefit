// ═══════════════════════════════════════════════════════════════════════
// vault/e2e/vault-smoke.spec.ts
//
// Phase 4.3f · Triad Verification Protocol · Functional Gauntlet ·
// three behavioral assertions on the Vault SPA's load-bearing
// architectural properties:
//
//   Test 1 · ROUTER LOCK
//     · Pre-mount of all 6 tabs is verifiable (every panel id exists
//       in the DOM regardless of active tab).
//     · Per-tab React state survives rapid round-trips (a value typed
//       into Profile.name persists through 6 tab switches without
//       re-mount).
//
//   Test 2 · DOUBLE-SUBMIT SHIELD
//     · 10 rapid-fire clicks on the WorkoutTracker per-row Log button
//       transition the UI to the "Logging…" / disabled state.
//     · Terminal "Logged" state is also disabled (a second user
//       intent can't reorder the same set into bbf_sets).
//
//   Test 3 · DATA LAYER INTERCEPT
//     · A spam-click burst translates to exactly ONE backend POST to
//       `bbf_logs` (the canonical "I logged this set" intent).
//     · The companion `bbf_sets` bulk insert also fires exactly once.
//
// EXECUTION MODEL
//   · Each test seeds `localStorage.bbf_current_user` + `bbf_v7`
//     synchronously via `context.addInitScript()` so `main.tsx →
//     hydrateSessionFromStorage()` finds a session BEFORE the auth
//     gate renders Login.
//   · Each test mocks `/vault/env.js` to set test-friendly Supabase env
//     globals (the production env.js otherwise overwrites them).
//   · Each test routes `**/rest/v1/...` paths to in-memory counters
//     and synthetic JSON responses · no network leaves the test runner.
//
// TIMING NOTES
//   · Test 2 (the shield-state test) uses an 800ms response delay on
//     `bbf_logs` so the in-flight window is wide enough to spam-click
//     into and observe the disabled/Logging… state.
//   · Test 3 (the count test) uses a 400ms delay so the spam-click
//     burst lands while the first request is still in flight · this
//     exercises the `busyId` early-return guard (the explicit shield)
//     rather than the `disabled` attribute alone (the implicit shield).
// ═══════════════════════════════════════════════════════════════════════

import { test, expect, type Page, type Route } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────
const TEST_UID  = 'testuid';
const FAKE_UUID = '00000000-0000-0000-0000-000000000001';

// First exercise in the WorkoutTracker DEMO_PLAN (vault/src/components/
// WorkoutTracker.tsx · DEMO_PLAN[0]).
const FIRST_EXERCISE_NAME = 'Barbell Back Squat';

// ─── Per-test seeding ─────────────────────────────────────────────────
/**
 * Seed the page with a synthetic auth session + Supabase env globals
 * BEFORE any page script runs. `context.addInitScript()` is the only
 * hook Playwright provides that fires earlier than the page's
 * `<script src='env.js'>`, which is critical because env.js would
 * otherwise overwrite the test's env values with the production ones.
 *
 * Why both `bbf_current_user` AND `bbf_v7`:
 *   · `bbf_current_user` is the session sigil · `hydrateSessionFromStorage`
 *     reads it FIRST and short-circuits the payload scan.
 *   · `bbf_v7` is the master payload · `getTrialState` reads
 *     `payload.u[uid].subscription_tier` to decide blur/lock/CTA · we
 *     seed `subscription_tier: 'sovereign'` so the vault renders
 *     unconditionally.
 */
async function seedSession(page: Page): Promise<void> {
  await page.addInitScript(({ uid }) => {
    try {
      localStorage.setItem('bbf_current_user', uid);
      localStorage.setItem(
        'bbf_v7',
        JSON.stringify({
          u: { [uid]: { subscription_tier: 'sovereign', name: '' } },
          l: {},
          w: {},
        })
      );
    } catch (_) {
      // localStorage may be unavailable in incognito-style contexts ·
      // tests assume a normal browser profile.
    }
  }, { uid: TEST_UID });
}

/**
 * Intercept `/vault/env.js` so the Supabase URL + publishable key
 * resolve to test-only values. Without this, the production env.js
 * would inject the real lab Supabase URL and the real-network mocks
 * below would race against actual HTTP traffic.
 */
async function mockEnvJs(page: Page): Promise<void> {
  await page.route('**/vault/env.js', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body:
        "window.ENV_SUPABASE_URL='http://test.supabase.local';" +
        "window.ENV_SUPABASE_KEY='test_publishable_key';",
    });
  });
}

// ─── Network-mock harness ─────────────────────────────────────────────
interface NetworkCounters {
  uidMap:           number;
  logsInsert:       number;
  setsInsert:       number;
  readinessInsert:  number;
  cardioInsert:     number;
}

/**
 * Install REST route interceptors that count requests + return
 * synthetic success responses. Returns a counter object the test can
 * inspect after the action under test resolves.
 *
 * @param page                 The Playwright page to install routes on.
 * @param logsResponseDelayMs  Optional delay before fulfilling the
 *                             `bbf_logs` POST · widens the in-flight
 *                             window so spam-clicks land while the
 *                             first request hasn't resolved yet.
 */
async function installNetworkRoutes(
  page: Page,
  logsResponseDelayMs: number = 0
): Promise<NetworkCounters> {
  const counters: NetworkCounters = {
    uidMap:           0,
    logsInsert:       0,
    setsInsert:       0,
    readinessInsert:  0,
    cardioInsert:     0,
  };

  // `bbf_get_uid_map` SECURITY DEFINER RPC · returns the slug→uuid map.
  // The data layer caches this in a module-level Map, so subsequent
  // calls hit the cache (counters.uidMap stays at 1 across the spam).
  await page.route('**/rest/v1/rpc/bbf_get_uid_map', async (route: Route) => {
    counters.uidMap++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ uid: TEST_UID, id: FAKE_UUID }]),
    });
  });

  // `bbf_logs` POST → return inserted row with id (Prefer:
  // return=representation in the caller). DELETE is the orphan-cleanup
  // fallback path · we accept it silently.
  await page.route('**/rest/v1/bbf_logs**', async (route: Route) => {
    const method = route.request().method();
    if (method === 'POST') {
      counters.logsInsert++;
      if (logsResponseDelayMs > 0) {
        await new Promise((r) => setTimeout(r, logsResponseDelayMs));
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ id: FAKE_UUID }]),
      });
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' });
    } else {
      await route.fulfill({ status: 405, body: '' });
    }
  });

  // `bbf_sets` bulk insert · Prefer: return=minimal in the caller.
  await page.route('**/rest/v1/bbf_sets**', async (route: Route) => {
    if (route.request().method() === 'POST') {
      counters.setsInsert++;
      await route.fulfill({ status: 201, body: '' });
    } else {
      await route.fulfill({ status: 405, body: '' });
    }
  });

  // `bbf_readiness` POST → return inserted row with id.
  await page.route('**/rest/v1/bbf_readiness**', async (route: Route) => {
    if (route.request().method() === 'POST') {
      counters.readinessInsert++;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ id: FAKE_UUID }]),
      });
    } else {
      await route.fulfill({ status: 405, body: '' });
    }
  });

  // `bbf_athlete_load_logs` POST · Cardio Tracker · Prefer: return=minimal.
  await page.route('**/rest/v1/bbf_athlete_load_logs**', async (route: Route) => {
    if (route.request().method() === 'POST') {
      counters.cardioInsert++;
      await route.fulfill({ status: 201, body: '' });
    } else {
      await route.fulfill({ status: 405, body: '' });
    }
  });

  return counters;
}

// ─── Helpers ──────────────────────────────────────────────────────────
async function bootVault(page: Page): Promise<void> {
  await seedSession(page);
  await mockEnvJs(page);
  await page.goto('/vault/');
  // Wait for the tablist to render · this is the load-complete signal
  // for the authenticated shell (Login renders without a tablist).
  await page.waitForSelector('[role="tablist"]');
}

// ═══════════════════════════════════════════════════════════════════════
// Test 1 · ROUTER LOCK
// ═══════════════════════════════════════════════════════════════════════
test.describe('Vault smoke · Triad Verification', () => {
  test('Test 1 · Router Lock · all 6 tabs pre-mount, state survives rapid switches', async ({ page }) => {
    await installNetworkRoutes(page);
    await bootVault(page);

    // Assert all 6 tab panels exist in the DOM (regardless of active
    // tab). If the shell unmounted inactive tabs, only one panel would
    // be attached at any moment.
    const tabIds = ['home', 'nutrition', 'workout', 'cardio', 'prehab', 'profile'] as const;
    for (const id of tabIds) {
      await expect(page.locator(`#vault-tab-panel-${id}`)).toBeAttached();
    }

    // Navigate to Profile and type a unique sentinel into the name
    // field. Profile is React-state-controlled (not localStorage-
    // hydrated until submit), so persistence here proves the React
    // tree wasn't unmounted across the round-trip.
    await page.locator('#vault-tab-trigger-profile').click();
    const sentinel = `router-lock-${Date.now()}`;
    await page.locator('#profile-name').fill(sentinel);
    await expect(page.locator('#profile-name')).toHaveValue(sentinel);

    // Rapid-fire switch · cycle through all 6 tabs ending back at Profile.
    // No awaits between clicks · stress the shell-stable contract.
    const cycle = ['nutrition', 'workout', 'cardio', 'prehab', 'home', 'profile'] as const;
    for (const id of cycle) {
      await page.locator(`#vault-tab-trigger-${id}`).click();
    }

    // After the round-trip, the typed sentinel must still be in the
    // ProfileSettings.name input. If the shell unmounted the Profile
    // panel during the switches, React state would have been dropped
    // and this field would be empty.
    await expect(page.locator('#profile-name')).toHaveValue(sentinel);

    // Final sanity · all 6 panels still attached after the cycle.
    for (const id of tabIds) {
      await expect(page.locator(`#vault-tab-panel-${id}`)).toBeAttached();
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // Test 2 · DOUBLE-SUBMIT SHIELD
  // ═══════════════════════════════════════════════════════════════════
  test('Test 2 · Double-Submit Shield · 10 rapid clicks lock to "Logging…" then to "Logged"', async ({ page }) => {
    // Wider delay (800ms) ensures the in-flight window is wide enough
    // for Playwright to observe the disabled / "Logging…" state before
    // the response fulfills and the row flips to terminal "Logged".
    await installNetworkRoutes(page, 800);
    await bootVault(page);

    await page.locator('#vault-tab-trigger-workout').click();

    const idleBtn = page.getByRole('button', { name: `Log ${FIRST_EXERCISE_NAME}` });
    await expect(idleBtn).toBeEnabled();
    await expect(idleBtn).toHaveText('Log');

    // Spam-fire 10 clicks concurrently via Promise.all. force:true
    // bypasses Playwright's actionability check so subsequent clicks
    // hit the disabled button rather than waiting for it to re-enable.
    // .catch() swallows the timeout rejection from clicks that race
    // against the disabled transition · only the count matters.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        idleBtn.click({ force: true, timeout: 400 }).catch(() => undefined)
      )
    );

    // The button must transition to the disabled / "Logging…" state ·
    // the in-flight shield. `name: 'Logging…'` is the aria-label
    // (which fallthroughs to text content for unlabeled buttons in
    // Playwright's accessibility tree resolution).
    const busyBtn = page.locator(`button[aria-label="Log ${FIRST_EXERCISE_NAME}"]`);
    await expect(busyBtn).toBeDisabled();
    await expect(busyBtn).toHaveText('Logging…');

    // Wait for the response to resolve · the row transitions to the
    // terminal "Logged" state · the aria-label changes to "Logged · <name>".
    const loggedBtn = page.getByRole('button', { name: `Logged · ${FIRST_EXERCISE_NAME}` });
    await expect(loggedBtn).toBeVisible({ timeout: 5_000 });

    // Logged state is also disabled (terminal · the row can't be
    // re-logged · idempotent at the UX layer).
    await expect(loggedBtn).toBeDisabled();
    await expect(loggedBtn).toHaveText('Logged');
  });

  // ═══════════════════════════════════════════════════════════════════
  // Test 3 · DATA LAYER INTERCEPT
  // ═══════════════════════════════════════════════════════════════════
  test('Test 3 · Data Layer Intercept · 10 spam clicks → exactly 1 backend POST', async ({ page }) => {
    // 400ms delay · enough to keep the first request in flight while
    // the spam-click burst lands. Exercises the explicit `busyId`
    // early-return guard in handleLog rather than the implicit
    // `disabled` attribute shield.
    const counters = await installNetworkRoutes(page, 400);
    await bootVault(page);

    await page.locator('#vault-tab-trigger-workout').click();

    const idleBtn = page.getByRole('button', { name: `Log ${FIRST_EXERCISE_NAME}` });
    await expect(idleBtn).toBeEnabled();

    // Burst 10 clicks. Even though the first click transitions the
    // button to disabled, the remaining 9 fire (via force:true) and
    // must be intercepted by the `busyId === entry.id` early-return
    // guard inside `handleLog`.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        idleBtn.click({ force: true, timeout: 400 }).catch(() => undefined)
      )
    );

    // Wait for the request to fully resolve · the row enters terminal
    // "Logged" state. Any duplicate POSTs from leaked spam clicks
    // would already be counted by this point.
    await expect(
      page.getByRole('button', { name: `Logged · ${FIRST_EXERCISE_NAME}` })
    ).toBeVisible({ timeout: 5_000 });

    // Critical assertion · the shield's promise.
    expect(counters.logsInsert, 'bbf_logs POST count').toBe(1);
    expect(counters.setsInsert, 'bbf_sets POST count').toBe(1);

    // uidMap is fetched once and cached · subsequent spam clicks hit
    // the cache (the canonical Phase 4.3d one-flight contract). 1 is
    // the expected value · 0 would mean the cache never warmed; >1
    // would mean the cache lost its one-flight guarantee.
    expect(counters.uidMap, 'bbf_get_uid_map RPC count').toBe(1);

    // The data-layer envelope check · no unrelated tables were hit.
    expect(counters.readinessInsert).toBe(0);
    expect(counters.cardioInsert).toBe(0);
  });
});
