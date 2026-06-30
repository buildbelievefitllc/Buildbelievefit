import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Coach Lab — Continuous Knowledge Ecosystem (Command Center, admin-only).
 * ========================================================================
 * All four pillars live (edge functions mocked):
 *   1. Pillars render (4 tabs, default = Research Vault).
 *   2. Research Vault: list + flip + ingest.
 *   3. Kinesiology Lab: pick a deck, answer a drill question.
 *   4. Coach's Arena: generate a case, submit a protocol, get a scorecard.
 *   5. Broadcast Hub: select a card, synthesize a newsletter.
 *   6. Chrome localizes (ES).
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

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

const SAMPLE_CARD = {
  id: 'card-1', category: 'bioenergetics',
  title: 'Low-Load BFR Matches High-Load Hypertrophy',
  source_citation: 'J. Strength Cond. Res. (2026)',
  claude_summary: {
    physiology_takeaways: ['Metabolic byproduct accumulation drives growth at low load', 'Occlusion increases high-threshold motor-unit recruitment'],
    coaching_application: 'Program 20–30% 1RM with cuffs for joint-sparing hypertrophy blocks on deload weeks.',
    scientific_pitfalls: 'Small male-only sample; 6-week duration limits long-term inference.',
  },
  model: 'claude-sonnet-4-6', created_at: '2026-06-23T12:00:00Z',
};
const NEW_CARD = { ...SAMPLE_CARD, id: 'card-2', category: 'biomechanics', title: 'Velocity-Based Training Autoregulates Daily Load' };

const SAMPLE_CASE = {
  scenario_title: 'Return-to-Play Point Guard',
  client_profile: {
    age: 17, background: 'HS point guard, 6 weeks post lateral ankle sprain, cleared for non-contact.',
    training_age: 'Intermediate · 3 years', primary_goal: 'Return to play + cut re-sprain risk',
    constraints: ['School schedule', 'Team practice 4x/week'],
    biomechanical_limitations: ['Limited ankle dorsiflexion', 'Single-leg balance deficit'],
  },
  the_ask: 'Design a 3-week reintegration block that restores cutting confidence without overloading the healing ankle.',
};
const SAMPLE_CRITIQUE = {
  accuracy_score: 78,
  verdict: 'Solid foundation; tighten the ankle-loading progression and add objective criteria.',
  strengths: ['Prioritized single-leg stability early', 'Sensible weekly volume given practice load'],
  gaps: ['No criteria-based progression gates', 'Missed calf eccentric loading for tendon capacity'],
  science_references: ['NSCA return-to-sport guidelines', 'NASM-CES corrective exercise continuum'],
  next_focus: 'Add objective return-to-play criteria (hop-test symmetry ≥ 90%).',
};
const NEWSLETTER = '# This Week in the Lab\n\nHey team — three quick science wins you can use today.\n\n## 1. Smarter hypertrophy\nLow-load cuff work can match heavy lifting for growth while sparing your joints.\n\nStay strong,\nCoach Akeem';

async function seedAdmin(page: Page, lang?: string): Promise<void> {
  await page.addInitScript(({ s, l }) => {
    localStorage.setItem('bbf.session.v1', JSON.stringify(s));
    if (l) localStorage.setItem('bbf_lang', l);
  }, { s: ADMIN_SESSION, l: lang });
}

async function mockNetwork(page: Page): Promise<void> {
  const ok = (route: Route, body: unknown) =>
    route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const actionOf = (route: Route) => { try { return JSON.parse(route.request().postData() || '{}').action; } catch { return ''; } };

  await page.route('**/rest/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return ok(route, []);
  });
  await page.route('**/auth/v1/**', (route) => ok(route, {}));
  await page.route('**/rest/v1/rpc/**', (route) => ok(route, { ok: true }));

  await page.route('**/functions/v1/bbf-coach-vault', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const a = actionOf(route);
    if (a === 'list') return ok(route, { ok: true, cards: [SAMPLE_CARD] });
    if (a === 'ingest') return ok(route, { ok: true, card: NEW_CARD, model: 'claude-sonnet-4-6' });
    if (a === 'delete') return ok(route, { ok: true, deleted: 'card-1' });
    if (a === 'broadcast') return ok(route, { ok: true, newsletter: NEWSLETTER, format: 'email', count: 1 });
    return ok(route, { ok: true });
  });
  await page.route('**/functions/v1/bbf-coach-arena', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const a = actionOf(route);
    if (a === 'generate') return ok(route, { ok: true, case: SAMPLE_CASE, model: 'claude-sonnet-4-6' });
    if (a === 'critique') return ok(route, { ok: true, critique: SAMPLE_CRITIQUE, model: 'claude-sonnet-4-6' });
    return ok(route, { ok: true });
  });
}

test.describe('Coach Lab — Knowledge Ecosystem', () => {
  test('pillars + Research Vault flip + ingest', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 950 });
    await seedAdmin(page);
    await mockNetwork(page);
    await page.goto('/command/coach-lab');

    await expect(page.locator('[data-testid="coach-lab-module"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cl-tab')).toHaveCount(4);
    await expect(page.locator('.cl-tab-soon')).toHaveCount(0); // all four live
    await expect(page.locator('[data-testid="cl-pillar-research"]')).toHaveAttribute('aria-selected', 'true');

    await expect(page.locator('[data-testid="rv-grid"] .cl-flip')).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS}/06-lab-research-vault.png`, fullPage: true });

    const card = page.locator('[data-testid="rv-card-card-1"]');
    await card.locator('.cl-face-front').click();
    await expect(card).toHaveClass(/is-flipped/);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/07-lab-card-flipped.png`, fullPage: true });

    await page.locator('[data-testid="rv-input"]').fill('Velocity-based training prescribes load from real-time bar speed, autoregulating to daily readiness across a mesocycle.');
    await page.locator('[data-testid="rv-summarize"]').click();
    await expect(page.locator('[data-testid="rv-grid"] .cl-flip')).toHaveCount(2);
  });

  test('Kinesiology Lab drill', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 950 });
    await seedAdmin(page);
    await mockNetwork(page);
    await page.goto('/command/coach-lab');
    await page.locator('[data-testid="cl-pillar-kinesiology"]').click();

    await expect(page.locator('[data-testid="kinesiology-lab"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="kl-mode-match"]').click();
    await expect(page.locator('[data-testid="kl-prompt"]')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/10-lab-kinesiology.png`, fullPage: true });

    await page.locator('[data-testid="kl-opt-correct"]').first().click();
    await expect(page.locator('[data-testid="kl-reveal"]')).toBeVisible();
    await expect(page.locator('[data-testid="kl-reveal"]')).toHaveClass(/is-correct/);
  });

  test('Coach Arena generate + critique, and Broadcast Hub', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1000 });
    await seedAdmin(page);
    await mockNetwork(page);
    await page.goto('/command/coach-lab');

    // Arena — default "Generate a case" draws from the hardwired local deck,
    // zero network calls. Title should be one of the ten hardwired scenarios.
    await page.locator('[data-testid="cl-pillar-arena"]').click();
    await expect(page.locator('[data-testid="coach-arena"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="ar-generate"]').click();
    await expect(page.locator('[data-testid="ar-case"]')).toBeVisible();
    await expect(page.locator('[data-testid="ar-source"]')).toContainText('Deck');
    await expect(page.locator('.ar-case-title')).not.toBeEmpty();

    // "Generate via AI" is the explicit fallback that hits bbf-coach-arena.
    await page.locator('[data-testid="ar-newcase-ai"]').click();
    await expect(page.locator('[data-testid="ar-source"]')).toContainText('AI-Generated');
    await expect(page.locator('.ar-case-title')).toContainText('Point Guard');

    await page.locator('[data-testid="ar-protocol"]').fill('Phase 1: isometric calf + single-leg balance, RPE 6. Phase 2: tempo step-downs, lateral bounds low amplitude. Phase 3: reactive cutting with hop-test gating.');
    await page.locator('[data-testid="ar-submit"]').click();
    await expect(page.locator('[data-testid="ar-critique"]')).toBeVisible();
    await expect(page.locator('.kl-results-pct')).toContainText('78');
    await page.screenshot({ path: `${SHOTS}/11-lab-arena.png`, fullPage: true });

    // Broadcast
    await page.locator('[data-testid="cl-pillar-broadcast"]').click();
    await expect(page.locator('[data-testid="broadcast-hub"]')).toBeVisible();
    await page.locator('[data-testid="bc-pick-card-1"]').click();
    await page.locator('[data-testid="bc-synthesize"]').click();
    await expect(page.locator('[data-testid="bc-result"]')).toBeVisible();
    await expect(page.locator('.bc-output')).toHaveValue(/This Week in the Lab/);
    await page.screenshot({ path: `${SHOTS}/12-lab-broadcast.png`, fullPage: true });
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
