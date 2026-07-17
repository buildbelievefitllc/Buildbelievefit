// e2e/coach-lecture-hall.spec.js — Coach Lab · Broadcast Hub · Lecture Hall.
// Locks the study-library contract:
//   1. The Broadcast Hub exposes a third mode (🎓 Lecture Hall) with the 100
//      curated lectures, sectioned by category, sourced from the bundle (no DB).
//   2. Category filter + title search narrow the grid.
//   3. Clicking a lecture mounts the inline player for THAT video.
//   4. "Mark watched" toggles and persists across a reload (localStorage), and
//      the progress counter reflects it.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

async function mount(page) {
  // Empty DB vault — the Lecture Hall must stand entirely on the bundle.
  await page.route('**/bbf-coach-vault', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, cards: [] }) }));
  await page.goto(`${HARNESS}?c=broadcast-hub`);
  await expect(page.getByTestId('broadcast-hub')).toBeVisible();
  await page.getByTestId('bc-mode-library').click();
  await expect(page.getByTestId('lecture-hall')).toBeVisible();
}

test('lecture hall lists 100 sectioned videos and filters by category + search', async ({ page }) => {
  await mount(page);

  // All 100 present by default.
  await expect(page.getByTestId('lh-grid').locator('.lh-card')).toHaveCount(100);
  await expect(page.getByTestId('lh-progress')).toContainText('of 100');

  // Category filter → 20 in Biomechanics & Kinesiology.
  await page.getByTestId('lh-cat-biomechanics-kinesiology').click();
  await expect(page.getByTestId('lh-grid').locator('.lh-card')).toHaveCount(20);

  // Search narrows further within the category.
  await page.getByTestId('lh-search').fill('Deadlift');
  const cards = page.getByTestId('lh-grid').locator('.lh-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Deadlift');
});

test('clicking a lecture mounts the inline player for that video', async ({ page }) => {
  await mount(page);
  await page.getByTestId('lh-play-bk_001').click();
  await expect(page.getByTestId('lh-player')).toBeVisible();
  // The iframe points at the exact YouTube id for bk_001.
  await expect(page.getByTestId('lh-player-iframe')).toHaveAttribute('src', /GkC5q6mcohk/);
});

test('mark-watched toggles, updates progress, and persists across reload', async ({ page }) => {
  await mount(page);
  await expect(page.getByTestId('lh-progress')).toContainText('0 of 100');

  await page.getByTestId('lh-watch-bk_001').click();
  await expect(page.getByTestId('lh-watch-bk_001')).toContainText('✓');
  await expect(page.getByTestId('lh-progress')).toContainText('1 of 100');

  // Persisted — reload, back into the Lecture Hall, the mark survives.
  await page.reload();
  await expect(page.getByTestId('broadcast-hub')).toBeVisible();
  await page.getByTestId('bc-mode-library').click();
  await expect(page.getByTestId('lh-progress')).toContainText('1 of 100');
  await expect(page.getByTestId('lh-watch-bk_001')).toContainText('✓');
});
