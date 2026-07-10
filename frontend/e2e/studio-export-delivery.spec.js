// e2e/studio-export-delivery.spec.js — the export delivery ladder (exportDelivery.js).
//
// Locks the permanent fix for the Galaxy S25 field failure: blob-anchor downloads
// die silently in the installed Android PWA, and navigator.share() refuses stale
// gestures — so delivery must ladder: share sheet (mobile, fresh tap) → classic
// anchor → window.open. Each rung is asserted here against the REAL module.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

async function boot(page) {
  await page.goto(HARNESS);
  await expect(page.getByTestId('harness-root')).toBeVisible();
}

test('desktop path (preferShare:false) delivers via the classic anchor download', async ({ page }) => {
  await boot(page);
  const dl = page.waitForEvent('download');
  const how = await page.evaluate(async () => {
    const { saveBlobToDevice } = await import('/src/lib/exportDelivery.js');
    return saveBlobToDevice(new Blob(['x'], { type: 'video/mp4' }), 'bbf-test.mp4', { preferShare: false });
  });
  expect(how).toBe('downloaded');
  expect((await dl).suggestedFilename()).toBe('bbf-test.mp4');
});

test('mobile path hands a real File to the navigator.share sheet', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const calls = [];
    navigator.canShare = (d) => !!(d && d.files && d.files.length);
    navigator.share = async (d) => { calls.push({ name: d.files[0].name, type: d.files[0].type, size: d.files[0].size }); };
    const { saveBlobToDevice } = await import('/src/lib/exportDelivery.js');
    const how = await saveBlobToDevice(new Blob(['abc'], { type: 'video/mp4' }), 'bbf-reel.mp4', { preferShare: true });
    return { how, calls };
  });
  expect(r.how).toBe('shared');
  expect(r.calls).toEqual([{ name: 'bbf-reel.mp4', type: 'video/mp4', size: 3 }]);
});

test('a refused share (stale gesture / NotAllowedError) falls down the ladder to a download', async ({ page }) => {
  await boot(page);
  const dl = page.waitForEvent('download');
  const how = await page.evaluate(async () => {
    navigator.canShare = () => true;
    navigator.share = async () => { const e = new Error('no transient activation'); e.name = 'NotAllowedError'; throw e; };
    const { saveBlobToDevice } = await import('/src/lib/exportDelivery.js');
    return saveBlobToDevice(new Blob(['x'], { type: 'video/mp4' }), 'bbf-fallback.mp4', { preferShare: true });
  });
  expect(how).toBe('downloaded');
  expect((await dl).suggestedFilename()).toBe('bbf-fallback.mp4');
});

test('user closing the share sheet is respected — cancelled, no surprise fallback download', async ({ page }) => {
  await boot(page);
  const how = await page.evaluate(async () => {
    navigator.canShare = () => true;
    navigator.share = async () => { const e = new Error('user dismissed'); e.name = 'AbortError'; throw e; };
    const { saveBlobToDevice } = await import('/src/lib/exportDelivery.js');
    return saveBlobToDevice(new Blob(['x'], { type: 'video/mp4' }), 'bbf-cancel.mp4', { preferShare: true });
  });
  expect(how).toBe('cancelled');
});
