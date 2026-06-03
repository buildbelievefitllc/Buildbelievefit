import { test, expect, type Page } from '@playwright/test';
import {
  CLIENT_SESSION, seedClientSession, installSupabaseBaseline, json, isPreflight,
  type SessionEnvelope,
} from './support/vault.js';

/**
 * The Sports Hub — Routing Fork, youth-surface isolation & first-run intake gate
 * ============================================================================
 * Browser-drone coverage of the youth/sports division (Terminal Echo):
 *
 *   1. A flagged athlete is forked at /login PAST the adult Vault into The Sports
 *      Hub (when their PAR-Q+ intake is already complete).
 *   2. Isolation holds: an athlete deep-linking /vault is bounced into the Hub.
 *   3. An ordinary adult client is unaffected — still lands in the Vault.
 *   4. FIRST-RUN GATE: an athlete with NO completed intake is blocked from the Hub
 *      and shown the forced PAR-Q+ / guardian-authorization intake instead.
 *   5. Completing the intake (token-gated persist) releases them into the Hub.
 *
 * The "flag" is the seed in frontend/src/lib/sportsRoster.js (marcus_bbf); intake
 * status is the new bbf_get_youth_intake_status RPC, persisted via
 * bbf_submit_youth_intake. NO REAL DATABASE: every Supabase call is stubbed and a
 * tripwire asserts nothing touched the real project host.
 */

const ATHLETE_SESSION: SessionEnvelope = {
  uid: 'marcus_bbf',
  vaultToken: 'e2e-vault-token', // present so the token-gated intake submit can fire
  user: { id: 'marcus_bbf', username: 'marcus_bbf', role: 'client', type: null, programKey: null },
  plans: null,
  authenticatedAt: Date.now(),
};

/** Stub the first-run gate STATUS read (completed = gate open → Hub renders). */
async function stubIntakeStatus(page: Page, completed: boolean) {
  await page.route('**/rest/v1/rpc/bbf_get_youth_intake_status', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, { ok: true, completed, screened_at: completed ? '2026-06-03T00:00:00Z' : null });
  });
}

/** Stub the token-gated intake WRITE → success (records the captured payload). */
async function stubIntakeSubmit(page: Page, captured: Array<Record<string, unknown>>) {
  await page.route('**/rest/v1/rpc/bbf_submit_youth_intake', (route) => {
    if (isPreflight(route)) return;
    try { captured.push(route.request().postDataJSON()); } catch { /* ignore */ }
    return json(route, 200, { ok: true, screened_at: '2026-06-03T00:00:00Z', cardiac_clearance: 'self_attested' });
  });
}

test.describe('The Sports Hub — fork, isolation & first-run intake gate', () => {
  test('a cleared athlete is forked from /login straight into the Hub', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubIntakeStatus(page, true); // intake already complete → gate open
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/login');

    await expect(page).toHaveURL(/\/sports-hub$/);
    await expect(page.getByTestId('sports-hub')).toBeVisible();
    await expect(page.locator('.cv-greet')).toHaveCount(0); // adult Vault never rendered
    await expect(page.getByRole('heading', { name: 'Combine Metrics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Positional Film Study' })).toBeVisible();

    expect(realDbHits).toHaveLength(0);
  });

  test('isolation: a cleared athlete deep-linking /vault is bounced into the Hub', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubIntakeStatus(page, true);
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
    await expect(page.getByTestId('sports-hub')).toHaveCount(0);
    expect(realDbHits).toHaveLength(0);
  });

  test('FIRST-RUN GATE: an un-screened athlete is blocked from the Hub by the intake', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubIntakeStatus(page, false); // no completed intake → gate closed
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/sports-hub');

    // The forced intake is shown IN PLACE OF the Hub.
    await expect(page.getByRole('heading', { name: /Athlete Intake/i })).toBeVisible();
    await expect(page.getByText('Parent / Guardian Authorization')).toBeVisible();
    await expect(page.getByTestId('sports-hub')).toHaveCount(0); // Hub is blocked

    expect(realDbHits).toHaveLength(0);
  });

  test('completing the intake persists it and releases the athlete into the Hub', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubIntakeStatus(page, false);
    const captured: Array<Record<string, unknown>> = [];
    await stubIntakeSubmit(page, captured);
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/sports-hub');
    await expect(page.getByRole('heading', { name: /Athlete Intake/i })).toBeVisible();

    // The gate forces guardian authorization + the liability/terms acknowledgment.
    await page.locator('#yi-guardian-name').fill('Denise Vance');
    await page.locator('#yi-guardian-consent').check();
    await page.locator('#yi-liability').check();
    await page.getByRole('button', { name: /Complete Intake/i }).click();

    // Persisted (token-gated) → released into the Hub.
    await expect(page.getByTestId('sports-hub')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Combine Metrics' })).toBeVisible();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ p_uid: 'marcus_bbf', p_session_token: 'e2e-vault-token' });
    expect(realDbHits).toHaveLength(0);
  });
});
