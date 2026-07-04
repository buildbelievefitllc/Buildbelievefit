// e2e/score-lock.spec.js — Hotfix 1: the Sovereign Briefing 77-vs-80 contradiction.
// Locks: the score-lock engine (client mirror of bbf-sovereign-briefing's
// lockScoreDigits, layer 2 of the fix) rewrites every stray 0–100 figure in a
// briefing script to the single active readiness_score — while calendar counters
// ("Day 34", "30 days") survive untouched.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

async function locked(page, script, score) {
  await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, { script, score });
  await page.goto(`${HARNESS}?c=score-lock`);
  return page.getByTestId('score-lock-output').textContent();
}

test('the exact production contradiction — 77 vs 80 — resolves to a single number', async ({ page }) => {
  const out = await locked(
    page,
    'Your readiness this morning is 77 out of 100. You earned this. Look, your CNS is primed at an 80 today, so attack the session.',
    77,
  );
  expect(out).not.toContain('80');           // the hallucinated second figure is gone
  expect(out).toContain('77 out of 100');    // the true score stands
  expect(out).toContain('primed at an 77');  // every metric reference aligns to 77
});

test('calendar counters are exempt — only 0-100 scale figures are locked', async ({ page }) => {
  const out = await locked(
    page,
    'Day 34 of the protocol. Thirty days done, 30 days strong. Your readiness sits at 92 while recovery hums at a 65.',
    92,
  );
  expect(out).toContain('Day 34');   // day counter untouched
  expect(out).toContain('30 days');  // duration untouched
  expect(out).toContain('at 92');    // true score stands
  expect(out).not.toContain('65');   // the stray rating is locked to the score
});
