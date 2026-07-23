// e2e/hyperframe.spec.js — Studio V4 Kinetic Hyperframe render + wiring lock.
// Covers the native text-reel engine: (1) the ReelPreviewEngine hyperframe hero
// paints the brand card + big word-synced words + CTA (word-highlight visible at
// rest because the crafted captions start at t≈0), and (2) the Video Engine exposes
// the Hyperframe toggle, background picker, and the Creative Wizard "Auto-Draft"
// trigger. A regression that drops the layout or the controls fails loudly here.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

test.describe('Studio V4 — Kinetic Hyperframe', () => {
  test('hyperframe hero renders the brand card, hero words, active-word box and CTA', async ({ page }) => {
    await page.goto(`${HARNESS}?c=reel-hyperframe`);
    const hero = page.getByTestId('reel-hyperframe');
    await expect(hero).toBeVisible();
    // The current spoken phrase is the hero; the first word is lit at t≈0.
    const active = hero.locator('.reel-hf-word-v4.is-active');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveText('STOP');
    // Base (unlit) words render alongside it.
    await expect(hero.locator('.reel-hf-word-v4')).not.toHaveCount(1);
    // The CTA chip carries the derived call-to-action.
    await expect(hero.locator('.reel-hf-cta-v4')).toContainText('START TODAY');
  });

  test('Video Engine exposes the Hyperframe toggle, background picker and Creative Wizard', async ({ page }) => {
    await page.goto(`${HARNESS}?c=studio-v4`);
    await expect(page.getByTestId('harness-root')).toBeVisible();
    // Jump to the Video Engine (reel) surface.
    await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();

    // The Wizard trigger + the layout toggle are present.
    await expect(page.getByTestId('hyperframe-wizard')).toBeVisible();
    await expect(page.getByTestId('hyperframe-on')).toBeVisible();
    await expect(page.getByTestId('hyperframe-off')).toBeVisible();

    // The background picker is revealed once Hyperframe is enabled.
    await expect(page.getByTestId('hyperframe-bg')).toHaveCount(0);
    await page.getByTestId('hyperframe-on').click();
    await expect(page.getByTestId('hyperframe-bg')).toBeVisible();
    // All four brand backgrounds are offered.
    await expect(page.getByTestId('hyperframe-bg').locator('button')).toHaveCount(4);
  });
});
