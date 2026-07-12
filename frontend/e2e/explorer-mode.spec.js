// e2e/explorer-mode.spec.js — Conversion Upgrade: the Explorer Mode guest funnel.
// Drives the REAL app routes (not the harness): guest-token gating on /explore,
// the interactive macro wheel + Day-1 preview, the gold 'Break the Loop' portal
// modal → /protocol-init (screening-first) → /select-tier, and the calculator
// → token-mint gateway.

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

  // The Fuel pane is now the premium Nutrition Locker clone — plan banner +
  // wheel + target legend + fasting pace card (16/8 default) all mount.
  await expect(page.getByTestId('explorer-fuel-dashboard')).toBeVisible();
  await expect(page.getByTestId('explorer-fasting-card')).toBeVisible();
  await expect(page.getByTestId('explorer-pace-16-8')).toHaveAttribute('aria-checked', 'true');

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

test('the 4-tab deck has no locked panels; the conversion portal is always one tap away', async ({ page }) => {
  await seedEnvelope(page);
  await page.goto('/explore');

  // Live Coach Chat is retired — exactly 4 tabs, all open previews.
  await expect(page.getByTestId('explorer-tab-chat')).toHaveCount(0);
  for (const id of ['fuel', 'day1', 'sync', 'audio']) {
    await expect(page.getByTestId(`explorer-tab-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId(/^explorer-locked-/)).toHaveCount(0);

  // The header 'Break the Loop' button opens the SAME portal modal from any tab.
  const modal = page.getByTestId('break-the-loop-modal');
  await page.getByTestId('explorer-break-open').click();
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(/unlock full protocol/i);

  // Dismiss keeps exploring; reopen, then the Sync-panel upsell note opens it too.
  await page.getByTestId('break-the-loop-close').click();
  await expect(modal).toHaveCount(0);
  await page.getByTestId('explorer-tab-sync').click();
  await page.getByTestId('explorer-sync-upsell').click();
  await expect(modal).toBeVisible();
});

test('Break the Loop routes into Protocol Initialization, biometrics forwarded', async ({ page }) => {
  await seedEnvelope(page);
  await page.goto('/explore');

  await page.getByTestId('explorer-break-open').click();
  await page.getByTestId('break-the-loop-cta').click();
  await page.waitForURL('**/protocol-init');
  await expect(page).toHaveURL(/\/protocol-init$/);

  // The intake is the REAL Pathfinder form, pre-seeded from the guest envelope
  // (profile.age: 30) — nothing the visitor already gave gets re-asked.
  await expect(page.getByRole('heading', { name: /protocol/i })).toBeVisible();
  await expect(page.locator('#pf-age')).toHaveValue('30');
});

test('Biometric Sync renders the read-only Client Hub Check-In preview', async ({ page }) => {
  await seedEnvelope(page);
  await page.goto('/explore');

  await page.getByTestId('explorer-tab-sync').click();
  const preview = page.getByTestId('explorer-sync-preview');
  await expect(preview).toBeVisible();

  // Fixed visual verdict: 89 · Prime Execution, ×1.00 volume.
  await expect(page.getByTestId('explorer-sync-score')).toHaveText('89');
  await expect(page.getByTestId('explorer-sync-mode')).toHaveText(/prime execution/i);

  // Manual tracking sliders are present and purely local — dragging changes the
  // readout, the fixed readiness verdict never moves (nothing computes).
  const sleepQ = page.getByTestId('explorer-sync-sleep-q');
  await expect(sleepQ).toBeVisible();
  await sleepQ.fill('4');
  await expect(page.getByTestId('explorer-sync-score')).toHaveText('89');

  // The Save CTA is the conversion portal, not a write.
  await page.getByTestId('explorer-sync-save').click();
  await expect(page.getByTestId('break-the-loop-modal')).toBeVisible();
});

test('Coach Audio embeds the Breaking the Loop masterclass players (trilingual)', async ({ page }) => {
  await seedEnvelope(page);
  await page.goto('/explore');

  await page.getByTestId('explorer-tab-audio').click();
  await expect(page.getByTestId('explorer-audio')).toBeVisible();

  // The ACTUAL CoachVoiceNote containers mount — one per masterclass essay —
  // each carrying a locale-keyed static MP3 source (EN by default).
  for (const module of ['primer', 'fuel', 'flush']) {
    const player = page.getByTestId(`coach-voice-${module}`);
    await expect(player).toBeVisible();
    const src = await player.locator('audio').getAttribute('src');
    expect(src).toBe(`/audio/coach-edu/${module}.en.mp3`);
  }
});

test('/burn trilingual entrance localizes the calculator through LangContext', async ({ page }) => {
  await page.goto('/burn');

  // EN ground truth renders by default.
  await expect(page.getByRole('heading', { name: 'What Does Your Body Burn?' })).toBeVisible();

  // ES flips the full surface instantly (native translation maps, no reload).
  await page.getByTestId('burn-lang-es').click();
  await expect(page.getByRole('heading', { name: '¿Cuánto Quema Tu Cuerpo?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /ver mis números/i })).toBeVisible();

  // PT too — and the choice persists through the app-wide LangContext key.
  await page.getByTestId('burn-lang-pt').click();
  await expect(page.getByRole('heading', { name: 'Quanto Seu Corpo Queima?' })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('bbf_lang'));
  expect(stored).toBe('pt');
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
