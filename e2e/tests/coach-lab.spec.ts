import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Coach Lab — Continuous Knowledge Ecosystem (Command Center, admin-only).
 * ========================================================================
 * Verifies (with the bbf-coach-vault edge function mocked):
 *   1. Admin renders the Lab at /command/coach-lab: hero + 4 pillar tabs
 *      (Research Vault LIVE, 3 Phase-2 pillars).
 *   2. Research Vault lists saved cards; a card flips front→back.
 *   3. Paste → Summarize & Save prepends the new card.
 *   4. A Phase-2 pillar shows its teaser panel.
 *   5. Chrome localizes (ES seed).
 */

const SHOTS =
  '/tmp/claude-0/-home-user-Buildbelievefit/253052c0-de49-5ca2-9900-c5dac2020053/scratchpad/shots';

const ADMIN_SESSION = {
  uid: 'akeem',
  vaultToken: 'e2e-admin',
  user: { id: 'akeem', username: 'akeem', role: 'admin', type: null, programKey: null },
  plans: null,
  authenticatedAt: Date.now(),
};

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

const SAMPLE_CARD = {
  id: 'card-1',
  category: 'bioenergetics',
  title: 'Low-Load BFR Matches High-Load Hypertrophy',
  source_citation: 'J. Strength Cond. Res. (2026)',
  claude_summary: {
    physiology_takeaways: [
      'Metabolic byproduct accumulation drives growth at low load',
      'Occlusion increases high-threshold motor-unit recruitment',
    ],
    coaching_application: 'Program 20–30% 1RM with cuffs for joint-sparing hypertrophy blocks on deload weeks.',
    scientific_pitfalls: 'Small male-only sample; 6-week duration limits long-term inference.',
  },
  model: 'claude-sonnet-4-6',
  created_at: '2026-06-23T12:00:00Z',
};

const NEW_CARD = {
  ...SAMPLE_CARD,
  id: 'card-2',
  category: 'biomechanics',
  title: 'Velocity-Based Training Autoregulates Daily Load',
};

async function seedAdmin(page: Page, lang?: string): Promise<void> {
  await page.addInitScript(({ s, l }) => {
    localStorage.setItem('bbf.session.v1', JSON.stringify(s));
    if (l) localStorage.setItem('bbf_lang', l);
  }, { s: ADMIN_SESSION, l: lang });
}

async function mockNetwork(page: Page): Promise<void> {
  const ok = (route: Route, body: unknown) =>
    route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });

  await page.route('**/rest/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return ok(route, []);
  });
  await page.route('**/auth/v1/**', (route) => ok(route, {}));
  await page.route('**/rest/v1/rpc/**', (route) => ok(route, { ok: true }));

  // The Research Vault edge function — branch on the posted action.
  await page.route('**/functions/v1/bbf-coach-vault', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let action = '';
    try { action = JSON.parse(route.request().postData() || '{}').action; } catch { /* ignore */ }
    if (action === 'list') return ok(route, { ok: true, cards: [SAMPLE_CARD] });
    if (action === 'ingest') return ok(route, { ok: true, card: NEW_CARD, model: 'claude-sonnet-4-6', usage: {} });
    if (action === 'delete') return ok(route, { ok: true, deleted: 'card-1' });
    return ok(route, { ok: true });
  });
}

test.describe('Coach Lab — Knowledge Ecosystem', () => {
  test('pillars, research vault flip + ingest', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 950 });
    await seedAdmin(page);
    await mockNetwork(page);

    await page.goto('/command/coach-lab');

    // Module + 4 pillars (1 live, 3 Phase-2).
    await expect(page.locator('[data-testid="coach-lab-module"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cl-tab')).toHaveCount(4);
    await expect(page.locator('.cl-tab-soon')).toHaveCount(3);
    await expect(page.locator('[data-testid="cl-pillar-research"]')).toHaveAttribute('aria-selected', 'true');

    // Research Vault lists the saved card.
    await expect(page.locator('[data-testid="research-vault"]')).toBeVisible();
    await expect(page.locator('[data-testid="rv-grid"] .cl-flip')).toHaveCount(1);
    await expect(page.locator('.cl-card-title').first()).toContainText('BFR');
    await page.screenshot({ path: `${SHOTS}/06-lab-research-vault.png`, fullPage: true });

    // Flip the card front → back.
    const card = page.locator('[data-testid="rv-card-card-1"]');
    await card.locator('.cl-face-front').click();
    await expect(card).toHaveClass(/is-flipped/);
    await page.waitForTimeout(700); // let the 0.6s 3D flip settle before capturing
    // The back face (takeaways) must be the one presented after the flip.
    await expect(card.locator('.cl-face-back')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/07-lab-card-flipped.png`, fullPage: true });

    // Ingest: paste → Summarize & Save → new card prepends (2 total).
    await page.locator('[data-testid="rv-input"]').fill(
      'Velocity-based training prescribes load from real-time bar speed, autoregulating to daily readiness and reducing accumulated fatigue across a mesocycle.',
    );
    await page.locator('[data-testid="rv-summarize"]').click();
    await expect(page.locator('[data-testid="rv-grid"] .cl-flip')).toHaveCount(2);
    await expect(page.locator('.cl-card-title').first()).toContainText('Velocity-Based');

    // A Phase-2 pillar shows its teaser.
    await page.locator('[data-testid="cl-pillar-arena"]').click();
    await expect(page.locator('[data-testid="cl-soon-arena"]')).toBeVisible();
    await expect(page.locator('.cl-soon-title')).toContainText('Arena');
    await page.screenshot({ path: `${SHOTS}/08-lab-pillar-soon.png`, fullPage: true });
  });

  test('chrome localizes to Spanish', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedAdmin(page, 'es');
    await mockNetwork(page);

    await page.goto('/command/coach-lab');
    await expect(page.locator('[data-testid="coach-lab-module"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cl-decks-kicker')).toContainText('Cuatro Pilares');
    await expect(page.locator('[data-testid="cl-pillar-research"]')).toContainText('Investigación');
    await page.screenshot({ path: `${SHOTS}/09-lab-es.png`, fullPage: true });
  });
});
