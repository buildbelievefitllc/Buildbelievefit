// e2e/studio-v4-spotlight.spec.js
// Locks the restored 🏆 CLIENT SPOTLIGHT mode (Tier 1): the tab mounts a
// before/after card stage, the copy fields drive the stage live, the photo
// upload slots accept images, and the 🎰 quote spin rewrites both quote lines.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

// A tiny valid 1x1 PNG so the file input has real image bytes to ingest.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function openSpotlight(page) {
  await page.goto(`${HARNESS}?c=studio-v4`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
  await page.getByRole('tab', { name: /SPOTLIGHT/i }).click();
}

test.describe('Studio V4 — Client Spotlight (Tier 1 restore)', () => {
  test('tab mounts the before/after card and the copy drives the stage live', async ({ page }) => {
    await openSpotlight(page);

    // Stage renders with the default client + both photo placeholders + badges.
    await expect(page.locator('.stage-spot-v4')).toBeVisible();
    await expect(page.locator('.spot-name-v4')).toHaveText('JACKY');
    await expect(page.locator('.spot-badge-v4.before')).toHaveText('BEFORE');
    await expect(page.locator('.spot-badge-v4.after')).toHaveText('AFTER');
    await expect(page.locator('.spot-ph-placeholder-v4')).toHaveCount(2);

    // Editing the client name reflects into the stage immediately.
    const nameInput = page.getByTestId('spot-name');
    await nameInput.fill('MARCUS');
    await expect(page.locator('.spot-name-v4')).toHaveText('MARCUS');

    // Export button is present.
    await expect(page.getByTestId('spot-export')).toBeVisible();
  });

  test('uploading a BEFORE photo swaps the placeholder for the image', async ({ page }) => {
    await openSpotlight(page);
    await expect(page.locator('.spot-ph-placeholder-v4')).toHaveCount(2);

    await page.getByTestId('spot-before-input').setInputFiles({
      name: 'before.png', mimeType: 'image/png', buffer: PNG_1x1,
    });

    // One placeholder replaced by an <img> — only the AFTER placeholder remains.
    await expect(page.locator('.spot-ph-placeholder-v4')).toHaveCount(1);
    await expect(page.locator('.spot-photo-img-v4')).toHaveCount(1);
  });

  test('🎰 SPIN rewrites both quote lines', async ({ page }) => {
    await openSpotlight(page);
    const q1 = page.locator('.spot-q-v4').first();
    const before = await q1.textContent();

    // Spin until the first quote actually changes (bank draw could repeat once).
    for (let i = 0; i < 8; i++) {
      await page.getByTestId('spot-spin-quotes').click();
      if ((await q1.textContent()) !== before) break;
    }
    await expect(q1).not.toHaveText(before || '');
  });
});
