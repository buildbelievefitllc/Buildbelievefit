// e2e/gram-standard.spec.js — THE GRAM STANDARD (§0.1) client guard.
// Locks: typing a weight using a banned kilogram/pound lexeme ('kilos') into the
// Vocab Forge recall input trips the validation warning; the gram-native
// {load_g} integer form passes clean. (The DATABASE layer is enforced by the
// bbf_cue_translation_gram_standard CHECK constraint — live-verified in prod:
// a 'kilos' translation insert is rejected by exactly that constraint.)

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

const PT_QUEUE = {
  ok: true, language: 'pt', due_count: 1, total: 14,
  queue: [{ term: 'carga', box_level: 1, source: 'seed', error_cluster: null, priority_boost: 0, correct: 0, attempts: 0, last_reviewed: null, due_at: null }],
};

test('a "kilos" weight entry triggers the Gram-Standard rejection; grams pass', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  await page.route('**/rest/v1/rpc/bbf_get_vocab_queue', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(PT_QUEUE) }));
  await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, { language: 'pt' });

  await page.goto(`${HARNESS}?c=vocab-gym`);
  await expect(page.getByTestId('vocab-flashcard')).toBeVisible();

  // Flip to the recall face and type a banned-lexeme weight.
  await page.locator('.lg-flip-btn').click();
  const input = page.getByTestId('forge-input');
  await input.fill('carrega noventa kilos');
  await expect(page.getByTestId('gram-violation')).toBeVisible();

  // The gram-native integer form is clean.
  await input.fill('carrega 90000 g');
  await expect(page.getByTestId('gram-violation')).toHaveCount(0);
});
