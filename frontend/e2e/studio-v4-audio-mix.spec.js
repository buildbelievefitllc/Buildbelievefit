// e2e/studio-v4-audio-mix.spec.js — Hotfix 2: independent Voice + Music volume sliders.
// Locks: the reel sidebar exposes BOTH mix channels as range sliders, and each is
// state-bound to its OWN audio element's volume — the voice track and the backing
// track balance independently.

import { test, expect } from '@playwright/test';
import { silentWav } from './helpers/wav.js';

const HARNESS = '/e2e/harness/index.html';

test.describe('Hotfix 2 — independent Voice/Music volume sliders', () => {
  test('two sliders drive two separate gain values', async ({ page }) => {
    // The pre-rendered vault entries point at studio-audio-vault — serve a real clip.
    await page.route('**/studio-audio-vault/**', (route) => route.fulfill({
      status: 200, headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' }, body: silentWav(1000),
    }));

    await page.goto(`${HARNESS}?c=studio-v4`);
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();

    const music = page.getByTestId('reel-music-volume');
    const voice = page.getByTestId('reel-voice-volume');
    await expect(music).toBeVisible();
    await expect(voice).toBeVisible();
    await expect(music).toHaveValue('80');   // backing track defaults under the voice
    await expect(voice).toHaveValue('100');  // voice defaults full

    // Mount BOTH tracks: upload a music file + select a vault voiceover.
    await page.getByTestId('reel-music-input').setInputFiles({
      name: 'track.wav', mimeType: 'audio/wav', buffer: silentWav(1000),
    });
    await page.getByTestId('reel-vault-select').selectOption({ index: 1 });

    const vol = (testid) => page.evaluate(
      (id) => document.querySelector(`audio[data-testid="${id}"]`)?.volume ?? null, testid,
    );
    await expect.poll(() => vol('reel-audio-music')).toBe(0.8);
    await expect.poll(() => vol('reel-audio-voice')).toBe(1);

    // Independent channel control: move each slider, assert ONLY its element follows.
    await music.fill('25');
    await expect.poll(() => vol('reel-audio-music')).toBe(0.25);
    await expect.poll(() => vol('reel-audio-voice')).toBe(1);

    await voice.fill('60');
    await expect.poll(() => vol('reel-audio-voice')).toBe(0.6);
    await expect.poll(() => vol('reel-audio-music')).toBe(0.25);
  });
});
