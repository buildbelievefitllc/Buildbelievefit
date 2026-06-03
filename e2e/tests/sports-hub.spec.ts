import { test, expect } from '@playwright/test';
import { CLIENT_SESSION, seedClientSession, installSupabaseBaseline } from './support/vault.js';

/**
 * The Sports Hub — post-login Routing Fork & isolation (Terminal 4 E2E lane)
 * =========================================================================
 * Browser-drone coverage of the youth/sports division split (Terminal Echo):
 *
 *   1. A flagged sports athlete is forked at the login gate PAST the adult
 *      Sovereign Vault and lands directly inside The Sports Hub, where the
 *      lineman identity + all four scoped sections (Combine Metrics, Explosive
 *      Power Output, Lineman Drill Progress, Positional Film Study) render.
 *   2. Isolation holds both ways: an athlete who deep-links /vault is bounced
 *      back into the Hub (the adult Vault never renders for them).
 *   3. An ordinary adult client is unaffected — still lands in the Vault.
 *
 * The "flag" is the seed in frontend/src/lib/sportsRoster.js
 * (SPORTS_ROSTER.marcus_bbf). The persisted session deliberately carries NO
 * sportsProfile field — the resolver flags the athlete from the login slug
 * alone, exactly as production behaves until an athlete column ships, so this
 * proves the real fork path, not a hand-fed profile.
 *
 * NO REAL DATABASE: installSupabaseBaseline() neutralizes the entire Supabase
 * surface and tracks any call to the real project host (asserted empty).
 *
 * Verified against source: App.jsx (VaultRoute bounce + SportsHubRoute @ the new
 * /sports-hub route), Login.jsx (homePathForUser fork on returning session),
 * AuthContext.jsx (sportsProfile enrichment + signInWithPin.home), and
 * pages/SportsHub.jsx (data-testid="sports-hub" + section headings).
 */

// Mock sports athlete: the 15-year-old American Football lineman. Session shape
// mirrors AuthContext's persisted envelope (a plain youth client — no elevated
// role, no vault_token).
const ATHLETE_SESSION = {
  uid: 'marcus_bbf',
  user: {
    id: 'marcus_bbf',
    username: 'marcus_bbf',
    role: 'client',
    type: null,
    programKey: null,
  },
  plans: null,
  authenticatedAt: Date.now(),
};

test.describe('The Sports Hub — Routing Fork & youth-surface isolation', () => {
  test('a flagged athlete is forked from /login straight into The Sports Hub', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/login');

    // Forked PAST the adult Vault into the youth Hub…
    await expect(page).toHaveURL(/\/sports-hub$/);
    await expect(page.getByTestId('sports-hub')).toBeVisible();

    // …the adult Vault chrome never rendered…
    await expect(page.locator('.cv-greet')).toHaveCount(0);

    // …and the lineman identity + all four scoped sections are present.
    await expect(page.getByRole('heading', { name: 'Marcus Vance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Combine Metrics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Explosive Power Output' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lineman Drill Progress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Positional Film Study' })).toBeVisible();
    // Position + focus directive surfaced for the test user.
    await expect(page.getByText('Offensive Lineman')).toBeVisible();
    await expect(page.getByText('Explosive Power', { exact: true })).toBeVisible();

    expect(realDbHits).toHaveLength(0);
  });

  test('isolation: an athlete deep-linking /vault is bounced into the Hub', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/vault');

    await expect(page).toHaveURL(/\/sports-hub$/);
    await expect(page.getByTestId('sports-hub')).toBeVisible();
    await expect(page.locator('.cv-greet')).toHaveCount(0);

    expect(realDbHits).toHaveLength(0);
  });

  test('an ordinary adult client still lands in the Sovereign Vault (no regression)', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await seedClientSession(page, CLIENT_SESSION); // jacque_bbf — not a sports athlete

    await page.goto('/login');

    await expect(page).toHaveURL(/\/vault$/);
    await expect(page.locator('.cv-greet')).toContainText('@jacque_bbf');
    // The youth Hub must NOT render for an adult client.
    await expect(page.getByTestId('sports-hub')).toHaveCount(0);

    expect(realDbHits).toHaveLength(0);
  });
});
