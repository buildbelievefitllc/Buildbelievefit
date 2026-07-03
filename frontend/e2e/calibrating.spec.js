// e2e/calibrating.spec.js — Defect 1: the "Calibrating" badge race condition.
// Locks: a hydrated payload carrying tier defaults must NOT wear the Calibrating chip
// just because the historical daily row is empty; a truly empty payload still does.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

const DEFAULTS = {
  nutrition: { tier: 'foundation', tdee_kcal: 2765, protein_g: 180, carbs_g: 320, fat_g: 85, day_type: 'standard' },
  cardio: {
    effective_tier: 'Zone 2', recovery_state: 'unknown', duration_min: 30,
    ee_kcal_est: 257, sweat_loss_g_est: 367, rehydration_g: 551, work_rest_ratio: null,
  },
};

async function mount(page, c, props) {
  await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, props || {});
  await page.goto(`${HARNESS}?c=${c}`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
}

test.describe('Defect 1 — Calibrating badge race', () => {
  test('nutrition: hydrated defaults present → NO calibrating chip, metrics visible', async ({ page }) => {
    await mount(page, 'nutrition', { data: null, defaults: DEFAULTS });
    await expect(page.locator('.hub-cal-chip')).toHaveCount(0);
    await expect(page.locator('.hub-card--nutrition')).not.toHaveClass(/is-calibrating/);
    await expect(page.locator('.hub-card--nutrition .hub-card-tier')).toBeVisible();
    await expect(page.locator('.hub-card--nutrition .hub-metric-value').first()).toContainText('180');
  });

  test('nutrition: empty payload (no data, no defaults) → calibrating chip shows', async ({ page }) => {
    await mount(page, 'nutrition', { data: null, defaults: null });
    await expect(page.locator('.hub-cal-chip')).toHaveCount(1);
    await expect(page.locator('.hub-card--nutrition')).toHaveClass(/is-calibrating/);
  });

  test('cardio: hydrated defaults present → NO calibrating chip', async ({ page }) => {
    await mount(page, 'cardio', { data: null, defaults: DEFAULTS });
    await expect(page.locator('.hub-cal-chip')).toHaveCount(0);
    await expect(page.locator('.hub-card--cardio')).not.toHaveClass(/is-calibrating/);
  });

  test('cardio: empty payload → calibrating chip shows', async ({ page }) => {
    await mount(page, 'cardio', { data: null, defaults: null });
    await expect(page.locator('.hub-cal-chip')).toHaveCount(1);
    await expect(page.locator('.hub-card--cardio')).toHaveClass(/is-calibrating/);
  });
});
