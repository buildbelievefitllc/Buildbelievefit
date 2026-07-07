// e2e/studio-image-format.spec.js — the Instagram JPEG guardrail.
// Locks: the Studio bakes image cards as JPEG, never PNG. Instagram's Content
// Publishing API rejects PNG at container creation (400) — it only accepts JPEG —
// while Facebook tolerates either. A regression to PNG here silently breaks IG
// auto-post again (FB keeps working, masking it), which is exactly the bug this
// spec exists to prevent. We assert on the exported file the browser produces,
// since that same canvas.toBlob() path feeds getStageBlob() → the queue upload.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

async function openStudio(page) {
  await page.goto(`${HARNESS}?c=studio-v4`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
}

test.describe('Studio image cards are JPEG (Instagram-compatible)', () => {
  test('the export button label advertises JPG, not PNG', async ({ page }) => {
    await openStudio(page);
    // Default panel is CTA CARDS; its export button must read JPG.
    await expect(page.getByRole('button', { name: /EXPORT JPG/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /EXPORT PNG/i })).toHaveCount(0);
  });

  test('CTA export downloads a .jpg (never a .png)', async ({ page }) => {
    await openStudio(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /EXPORT JPG/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.jpg$/);
    expect(download.suggestedFilename()).not.toMatch(/\.png$/);
  });
});
