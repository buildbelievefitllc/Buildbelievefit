// e2e/provision-guard.spec.js — the vault-landing provisioning guard.
// Locks the hard-guard contract: no athlete reaches the Client Hub until
// bbf_ensure_provisioned confirms their athlete_profiles + today's
// athlete_nutrition_targets_daily rows exist (seeding baseline rows first for a
// legacy / tier-change account). Fail-open: a provisioning failure never locks a
// paying athlete out.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const url = (c) => `${HARNESS}?c=${c}`;

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (body) => ({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const preflight = (route) => route.fulfill({ status: 204, headers: CORS });

async function setup(page, props = {}) {
  await page.addInitScript((p) => {
    window.__HARNESS_PROPS__ = p;
    window.localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  }, props);
  await page.route('**/*.supabase.co/**', (route) => (route.request().method() === 'OPTIONS' ? preflight(route) : route.fulfill(json({}))));
}

test('a fresh account is GATED until ensure-provisioned writes both tables and returns ready', async ({ page }) => {
  let calls = 0;
  await setup(page, { user: { username: 'freshfuel' } });
  await page.route('**/rest/v1/rpc/bbf_ensure_provisioned', async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    calls += 1;
    // Simulate the RPC seeding athlete_profiles + athlete_nutrition_targets_daily.
    await new Promise((r) => setTimeout(r, 900));
    return route.fulfill(json({ ok: true, profile_id: 'p1', provisioned: true, ready: true }));
  });

  await page.goto(url('provision-gate'));

  // While provisioning: the "setting up your plan" gate shows and the Hub is withheld.
  await expect(page.getByTestId('provision-gate')).toBeVisible();
  await expect(page.getByTestId('hub-sentinel')).toHaveCount(0);

  // Only once the guard confirms readiness is the Hub granted.
  await expect(page.getByTestId('hub-sentinel')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('provision-gate')).toHaveCount(0);
  expect(calls).toBeGreaterThan(0); // the guard actually ran (server-side writes happen here)
});

test('an already-provisioned athlete passes straight through — no setup flash', async ({ page }) => {
  await setup(page, { user: { username: 'akeem' } });
  await page.route('**/rest/v1/rpc/bbf_ensure_provisioned', (route) => (route.request().method() === 'OPTIONS'
    ? preflight(route)
    : route.fulfill(json({ ok: true, profile_id: 'p1', provisioned: false, ready: true }))));

  await page.goto(url('provision-gate'));

  // Fast path resolves within the 400ms grace → Hub granted, gate never paints.
  await expect(page.getByTestId('hub-sentinel')).toBeVisible();
  await expect(page.getByTestId('provision-gate')).toHaveCount(0);
});

test('a provisioning failure FAILS OPEN — the athlete still reaches the Hub', async ({ page }) => {
  await setup(page, { user: { username: 'erruser' } });
  await page.route('**/rest/v1/rpc/bbf_ensure_provisioned', (route) => (route.request().method() === 'OPTIONS'
    ? preflight(route)
    : route.fulfill({ status: 500, headers: CORS, body: 'boom' })));

  await page.goto(url('provision-gate'));

  // The guard can only IMPROVE provisioning; a hard failure never padlocks a payer.
  await expect(page.getByTestId('hub-sentinel')).toBeVisible({ timeout: 8000 });
});
