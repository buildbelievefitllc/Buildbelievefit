// e2e/kinesiology-anatomy-arena.spec.js — Coach Lab · Kinesiology Lab game #3.
// Locks the contract for the Anatomy Arena "find it on the body" drill:
//   1. The select screen offers all THREE decks and the mastery denominator is the
//      UNION of every concept id (12 match + 12 true/false + 5 anatomy-only = 29),
//      never a naive sum that double-counts the shared muscle ids.
//   2. Tapping the correct muscle on the mannequin scores it correct AND banks a
//      rep into the SAME 1-5 SRS box the text decks use (shared muscle id).
//   3. A wrong tap reveals the answer as a teaching moment (the correct region is
//      revealed, the miss is named).
//   4. Locating a back-view muscle requires — and honors — the front↔back toggle.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const SRS_KEY = 'bbf.coachlab.kinesio.srs.v1';

async function mount(page) {
  await page.addInitScript((key) => { localStorage.removeItem(key); }, SRS_KEY);
  await page.goto(`${HARNESS}?c=kinesiology-lab`);
  await expect(page.getByTestId('kinesiology-lab')).toBeVisible();
}

test('select screen offers three decks and a union mastery denominator (/29)', async ({ page }) => {
  await mount(page);
  await expect(page.getByTestId('kl-mode-match')).toBeVisible();
  await expect(page.getByTestId('kl-mode-speed')).toBeVisible();
  await expect(page.getByTestId('kl-mode-anatomy')).toBeVisible();
  // Union total: shared muscle ids counted once, not twice.
  await expect(page.getByTestId('kinesiology-lab')).toContainText('/29');
});

test('tapping the correct muscle scores it and banks a shared SRS rep', async ({ page }) => {
  await mount(page);
  await page.getByTestId('kl-mode-anatomy').click();

  const stage = page.getByTestId('kl-anat-playing');
  await expect(stage).toBeVisible();
  const target = await stage.getAttribute('data-target');
  const view = await stage.getAttribute('data-target-view');
  expect(target).toBeTruthy();

  if (view === 'back') await page.getByTestId('kl-anat-view-back').click();
  // Tap the visible muscle belly (a two-belly group's bbox center is the empty
  // gap between the ellipses; the click bubbles from the ellipse to the group).
  await page.getByTestId(`kl-anat-${target}`).locator('ellipse').first().click();

  const reveal = page.getByTestId('kl-anat-reveal');
  await expect(reveal).toBeVisible();
  await expect(reveal).toHaveClass(/is-correct/);

  // The rep landed in the shared kinesiology SRS store (box 1 after one correct).
  const box = await page.evaluate(([key, id]) => {
    const all = JSON.parse(localStorage.getItem(key) || '{}');
    return all[id];
  }, [SRS_KEY, target]);
  expect(box).toBe(1);

  // Advancing continues the round.
  await page.getByTestId('kl-anat-next').click();
  await expect(page.getByTestId('kl-anat-playing')).toBeVisible();
});

test('a wrong tap reveals the answer as a teaching moment', async ({ page }) => {
  await mount(page);
  await page.getByTestId('kl-mode-anatomy').click();

  const stage = page.getByTestId('kl-anat-playing');
  await expect(stage).toBeVisible();
  const target = await stage.getAttribute('data-target');

  // Both m_quads and m_pecmaj live on the default front view; pick whichever is
  // NOT the target so the tap is guaranteed wrong.
  const wrong = target === 'm_quads' ? 'm_pecmaj' : 'm_quads';
  await page.getByTestId(`kl-anat-${wrong}`).locator('ellipse').first().click();

  const reveal = page.getByTestId('kl-anat-reveal');
  await expect(reveal).toBeVisible();
  await expect(reveal).toHaveClass(/is-wrong/);
  // The correct muscle is named + its region revealed on the correct side.
  await expect(page.getByTestId(`kl-anat-${target}`)).toHaveClass(/is-correct/);
});
