// e2e/kinesiology-anatomy-arena.spec.js — Coach Lab · Anatomy Arena (game #3).
// Locks the Exploded Regional Zoom contract:
//   1. The Lab offers all THREE decks; the mastery denominator is the UNION of
//      every concept id (12 match + 12 true/false + 22 anatomy, 7 shared = 39).
//   2. Tier 1 gate: the anatomy deck opens a PUSH / PULL / LEGS split picker.
//   3. Choosing a lane hides every muscle outside it (a legs muscle is absent
//      from the push canvas) — the core clutter fix.
//   4. Tapping the correct muscle scores it AND banks a rep into the shared 1-5
//      SRS box; a wrong tap reveals the answer (gold) as a teaching moment.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const SRS_KEY = 'bbf.coachlab.kinesio.srs.v1';

async function mount(page) {
  await page.addInitScript((key) => { localStorage.removeItem(key); }, SRS_KEY);
  await page.goto(`${HARNESS}?c=kinesiology-lab`);
  await expect(page.getByTestId('kinesiology-lab')).toBeVisible();
}

async function openLane(page, lane) {
  await page.getByTestId('kl-mode-anatomy').click();
  await expect(page.getByTestId('kl-anat-gate')).toBeVisible();
  await page.getByTestId(`kl-lane-${lane}`).click();
  await expect(page.getByTestId('kl-anat-playing')).toBeVisible();
}

// Capture every speechSynthesis.speak() call as text, without producing audio.
async function spyOnSpeech(page) {
  await page.addInitScript(() => {
    window.__spoken = [];
    const s = window.speechSynthesis;
    if (s) {
      s.getVoices = () => [];
      s.cancel = () => {};
      s.speak = (u) => { try { window.__spoken.push(String((u && u.text) || '')); } catch { /* ignore */ } };
    }
  });
}

test('select screen offers three decks and a union mastery denominator (/39)', async ({ page }) => {
  await mount(page);
  await expect(page.getByTestId('kl-mode-match')).toBeVisible();
  await expect(page.getByTestId('kl-mode-speed')).toBeVisible();
  await expect(page.getByTestId('kl-mode-anatomy')).toBeVisible();
  await expect(page.getByTestId('kinesiology-lab')).toContainText('/39');
});

test('the anatomy deck opens the PUSH / PULL / LEGS split gate', async ({ page }) => {
  await mount(page);
  await page.getByTestId('kl-mode-anatomy').click();
  await expect(page.getByTestId('kl-anat-gate')).toBeVisible();
  await expect(page.getByTestId('kl-lane-push')).toBeVisible();
  await expect(page.getByTestId('kl-lane-pull')).toBeVisible();
  await expect(page.getByTestId('kl-lane-legs')).toBeVisible();
});

test('choosing a lane hides every muscle outside it', async ({ page }) => {
  await mount(page);
  await openLane(page, 'push');
  await expect(page.getByTestId('kl-anat-playing')).toHaveAttribute('data-lane', 'push');
  await expect(page.getByTestId('kl-anat-m_pec_clav')).toBeVisible();   // a push muscle is on-canvas
  await expect(page.getByTestId('kl-anat-m_gastroc')).toHaveCount(0);   // a legs muscle is NOT
});

test('tapping the correct muscle scores it and banks a shared SRS rep', async ({ page }) => {
  await mount(page);
  await openLane(page, 'legs');

  const stage = page.getByTestId('kl-anat-playing');
  const target = await stage.getAttribute('data-target');
  expect(target).toBeTruthy();

  await page.getByTestId(`kl-anat-${target}`).locator('path.kl-anat-path').first().click();

  const reveal = page.getByTestId('kl-anat-reveal');
  await expect(reveal).toBeVisible();
  await expect(reveal).toHaveClass(/is-correct/);
  await expect(page.getByTestId(`kl-anat-${target}`)).toHaveClass(/is-correct/);

  const box = await page.evaluate(([key, id]) => {
    const all = JSON.parse(localStorage.getItem(key) || '{}');
    return all[id];
  }, [SRS_KEY, target]);
  expect(box).toBe(1);

  await page.getByTestId('kl-anat-next').click();
  await expect(page.getByTestId('kl-anat-playing')).toBeVisible();
});

test('a wrong tap reveals the answer in gold as a teaching moment', async ({ page }) => {
  await mount(page);
  await openLane(page, 'legs');

  const stage = page.getByTestId('kl-anat-playing');
  const target = await stage.getAttribute('data-target');
  // Both m_gastroc and m_tibant are always rendered on the legs canvas; tap
  // whichever is NOT the target so the tap is guaranteed wrong.
  const wrong = target === 'm_gastroc' ? 'm_tibant' : 'm_gastroc';
  await page.getByTestId(`kl-anat-${wrong}`).locator('path.kl-anat-path').first().click();

  const reveal = page.getByTestId('kl-anat-reveal');
  await expect(reveal).toBeVisible();
  await expect(reveal).toHaveClass(/is-wrong/);
  await expect(page.getByTestId(`kl-anat-${target}`)).toHaveClass(/is-reveal/);
});

test('voice narrates the verdict on reveal (Correct + the action)', async ({ page }) => {
  await spyOnSpeech(page);
  await mount(page);
  await openLane(page, 'legs');

  const name = (await page.locator('.kl-anat-target').first().innerText()).trim();
  const target = await page.getByTestId('kl-anat-playing').getAttribute('data-target');
  await page.getByTestId(`kl-anat-${target}`).locator('path.kl-anat-path').first().click();
  await expect(page.getByTestId('kl-anat-reveal')).toBeVisible();

  const spoken = await page.evaluate(() => (window.__spoken || []).join(' || '));
  expect(spoken).toContain('Correct.');
  expect(spoken).toContain(name);   // the muscle is named aloud
});

test('muting narration silences the verdict', async ({ page }) => {
  await spyOnSpeech(page);
  await page.addInitScript(() => localStorage.setItem('bbf.coachlab.voice', '0'));
  await mount(page);
  await openLane(page, 'legs');

  const target = await page.getByTestId('kl-anat-playing').getAttribute('data-target');
  await page.getByTestId(`kl-anat-${target}`).locator('path.kl-anat-path').first().click();
  await expect(page.getByTestId('kl-anat-reveal')).toBeVisible();

  const count = await page.evaluate(() => (window.__spoken || []).length);
  expect(count).toBe(0);   // voice off → no prompt narration, no verdict narration
});
