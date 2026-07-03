// e2e/studio-v4-audio-mix.spec.js — Round-2 Defect 4: Studio V4 audio-mix toggle.
// Locks: the reel (Video Engine) sidebar exposes the audio-mix / ducking toggle, it is
// state-bound (defaults on), and toggling flips its state.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

async function openReel(page) {
  await page.goto(`${HARNESS}?c=studio-v4`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
  await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();
}

test.describe('Defect 4 — Studio V4 audio-mix toggle', () => {
  test('audio-mix toggle is present, defaults on, and is state-bound', async ({ page }) => {
    await openReel(page);
    const toggle = page.getByTestId('reel-audio-duck');
    await expect(toggle).toBeVisible();
    const box = toggle.locator('input[type="checkbox"]');
    await expect(box).toBeChecked(); // ducking defaults ON so music never overpowers voice
    await box.uncheck();
    await expect(box).not.toBeChecked();
    await expect(toggle).not.toHaveClass(/\bon\b/);
  });
});
