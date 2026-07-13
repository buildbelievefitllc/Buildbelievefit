// e2e/studio-v4-audio-mix.spec.js — Hotfix 2: independent Voice + Music volume sliders.
// Locks: the reel sidebar exposes BOTH mix channels as range sliders, and each is
// state-bound to its OWN audio element's volume — the voice track and the backing
// track balance independently.
//
// Clip Volume addendum: a THIRD channel governs the uploaded footage's OWN baked-in
// audio (prebaked music), bound to the preview <video> element so it can sit under a
// voiceover — the same slider feeds the export's ducked footage-audio channel.

import { test, expect } from '@playwright/test';
import { silentWav } from './helpers/wav.js';

const HARNESS = '/e2e/harness/index.html';

// A minimal fake MP4 blob — the Clip Volume binding sets video.volume directly and
// never needs the footage to actually decode, so any buffer stands in for footage.
const FAKE_MP4 = Buffer.from('00000020667479706d70343200000000', 'hex');

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

  test('Clip Volume slider drives the uploaded footage video element', async ({ page }) => {
    await page.goto(`${HARNESS}?c=studio-v4`);
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();

    const clip = page.getByTestId('reel-footage-volume');
    await expect(clip).toBeVisible();
    await expect(clip).toHaveValue('100'); // clip audio defaults to full — feature it until dialed down

    // Upload footage → the preview <video> (.reel-video-v4) mounts and the Clip
    // Volume binding applies to its own audio track.
    await page.locator('#reel-video-input').setInputFiles({
      name: 'clip.mp4', mimeType: 'video/mp4', buffer: FAKE_MP4,
    });
    const videoVol = () => page.evaluate(() => document.querySelector('video.reel-video-v4')?.volume ?? null);
    await expect.poll(videoVol).toBe(1);

    // Dial the clip's baked-in sound down under a voiceover — only the video
    // element follows; it's an independent third channel.
    await clip.fill('30');
    await expect.poll(videoVol).toBe(0.3);

    await clip.fill('0'); // 0% fully mutes the clip's own audio
    await expect.poll(videoVol).toBe(0);
  });
});
