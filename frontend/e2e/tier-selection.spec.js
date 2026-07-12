// e2e/tier-selection.spec.js — closes the onboarding loop seam between the
// Explorer funnel's /protocol-init screen and the /select-tier pricing wall.
//
// Two paths through Select Plan:
//   · LEGACY — a direct /select-tier visit (no `screening` in router state)
//     still carries the chosen tier into /pathfinder for the intake, exactly
//     as before this change.
//   · SCREENING COMPLETE — a visitor who just finished Protocol Initialization
//     arrives with a completed screening record; Select Plan skips the intake
//     entirely and mints a Stripe Checkout Session directly.

import { test, expect } from '@playwright/test';

const ENVELOPE = {
  token: 'xp-e2e-token',
  source: 'tdee_calculator',
  createdAt: Date.now(),
  profile: { age: 30, sex: 'male', weight_lbs: 180, height_ft: 5, height_in: 10, activity_factor: 1.55 },
  targets: { goal: 'maintain', tdee_maintenance: 2600, tdee_target: 2600, macro_p: 162, macro_c: 298, macro_f: 72 },
};

function seedEnvelope(page) {
  return page.addInitScript((env) => {
    localStorage.setItem('bbf.explorer.token.v1', JSON.stringify(env));
  }, ENVELOPE);
}

function stubTurnstile(page) {
  return page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.turnstile = {
      render: (el, opts) => { window.__ts_cb = opts.callback; return 'w1'; },
      reset: () => {},
      execute: () => { setTimeout(() => window.__ts_cb && window.__ts_cb('e2e-turnstile-token'), 0); },
      remove: () => {},
    };`,
  }));
}

test('legacy path: no screening on file → Select Plan still routes into /pathfinder', async ({ page }) => {
  await page.goto('/select-tier');

  await expect(page.getByTestId('tier-screening-complete')).toHaveCount(0);
  await expect(page.getByTestId('tier-select-plan')).toHaveText(/select plan/i);

  await page.getByTestId('tier-select-plan').click();
  await page.waitForURL('**/pathfinder');
  await expect(page).toHaveURL(/\/pathfinder$/);
});

test('screening complete: Protocol Initialization → Select Plan fast-tracks straight to checkout', async ({ page }) => {
  await stubTurnstile(page);
  await seedEnvelope(page);

  await page.route('**/functions/v1/bbf-lead-capture', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' } });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true }) });
  });

  let checkoutCall = null;
  await page.route('**/functions/v1/bbf-create-checkout', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' } });
      return;
    }
    checkoutCall = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: true, url: '/burn?checkout=stub-session' }),
    });
  });

  // Drive the real funnel: guest sandbox → Break the Loop → Protocol Initialization.
  await page.goto('/explore');
  await page.getByTestId('explorer-break-open').click();
  await page.getByTestId('break-the-loop-cta').click();
  await page.waitForURL('**/protocol-init');

  // Biometrics arrive pre-seeded from the guest envelope — only identity +
  // goal + the liability waiver are left to fill.
  await expect(page.locator('#pf-age')).toHaveValue('30');
  await page.locator('#pf-name').fill('Explorer Test');
  await page.locator('#pf-email').fill('screened@test.fit');
  await page.locator('#pf-goal').selectOption('fat-loss');
  await page.locator('#pf-liability').check();
  await page.locator('button[type=submit]').click();

  // Intake success forwards the screening flag onward — no local success card,
  // straight to /select-tier.
  await page.waitForURL('**/select-tier');
  await expect(page.getByTestId('tier-screening-complete')).toBeVisible();
  await expect(page.getByTestId('tier-select-plan')).toHaveText(/proceed to secure checkout/i);

  // Select Plan mints checkout directly against the SAME normalized email —
  // no second Pathfinder pass.
  await page.getByTestId('tier-select-plan').click();
  await page.waitForURL('**/burn?checkout=stub-session');
  expect(checkoutCall?.email).toBe('screened@test.fit');
  expect(checkoutCall?.price_id).toBeTruthy();
});
