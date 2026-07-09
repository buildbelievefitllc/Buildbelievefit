// e2e/sovereign-prep-video.spec.js — Sovereign Prep demo video de-bloat.
// Locks the collapsed-row aesthetic (Video Vault pattern) replacing the old
// always-mounted inline thumbnail: no video iframe/thumbnail exists on the page
// until WATCH or PREVIEW is pressed, both open the SAME in-app mini-player
// pop-up (never a new tab), WATCH autoplays and PREVIEW does not, and a card
// with no matching demo renders no video row at all.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

test.describe('Sovereign Prep — collapsed demo row + mini-player pop-up', () => {
  test('nothing streams until tapped; WATCH opens an autoplay pop-up', async ({ page }) => {
    await page.goto(`${HARNESS}?c=sovereign-prep-panels`);

    const row = page.getByTestId('sp-video-row');
    await expect(row).toBeVisible();
    // Zero-bloat contract: no iframe/embed anywhere on the page pre-tap.
    await expect(page.locator('iframe')).toHaveCount(0);

    await row.getByTestId('sp-watch').click();
    const modal = page.getByTestId('sp-video-modal');
    await expect(modal).toBeVisible();
    const frame = page.locator('.sp-modal-frame');
    await expect(frame).toHaveAttribute('src', /autoplay=1/);
    // stat_calf_001's top-quality EN video (data/recoveryVideos.js) resolves to this id.
    await expect(frame).toHaveAttribute('src', /mtVqe4CR_60/);

    // Esc closes it — the athlete never leaves the page.
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('PREVIEW opens the same pop-up without autoplay', async ({ page }) => {
    await page.goto(`${HARNESS}?c=sovereign-prep-panels`);

    await page.getByTestId('sp-preview').click();
    const frame = page.locator('.sp-modal-frame');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', /autoplay=0/);

    // Backdrop click also closes it.
    await page.getByTestId('sp-video-modal').click({ position: { x: 4, y: 4 } });
    await expect(page.getByTestId('sp-video-modal')).toHaveCount(0);
  });

  test('a card with no matching demo renders no video row', async ({ page }) => {
    await page.goto(`${HARNESS}?c=sovereign-prep-panels`);
    // The Tissue Release phase (foam_rolling) holds the undemoed item — switch to it.
    await page.getByTestId('sp-tab-release').click();
    await expect(page.getByTestId('sp-card')).toContainText('Undemoed Movement');
    await expect(page.getByTestId('sp-video-row')).toHaveCount(0);
  });
});
