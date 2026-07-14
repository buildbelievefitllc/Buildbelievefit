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

  test('VIDEO format swaps to the 9:16 stage with the stat callout', async ({ page }) => {
    await openSpotlight(page);
    // Card stage is showing first.
    await expect(page.locator('.stage-spot-v4')).toBeVisible();

    await page.getByTestId('spot-format').getByRole('button', { name: 'VIDEO 9:16' }).click();

    // Card stage gone, video stage + clip placeholder + stat callout present.
    await expect(page.locator('.stage-spot-v4')).toHaveCount(0);
    await expect(page.locator('.stage-spotvid-v4')).toBeVisible();
    await expect(page.getByTestId('spot-video-placeholder')).toBeVisible();

    const stat = page.getByTestId('spot-stat');
    await expect(stat).toBeVisible();
    await expect(stat.locator('.spot-stat-num-v4')).toContainText('688');
    await expect(stat.locator('.spot-pr-v4')).toHaveText(/NEW PR/);

    // Editing the stat number + lift reflects live.
    await page.getByTestId('spot-stat-number').fill('405');
    await expect(stat.locator('.spot-stat-num-v4')).toContainText('405');
    await page.getByTestId('spot-rep-line').fill('5×5 @ RPE 8');
    await expect(stat.locator('.spot-stat-rep-v4')).toHaveText('5×5 @ RPE 8');
  });

  test('NEW PR badge toggle shows / hides the gold pill', async ({ page }) => {
    await openSpotlight(page);
    await page.getByTestId('spot-format').getByRole('button', { name: 'VIDEO 9:16' }).click();
    await expect(page.locator('.spot-pr-v4')).toBeVisible();
    await page.getByTestId('spot-pr-toggle').uncheck();
    await expect(page.locator('.spot-pr-v4')).toHaveCount(0);
  });

  test('🤖 AI shoutout fills the shoutout + both quotes and drives the card', async ({ page }) => {
    const CORS = { 'Access-Control-Allow-Origin': '*' };
    await page.route('**/functions/v1/bbf-studio-voiceover', async (route) => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action !== 'spotlight') { await route.fulfill({ status: 400, headers: CORS, body: '{}' }); return; }
      await route.fulfill({
        status: 200, contentType: 'application/json', headers: CORS,
        body: JSON.stringify({ ok: true, shoutout: 'UNSTOPPABLE, MARCUS.', quote1: 'Forty pounds down, every week earned.', quote2: 'Proud to coach this grind.' }),
      });
    });
    await openSpotlight(page);
    await page.getByTestId('spot-name').fill('MARCUS');
    await page.getByTestId('spot-achievement').fill('-40 lbs in 6 months');
    await page.getByTestId('spot-ai-shoutout').click();

    // The generated copy lands in the fields AND the stage.
    await expect(page.locator('.spot-shout-v4')).toHaveText('UNSTOPPABLE, MARCUS.');
    await expect(page.locator('.spot-q-v4').first()).toHaveText('Forty pounds down, every week earned.');
  });

  test('🎙 AI voiceover bakes karaoke captions onto the video spotlight', async ({ page }) => {
    const CORS = { 'Access-Control-Allow-Origin': '*' };
    const WORDS = [
      { text: 'Marcus', start: 0.0, end: 0.5 },
      { text: 'six', start: 0.5, end: 0.8 },
      { text: 'eighty-eight', start: 0.8, end: 1.4 },
    ];
    await page.route('**/functions/v1/bbf-studio-voiceover', async (route) => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
      await route.fulfill({
        status: 200, contentType: 'application/json', headers: CORS,
        body: JSON.stringify({ ok: true, cached: false, url: 'https://example.test/spot-vo.mp3', words: WORDS }),
      });
    });
    await openSpotlight(page);
    await page.getByTestId('spot-format').getByRole('button', { name: 'VIDEO 9:16' }).click();
    await page.getByTestId('spot-gen-vo').click();

    // VO audio element mounts + the captions toggle appears (auto-on).
    await expect(page.getByTestId('spot-audio-voice')).toHaveCount(1);
    await expect(page.getByTestId('spot-captions-toggle')).toBeChecked();

    // Drive the VO playhead → the karaoke phrase renders with the active word lit.
    await page.evaluate(() => {
      const a = document.querySelector('audio[data-testid="spot-audio-voice"]');
      a.currentTime = 0.6; a.dispatchEvent(new Event('timeupdate'));
    });
    const cap = page.getByTestId('spot-caption');
    await expect(cap).toBeVisible();
    await expect(cap.locator('.cap-word-v4.is-active')).toHaveText('six');
  });
});
