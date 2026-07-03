// e2e/coach-audio.spec.js — Defect 2: Coach audio lifecycle race.
// Locks: the FIRST tap plays even when the source URL resolves late (simulating the
// Supabase bucket / ElevenLabs handshake), and the "Coach audio unavailable." error
// never appears. Before the fix, tap 1 raced the empty <audio src> and reported the error.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

test.describe('Defect 2 — Coach audio lifecycle race', () => {
  test('first tap plays despite a delayed source resolve — no "unavailable" error', async ({ page }) => {
    await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, { delayMs: 400 });
    await page.goto(`${HARNESS}?c=coach-audio`);

    const btn = page.getByTestId('program-coach-audio');
    await expect(btn).toBeVisible();

    await btn.click(); // the single tap

    // Reaches a playing state on the first tap (readiness-gated play resolved the source
    // before initializing playback), and the error line never renders.
    await expect(btn).toHaveClass(/is-playing/);
    await expect(page.locator('.ca-err')).toHaveCount(0);
  });
});
