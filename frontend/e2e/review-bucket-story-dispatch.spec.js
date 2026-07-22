// e2e/review-bucket-story-dispatch.spec.js — Grouped Media Pass: Review Bucket →
// "Dispatch to Meta Stories". Locks that a draft card renders a branded 9:16 story
// image client-side and routes it through the bbf-studio-queue surface='story'
// pipeline (POST-NOW) to BOTH Meta channels — behind the live-post confirm guard.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
};
// The one-shot signed upload slot the mocked `sign` hands back; the client PUTs the
// baked story image here, so the spec must also fulfill this URL.
const PUT_URL = 'https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/upload/mock-story-slot';

const seedToken = (page) => page.addInitScript(() =>
  localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' })));

async function mockContentQueueList(page) {
  await page.route('**/functions/v1/bbf-content-manager', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, items: [] }) });
  });
}

// Mock the bbf-studio-queue sign→PUT→confirm pipeline. Records every `confirm` body
// into `confirms` so the spec can assert the story routing (kind/surface/now/target).
async function mockStudioQueue(page, confirms) {
  let signSeq = 0;
  await page.route('**/functions/v1/bbf-studio-queue', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* non-JSON — ignore */ }
    if (body.action === 'sign') {
      signSeq += 1;
      await route.fulfill({
        status: 200, headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, id: `mock-story-${signSeq}`, uploadUrl: PUT_URL, contentType: 'image/jpeg' }),
      });
    } else if (body.action === 'confirm') {
      confirms.push(body);
      await route.fulfill({
        status: 200, headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, status: 'posted' }),
      });
    } else {
      await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
    }
  });
  await page.route(PUT_URL, async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
    await route.fulfill({ status: 200, headers: CORS });
  });
}

test.describe('Grouped Media Pass — Dispatch to Meta Stories', () => {
  test('renders a story card and posts via the story pipeline to IG + FB', async ({ page }) => {
    await seedToken(page);
    await mockContentQueueList(page);
    const confirms = [];
    await mockStudioQueue(page, confirms);
    page.on('dialog', (d) => d.accept()); // clear the live-post confirm guard

    await page.goto(`${HARNESS}?c=content-manager`);
    await expect(page.getByTestId('harness-root')).toBeVisible();

    const card = page.getByTestId('draft-card').first();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /Dispatch to Meta Stories/i }).click();

    // The card reports success once both channels confirm.
    await expect(card.getByRole('button', { name: /Story Posted/i })).toBeVisible();
    await expect(card.locator('.dcm-bridge-note')).toContainText(/Instagram \+ Facebook/i);

    // Routed through surface='story', kind='image', post-now, to BOTH Meta channels.
    expect(confirms.length).toBe(2);
    for (const c of confirms) {
      expect(c.kind).toBe('image');
      expect(c.surface).toBe('story');
      expect(c.now).toBe(true);
    }
    expect(confirms.map((c) => c.platform_target).sort()).toEqual(['facebook', 'instagram']);
  });

  test('cancelling the confirm dialog posts nothing', async ({ page }) => {
    await seedToken(page);
    await mockContentQueueList(page);
    const confirms = [];
    await mockStudioQueue(page, confirms);
    page.on('dialog', (d) => d.dismiss()); // decline the confirm

    await page.goto(`${HARNESS}?c=content-manager`);
    await expect(page.getByTestId('harness-root')).toBeVisible();

    const card = page.getByTestId('draft-card').first();
    const dispatch = card.getByRole('button', { name: /Dispatch to Meta Stories/i });
    await dispatch.click();

    // Declined → early return: the button never leaves its idle label and nothing posts.
    await expect(dispatch).toBeVisible();
    await page.waitForTimeout(300); // let any (erroneous) async settle
    expect(confirms.length).toBe(0);
  });
});
