// e2e/studio-v4-audio-mix.spec.js — Mandate 4: the Studio V4 music-volume slider.
// Locks: the reel sidebar exposes a 0–100% range slider (the boolean duck checkbox is
// gone), and its state binds DIRECTLY to the preview audio element's volume property.

import { test, expect } from '@playwright/test';
import { silentWav } from './helpers/wav.js';

const HARNESS = '/e2e/harness/index.html';

test.describe('Mandate 4 — Studio V4 volume slider', () => {
  test('slider replaces the checkbox and drives audio.volume exactly', async ({ page }) => {
    await page.goto(`${HARNESS}?c=studio-v4`);
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();

    // The old boolean checkbox is gone; the range slider is present, default 80%.
    await expect(page.getByTestId('reel-audio-duck')).toHaveCount(0);
    const slider = page.getByTestId('reel-music-volume');
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute('type', 'range');
    await expect(slider).toHaveValue('80');

    // Load a custom track → the preview audio element mounts with the slider's level.
    await page.getByTestId('reel-music-input').setInputFiles({
      name: 'track.wav', mimeType: 'audio/wav', buffer: silentWav(1000),
    });
    const volume = () => page.evaluate(() => {
      const a = document.querySelector('.stage-reel-v4 audio');
      return a ? a.volume : null;
    });
    await expect.poll(volume).toBe(0.8);

    // Dragging the slider re-binds the element volume exactly (0.3, then mute).
    await slider.fill('30');
    await expect(slider).toHaveValue('30');
    await expect.poll(volume).toBe(0.3);
    await slider.fill('0');
    await expect.poll(volume).toBe(0);
  });
});
