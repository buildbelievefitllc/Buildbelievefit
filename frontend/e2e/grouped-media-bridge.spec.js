// e2e/grouped-media-bridge.spec.js — Grouped Media Pass: the Studio V4 bridge.
// Locks the one-shot handoff (lib/studioInbox.js) that carries an asset from the
// Marketing Vault or the Review Bucket into the Studio V4 Video Engine across the
// Command Center's per-tab remount boundary:
//   • Marketing Vault "Send to Studio V4 Engine" writes the inbox + navigates.
//   • Review Bucket "Send to Studio V4 Engine" writes the inbox + navigates.
//   • Studio V4 CONSUMES the inbox on mount (reel mode, footage, hook, banner) and
//     CLEARS it, so a reload can never replay a stale handoff.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const INBOX_KEY = 'bbf-studio-v4-inbox-v1';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

// Read the studio handoff inbox from the page's localStorage.
const readInbox = (page) => page.evaluate((key) => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}, INBOX_KEY);

// Serve the Marketing Vault's content_vault REST read with fixture rows (no live DB).
async function mockContentVault(page, rows) {
  await page.route('**/rest/v1/content_vault*', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(rows) });
  });
}

// Keep the Review Bucket's calendar list fetch from erroring (it doesn't gate the
// bucket, but a clean empty list keeps the panel quiet).
async function mockContentQueueList(page) {
  await page.route('**/functions/v1/bbf-content-manager', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, items: [] }) });
  });
}

const seedToken = (page) => page.addInitScript(() =>
  localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' })));

test.describe('Grouped Media Pass — Studio V4 bridge handoff', () => {
  test('Marketing Vault "Send to Studio V4 Engine" writes the inbox and navigates', async ({ page }) => {
    await mockContentVault(page, [{
      id: 'cv1', title: 'Squat PR Reel', video_url: 'https://cdn.example/clip1.mp4',
      caption_body: 'Big lift.', status: 'staged', platform_targets: ['instagram'],
      bgm_source_url: null, created_at: '2026-07-20T00:00:00Z',
    }]);

    await page.goto(`${HARNESS}?c=content-vault`);
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await expect(page.getByTestId('content-vault-grid')).toBeVisible();

    const card = page.getByTestId('vault-card-cv1');
    await expect(card).toBeVisible();
    await card.getByTestId('vault-studio-cv1').click();

    // The durable CDN video URL + provenance rode the inbox (never a blob: URL).
    const inbox = await readInbox(page);
    expect(inbox).toBeTruthy();
    expect(inbox.mode).toBe('reel');
    expect(inbox.videoUrl).toBe('https://cdn.example/clip1.mp4');
    expect(inbox.source).toBe('marketing-vault');
    expect(inbox.hook).toBe('Squat PR Reel');

    // And the bridge navigated to the Studio V4 Video Engine route.
    await expect(page.getByTestId('probe-location')).toHaveAttribute('data-path', '/command/studio-v4');
  });

  test('Studio V4 consumes a bridged handoff on mount (reel + footage + hook + banner) and clears it', async ({ page }) => {
    // Seed the inbox BEFORE the app mounts — addInitScript runs before page scripts.
    // Guard on sessionStorage (survives reload) so the seed fires ONCE: the reload
    // below must find an already-consumed inbox, not a freshly re-seeded one.
    await page.addInitScript((key) => {
      if (sessionStorage.getItem('__bridge_seeded__')) return;
      sessionStorage.setItem('__bridge_seeded__', '1');
      localStorage.setItem(key, JSON.stringify({
        mode: 'reel',
        videoUrl: 'https://cdn.example/bridged.mp4',
        hook: 'BRIDGED HOOK',
        source: 'marketing-vault',
        sourceLabel: 'Squat PR Reel',
        ts: Date.now(),
      }));
    }, INBOX_KEY);

    await page.goto(`${HARNESS}?c=studio-v4`);
    await expect(page.getByTestId('harness-root')).toBeVisible();

    // Banner names the bridge source.
    const banner = page.getByTestId('studio-bridge-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/Marketing Vault/i);

    // Opened straight into the Video Engine with the bridged footage + hook applied.
    await expect(page.getByRole('tab', { name: /VIDEO ENGINE/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('video.reel-video-v4')).toHaveAttribute('src', 'https://cdn.example/bridged.mp4');
    await expect(page.locator('.reel-hl-v4')).toContainText('BRIDGED HOOK');

    // One-shot: the inbox is consumed (cleared) as it's read.
    expect(await readInbox(page)).toBeNull();

    // A reload must NOT replay it — the banner is gone.
    await page.reload();
    await expect(page.getByTestId('harness-root')).toBeVisible();
    await expect(page.getByTestId('studio-bridge-banner')).toHaveCount(0);
  });

  test('Review Bucket "Send to Studio V4 Engine" writes the inbox and navigates', async ({ page }) => {
    await seedToken(page);
    await mockContentQueueList(page);

    await page.goto(`${HARNESS}?c=content-manager`);
    await expect(page.getByTestId('harness-root')).toBeVisible();

    const card = page.getByTestId('draft-card').first();
    await expect(card).toBeVisible();

    // Capture the card's displayed hook so we can assert it rode the handoff verbatim.
    const hookText = (await card.locator('.dcm-hook').innerText()).trim();
    expect(hookText.length).toBeGreaterThan(0);

    await card.getByRole('button', { name: /Send to Studio V4 Engine/i }).click();

    const inbox = await readInbox(page);
    expect(inbox).toBeTruthy();
    expect(inbox.mode).toBe('reel');
    expect(inbox.source).toBe('review-bucket');
    expect(inbox.hook).toBe(hookText);

    await expect(page.getByTestId('probe-location')).toHaveAttribute('data-path', '/command/studio-v4');
  });
});
