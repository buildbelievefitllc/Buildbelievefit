// e2e/studio-v4-panels.spec.js — Defect 4: restored Studio V4 reel customization panels.
// Locks: the reel (Video Engine) sidebar exposes the custom music upload, the overlay
// text-layout toggle, and the asset-size slider — and the toggle is genuinely wired.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

async function openReel(page) {
  await page.goto(`${HARNESS}?c=studio-v4`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
  await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();
}

test.describe('Defect 4 — Studio V4 reel panels restored', () => {
  test('reel sidebar exposes music upload, layout toggle, and asset-size slider', async ({ page }) => {
    await openReel(page);

    // (1) custom music upload input (hidden native input + visible label).
    // Accepts VIDEO too: on mobile that opens the same gallery picker as the
    // footage upload, and the clip's soundtrack rides the music channel.
    const music = page.getByTestId('reel-music-input');
    await expect(music).toHaveCount(1);
    await expect(music).toHaveAttribute('accept', /audio/);
    await expect(music).toHaveAttribute('accept', /video/);
    await expect(page.getByText('UPLOAD MUSIC')).toBeVisible();

    // (2) overlay text layout toggle
    const layout = page.getByTestId('reel-text-layout');
    await expect(layout).toBeVisible();
    await expect(layout.getByRole('button', { name: 'CENTER' })).toBeVisible();

    // (3) asset size slider
    const slider = page.getByTestId('reel-logo-size');
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute('type', 'range');
  });

  test('layout toggle is wired (activates the chosen anchor)', async ({ page }) => {
    await openReel(page);
    const center = page.getByTestId('reel-text-layout').getByRole('button', { name: 'CENTER' });
    await center.click();
    await expect(center).toHaveClass(/active/);
  });
});
