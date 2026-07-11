// e2e/media-portal.spec.js — BBF Media Portal (4K HeyGen module guides).
// Locks the dual-media mixer: the TierGate-gated [ Watch Guide ] / [ Listen Only ]
// launcher opens the matte-black portal, switches cleanly between the 4K video
// stage and the audio-only wavelength stage (video container unmounts in Listen
// mode), and closes. Drives the REAL GuideLauncher + BbfMediaPortal + TierGate via
// the harness — not a reimplementation.
//
// The real 4K MP4s are 70–90 MB and now live in Supabase Storage (public bucket
// `bbf-media-vault/guides`), not the local public dir; we intercept that external
// bucket route so playback is never actually fetched — this spec asserts the DOM
// contract, not decode, and stays fully offline (no live Supabase round-trip).

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

test.describe('BBF Media Portal — dual-media mixer', () => {
  test.beforeEach(async ({ page }) => {
    // Keep the heavy 4K assets off the wire — intercept the Supabase Storage bucket
    // route (bbf-media-vault/guides) so the elements mount without a live fetch.
    await page.route('**/storage/v1/object/public/**', (route) =>
      route.fulfill({ status: 200, contentType: 'video/mp4', body: '' }));
  });

  test('launcher opens the portal, switches Watch ⇄ Listen, and closes', async ({ page }) => {
    await page.goto(`${HARNESS}?c=guide-launcher`);

    // Both triggers render (TierGate fail-opens for a validated/soft account).
    const watchBtn = page.getByTestId('guide-watch');
    const listenBtn = page.getByTestId('guide-listen');
    await expect(watchBtn).toBeVisible();
    await expect(listenBtn).toBeVisible();

    // ── Open in Watch mode → the 4K video stage mounts, audio stage does not. ──
    await watchBtn.click();
    const portal = page.getByTestId('bmp-portal');
    await expect(portal).toBeVisible();
    await expect(page.getByTestId('bmp-video-stage')).toBeVisible();
    await expect(page.getByTestId('bmp-video')).toHaveCount(1);
    await expect(page.getByTestId('bmp-audio-stage')).toHaveCount(0);

    // ── Switch to Listen Only → video container unmounts; wavelength + audio show. ──
    await page.getByTestId('bmp-mode-listen').click();
    await expect(page.getByTestId('bmp-audio-stage')).toBeVisible();
    await expect(page.getByTestId('bmp-audio')).toHaveCount(1);
    await expect(page.getByTestId('bmp-video-stage')).toHaveCount(0);
    await expect(page.locator('.bmp-wave-bar')).toHaveCount(7);

    // ── Switch back to Watch → video returns, audio container unmounts. ──
    await page.getByTestId('bmp-mode-watch').click();
    await expect(page.getByTestId('bmp-video-stage')).toBeVisible();
    await expect(page.getByTestId('bmp-audio-stage')).toHaveCount(0);

    // ── Close via the ✕ → portal is gone. ──
    await page.getByTestId('bmp-close').click();
    await expect(page.getByTestId('bmp-portal')).toHaveCount(0);
  });

  test('Listen Only trigger opens the portal directly in audio mode', async ({ page }) => {
    await page.goto(`${HARNESS}?c=guide-launcher`);

    await page.getByTestId('guide-listen').click();
    await expect(page.getByTestId('bmp-portal')).toBeVisible();
    // Opened straight into the audio-only stage — no video fetch.
    await expect(page.getByTestId('bmp-audio-stage')).toBeVisible();
    await expect(page.getByTestId('bmp-video-stage')).toHaveCount(0);

    // Backdrop click closes it (the athlete never leaves the page).
    await page.getByTestId('bmp-portal').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('bmp-portal')).toHaveCount(0);
  });
});
