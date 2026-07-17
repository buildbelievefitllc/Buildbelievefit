// e2e/bodyweight-tracker.spec.js — Sovereign Vault · adult bodyweight tracker.
// Locks the contract that matters:
//   1. The card hydrates from bbf_get_bodyweight and shows the current weight in
//      the chosen unit (grams → lb).
//   2. Logging a weigh-in sends GRAMS (the gram standard) matching the lb/kg
//      entry, via the vault-token RPC.
//   3. The gentle cadence surfaces a "weigh-in due" state only when the 7-day
//      window has elapsed — never a daily nag.
//   4. Setting a goal sends grams.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

const rpc = (body) => (route) =>
  route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: CORS })
    : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });

function daysFromToday(n) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 185 lb → round(185 * 453.59237) grams.
const LB_185_G = Math.round(185 * 453.59237);

async function mount(page, envelope) {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
    localStorage.setItem('bbf_weight_unit', 'lb');
  });
  await page.route('**/rest/v1/rpc/bbf_get_bodyweight', rpc(envelope));
  await page.goto(`${HARNESS}?c=bodyweight-card`);
  await expect(page.getByTestId('bodyweight-card')).toBeVisible();
}

const NOT_DUE = {
  ok: true, cadence_days: 7,
  current_g: Math.round(190 * 453.59237), current_on: daysFromToday(-2), start_g: Math.round(205 * 453.59237),
  goal_g: Math.round(180 * 453.59237), goal_set_at: daysFromToday(-30),
  last_measured_on: daysFromToday(-2), next_due_on: daysFromToday(5), count: 6,
  series: [
    { on: daysFromToday(-30), g: Math.round(205 * 453.59237) },
    { on: daysFromToday(-16), g: Math.round(198 * 453.59237) },
    { on: daysFromToday(-9), g: Math.round(194 * 453.59237) },
    { on: daysFromToday(-2), g: Math.round(190 * 453.59237) },
  ],
};

test('hydrates and shows current weight in lb, goal, and NOT due', async ({ page }) => {
  await mount(page, NOT_DUE);
  await expect(page.getByTestId('bw-current')).toHaveText('190');
  await expect(page.getByTestId('bw-goal-chip')).toContainText('180');
  await expect(page.getByTestId('bw-due')).toHaveCount(0);          // within the 7-day window → no nag
  await expect(page.getByTestId('bw-cadence')).toContainText('weekly, not daily');
});

test('logging a weigh-in sends integer grams matching the lb entry', async ({ page }) => {
  await mount(page, NOT_DUE);

  let logged = null;
  await page.route('**/rest/v1/rpc/bbf_log_bodyweight', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { logged = route.request().postDataJSON(); } catch { logged = {}; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({ ...NOT_DUE, current_g: LB_185_G, current_on: daysFromToday(0), last_measured_on: daysFromToday(0), next_due_on: daysFromToday(7), count: 7 }) });
  });

  await page.getByTestId('bw-input').fill('185');
  await page.getByTestId('bw-log').click();
  await expect.poll(() => logged && logged.p_body_mass_g).toBe(LB_185_G);
  expect(logged.p_session_token).toBe('test-vault-token');
  // The card refreshes from the returned envelope.
  await expect(page.getByTestId('bw-current')).toHaveText('185');
});

test('kg unit converts entry to grams (84 kg → 84000 g)', async ({ page }) => {
  await mount(page, NOT_DUE);
  let logged = null;
  await page.route('**/rest/v1/rpc/bbf_log_bodyweight', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { logged = route.request().postDataJSON(); } catch { logged = {}; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(NOT_DUE) });
  });
  await page.getByTestId('bw-unit-kg').click();
  await page.getByTestId('bw-input').fill('84');
  await page.getByTestId('bw-log').click();
  await expect.poll(() => logged && logged.p_body_mass_g).toBe(84000);
});

test('surfaces the gentle "weigh-in due" state once the 7-day window elapses', async ({ page }) => {
  await mount(page, { ...NOT_DUE, last_measured_on: daysFromToday(-9), next_due_on: daysFromToday(-2) });
  await expect(page.getByTestId('bw-due')).toBeVisible();
  await expect(page.getByTestId('bw-cadence')).toContainText('been a week');
});

test('setting a goal sends grams', async ({ page }) => {
  await mount(page, { ...NOT_DUE, goal_g: null, goal_set_at: null });
  let goalReq = null;
  await page.route('**/rest/v1/rpc/bbf_set_weight_goal', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { goalReq = route.request().postDataJSON(); } catch { goalReq = {}; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ...NOT_DUE, goal_g: Math.round(175 * 453.59237) }) });
  });
  await page.getByTestId('bw-goal-chip').click();          // "+ Set a goal"
  await page.getByTestId('bw-goal-input').fill('175');
  await page.getByTestId('bw-goal-save').click();
  await expect.poll(() => goalReq && goalReq.p_goal_body_mass_g).toBe(Math.round(175 * 453.59237));
});
