// e2e/cardio-baseline.spec.js — Round-2 Defect 2: blank Cardio Prescription block.
// Locks: a live prescription row with unfilled numerics still renders the baseline
// cardio targets from the payload (field-level coalesce) instead of "— kcal" / "—".

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

const DEFAULTS = {
  cardio: {
    effective_tier: 'Zone 2', recovery_state: 'unknown', duration_min: 30,
    ee_kcal_est: 257, sweat_loss_g_est: 367, rehydration_g: 551, work_rest_ratio: null,
  },
};

async function mount(page, data, defaults) {
  await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, { data, defaults });
  await page.goto(`${HARNESS}?c=cardio`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
}

test.describe('Defect 2 — blank Cardio Prescription', () => {
  test('live row with null numerics → baseline values fill in (no blanks)', async ({ page }) => {
    // A prescription row exists but its numeric targets are unfilled — must NOT blank out.
    await mount(page, {
      effective_tier: 'Zone 2', recovery_state: 'clear',
      ee_kcal_est: null, duration_min: null, sweat_loss_g_est: null, rehydration_g: null,
    }, DEFAULTS);
    // Energy metric (first tile) resolves to the baseline 257, not an em-dash.
    await expect(page.locator('.hub-card--cardio .hub-metric-value').first()).toContainText('257');
    // Duration on the hero rail resolves to the baseline 30, not "—".
    await expect(page.locator('.hub-card--cardio .hub-rail-v').first()).toContainText('30');
    await expect(page.locator('.hub-card--cardio .hub-rail-v').first()).not.toContainText('—');
  });

  test('no live row, defaults present → baseline values render', async ({ page }) => {
    await mount(page, null, DEFAULTS);
    await expect(page.locator('.hub-card--cardio .hub-metric-value').first()).toContainText('257');
    await expect(page.locator('.hub-card--cardio .hub-rail-v').first()).toContainText('30');
  });
});
