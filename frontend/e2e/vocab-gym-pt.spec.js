// e2e/vocab-gym-pt.spec.js — Mandate 3: the Portuguese SRS queue.
// Locks: (a) the client normalizes ANY Portuguese identifier ('pt-BR') to the
// canonical 'pt' before the RPC (the old strict equality coerced pt-BR to the
// SPANISH queue); (b) a populated Portuguese queue fetches and renders active terms
// — never the "Queue clear" empty state when terms are due.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

// Mirrors the live production seed this fix shipped (verified in prod: pt-BR → pt,
// 14 gym-floor terms due).
const PT_QUEUE = {
  ok: true,
  language: 'pt',
  due_count: 3,
  total: 14,
  queue: [
    { term: 'agachamento', box_level: 1, source: 'seed', error_cluster: null, priority_boost: 0, correct: 0, attempts: 0, last_reviewed: null, due_at: null },
    { term: 'levantamento terra', box_level: 1, source: 'seed', error_cluster: null, priority_boost: 0, correct: 0, attempts: 0, last_reviewed: null, due_at: null },
    { term: 'supino', box_level: 1, source: 'seed', error_cluster: null, priority_boost: 0, correct: 0, attempts: 0, last_reviewed: null, due_at: null },
  ],
};

test('Portuguese queue (pt-BR prop) sends canonical pt and renders active terms', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });

  let sentLanguage = null;
  await page.route('**/rest/v1/rpc/bbf_get_vocab_queue', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { sentLanguage = route.request().postDataJSON()?.p_language ?? null; } catch { sentLanguage = null; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(PT_QUEUE) });
  });

  // Regional code in — canonical code out.
  await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, { language: 'pt-BR' });
  await page.goto(`${HARNESS}?c=vocab-gym`);

  // The drill renders the active PT term — NOT the "Queue clear" empty state.
  await expect(page.getByTestId('vocab-flashcard')).toBeVisible();
  await expect(page.locator('.lg-term')).toHaveText('agachamento');
  await expect(page.getByText(/Queue clear/i)).toHaveCount(0);

  // The client sent the CANONICAL language code (the pt-BR→es coercion is dead).
  expect(sentLanguage).toBe('pt');
});

test('a genuinely empty queue still shows the clear state (no phantom terms)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  await page.route('**/rest/v1/rpc/bbf_get_vocab_queue', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, language: 'pt', queue: [], due_count: 0, total: 0 }) }));
  await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, { language: 'pt' });
  await page.goto(`${HARNESS}?c=vocab-gym`);
  await expect(page.getByText(/Queue clear/i)).toBeVisible();
});
