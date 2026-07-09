// e2e/roster-share.spec.js — R1 (Shared Roster Provider) network proof.
//
// COACHING_MODULE_AUDIT.md · R1: Founder Five (ClientHub) and Nutrition Locker each
// used to fire their OWN rosterCall('roster') on mount — the identical service-role
// pull of the whole bbf_users roster, uncached. Opening one then the other pulled
// the same list twice.
//
// After R1 a single <RosterProvider> owns the base roster (memoized, fetched once).
// This spec mounts BOTH siblings under one provider and toggles between them (the
// toggle uses `key` to unmount/remount the active panel, exactly like CommandCenter's
// `key={activeTab}` boundary — the provider lives OUTSIDE it). The proof: no matter
// how many times we swap panels, the `action:'roster'` POST fires EXACTLY ONCE, and
// both panels render the same shared roster.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const url = (c) => `${HARNESS}?c=${c}`;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};
const json = (body) => ({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const preflight = (route) => route.fulfill({ status: 204, headers: CORS });

// Two-client roster envelope, the { ok, count, clients } shape rosterCall('roster')
// returns (see rosterApi.js contract).
const ROSTER = {
  ok: true,
  count: 2,
  clients: [
    { id: 'c1', uid: 'athlete-one', name: 'Athlete One', email: 'one@bbf.test', role: 'client', subscription_tier: 'sovereign', account_status: 'active' },
    { id: 'c2', uid: 'athlete-two', name: 'Athlete Two', email: 'two@bbf.test', role: 'client', subscription_tier: 'sovereign', account_status: 'active' },
  ],
};

test('Founder Five ↔ Nutrition Locker share ONE roster fetch across mounts (R1)', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });

  // Playwright uses LAST-registered-route-wins, so register the fail-soft catch-all
  // FIRST and the specific routes AFTER it (they take precedence).
  await page.route('**/*.supabase.co/**', (route) => (route.request().method() === 'OPTIONS' ? preflight(route) : route.fulfill(json({ ok: true }))));
  // ClientHub's two mount-time enrichments (distinct calls, not R1's target) — keep
  // them benign so the panel renders without console noise.
  await page.route('**/rest/v1/rpc/bbf_admin_roster_calibration', (route) => (route.request().method() === 'OPTIONS' ? preflight(route) : route.fulfill(json([]))));
  await page.route('**/rest/v1/rpc/bbf_admin_roster_telemetry', (route) => (route.request().method() === 'OPTIONS' ? preflight(route) : route.fulfill(json({ ok: true, telemetry: [] }))));
  // Count ONLY the roster action — calibration/telemetry are distinct panel
  // enrichments and are intentionally not shared by the provider.
  const rosterPosts = [];
  await page.route('**/functions/v1/bbf-admin-roster', (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    const body = route.request().postDataJSON() || {};
    if (body.action === 'roster') rosterPosts.push(body);
    return route.fulfill(json(ROSTER));
  });

  await page.goto(url('roster-share'));

  // Founder Five mounts first and shows the shared roster.
  await expect(page.getByText('Athlete One').first()).toBeVisible();
  await expect.poll(() => rosterPosts.length).toBe(1);

  // Swap to Nutrition Locker — the active panel remounts, but the provider does not.
  await page.getByTestId('probe-tab-locker').click();
  await expect(page.getByTestId('probe-tab-locker')).toHaveAttribute('aria-selected', 'true');
  // The scholar dropdown is populated from the SAME shared roster (no new fetch).
  await expect(page.locator('option', { hasText: 'Athlete One' }).first()).toBeAttached();

  // Swap back to Founder Five — remount again, still no extra pull.
  await page.getByTestId('probe-tab-founder').click();
  await expect(page.getByText('Athlete One').first()).toBeVisible();

  // Toggle a couple more times to be sure remounting never re-fetches.
  await page.getByTestId('probe-tab-locker').click();
  await page.getByTestId('probe-tab-founder').click();

  // THE PROOF: exactly ONE roster round-trip for the whole session, despite N mounts.
  expect(rosterPosts.length).toBe(1);
});
