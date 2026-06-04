import { test, expect, type Page } from '@playwright/test';
import {
  CLIENT_SESSION, seedClientSession, installSupabaseBaseline, json, isPreflight,
  type SessionEnvelope,
} from './support/vault.js';

/**
 * The Sports Hub — fork, isolation, first-run intake gate & Daily Execution Protocol
 * =================================================================================
 * Browser-drone coverage of the youth/sports division (Terminal Echo):
 *
 *   1. A flagged athlete is forked at /login PAST the adult Vault into the daily
 *      protocol (when their PAR-Q+ intake is already complete).
 *   2. Isolation holds: an athlete deep-linking /vault is bounced into the Hub.
 *   3. An ordinary adult client is unaffected — still lands in the Vault.
 *   4. FIRST-RUN GATE: an un-screened athlete is blocked by the forced intake.
 *   5. Completing the intake (sport selection + token-gated persist) releases them
 *      into the Day 1 protocol.
 *   6. DAILY PROTOCOL: the Day 1–7 pill nav switches days, the off/in-season phase
 *      toggle swaps the workload, and exercise/drill/film checkoffs mutate live;
 *      the Combine calculators remain one tap away in the measurables panel.
 *   7. The intake sport selection drives the protocol's sport-specific content.
 *
 * NO REAL DATABASE: every Supabase call is stubbed and a tripwire asserts nothing
 * touched the real project host.
 */

const ATHLETE_SESSION: SessionEnvelope = {
  uid: 'marcus_bbf',
  vaultToken: 'e2e-vault-token', // present so the token-gated intake submit can fire
  user: { id: 'marcus_bbf', username: 'marcus_bbf', role: 'client', type: null, programKey: null },
  plans: null,
  authenticatedAt: Date.now(),
};

/** Stub the first-run gate STATUS read (completed = gate open → Hub renders).
 *  `progress` seeds the persisted per-day check-off map (bbf_users.youth_progress). */
async function stubIntakeStatus(page: Page, completed: boolean, progress: Record<string, unknown> = {}) {
  await page.route('**/rest/v1/rpc/bbf_get_youth_intake_status', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, {
      ok: true, completed, screened_at: completed ? '2026-06-04T00:00:00Z' : null,
      sport: null, position: null, youth_progress: progress,
    });
  });
}

/** Stub the token-gated intake WRITE → success (records the captured payload). */
async function stubIntakeSubmit(page: Page, captured: Array<Record<string, unknown>>) {
  await page.route('**/rest/v1/rpc/bbf_submit_youth_intake', (route) => {
    if (isPreflight(route)) return;
    try { captured.push(route.request().postDataJSON()); } catch { /* ignore */ }
    return json(route, 200, { ok: true, screened_at: '2026-06-04T00:00:00Z', cardiac_clearance: 'self_attested' });
  });
}

/** Stub the per-tap check-off WRITE → success (records each captured call). */
async function stubProgressLog(page: Page, captured: Array<Record<string, unknown>>) {
  await page.route('**/rest/v1/rpc/bbf_log_youth_progress', (route) => {
    if (isPreflight(route)) return;
    try { captured.push(route.request().postDataJSON()); } catch { /* ignore */ }
    return json(route, 200, { ok: true, youth_progress: {} });
  });
}

test.describe('The Sports Hub — fork, isolation, intake gate & daily protocol', () => {
  test('a cleared athlete is forked from /login into the Day 1 protocol', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubIntakeStatus(page, true); // intake already complete → gate open
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/login');

    await expect(page).toHaveURL(/\/sports-hub$/);
    await expect(page.getByTestId('sports-hub')).toBeVisible();
    await expect(page.locator('.cv-greet')).toHaveCount(0); // adult Vault never rendered
    await expect(page.getByRole('tab', { name: 'Day 1' })).toBeVisible(); // day pill nav
    await expect(page.getByRole('heading', { name: 'Lower-Body Power' })).toBeVisible(); // Day 1 workload

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

    await expect(page.getByRole('heading', { name: /Athlete Intake/i })).toBeVisible();
    await expect(page.getByText('Parent / Guardian Authorization')).toBeVisible();
    await expect(page.getByTestId('sports-hub')).toHaveCount(0); // Hub is blocked

    expect(realDbHits).toHaveLength(0);
  });

  test('completing the intake persists it and releases the athlete into the protocol', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubIntakeStatus(page, false);
    const captured: Array<Record<string, unknown>> = [];
    await stubIntakeSubmit(page, captured);
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/sports-hub');
    await expect(page.getByRole('heading', { name: /Athlete Intake/i })).toBeVisible();

    // The gate forces the sport selection + guardian authorization + liability/terms.
    await page.locator('#yi-sport').selectOption('football');
    await page.locator('#yi-position').selectOption('OL');
    await page.locator('#yi-guardian-name').fill('Denise Vance');
    await page.locator('#yi-guardian-consent').check();
    await page.locator('#yi-liability').check();
    await page.getByRole('button', { name: /Complete Intake/i }).click();

    // Persisted (token-gated) → released into the Day 1 protocol.
    await expect(page.getByTestId('sports-hub')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lower-Body Power' })).toBeVisible();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      p_uid: 'marcus_bbf',
      p_session_token: 'e2e-vault-token',
      p_payload: { sport: 'football', position: 'OL' }, // selection bundled into the payload
    });
    expect(realDbHits).toHaveLength(0);
  });

  test('daily protocol: day nav, phase workload, and checkoffs mutate live', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubIntakeStatus(page, true); // cleared → protocol renders
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/sports-hub');
    await expect(page.getByTestId('sports-hub')).toBeVisible();

    // Day 1 (first training day) is active by default — workload visible.
    await expect(page.getByRole('heading', { name: 'Lower-Body Power' })).toBeVisible();
    await expect(page.getByText('Back Squat')).toBeVisible();

    // The off/in-season toggle swaps the workload scheme (encoding-safe: assert change).
    const scheme = page.getByTestId('sh-ex-scheme-0');
    const offText = await scheme.textContent();
    expect(offText).toContain('4'); // off-season Back Squat 4 × 5
    await page.getByTestId('sh-phase-in').click();
    await expect(scheme).not.toHaveText(offText || '');
    expect(await scheme.textContent()).toContain('3'); // in-season 3 × 3

    // Workout exercise checkoff.
    const ex0 = page.getByTestId('sh-ex-0');
    await expect(ex0).toHaveAttribute('aria-pressed', 'false');
    await ex0.click();
    await expect(ex0).toHaveAttribute('aria-pressed', 'true');

    // Drill checkoff (Day 1 carries a position-specific drill).
    const drill0 = page.getByTestId('sh-drill-toggle-0');
    await expect(drill0).toHaveAttribute('aria-pressed', 'false');
    await drill0.click();
    await expect(drill0).toHaveAttribute('aria-pressed', 'true');

    // Switch to Day 2 → film study cycles assigned → in-review.
    await page.getByRole('tab', { name: 'Day 2' }).click();
    await expect(page.getByRole('heading', { name: 'Upper-Body Strength' })).toBeVisible();
    const film0 = page.getByTestId('sh-film-card-0');
    await expect(film0).toContainText('Assigned');
    await film0.click();
    await expect(film0).toContainText('In Review');

    // The combine calculator still lives one tap away in the measurables panel.
    await page.getByTestId('sh-measurables-toggle').click();
    const fortyPct = page.getByTestId('sh-combine-pct-forty');
    await expect(fortyPct).toHaveText('93% to target');
    await page.getByTestId('sh-combine-input-forty').fill('5.20');
    await expect(fortyPct).toHaveText('100% to target');

    expect(realDbHits).toHaveLength(0);
  });

  test('intake sport selection drives the protocol (basketball / point guard)', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubIntakeStatus(page, false);
    const captured: Array<Record<string, unknown>> = [];
    await stubIntakeSubmit(page, captured);
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/sports-hub');
    await expect(page.getByRole('heading', { name: /Athlete Intake/i })).toBeVisible();

    // Pick a sport + position different from the football seed (dependent field).
    await page.locator('#yi-sport').selectOption('basketball');
    await page.locator('#yi-position').selectOption('PG');
    await page.locator('#yi-guardian-name').fill('Denise Vance');
    await page.locator('#yi-guardian-consent').check();
    await page.locator('#yi-liability').check();
    await page.getByRole('button', { name: /Complete Intake/i }).click();

    // Released into the protocol scoped to basketball / point guard.
    await expect(page.getByTestId('sports-hub')).toBeVisible();
    await expect(page.getByTestId('sh-hero-sport')).toContainText('Basketball');
    await expect(page.getByTestId('sh-hero-position')).toContainText('Point Guard');
    await expect(page.getByText('Closeout & Slide')).toBeVisible(); // basketball drill on Day 1

    expect(captured[0]).toMatchObject({ p_payload: { sport: 'basketball', position: 'PG' } });
    expect(realDbHits).toHaveLength(0);
  });

  test('persistence: completed check-offs are restored from the DB on load', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    // The status read carries a persisted progress map for this athlete.
    await stubIntakeStatus(page, true, { 'Day 1': { ex: { '0': true }, dr: { '0': true } } });
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/sports-hub');
    await expect(page.getByTestId('sports-hub')).toBeVisible();

    // Day 1's first exercise + first drill open already checked (restored, not reset).
    await expect(page.getByTestId('sh-ex-0')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('sh-drill-toggle-0')).toHaveAttribute('aria-pressed', 'true');

    expect(realDbHits).toHaveLength(0);
  });

  test('persistence: tapping a check-off fires bbf_log_youth_progress', async ({ page }) => {
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubIntakeStatus(page, true); // cleared, no prior progress
    const logs: Array<Record<string, unknown>> = [];
    await stubProgressLog(page, logs);
    await seedClientSession(page, ATHLETE_SESSION);

    await page.goto('/sports-hub');
    const ex0 = page.getByTestId('sh-ex-0');
    await expect(ex0).toHaveAttribute('aria-pressed', 'false');
    await ex0.click();
    await expect(ex0).toHaveAttribute('aria-pressed', 'true');

    // The tap persisted the single check-off to the athlete's row (token-gated).
    await expect.poll(() => logs.length).toBeGreaterThan(0);
    expect(logs[0]).toMatchObject({
      p_uid: 'marcus_bbf',
      p_session_token: 'e2e-vault-token',
      p_day: 'Day 1',
      p_kind: 'ex',
      p_index: '0',
      p_value: true,
    });
    expect(realDbHits).toHaveLength(0);
  });
});
