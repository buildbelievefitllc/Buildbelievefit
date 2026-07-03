// e2e/studio-batch.spec.js — Defect 3: Studio Batch admin/founder access gate.
// Locks: the founder/admin ROLE claim (isAdmin) unlocks the compile utilities even with
// no admin token hydrated; a non-admin session stays locked.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

async function mount(page, props) {
  await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, props);
  await page.goto(`${HARNESS}?c=studio-batch`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
}

test.describe('Defect 3 — Studio Batch admin/founder gate', () => {
  test('admin/founder role unlocks the compile utilities', async ({ page }) => {
    await mount(page, { isAdmin: true, user: { username: 'akeem', role: 'admin' } });
    await expect(page.locator('.st-locked')).toHaveCount(0);
    await expect(page.locator('.st-compile')).toBeVisible();
  });

  test('non-admin session stays locked', async ({ page }) => {
    await mount(page, { isAdmin: false, user: { username: 'client', role: 'client' } });
    await expect(page.locator('.st-locked')).toBeVisible();
    await expect(page.locator('.st-compile')).toHaveCount(0);
  });
});
