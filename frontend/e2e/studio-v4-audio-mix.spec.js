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

// Cross-device voiceover upload mocks. The client signs an upload slot at the
// asset-upload fn, then PUTs the bytes to the returned URL and adopts the durable
// public URL as voUrl. These stand in for real Supabase Storage.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, PUT, OPTIONS' };
const CLOUD_PUT_URL = 'https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/upload/sign/studio-audio-vault/user-uploads/mock-vo.wav?token=stub';
const CLOUD_PUBLIC_URL = 'https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/public/studio-audio-vault/user-uploads/mock-vo.wav';

// Mock the sign endpoint (+ the signed PUT when ok). ok:false → the client falls
// back to a session-local blob + IndexedDB (the offline path), deterministically
// and WITHOUT hitting the real function.
async function mockAssetUpload(page, { ok = true } = {}) {
  await page.route('**/functions/v1/bbf-studio-asset-upload', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
    if (!ok) { await route.fulfill({ status: 401, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: 'not_admin' }) }); return; }
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ ok: true, uploadUrl: CLOUD_PUT_URL, publicUrl: CLOUD_PUBLIC_URL, path: 'user-uploads/mock-vo.wav' }),
    });
  });
  if (ok) {
    await page.route(CLOUD_PUT_URL, (route) => route.fulfill({ status: 200, headers: CORS }));
  }
}

// Mock the caption transcription (ElevenLabs Scribe proxy) → a fixed word-timed
// transcript so the karaoke render is deterministic.
const CAPTION_WORDS = [
  { text: 'Bring', start: 0.0, end: 0.4 },
  { text: 'your', start: 0.4, end: 0.7 },
  { text: 'story', start: 0.7, end: 1.1 },
  { text: 'to', start: 1.1, end: 1.3 },
  { text: 'life', start: 1.3, end: 1.9 },
];
async function mockTranscribe(page) {
  await page.route('**/functions/v1/bbf-studio-transcribe', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ ok: true, text: 'Bring your story to life', words: CAPTION_WORDS }),
    });
  });
}

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

  test('Upload Voiceover loads a user file onto the voice channel (offline fallback)', async ({ page }) => {
    await mockAssetUpload(page, { ok: false }); // cloud sign fails → local blob fallback
    await page.goto(`${HARNESS}?c=studio-v4`);
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();

    // No voice element until a source is chosen (generate / vault / upload).
    const voiceEl = () => page.locator('audio[data-testid="reel-audio-voice"]');
    await expect(voiceEl()).toHaveCount(0);

    // Upload an ElevenLabs/Sovereign-style file → it mounts on the VOICE channel
    // immediately (instant blob preview) and the voice-volume binding applies.
    await page.getByTestId('reel-vo-upload-input').setInputFiles({
      name: 'elevenlabs-vo.wav', mimeType: 'audio/wav', buffer: silentWav(1000),
    });
    await expect(voiceEl()).toHaveCount(1);
    // Cloud sync failed → it stays the local blob (not a remote URL).
    await expect.poll(() => page.evaluate(() => document.querySelector('audio[data-testid="reel-audio-voice"]')?.getAttribute('src') || null))
      .toMatch(/^blob:/);
    await expect.poll(
      () => page.evaluate(() => document.querySelector('audio[data-testid="reel-audio-voice"]')?.volume ?? null),
    ).toBe(1);

    // The remove chip clears the voice channel (and revokes the blob).
    await page.getByTestId('reel-vo-upload-clear').click();
    await expect(voiceEl()).toHaveCount(0);
  });

  test('Upload Voiceover syncs to the cloud → voUrl becomes a durable cross-device URL', async ({ page }) => {
    await mockAssetUpload(page, { ok: true });
    await page.goto(`${HARNESS}?c=studio-v4`);
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();

    await page.getByTestId('reel-vo-upload-input').setInputFiles({
      name: 'elevenlabs-vo.wav', mimeType: 'audio/wav', buffer: silentWav(1000),
    });

    // Instant local preview, THEN the src swaps to the durable public URL once the
    // (mocked) cloud upload completes — that https URL is what follows the user
    // across devices, exactly like a generated voice.
    const voice = page.locator('audio[data-testid="reel-audio-voice"]');
    await expect(voice).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => document.querySelector('audio[data-testid="reel-audio-voice"]')?.getAttribute('src') || null))
      .toBe(CLOUD_PUBLIC_URL);
  });

  test('Generate Captions transcribes the voice → karaoke words render synced to playback', async ({ page }) => {
    await mockAssetUpload(page, { ok: false }); // keep the voice a local blob (fetchable for STT)
    await mockTranscribe(page);
    await page.goto(`${HARNESS}?c=studio-v4`);
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();

    // Captions need a voice — the button is disabled until one exists.
    await expect(page.getByTestId('reel-generate-captions')).toBeDisabled();

    await page.getByTestId('reel-vo-upload-input').setInputFiles({
      name: 'vo.wav', mimeType: 'audio/wav', buffer: silentWav(2000),
    });
    await expect(page.getByTestId('reel-generate-captions')).toBeEnabled();

    // Transcribe → captions stored, the show-captions toggle appears (auto-on).
    await page.getByTestId('reel-generate-captions').click();
    await expect(page.getByTestId('reel-captions-toggle')).toBeChecked();

    // Toggling OFF hides the overlay; ON brings it back.
    await page.getByTestId('reel-captions-toggle').uncheck();
    await expect(page.getByTestId('reel-caption')).toHaveCount(0);
    await page.getByTestId('reel-captions-toggle').check();

    // Drive the voice playhead into the first word → its phrase renders with the
    // active word lit.
    await page.evaluate(() => {
      const a = document.querySelector('audio[data-testid="reel-audio-voice"]');
      a.currentTime = 0.2;
      a.dispatchEvent(new Event('timeupdate'));
    });
    const cap = page.getByTestId('reel-caption');
    await expect(cap).toBeVisible();
    await expect(cap).toContainText('Bring');
    await expect(cap.locator('.cap-word-v4.is-active')).toHaveText('Bring');

    // Advance to the last word → the highlight moves to it.
    await page.evaluate(() => {
      const a = document.querySelector('audio[data-testid="reel-audio-voice"]');
      a.currentTime = 1.5;
      a.dispatchEvent(new Event('timeupdate'));
    });
    await expect(page.getByTestId('reel-caption').locator('.cap-word-v4.is-active')).toHaveText('life');
  });

  test('an uploaded voiceover survives a reload (IndexedDB rehydration, offline)', async ({ page }) => {
    await mockAssetUpload(page, { ok: false }); // no cloud → the on-device IndexedDB path
    await page.goto(`${HARNESS}?c=studio-v4`);
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();

    await page.getByTestId('reel-vo-upload-input').setInputFiles({
      name: 'my-elevenlabs-take.wav', mimeType: 'audio/wav', buffer: silentWav(1000),
    });
    await expect(page.locator('audio[data-testid="reel-audio-voice"]')).toHaveCount(1);

    // Wait for the debounced editor snapshot to flush the upload MARKER to
    // localStorage (the bytes are already in IndexedDB from the upload handler).
    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('bbf-studio-v4-editor-v1');
      return raw ? (JSON.parse(raw)?.reel?.voUploadName ?? null) : null;
    })).toBe('my-elevenlabs-take.wav');

    // Hard reload — the session's blob: URL is gone; only IndexedDB + the marker survive.
    await page.reload();
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();

    // The voice channel re-mints a FRESH blob from IndexedDB — the upload survived.
    const voice = page.locator('audio[data-testid="reel-audio-voice"]');
    await expect(voice).toHaveCount(1);
    expect(await voice.getAttribute('src')).toMatch(/^blob:/);
    // And the remove chip (driven by the persisted marker) is back too.
    await expect(page.getByTestId('reel-vo-upload-clear')).toBeVisible();
  });
});
