// e2e/language-lab-guided-dose.spec.js — the Guided Track's 5-item daily dose
// (Fable Fleet Sync wave 4: 20260717180000_bbf_curriculum_dose_shadow_clinic).
// Locks two contracts:
//   1. THE STRIP SHOWS FIVE — Echo Chamber and Grammar Clinic render as dose
//      items on the Guided Track strip alongside the original vocab/syntax/video.
//   2. THE MODULES REPORT IN — finishing an Echo Chamber run (even listen-only)
//      calls bbf_log_curriculum_progress with metric 'shadow'; finishing a
//      Grammar Clinic session calls it with metric 'clinic'.

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

async function mountLab(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  await page.route('**/rest/v1/rpc/bbf_get_vocab_queue', rpcStub({ ok: true, language: 'es', queue: [], due_count: 0, total: 0 }));
  await page.route('**/rest/v1/rpc/bbf_get_language_dashboard', rpcStub({
    ok: true, language: 'es',
    profile: { phase: 1, streak_current: 0, streak_best: 0, fluency_ewma: null, vocab_mastered: 0, pimsleur_done: 0, weak_clusters: [] },
    pimsleur: null,
  }));
  await page.route('**/rest/v1/rpc/bbf_get_curriculum_track', rpcStub({
    ok: true, language: 'es', current_day: 3, days_completed: 2,
    requirements: { vocab: 10, syntax: 1, video: 1, shadow: 1, clinic: 1 },
    progress: { vocab: 0, syntax: 0, video: 0, shadow: 0, clinic: 0 },
    day_complete: false,
  }));
  await page.goto(`${HARNESS}?c=language-lab`);
  await expect(page.locator('.lm-panel')).toBeVisible();
}

test('the Guided Track renders Echo Chamber and Grammar Clinic as dose items', async ({ page }) => {
  await mountLab(page);
  await expect(page.getByTestId('guided-track')).toBeVisible();

  const shadowItem = page.getByTestId('gt-item-shadow');
  const clinicItem = page.getByTestId('gt-item-clinic');
  await expect(shadowItem).toBeVisible();
  await expect(shadowItem).toContainText('0/1');
  await expect(clinicItem).toBeVisible();
  await expect(clinicItem).toContainText('0/1');
});

test('finishing an Echo Chamber run (listen-only) logs curriculum progress on the shadow metric', async ({ page }) => {
  await mountLab(page);

  const calls = [];
  await page.route('**/rest/v1/rpc/bbf_log_curriculum_progress', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { calls.push(route.request().postDataJSON()); } catch { /* ignore */ }
    await route.fulfill({
      status: 200, headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: true, language: 'es', current_day: 3, days_completed: 2,
        requirements: { vocab: 10, syntax: 1, video: 1, shadow: 1, clinic: 1 },
        progress: { vocab: 0, syntax: 0, video: 0, shadow: 1, clinic: 0 },
        day_complete: false, unlocked_next: false,
      }),
    });
  });

  await page.getByTestId('lm-mode-echo').click();
  await expect(page.getByTestId('echo-chamber')).toBeVisible();

  // Walk the fallback trio without a mic (harness has none) — a listen-only run.
  await page.getByTestId('echo-next').click();
  await page.getByTestId('echo-next').click();
  await page.getByTestId('echo-next').click();
  await expect(page.getByTestId('echo-done')).toBeVisible();

  await expect.poll(() => calls.length).toBeGreaterThan(0);
  expect(calls.some((c) => c.p_metric === 'shadow')).toBe(true);

  // The strip reflects the write-through immediately (no reload needed).
  await expect(page.getByTestId('gt-item-shadow')).toContainText('1/1');
});

test('finishing a Grammar Clinic session logs curriculum progress on the clinic metric', async ({ page }) => {
  await mountLab(page);

  const calls = [];
  await page.route('**/rest/v1/rpc/bbf_log_curriculum_progress', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { calls.push(route.request().postDataJSON()); } catch { /* ignore */ }
    await route.fulfill({
      status: 200, headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: true, language: 'es', current_day: 3, days_completed: 2,
        requirements: { vocab: 10, syntax: 1, video: 1, shadow: 1, clinic: 1 },
        progress: { vocab: 0, syntax: 0, video: 0, shadow: 0, clinic: 1 },
        day_complete: false, unlocked_next: false,
      }),
    });
  });
  await page.route('**/rest/v1/rpc/bbf_log_language_attempt', rpcStub({ ok: true, streak_current: 1, fluency_ewma: 50 }));

  await page.getByTestId('lm-mode-clinic').click();
  await expect(page.getByTestId('grammar-clinic')).toBeVisible();

  // Answer all 10 questions (any option) to complete the session.
  for (let i = 0; i < 10; i++) {
    await page.getByTestId('clinic-option').first().click();
    await page.getByTestId('clinic-next').click();
  }
  await expect(page.getByTestId('clinic-done')).toBeVisible();

  await expect.poll(() => calls.length).toBeGreaterThan(0);
  expect(calls.some((c) => c.p_metric === 'clinic')).toBe(true);

  await expect(page.getByTestId('gt-item-clinic')).toContainText('1/1');
});
