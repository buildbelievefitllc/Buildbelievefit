// e2e/language-lab-fusion.spec.js — the consolidated Language Lab (structural merge).
// Locks two contracts:
//   1. SEQUENCE BINDING — the Guided Track's Day N binds to the chronological
//      index of languageVideoLibrary.json (the ingested bbf_language_gated_system
//      payload): PT Day 2 must name PO-B-02 ("Brazilian Portuguese Pronunciation
//      Hacks") and clicking it routes to the Video Vault with that exact lesson
//      featured as the day's assignment.
//   2. AUDIO LAB FUSION — the legacy module (Pimsleur Audio Lab · Voice Studio ·
//      Vocab Gym soundboards) mounts WHOLE inside the Lab's Voice Studio segment
//      ("Coach Akeem's Voice Studio & Audio Lab") — nothing lost in the merge.

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

async function mountLab(page, { day = 2 } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  await page.route('**/rest/v1/rpc/bbf_get_vocab_queue', rpcStub({ ok: true, language: 'pt', queue: [], due_count: 0, total: 0 }));
  await page.route('**/rest/v1/rpc/bbf_get_language_dashboard', rpcStub({ ok: true, language: 'pt', profile: null, pimsleur: null }));
  await page.route('**/rest/v1/rpc/bbf_get_curriculum_track', rpcStub({
    ok: true, language: 'pt', current_day: day, days_completed: day - 1,
    requirements: { vocab: 10, syntax: 1, video: 1 },
    progress: { vocab: 0, syntax: 0, video: 0 },
    day_complete: false,
  }));
  await page.goto(`${HARNESS}?c=language-lab`);
  await expect(page.locator('.lm-panel')).toBeVisible();
}

test('Guided Track Day N binds to the chronological video and routes into the Vault', async ({ page }) => {
  await mountLab(page, { day: 2 });
  await page.getByRole('radio', { name: /portugu/i }).click();

  // PT Day 2 → chronological index 1 → PO-B-02.
  await expect(page.getByTestId('gt-day')).toHaveText('Day 2');
  const videoItem = page.getByTestId('gt-item-video');
  await expect(videoItem).toContainText('Brazilian Portuguese Pronunciation Hacks');

  // Click-through: the Vault opens with that exact lesson featured.
  await videoItem.click();
  await expect(page.getByTestId('video-vault')).toBeVisible();
  const assigned = page.getByTestId('vv-assigned');
  await expect(assigned).toContainText('PO-B-02');
  await expect(assigned).toContainText('Brazilian Portuguese Pronunciation Hacks');
});

test("the fused Voice Studio & Audio Lab segment mounts the complete legacy module", async ({ page }) => {
  await mountLab(page);
  await page.getByTestId('lm-mode-studio').click();
  await expect(page.getByTestId('voice-studio-lab')).toBeVisible();
  // The ENTIRE legacy module renders inside the segment — its own shell testid,
  // plus its Pimsleur Audio + Voice Studio + Vocab Gym sub-tabs, all preserved.
  const legacy = page.getByTestId('admin-language-roadmap');
  await expect(legacy).toBeVisible();
  await expect(legacy.getByRole('tab', { name: /Pimsleur Audio/i })).toBeVisible();
  await expect(legacy.getByRole('tab', { name: /Voice Studio/i })).toBeVisible();
  await expect(legacy.getByRole('tab', { name: /Vocab Gym/i })).toBeVisible();
});
