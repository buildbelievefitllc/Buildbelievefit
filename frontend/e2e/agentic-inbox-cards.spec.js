// e2e/agentic-inbox-cards.spec.js — Agentic Command Center · Action Inbox render lock.
// The agentic-expansion cards (SP-0 dry-run Referee promotion + OP-8 mesocycle audit,
// SP-1 catalog bake, SP-2 season taper, SP-9 guardian wire, OP-1 morning brief) all
// surface as coach_action_inbox rows rendered by ActionInbox.jsx. They are data-gated
// (no row → no FAB) AND admin-auth-gated, so a cold app visit shows nothing — by design.
// This spec seeds the brain's `list` response with one of each new type and asserts every
// card body renders, so a future regression that drops a card type fails loudly here.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

// One representative PENDING row per new card type (shapes verified against
// ActionInbox.jsx ActionCard render branches).
const ACTIONS = [
  {
    id: 'demo-brief', type: 'MORNING_BRIEF', status: 'PENDING', risk_score: null,
    created_at: new Date(Date.now() - 2 * 3600e3).toISOString(),
    athlete: { name: 'Command Desk', uid: 'akeem' },
    insight_summary: 'Three decisions need you today.', proposed_action: 'Clear the two safety cards, then the taper.',
    draft_message: '',
    proposed_plan_modification: { morning_brief: { top_actions: [
      { title: 'Approve Marcus game-week taper', why: 'Friday game.' },
      { title: 'Nudge Dana (72h silent)', why: 'SLA breach at 09:00.' },
    ] } },
  },
  {
    id: 'demo-promo', type: 'PHASE_PROMOTION', status: 'PENDING', risk_score: null,
    created_at: new Date(Date.now() - 6 * 3600e3).toISOString(),
    athlete: { name: 'Marcus Bell', uid: 'marcus' },
    insight_summary: 'Marcus cleared Phase 1 gates.', proposed_action: 'Promote Phase 1 → Phase 2.',
    draft_message: '',
    proposed_plan_modification: { promotion: {
      user_id: 'marcus', sport: 'basketball', from_phase: 1, to_phase: 2, is_youth: true,
      telemetry: { mesocycle_week: 4, rpe_avg_last_3: 6.2, friction_avg_last_3: 0.11 },
      current_protocol: { blocks: [{ title: 'Foundation', items: [{ name: 'Goblet Squat', sets: 3 }] }] },
      next_protocol: { blocks: [{ title: 'Accumulation', items: [{ name: 'Front Squat', sets: 4 }, { name: 'RDL', sets: 3 }] }] },
    } },
  },
  {
    id: 'demo-bake', type: 'CATALOG_BAKE', status: 'PENDING', risk_score: null,
    created_at: new Date(Date.now() - 20 * 3600e3).toISOString(),
    athlete: { name: 'Periodization Engine', uid: 'system' },
    insight_summary: 'Basketball catalog baked.', proposed_action: 'Activate to serve blocks.',
    draft_message: '',
    proposed_plan_modification: { catalog_bake: { batch_id: 'demo-batch', baked: 3, failed: 0 } },
  },
  {
    id: 'demo-taper', type: 'SEASON_TAPER', status: 'PENDING', risk_score: null,
    created_at: new Date(Date.now() - 30 * 3600e3).toISOString(),
    athlete: { name: 'Marcus Bell', uid: 'marcus' },
    insight_summary: 'Game Friday.', proposed_action: 'Apply the game-week overlay.',
    draft_message: '',
    proposed_plan_modification: { season_taper: { week_start: '2026-07-20', days: {
      Fri: { volume_multiplier: 0.0, focus_note: 'GAME DAY' },
    } } },
  },
  {
    id: 'demo-wire', type: 'GUARDIAN_WIRE', status: 'PENDING', risk_score: null,
    created_at: new Date(Date.now() - 40 * 3600e3).toISOString(),
    athlete: { name: 'Marcus Bell', uid: 'marcus' },
    insight_summary: 'Monthly Guardian Wire digest drafted.', proposed_action: 'Read the letter, then approve.',
    draft_message: 'Hi — this month Marcus logged 11 of 12 sessions and moved from Phase 1 to Phase 2. — Coach Akeem',
    proposed_plan_modification: { guardian_wire: { period: 'July 2026' } },
  },
];

async function mockBrain(page) {
  await page.route('**/functions/v1/bbf-agent-brain', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS }); return; }
    const body = route.request().postDataJSON?.() || {};
    if (body.action === 'list') {
      await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, count: ACTIONS.length, actions: ACTIONS }) });
      return;
    }
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
  });
}

test.describe('Agentic Command Center — Action Inbox card render lock', () => {
  test('every agentic-expansion card type renders in the sentinel inbox', async ({ page }) => {
    await mockBrain(page);
    await page.addInitScript(() => { window.__HARNESS_PROPS__ = { domain: 'coaching' }; });
    await page.goto(`${HARNESS}?c=action-inbox`);
    await expect(page.getByTestId('harness-root')).toBeVisible();

    // Data-gated FAB: appears only because the brain returned pending rows.
    const fab = page.getByTestId('ainbox-fab');
    await expect(fab).toBeVisible();
    await expect(page.getByTestId('ainbox-count')).toHaveText(String(ACTIONS.length));
    await fab.click();

    const panel = page.getByTestId('ainbox-panel');
    await expect(panel).toBeVisible();

    // OP-1 · Morning Command Brief — the top-decisions block.
    await expect(page.getByTestId('ainbox-morning-brief')).toBeVisible();
    await expect(page.getByTestId('ainbox-morning-brief')).toContainText('Approve Marcus game-week taper');

    // SP-0 dry-run Referee verdict + OP-8 deterministic mesocycle audit.
    const promo = page.getByTestId('ainbox-card-demo-promo');
    await expect(promo.getByTestId('ainbox-promotion')).toContainText('Phase 1 → 2');
    await expect(promo.getByTestId('ainbox-meso-audit')).toContainText('prescribed sets');
    await expect(promo.getByTestId('ainbox-apply')).toContainText('APPROVE PHASE PROMOTION');

    // SP-1 · Catalog bake — validated draft blocks + the activation trigger.
    const bake = page.getByTestId('ainbox-card-demo-bake');
    await expect(bake.getByTestId('ainbox-catalog-bake')).toContainText('validated');
    await expect(bake.getByTestId('ainbox-apply')).toContainText('ACTIVATE BLOCK CATALOG');

    // SP-2 · Season taper — the game-week overlay + the taper trigger.
    const taper = page.getByTestId('ainbox-card-demo-taper');
    await expect(taper.getByTestId('ainbox-season-taper')).toContainText('GAME DAY');
    await expect(taper.getByTestId('ainbox-apply')).toContainText('APPLY GAME-WEEK TAPER');

    // SP-9 · Guardian Wire — the letter is the draft body; approve sends it home.
    const wire = page.getByTestId('ainbox-card-demo-wire');
    await expect(wire.getByTestId('ainbox-apply')).toContainText('APPROVE LETTER HOME');
    await expect(wire).toContainText('Guardian Wire');
  });
});
