// e2e/coaching-velocity.spec.js — Intuition Engine: the Coaching Velocity Index
// + the R2 dossier consolidation, driven through the REAL ClientHub/RosterProvider
// stack with the roster edge fn and admin RPCs route-intercepted.
//
// Locks: (1) a critical-velocity athlete floats to the ABSOLUTE TOP of the grid
// regardless of the active sort; (2) the priority badge renders next to the name
// with the right band; (3) a telemetry-less athlete stays badge-free (calibrating,
// no false flags); (4) selecting an athlete hydrates the Dossier Pulse band from
// ONE bbf_athlete_dossier RPC.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

const ROSTER = [
  { id: 'a1', uid: 'alpha', name: 'Alpha Steady', email: 'a@bbf.fit', role: 'client', subscription_tier: 'autonomous', tdee_target: 2600, updated_at: new Date().toISOString() },
  { id: 'b1', uid: 'bravo', name: 'Bravo Critical', email: 'b@bbf.fit', role: 'client', subscription_tier: 'catalyst', tdee_target: 2200, updated_at: new Date(Date.now() - 20 * 86400000).toISOString() },
  { id: 'c1', uid: 'charlie', name: 'Charlie New', email: 'c@bbf.fit', role: 'client', subscription_tier: 'momentum', tdee_target: 0, updated_at: new Date().toISOString() },
];

const TELEMETRY = [
  // Alpha: active inside 48h, 4/4 week, 92% adherence, fresh touch → locked_in.
  { id: 'a1', status: 'green', adherence_score: 92, sparkline: [900, 1100, 0, 1200, 0, 800, 1000], workout_assigned: 4, workout_completed: 4, tonnage_week: 5000, tonnage_prev: 4000, tonnage_trend: 'up' },
  // Bravo: dark for the whole week, 12% adherence, red flag, 20 days silent → critical.
  { id: 'b1', status: 'red', adherence_score: 12, sparkline: [0, 0, 0, 0, 0, 0, 0], workout_assigned: 4, workout_completed: 0, tonnage_week: 0, tonnage_prev: 0, tonnage_trend: 'flat' },
  // Charlie: no telemetry row at all → calibrating (no badge, never critical).
];

const DOSSIER = {
  ok: true,
  dossier: {
    athlete: { id: 'b1', name: 'Bravo Critical' },
    metrics: {
      readiness_protocols: [{ date: '2026-07-09', readiness_score: 88 }],
      daily_biometrics: [{ date: '2026-07-09', hrv_ms: 65, sleep_minutes: 420 }],
      wearable_readings: [],
    },
    timeline: { completion_events: [], session_feedback: [], recent_sets: [], meal_logs: [], nutrition_sync: [], messages: [] },
    protocols: { prehab_open: [] },
    generated_at: '2026-07-09T12:00:00Z',
  },
};

function fulfillJson(body) {
  return {
    status: 200,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
const routeWithPreflight = (body) => async (route) => {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' } });
    return;
  }
  await route.fulfill(fulfillJson(body));
};

async function mountHub(page) {
  // getStoredVaultToken reads localStorage directly — seed the session envelope.
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({
      uid: 'akeem', vaultToken: 'test-vault-token',
      user: { id: 'u0', username: 'akeem', role: 'admin' },
      plans: null, authenticatedAt: Date.now(),
    }));
  });
  // Action-aware edge-fn mock: 'roster' feeds the list; 'detail' feeds the
  // dossier drill-in; everything else acks empty (analytics etc. are non-fatal).
  await page.route('**/functions/v1/bbf-admin-roster', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' } });
      return;
    }
    let action = '';
    try { action = JSON.parse(route.request().postData() || '{}').action || ''; } catch { /* default */ }
    if (action === 'detail') {
      const id = JSON.parse(route.request().postData()).id;
      const client = ROSTER.find((c) => c.id === id) || null;
      await route.fulfill(fulfillJson({ ok: true, client }));
      return;
    }
    if (action === 'roster') {
      await route.fulfill(fulfillJson({ ok: true, count: ROSTER.length, clients: ROSTER }));
      return;
    }
    await route.fulfill(fulfillJson({ ok: true }));
  });
  // Wildcard RPC net FIRST (playwright matches the most recently registered
  // route first) — any dossier-adjacent RPC not modeled here acks empty.
  await page.route('**/rest/v1/rpc/**', routeWithPreflight({}));
  // getRosterTelemetry reads body.telemetry (protocolOverrideApi.js:52).
  await page.route('**/rest/v1/rpc/bbf_admin_roster_telemetry', routeWithPreflight({ telemetry: TELEMETRY }));
  await page.route('**/rest/v1/rpc/bbf_admin_roster_calibration', routeWithPreflight([]));
  await page.route('**/rest/v1/rpc/bbf_athlete_dossier', routeWithPreflight(DOSSIER));
  await page.goto(`${HARNESS}?c=client-hub`);
}

test('critical outreach alert floats to the absolute top and wears the band badge', async ({ page }) => {
  await mountHub(page);

  // Bravo is SECOND in the roster payload; the critical float puts him first.
  const rows = page.locator('.ff-row');
  await expect(rows.first()).toHaveAttribute('data-testid', 'roster-row-b1');
  await expect(rows.first()).toHaveClass(/ff-row--outreach/);

  // Priority badges: Bravo critical, Alpha locked-in, Charlie badge-free (calibrating).
  const bravoBadge = page.getByTestId('roster-row-b1').getByTestId('velocity-badge');
  await expect(bravoBadge).toHaveAttribute('data-band', 'critical');
  await expect(bravoBadge).toContainText(/outreach now/i);

  const alphaBadge = page.getByTestId('roster-row-a1').getByTestId('velocity-badge');
  await expect(alphaBadge).toHaveAttribute('data-band', 'locked_in');

  await expect(page.getByTestId('roster-row-c1').getByTestId('velocity-badge')).toHaveCount(0);
});

test('critical float holds under every sort mode, and the Velocity sort ranks ascending', async ({ page }) => {
  await mountHub(page);

  for (const sort of ['tonnage', 'adherence', 'velocity', 'name']) {
    await page.getByTestId(`roster-sort-${sort}`).click();
    await expect(page.locator('.ff-row').first()).toHaveAttribute('data-testid', 'roster-row-b1');
  }

  // Velocity ↑: b1 (critical) then a1 (locked-in); c1 (no score) sinks last.
  await page.getByTestId('roster-sort-velocity').click();
  const ids = await page.locator('.ff-row').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
  expect(ids).toEqual(['roster-row-b1', 'roster-row-a1', 'roster-row-c1']);
});

test('selecting an athlete hydrates the Dossier Pulse from ONE consolidated RPC', async ({ page }) => {
  await mountHub(page);

  let dossierCalls = 0;
  page.on('request', (req) => {
    if (req.url().includes('/rest/v1/rpc/bbf_athlete_dossier') && req.method() === 'POST') dossierCalls += 1;
  });

  await page.getByTestId('roster-row-b1').click();
  const pulse = page.getByTestId('dossier-pulse');
  await expect(pulse).toBeVisible();
  await expect(pulse).toContainText('88');        // readiness from the aggregate
  await expect(pulse).toContainText('65ms HRV');  // vitals from the SAME payload
  await expect(pulse).toContainText('Clear');     // empty prehab queue degrades cleanly
  expect(dossierCalls).toBe(1);
});
