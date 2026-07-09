// e2e/comlink-tdee-signals.spec.js — Comlink Dashboard Unification (Phase 21).
//
// Locks: the Comlink surface renders a segmented toggle — "Applications" (the
// existing Pathfinder queue, completely untouched) vs "TDEE Signals" (the new
// bbf_tdee_leads-backed view) — and switching to TDEE Signals fires the
// tdee_leads_list action and renders name/email, target calorie chips, goal
// labels, and a "Converted" badge for leads whose converted_lead_id is set.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const url = (c) => `${HARNESS}?c=${c}`;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};
const json = (body) => ({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const preflight = (route) => route.fulfill({ status: 204, headers: CORS });

const LEADS_LIST = {
  ok: true, total: 1, provisioned: 0, pending: 1,
  leads: [{ id: 'l1', source: 'pathfinder', email: 'applicant@example.com', full_name: 'Applicant One', tier: 'sovereign', created_at: '2026-07-01T00:00:00Z', provisioned: false, primary_goal: 'fat-loss', dietary_profile: 'Omnivore', allergens: [] }],
};
const CONCIERGE_LOG = { ok: true, total: 0, runs: [] };
const TDEE_LEADS = {
  ok: true, total: 2, converted: 1,
  leads: [
    { id: 't1', source: 'tdee_calculator', email: 'signal-one@example.com', full_name: 'Signal One', goal: 'cut', tdee_maintenance: 2600, tdee_target: 2100, macro_p: 180, macro_c: 200, macro_f: 60, converted_lead_id: 'l1', created_at: '2026-07-05T00:00:00Z' },
    { id: 't2', source: 'daily_burn', email: 'signal-two@example.com', full_name: 'Signal Two', goal: null, tdee_maintenance: 2400, tdee_target: null, macro_p: null, macro_c: null, macro_f: null, converted_lead_id: null, created_at: '2026-07-06T00:00:00Z' },
  ],
};

async function setup(page) {
  await page.addInitScript(() => window.localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' })));
  await page.route('**/*.supabase.co/**', (route) => (route.request().method() === 'OPTIONS' ? preflight(route) : route.fulfill(json({ ok: true }))));
  await page.route('**/functions/v1/bbf-admin-roster', (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    const body = route.request().postDataJSON() || {};
    if (body.action === 'leads_list') return route.fulfill(json(LEADS_LIST));
    if (body.action === 'concierge_log') return route.fulfill(json(CONCIERGE_LOG));
    if (body.action === 'tdee_leads_list') return route.fulfill(json(TDEE_LEADS));
    return route.fulfill(json({ ok: false, error: 'unknown_action' }));
  });
}

test('Comlink renders the Applications/TDEE Signals toggle; Applications is untouched', async ({ page }) => {
  await setup(page);
  await page.goto(url('comlink'));

  // Applications is the default view — the existing Pathfinder queue, unchanged.
  await expect(page.getByRole('tab', { name: 'Applications' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Applicant One')).toBeVisible();
  await expect(page.getByText('applicant@example.com')).toBeVisible();
});

test('TDEE Signals view renders name/email, calorie chips, goal, and a Converted badge', async ({ page }) => {
  await setup(page);
  await page.goto(url('comlink'));

  await page.getByRole('tab', { name: 'TDEE Signals' }).click();
  await expect(page.getByRole('tab', { name: 'TDEE Signals' })).toHaveAttribute('aria-selected', 'true');

  // Applications content is gone — a genuinely separate lane, not merged.
  await expect(page.getByText('Applicant One')).not.toBeVisible();

  // The converted signal shows its badge + goal + calorie chips.
  await expect(page.getByText('Signal One')).toBeVisible();
  await expect(page.getByText('signal-one@example.com')).toBeVisible();
  // Two "Converted" nodes exist (the summary Tile label + the row Badge) — the
  // Badge is the last exact match in DOM order.
  await expect(page.getByText('Converted', { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/Goal: cut/)).toBeVisible();
  await expect(page.getByText(/2,100 target kcal/)).toBeVisible();

  // The non-converted signal renders with no badge and tolerates missing macros.
  await expect(page.getByText('Signal Two')).toBeVisible();
  await expect(page.getByText(/2,400 maintenance kcal/)).toBeVisible();
});
