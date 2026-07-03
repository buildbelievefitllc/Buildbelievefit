// e2e/audio-brief-state.spec.js — Round-2 Defect 1: Audio Brief state mismatch.
// Locks: the Hub Audio Brief card drops the "Calibrating" badge the moment the payload
// carries a playable brief (fragments / runtime / ready status); an absent or empty-stub
// brief still calibrates.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

async function mount(page, data) {
  await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, { data });
  await page.goto(`${HARNESS}?c=audio-brief`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
}

test.describe('Defect 1 — Audio Brief state mismatch', () => {
  test('playable brief in payload → NO calibrating badge', async ({ page }) => {
    await mount(page, { tone: 'grounded', total_duration_ms: 42000, status: 'ready', fragment_count: 5 });
    await expect(page.locator('.hub-cal-chip')).toHaveCount(0);
    await expect(page.locator('.hub-card--brief')).not.toHaveClass(/is-calibrating/);
    await expect(page.locator('.hub-card--brief')).toContainText('5'); // fragment count rendered
  });

  test('brief with fragments but no duration → still drops the badge', async ({ page }) => {
    await mount(page, { tone: 'grounded', total_duration_ms: 0, status: 'stitching', fragment_count: 3 });
    await expect(page.locator('.hub-cal-chip')).toHaveCount(0);
  });

  test('absent brief → calibrating badge shows', async ({ page }) => {
    await mount(page, null);
    await expect(page.locator('.hub-cal-chip')).toHaveCount(1);
    await expect(page.locator('.hub-card--brief')).toHaveClass(/is-calibrating/);
  });

  test('empty stub (0 fragments, calibrating status) → still calibrating', async ({ page }) => {
    await mount(page, { status: 'calibrating', fragment_count: 0, total_duration_ms: 0 });
    await expect(page.locator('.hub-cal-chip')).toHaveCount(1);
  });
});
