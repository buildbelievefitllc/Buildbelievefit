// e2e/exercise-demo-modal.spec.js — the exercise demo pop-up at a phone breakpoint.
//
// Locks the mobile edge case for FormDemoPlayer's pop-up modal: at a 390 px phone
// viewport the dialog card stays STRICTLY within the viewport (no horizontal
// clipping / layout bleed), and BOTH close affordances — the top-right ✕
// touch-target and the backdrop click-outside — remain visible and functional.
//
// Mounts the real FormDemoPlayer via the harness (?c=form-demo, gif-only → tapping
// the cover opens the modal directly). GPU-free, deterministic (local asset).

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const PHONE = { width: 390, height: 844 };

// 1 · Viewport simulation — a phone-width device context for every test here.
test.use({ viewport: PHONE });

test('exercise demo modal fits a 390px phone viewport with working close controls', async ({ page }) => {
  await page.goto(`${HARNESS}?c=form-demo`);
  const cover = page.locator('.bbf-video-cover');
  await expect(cover).toBeVisible();

  // Open the pop-up.
  await cover.click();
  const modal = page.getByTestId('form-demo-modal');
  await expect(modal).toBeVisible();

  // 2 · Layout assertion — the dialog card is strictly inside the 390px viewport.
  const card = modal.locator('.fdm');
  const box = await card.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
  // …and the page never gains a horizontal scrollbar (no bleed off-screen).
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW).toBeLessThanOrEqual(PHONE.width);

  // 3a · The ✕ touch-target is visible, inside the viewport, and dismisses.
  const closeX = page.getByTestId('form-demo-close');
  await expect(closeX).toBeVisible();
  const xb = await closeX.boundingBox();
  expect(xb.x + xb.width).toBeLessThanOrEqual(PHONE.width);
  expect(xb.width).toBeGreaterThanOrEqual(28); // a real, tappable target
  await closeX.click();
  await expect(modal).toHaveCount(0);

  // 3b · Reopen → the backdrop click-outside also dismisses at mobile scale.
  await cover.click();
  await expect(page.getByTestId('form-demo-modal')).toBeVisible();
  await page.mouse.click(5, 5); // top-left corner = backdrop, clear of the centred card
  await expect(page.getByTestId('form-demo-modal')).toHaveCount(0);
});
