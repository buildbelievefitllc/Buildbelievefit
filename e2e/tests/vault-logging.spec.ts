import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * BBF Vault Workout Logging (Terminal 4 E2E lane)
 * ===============================================
 * Browser-drone coverage of the authenticated athlete logging a set in the
 * React Sovereign Vault (Phase 18/20 — pages/ClientVault.jsx + components/vault/*):
 *
 *   1. Land in the Vault as a logged-in client (auth seeded via localStorage —
 *      the app uses PIN-RPC auth persisted to `bbf.session.v1`, not GoTrue).
 *   2. Open "Program" → today's training day (jacque_plan · Day 1).
 *   3. Expand a collapsed exercise card.
 *   4. Log a valid set (12 reps @ 160 lbs) and verify the inputs flip to the
 *      green `is-done` state with the focus ring rendered.
 *   5. Click the gold "☁ Complete & Sync Day" CTA and verify the success state.
 *
 * NO REAL DATABASE WRITES: every Supabase REST/RPC call is intercepted. The
 * build points VITE_SUPABASE_URL at the preview origin so calls are same-origin
 * (no CORS preflight); the spec fulfills them with deterministic stubs and
 * additionally fails loudly if anything ever reaches the real project host.
 *
 * Verified against source: AuthContext.jsx (session shape @ 79-99, rehydrate @
 * 32-45), App.jsx VaultRoute (the authed Vault now lives at /vault, not "/"),
 * ClientVault.jsx tabs (@ 31-39),
 * ProgramGrid.jsx (cards/inputs/sync @ 84-229), programApi.js (the
 * uid_map → bbf_logs → bbf_sets write transaction @ 187-222), and the
 * jacque_plan Day 1 catalog (programData.js @ 101-109).
 */

const REAL_PROJECT_HOST = 'ihclbceghxpuawymlvgi.supabase.co';

// A valid non-admin client session. `jacque_bbf` maps to jacque_plan via the
// persona resolver; programKey is also set explicitly (explicit key wins).
const SESSION = {
  uid: 'jacque_bbf',
  user: {
    id: 'jacque_bbf',
    username: 'jacque_bbf',
    role: 'client',
    type: null,
    programKey: 'jacque_plan',
  },
  plans: null,
  authenticatedAt: Date.now(),
};

const SET_TO_LOG = { reps: '12', weight: '160' };

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: { ...cors, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Short-circuit CORS preflights (belt-and-suspenders — same-origin under the
// default config means these usually don't fire).
function isPreflight(route: Route): boolean {
  if (route.request().method() === 'OPTIONS') {
    route.fulfill({ status: 204, headers: cors });
    return true;
  }
  return false;
}

/** Seed an authenticated client session before any app script runs. */
async function seedAuth(page: Page): Promise<void> {
  await page.addInitScript((session) => {
    localStorage.setItem('bbf.session.v1', JSON.stringify(session));
    localStorage.removeItem('bbf.vault.weights.v1'); // clean per-run buffer
  }, SESSION);
}

interface VaultCaptures {
  sets: Array<Record<string, unknown>>;
  logs: Array<{ method: string; url: string }>;
  realDbHits: string[];
}

/**
 * Intercept the Vault's entire Supabase surface so the run is hermetic and
 * writes nothing. Registration order matters: Playwright checks the most
 * recently added matching handler first, so the broad catch-alls are registered
 * BEFORE the specific table/RPC handlers (which must win).
 */
async function stubVaultBackends(page: Page): Promise<VaultCaptures> {
  const captures: VaultCaptures = { sets: [], logs: [], realDbHits: [] };

  // (lowest priority) blanket neutralizer for any other Supabase REST/auth call.
  await page.route('**/rest/v1/**', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, []);
  });
  await page.route('**/auth/v1/**', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, {});
  });

  // Profile metrics (fetch-on-land) — benign envelope so the Vault renders clean.
  await page.route('**/rest/v1/rpc/bbf_get_profile_metrics', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, {
      ok: true, total_sessions: 4, current_streak: 2, best_streak: 6,
      this_week: 2, this_month: 9, avg_per_week: 2.3, heatmap: [],
    });
  });

  // Autoregulation last-weights (fires on each exercise card mount) — empty map.
  await page.route('**/rest/v1/rpc/bbf_get_last_weights', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, { ok: true, day_idx: 0, weights: {} });
  });

  // Slug → UUID resolver used by the sync transaction.
  await page.route('**/rest/v1/rpc/bbf_get_uid_map', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, [{ uid: 'jacque_bbf', id: 'e2e-uuid-jacque-0001' }]);
  });

  // Parent session row: POST → single {id}; DELETE (rollback) → []. Captured.
  await page.route('**/rest/v1/bbf_logs**', (route) => {
    if (isPreflight(route)) return;
    const method = route.request().method();
    captures.logs.push({ method, url: route.request().url() });
    if (method === 'POST') return json(route, 201, { id: 7777 });
    return json(route, 200, []);
  });

  // Child set rows: echo back exactly one {id} per inserted row so the client's
  // `setData.length === rows.length` success check passes. Capture the payload.
  await page.route('**/rest/v1/bbf_sets**', (route) => {
    if (isPreflight(route)) return;
    let rows: Array<Record<string, unknown>> = [];
    try {
      const parsed = route.request().postDataJSON();
      rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch {
      rows = [];
    }
    captures.sets.push(...rows);
    return json(route, 201, rows.map((_, i) => ({ id: 9000 + i })));
  });

  // (highest priority) tripwire: a call to the real project host must NEVER
  // happen. Record + abort so the assertion at the end fails loudly if it does.
  await page.route(`**${REAL_PROJECT_HOST}/**`, (route) => {
    captures.realDbHits.push(route.request().url());
    return route.abort();
  });

  return captures;
}

test.describe('BBF Vault — workout set logging', () => {
  test('client logs a set in Today’s Program and syncs the session (no DB writes)', async ({
    page,
  }) => {
    await seedAuth(page);
    const captures = await stubVaultBackends(page);

    // 1) Land in the authenticated Vault (now at /vault — "/" is the public landing).
    await page.goto('/vault');
    await expect(page.locator('.cv-greet')).toContainText('@jacque_bbf');
    await expect(page.locator('.cv-brand')).toContainText('Sovereign Vault');

    // 2) Open "Program" → today's training day.
    await page.getByRole('tab', { name: 'Program' }).click();
    await expect(page.locator('.pg-dayhead')).toContainText('Day 1');
    const cards = page.locator('.pg-ex');
    await expect(cards.first()).toBeVisible();
    await expect(cards.nth(1)).toBeVisible();

    // 3) Expand a collapsed exercise card (the first card is open by default,
    //    so target the second to genuinely exercise the expand interaction).
    const card = cards.nth(1);
    await expect(card).not.toHaveClass(/is-open/);
    await card.locator('.pg-ex-head').click();
    await expect(card).toHaveClass(/is-open/);
    await expect(card.locator('.pg-ex-head')).toHaveAttribute('aria-expanded', 'true');

    // 4) Log a valid set: 12 reps @ 160 lbs. The weight field now defaults to "BW"
    //    (bodyweight) when the plan prescribes no load and there's no autoreg history.
    const reps = card.getByPlaceholder('reps').first();
    const weight = card.getByPlaceholder('BW').first();
    await reps.fill(SET_TO_LOG.reps);
    await weight.fill(SET_TO_LOG.weight);

    // ...inputs flip to the green "done" state...
    await expect(reps).toHaveClass(/is-done/);
    await expect(weight).toHaveClass(/is-done/);

    // ...with the focus ring rendered (the :focus box-shadow is non-empty).
    await reps.focus();
    await expect(reps).toBeFocused();
    const ring = await reps.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(ring && ring !== 'none').toBeTruthy();

    // 5) Click the gold "Complete & Sync Day" CTA → success state.
    const syncBtn = page.locator('.pg-syncbtn');
    await expect(syncBtn).toContainText('Complete & Sync Day');
    await syncBtn.click();
    await expect(syncBtn).toContainText('Synced');
    await expect(page.locator('.pg-syncmsg.is-synced')).toContainText('saved to your cloud history');

    // The write was intercepted with the correct data — and never hit prod.
    expect(captures.sets).toHaveLength(1);
    expect(captures.sets[0]).toMatchObject({
      exercise_key: 'ex_1',
      set_number: 1,
      reps: 12,
      weight_lbs: 160,
    });
    expect(captures.logs.some((l) => l.method === 'POST')).toBeTruthy();
    expect(captures.realDbHits).toHaveLength(0);
  });
});
