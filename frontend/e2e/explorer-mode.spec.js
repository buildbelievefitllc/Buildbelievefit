// e2e/explorer-mode.spec.js — Conversion Upgrade: the Explorer Mode guest funnel.
// Drives the REAL app routes (not the harness): guest-token gating on /explore,
// the interactive macro wheel + Day-1 preview, the gold 'Break the Loop' portal
// modal → /select-tier redirect, and the calculator → token-mint gateway.

import { test, expect } from '@playwright/test';

const ENVELOPE = {
  token: 'xp-e2e-token',
  source: 'tdee_calculator',
  createdAt: Date.now(),
  profile: { age: 30, sex: 'male', weight_lbs: 180, height_ft: 5, height_in: 10, activity_factor: 1.55 },
  targets: { goal: 'maintain', tdee_maintenance: 2600, tdee_target: 2600, macro_p: 162, macro_c: 298, macro_f: 72 },
};

function seedEnvelope(page, envelope = ENVELOPE) {
  return page.addInitScript((env) => {
    localStorage.setItem('bbf.explorer.token.v1', JSON.stringify(env));
  }, envelope);
}

test('no guest token → /explore bounces back to the calculator entry', async ({ page }) => {
  await page.goto('/explore');
  await page.waitForURL('**/burn');
  await expect(page).toHaveURL(/\/burn$/);
});

test('guest sandbox renders the macro wheel + Day-1 preview, fully interactive', async ({ page }) => {
  await seedEnvelope(page);
  await page.goto('/explore');

  await expect(page.getByTestId('explorer-mode-chip')).toBeVisible();
  await expect(page.getByTestId('explorer-macro-wheel')).toBeVisible();

  // Interactive re-targeting: the SAME vault math recomputes live. Maintain →
  // protein rides the 0.9 g/lb cut/maintain coefficient (162 g at 180 lb);
  // switching to Build (surplus) lifts it to the 1.0 g/lb coefficient (180 g).
  await expect(page.getByTestId('explorer-macro-protein')).toHaveText('162g');
  await page.getByTestId('explorer-goal-gain').click();
  await expect(page.getByTestId('explorer-macro-protein')).toHaveText('180g');

  // Day-1 programming preview — static authorized catalog, expandable rows.
  await page.getByTestId('explorer-tab-day1').click();
  await expect(page.getByTestId('explorer-day1')).toBeVisible();
  const firstEx = page.getByTestId('explorer-ex-0');
  await expect(firstEx).toBeVisible();
  await firstEx.click(); // toggle (mounts expanded by default index 0 → closes)
  await expect(firstEx).toHaveAttribute('aria-expanded', 'false');
  await firstEx.click();
  await expect(firstEx).toHaveAttribute('aria-expanded', 'true');
});

test('deep layers are gated: locked tab → Break the Loop modal → /select-tier', async ({ page }) => {
  await seedEnvelope(page);
  await page.goto('/explore');

  await page.getByTestId('explorer-tab-chat').click();
  await expect(page.getByTestId('explorer-locked-chat')).toBeVisible();

  await page.getByTestId('explorer-locked-unlock').click();
  const modal = page.getByTestId('break-the-loop-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(/break the loop/i);

  // Dismiss keeps exploring; reopen from the always-visible header CTA.
  await page.getByTestId('break-the-loop-close').click();
  await expect(modal).toHaveCount(0);
  await page.getByTestId('explorer-break-open').click();
  await expect(page.getByTestId('break-the-loop-modal')).toBeVisible();

  // The gold CTA routes into the existing application funnel.
  await page.getByTestId('break-the-loop-cta').click();
  await page.waitForURL('**/select-tier');
  await expect(page).toHaveURL(/\/select-tier$/);
});

test('calculator capture mints the guest token and surfaces the Explorer CTA', async ({ page }) => {
  // Headless Turnstile stub — the real Cloudflare widget cannot issue tokens in
  // CI; the stub honors the render/execute/callback contract useTurnstile drives.
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.turnstile = {
      render: (el, opts) => { window.__ts_cb = opts.callback; return 'w1'; },
      reset: () => {},
      execute: () => { setTimeout(() => window.__ts_cb && window.__ts_cb('e2e-turnstile-token'), 0); },
      remove: () => {},
    };`,
  }));
  // Same lead-capture mock contract as tdee-lead-capture.spec.js.
  await page.route('**/functions/v1/bbf-lead-capture', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' } });
      return;
    }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: true, source: 'tdee_calculator' }),
    });
  });
  await page.goto('/e2e/harness/index.html?c=tdee-calculator');

  await page.locator('input[type=number]').first().fill('30');
  await page.locator('input[type=number]').nth(1).fill('180');
  await page.locator('input[type=number]').nth(2).fill('5');
  await page.getByRole('button', { name: /calculate/i }).click();
  await expect(page.getByText(/kcal\/day/i)).toBeVisible();

  const form = page.getByRole('form', { name: 'Save your results' });
  await form.locator('input[type=text]').fill('Explorer Test');
  await form.locator('input[type=email]').fill('explorer@test.fit');
  await form.getByRole('button', { name: /email me this|sending/i }).click();

  // The moment the details land: guest token minted + the gold gateway appears.
  await expect(page.getByTestId('enter-explorer')).toBeVisible();
  const envelope = await page.evaluate(() => JSON.parse(localStorage.getItem('bbf.explorer.token.v1') || 'null'));
  expect(envelope?.token).toBeTruthy();
  expect(envelope?.source).toBe('tdee_calculator');
  expect(envelope?.targets?.tdee_target).toBeGreaterThan(0);
});
