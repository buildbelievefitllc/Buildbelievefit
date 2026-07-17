// e2e/language-lab-wave2.spec.js — Fable Fleet Sync wave 2: the Grammar Clinic
// and the Echo Chamber. Locks two contracts:
//   1. THE PRESCRIPTION LOOP — the Clinic reads the profile's weak_clusters
//      (rolled up by the Immersion engine) and serves that cluster FIRST, and
//      answering locks in a verdict + explanation.
//   2. ECHO GRACEFUL FLOOR — the Chamber mounts on the fallback line set with
//      no episode/mic, supports a listen-only walkthrough, and a run with zero
//      spoken attempts finishes WITHOUT logging to the ledger.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

const rpcStub = (body) => (route) =>
  route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: CORS })
    : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function mountLab(page, { weakClusters = [] } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  await page.route('**/rest/v1/rpc/bbf_get_vocab_queue', rpcStub({ ok: true, language: 'es', queue: [], due_count: 0, total: 0 }));
  await page.route('**/rest/v1/rpc/bbf_get_language_dashboard', rpcStub({
    ok: true, language: 'es',
    profile: { phase: 1, streak_current: 3, streak_best: 5, fluency_ewma: 62, vocab_mastered: 12, pimsleur_done: 2, weak_clusters: weakClusters },
    pimsleur: null,
  }));
  await page.goto(`${HARNESS}?c=language-lab`);
  await expect(page.locator('.lm-panel')).toBeVisible();
}

test('the Grammar Clinic serves the weak cluster first and locks in a verdict', async ({ page }) => {
  await mountLab(page, { weakClusters: ['preposition'] });

  let logged = null;
  await page.route('**/rest/v1/rpc/bbf_log_language_attempt', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { logged = route.request().postDataJSON(); } catch { logged = {}; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, streak_current: 1, fluency_ewma: 70 }) });
  });

  await page.getByTestId('lm-mode-clinic').click();
  await expect(page.getByTestId('grammar-clinic')).toBeVisible();

  // The prescription header names the weak cluster, and the first item IS from it.
  await expect(page.getByTestId('clinic-rx')).toContainText('Preposition');
  await expect(page.getByTestId('clinic-cluster')).toHaveText('Preposition');
  await expect(page.getByTestId('clinic-q')).toContainText('Entreno ___ ser más fuerte.');

  // Answer correctly (purpose → para): verdict ✓ + the why + narratable solve.
  await page.getByTestId('clinic-option').filter({ hasText: /^para$/ }).click();
  await expect(page.getByTestId('clinic-verdict')).toContainText('✓');
  await expect(page.getByTestId('clinic-verdict')).toContainText('Purpose/goal takes para');
  await expect(page.getByTestId('clinic-hear')).toBeVisible();

  // The session advances — the deck moves to item 2 of 10.
  await page.getByTestId('clinic-next').click();
  await expect(page.getByTestId('grammar-clinic')).toContainText('2 of 10');
  expect(logged).toBeNull(); // nothing hits the ledger until the session completes
});

test('the Echo Chamber mounts the fallback lines and a listen-only run logs nothing', async ({ page }) => {
  await mountLab(page);

  let logged = null;
  await page.route('**/rest/v1/rpc/bbf_log_language_attempt', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { logged = route.request().postDataJSON(); } catch { logged = {}; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
  });

  await page.getByTestId('lm-mode-echo').click();
  await expect(page.getByTestId('echo-chamber')).toBeVisible();

  // Fallback trio (no curriculum session in the harness) — line 1 renders as word chips.
  await expect(page.getByTestId('echo-chamber')).toContainText('Line 1 of 3');
  await expect(page.getByTestId('echo-line')).toContainText('Activa');
  await expect(page.getByTestId('echo-hear')).toBeVisible();

  // Listen-only walkthrough: advance through all three lines without speaking.
  await page.getByTestId('echo-next').click();
  await expect(page.getByTestId('echo-chamber')).toContainText('Line 2 of 3');
  await page.getByTestId('echo-next').click();
  await page.getByTestId('echo-next').click();

  // Done state — and the ledger was NEVER hit (no spoken attempt → no EWMA dilution).
  await expect(page.getByTestId('echo-done')).toBeVisible();
  await expect(page.getByTestId('echo-done')).toContainText('nothing logged');
  expect(logged).toBeNull();
});
