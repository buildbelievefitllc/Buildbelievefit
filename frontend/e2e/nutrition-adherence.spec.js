// e2e/nutrition-adherence.spec.js — the Nutrition adherence loop.
// Locks the data flow shipped in the two-layer nutrition architecture:
//   1. Tapping a meal POSTs to bbf-meal-log (integer grams + a stable key) and the
//      wheel updates OPTIMISTICALLY in the same tick.
//   2. A logged meal PERSISTS across a page reload — rehydrated from the SERVER
//      (bbf_nutrition_today), proven by wiping localStorage before the reload.
//   3. A lower-tier (Fuel Foundation) athlete CANNOT access the Sovereign-only
//      periodization surface (nor the Performance fueling-status) — padlock shown,
//      real content absent.

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

// Today's canonical targets + (optionally) already-logged intake rows.
const nutToday = (intake = []) => ({
  ok: true, day: '2026-07-06', profile_id: 'p1',
  targets: { tier: 'sovereign', tdee_kcal: 2800, protein_g: 180, carbs_g: 300, fat_g: 80, creatine_g: null, day_type: 'standard', timing_plan: null },
  intake,
  week_adherence: [{ day: '2026-07-06', pct: 40, target_kcal: 2800, consumed_kcal: 1120 }],
});

// Base harness setup: inject props + a vault session, and a fail-soft catch-all for
// every other supabase call (readiness ledger, etc.). Specific routes registered by
// each test AFTER this take precedence (Playwright matches most-recent-first).
async function setup(page, props = {}) {
  await page.addInitScript((p) => {
    window.__HARNESS_PROPS__ = p;
    window.localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  }, props);
  await page.route('**/*.supabase.co/**', (route) => (route.request().method() === 'OPTIONS' ? preflight(route) : route.fulfill(json({}))));
}

const wheelKcal = async (page) => {
  const txt = await page.locator('.nl-wheel-kcal').first().innerText();
  return parseInt(txt.replace(/[^0-9]/g, ''), 10) || 0;
};

test('logging a meal POSTs to bbf-meal-log and the wheel updates optimistically', async ({ page }) => {
  await setup(page, { isAdmin: true }); // God user → tier gates open, isolate the meal flow
  const posts = [];
  await page.route('**/rest/v1/rpc/bbf_nutrition_today', (route) => (route.request().method() === 'OPTIONS' ? preflight(route) : route.fulfill(json(nutToday([])))));
  await page.route('**/functions/v1/bbf-meal-log', (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    const body = route.request().postDataJSON();
    posts.push(body);
    return route.fulfill(json({ ok: true, action: body.action, client_meal_key: body.client_meal_key, day: '2026-07-06' }));
  });

  await page.goto(url('nutrition-tab'));
  const firstMeal = page.locator('.nl-meal').first();
  await expect(firstMeal).toBeVisible();
  await expect(firstMeal).not.toHaveClass(/is-done/);
  const before = await wheelKcal(page);

  await firstMeal.locator('.nl-meal-main').click();

  // Optimistic: the card flips done + the "why this fuels you" note appears immediately.
  await expect(firstMeal).toHaveClass(/is-done/);
  await expect(page.getByTestId('meal-benefit-note')).toBeVisible();
  // Optimistic: the wheel's consumed kcal rises in the same tick (no server round-trip).
  await expect.poll(() => wheelKcal(page)).toBeGreaterThan(before);

  // The write fired: a 'log' action with a stable key and integer-gram macros.
  await expect.poll(() => posts.length).toBeGreaterThan(0);
  const logged = posts.find((b) => b.action === 'log');
  expect(logged).toBeTruthy();
  expect(typeof logged.client_meal_key).toBe('string');
  expect(logged.client_meal_key.length).toBeGreaterThan(0);
  expect(Number.isInteger(logged.protein_g)).toBe(true);
  expect(Number.isInteger(logged.carbs_g)).toBe(true);
  expect(Number.isInteger(logged.fat_g)).toBe(true);
});

test('a logged meal persists across a reload — rehydrated from the server, not localStorage', async ({ page }) => {
  await setup(page, { isAdmin: true });
  let loggedKeys = []; // stateful "server" — the meal-log write pushes; the read returns it
  await page.route('**/rest/v1/rpc/bbf_nutrition_today', (route) => (route.request().method() === 'OPTIONS'
    ? preflight(route)
    : route.fulfill(json(nutToday(loggedKeys.map((k) => ({ client_meal_key: k, meal_slot: 'snack', food_label: 'x', protein_g: 20, carbs_g: 30, fat_g: 10, kcal: 290 })))))));
  await page.route('**/functions/v1/bbf-meal-log', (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    const b = route.request().postDataJSON();
    if (b.action === 'log' && !loggedKeys.includes(b.client_meal_key)) loggedKeys.push(b.client_meal_key);
    if (b.action === 'unlog') loggedKeys = loggedKeys.filter((k) => k !== b.client_meal_key);
    return route.fulfill(json({ ok: true, action: b.action, client_meal_key: b.client_meal_key, day: '2026-07-06' }));
  });

  await page.goto(url('nutrition-tab'));
  const firstMeal = page.locator('.nl-meal').first();
  await firstMeal.locator('.nl-meal-main').click();
  await expect(firstMeal).toHaveClass(/is-done/);
  await expect.poll(() => loggedKeys.length).toBe(1); // the server recorded the log

  // Prove SERVER persistence (not localStorage): wipe local state, reload → the card
  // is STILL checked, rehydrated purely from bbf_nutrition_today's intake.
  await page.evaluate(() => window.localStorage.removeItem('bbf.vault.nut.done.v1'));
  await page.reload();
  const firstMealAfter = page.locator('.nl-meal').first();
  await expect(firstMealAfter).toHaveClass(/is-done/);
});

test('a Fuel Foundation athlete cannot access the Sovereign periodization surface', async ({ page }) => {
  await setup(page, { isAdmin: false, user: { username: 'fueluser' } });
  await page.route('**/rest/v1/rpc/bbf_get_trial_state', (route) => (route.request().method() === 'OPTIONS'
    ? preflight(route)
    : route.fulfill(json([{ subscription_tier: 'fuel_foundation', trial_expires_at: null }]))));
  await page.route('**/rest/v1/rpc/bbf_nutrition_today', (route) => (route.request().method() === 'OPTIONS' ? preflight(route) : route.fulfill(json(nutToday([])))));

  await page.goto(url('nutrition-tab'));

  // Base nutrition (the wheel) is available to every paying nutrition tier.
  await expect(page.locator('.nl-wheel').first()).toBeVisible();

  // Sovereign periodization: padlock shown, real content absent.
  await expect(page.getByTestId('nutrition-periodization-lock')).toBeVisible();
  await expect(page.getByTestId('nutrition-periodization')).toHaveCount(0);
  await expect(page.getByTestId('nutrition-periodization-calibrating')).toHaveCount(0);

  // Performance fueling-status is also above Foundation → locked, content absent.
  await expect(page.getByTestId('nutrition-fueling-status-lock')).toBeVisible();
  await expect(page.getByTestId('nutrition-fueling-status')).toHaveCount(0);
});
