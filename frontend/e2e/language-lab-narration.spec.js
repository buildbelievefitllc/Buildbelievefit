// e2e/language-lab-narration.spec.js — the SYSTEM NARRATION ENGINE toggle + the
// unified audio ecosystem. Locks three contracts of the voice-mesh pass:
//   1. The global toggle renders at the top header with both explicit states and
//      persists the chosen persona across a reload (localStorage).
//   2. Every module reads the toggle — the Audio Dojo's engine note flips with it.
//   3. Pimsleur Audio Lab + Voice Studio are exposed as their OWN dedicated
//      sub-tabs in the main matrix (not buried inside the hub).

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const rpcStub = (body) => (route) =>
  route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: CORS })
    : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function mountLab(page) {
  await page.addInitScript(() => localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' })));
  await page.route('**/rest/v1/rpc/bbf_get_vocab_queue', rpcStub({ ok: true, language: 'es', queue: [], due_count: 0, total: 0 }));
  await page.route('**/rest/v1/rpc/bbf_get_language_dashboard', rpcStub({ ok: true, language: 'es', profile: null, pimsleur: null }));
  await page.route('**/rest/v1/rpc/bbf_get_curriculum_track', rpcStub({ ok: true, language: 'es', current_day: 1, days_completed: 0, requirements: { vocab: 10, syntax: 1, video: 1 }, progress: { vocab: 0, syntax: 0, video: 0 }, day_complete: false }));
  await page.goto(`${HARNESS}?c=language-lab`);
  await expect(page.locator('.lm-panel')).toBeVisible();
}

test('the SYSTEM NARRATION ENGINE toggle persists the chosen persona across reload', async ({ page }) => {
  await mountLab(page);
  const toggle = page.getByTestId('lm-engine-toggle');
  await expect(toggle).toBeVisible();
  // Default = Natural Synthesizer (premium Web Speech).
  await expect(page.getByTestId('lm-engine-natural')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('lm-engine-akeem')).toHaveAttribute('aria-checked', 'false');

  // Switch to BBF Coach Akeem → persists.
  await page.getByTestId('lm-engine-akeem').click();
  await expect(page.getByTestId('lm-engine-akeem')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => localStorage.getItem('bbf_lab_narration_engine'))).toBe('akeem');

  await page.reload();
  await expect(page.locator('.lm-panel')).toBeVisible();
  await expect(page.getByTestId('lm-engine-akeem')).toHaveAttribute('aria-checked', 'true');
});

test('every module reads the toggle — the Audio Dojo engine note flips with it', async ({ page }) => {
  await mountLab(page);
  await page.getByTestId('lm-mode-dojo').click();
  const note = page.getByTestId('dojo-engine-note');
  await expect(note).toBeVisible();
  // Default natural → the "always uses native baked voices" advisory.
  await expect(note).toContainText(/native baked voices/i);

  // Flip to Coach Akeem → the note reflects the native-baked persona line.
  await page.getByTestId('lm-engine-akeem').click();
  await expect(page.getByTestId('dojo-engine-note')).toContainText(/Coach Akeem/i);
});

test('Pimsleur Audio Lab + Voice Studio are dedicated sub-tabs in the main matrix', async ({ page }) => {
  await mountLab(page);
  // Dedicated Pimsleur mode mounts the legacy lesson player directly.
  await page.getByTestId('lm-mode-pimsleur').click();
  await expect(page.getByText(/PIMSLEUR/i).first()).toBeVisible();

  // Dedicated Voice Studio mode mounts the on-device pronunciation scorer.
  await page.getByTestId('lm-mode-voice').click();
  await expect(page.getByText(/THE VOICE STUDIO/i).first()).toBeVisible();
});
