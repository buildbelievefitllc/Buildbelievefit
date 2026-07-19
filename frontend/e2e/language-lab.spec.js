// e2e/language-lab.spec.js — the Language Mastery Lab (the three Mastery Views).
// Locks: the Lab mounts, the Portuguese starter deck fetches into the Forge, and
// The Path registers a full sentence build via DRAG-AND-DROP, appending the run to
// the closed-loop ledger (bbf_log_language_attempt intercepted on the wire).

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

// The production PT starter deck (seeded live by bbf_get_vocab_queue).
const PT_DECK = ['agachamento', 'levantamento terra', 'supino', 'remada', 'flexão'];
const PT_QUEUE = {
  ok: true, language: 'pt', due_count: PT_DECK.length, total: 14,
  queue: PT_DECK.map((term) => ({ term, box_level: 1, source: 'seed', error_cluster: null, priority_boost: 0, correct: 0, attempts: 0, last_reviewed: null, due_at: null })),
};

async function mountLab(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  await page.route('**/rest/v1/rpc/bbf_get_vocab_queue', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(PT_QUEUE) }));
  await page.route('**/rest/v1/rpc/bbf_get_language_dashboard', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, language: 'pt', profile: null, pimsleur: null }) }));
  await page.goto(`${HARNESS}?c=language-lab`);
  await expect(page.locator('.lm-panel')).toBeVisible();
}

test('the Lab mounts and the Portuguese starter deck fetches into the Forge', async ({ page }) => {
  await mountLab(page);
  await page.getByRole('radio', { name: /portugu/i }).click();
  // The Lab now lands on the Curriculum Atlas; the Vocab Forge (flashcard) is a
  // dedicated mode tab, so open it explicitly (mirrors the Path/Dojo specs below).
  await page.getByTestId('lm-mode-forge').click();
  await expect(page.getByTestId('vocab-flashcard')).toBeVisible();
  await expect(page.locator('.lg-term')).toHaveText('agachamento'); // deck term 1 renders
});

test('The Path registers a sentence build via drag-and-drop and logs the run', async ({ page }) => {
  await mountLab(page);

  let logged = null;
  await page.route('**/rest/v1/rpc/bbf_log_language_attempt', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { logged = route.request().postDataJSON(); } catch { logged = {}; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, streak_current: 1, fluency_ewma: 100 }) });
  });

  await page.getByRole('radio', { name: /portugu/i }).click();
  await page.getByTestId('lm-mode-path').click();
  await expect(page.getByTestId('the-path')).toBeVisible();

  // Build every sentence: physically DRAG each chip into the rail in solution order.
  // Chips are deterministically scrambled, so drag them by their word text.
  const SOLUTIONS = [
    ['trave', 'o', 'core'],
    ['abre', 'os', 'joelhos'],
    ['carrega', '90000', 'g', 'na', 'barra'],
  ];
  const rail = page.getByTestId('path-rail');
  for (let s = 0; s < SOLUTIONS.length; s += 1) {
    for (const word of SOLUTIONS[s]) {
      await page.getByTestId('path-tray').getByRole('button', { name: word, exact: true }).dragTo(rail);
    }
    await expect(page.getByTestId('path-placed-chip')).toHaveCount(SOLUTIONS[s].length);
    await page.getByTestId('path-check').click();
    if (s < SOLUTIONS.length - 1) {
      await expect(page.getByTestId('path-verdict')).toContainText('✓');
      await page.getByTestId('path-next').click();
    }
    // (the final correct sentence swaps the whole view to the done screen)
  }

  // The run completed and hit the closed-loop ledger with a perfect drill score.
  await expect(page.getByTestId('path-done')).toBeVisible();
  await expect.poll(() => logged && logged.p_module).toBe('drill');
  expect(logged.p_language).toBe('pt');
  expect(logged.p_items_total).toBe(3);
  expect(logged.p_items_correct).toBe(3);
});

test('the Audio Dojo mounts screen-locked player chrome (degrades to calibrating)', async ({ page }) => {
  await mountLab(page);
  // No baked fragments in the harness → the storage fetch 404s.
  await page.route('**/language-fragments/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.getByRole('radio', { name: /portugu/i }).click();
  await page.getByTestId('lm-mode-dojo').click();
  await expect(page.getByTestId('audio-dojo')).toBeVisible();
  await page.getByTestId('dojo-start').click();
  // Unbaked library → the calibrating notice, never a raw error.
  await expect(page.getByTestId('dojo-calibrating')).toBeVisible();
});
