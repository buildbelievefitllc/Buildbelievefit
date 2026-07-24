// e2e/checkin-symptom-routing.spec.js — the Check-In → Prehab/Recovery symptom loop.
// Locks the architectural reconciliation:
//   1. A logged "Shoulder" issue routes the Prehab Protocol Deck to the SHOULDER
//      protocol ("Rotator Cuff & Scapular Decompression") — explicitly NOT the
//      lumbar "Spine Decompression & Pelvic Stabilization" fallback.
//   2. The live check-in dispatch (bbf:protocol-updated with the symptom payload)
//      re-routes an already-mounted Prehab surface instantly, no reload.
//   3. Sovereign Prep factors the flagged joint: the recovery-engine request's
//      yesterday_muscle_groups leads with the shoulder bucket.
//   4. The Hub Prehab card renders the reported joint from the queue payload.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

const json = (body) => ({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });

// Serve every supabase surface locally: catch-all first, specific routes override.
async function baseRoutes(page, { prescription = null } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  await page.route('**/*.supabase.co/**', (route) => route.fulfill(json({})));
  await page.route('**/functions/v1/bbf-prescription-today', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill(json({ ok: true, playlist: prescription })));
}

const SHOULDER_RX = { id: 'p1', target_area: 'shoulder', pain_score: 6, action: 'maintain', exercises: [], scheduled_for: '2026-07-05' };

test('a logged Shoulder issue routes the Protocol Deck to shoulder — not the lumbar fallback', async ({ page }) => {
  await baseRoutes(page, { prescription: SHOULDER_RX });
  await page.goto(`${HARNESS}?c=prehab`);

  const deck = page.getByTestId('protocol-deck');
  await expect(deck).toBeVisible();
  await expect(deck).toHaveAttribute('data-region', 'shoulder');
  await expect(deck).toContainText('Rotator Cuff & Scapular Decompression');
  await expect(deck).not.toContainText('Spine Decompression & Pelvic Stabilization');

  // The Joint Symptom Diagnostic pre-isolated the reported joint (Step 1 answered).
  // The chip now shows the plain-English display label (DIAG_LABELS in Prehab.jsx);
  // the underlying selection value stays the raw 'Glenohumeral / Scapulothoracic' key.
  const diag = page.getByTestId('prehab-diagnostic');
  await expect(diag.getByRole('radio', { name: 'Shoulder & Upper Back' })).toHaveAttribute('aria-checked', 'true');
});

test('no symptom logged → the deck keeps its neutral default (and manual taps win)', async ({ page }) => {
  await baseRoutes(page, { prescription: null });
  await page.goto(`${HARNESS}?c=prehab`);
  const deck = page.getByTestId('protocol-deck');
  await expect(deck).toHaveAttribute('data-region', 'lower_back'); // neutral catalog default
  // Manual agency: tapping Knee pins the deck.
  await page.getByTestId('prehab-region-knee').click();
  await expect(deck).toHaveAttribute('data-region', 'knee');
});

test('a live check-in dispatch re-routes the mounted Prehab surface instantly', async ({ page }) => {
  await baseRoutes(page, { prescription: null });
  await page.goto(`${HARNESS}?c=prehab`);
  const deck = page.getByTestId('protocol-deck');
  await expect(deck).toHaveAttribute('data-region', 'lower_back');

  // The exact event submitSessionFeedback broadcasts on the 200.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('bbf:protocol-updated', {
    detail: { source: 'post_workout_checkin', target_area: 'shoulder', pain_score: 6 },
  })));

  await expect(deck).toHaveAttribute('data-region', 'shoulder'); // same tick — no reload
  await expect(deck).toContainText('Rotator Cuff & Scapular Decompression');
});

test('Sovereign Prep leads yesterday-loads with the flagged shoulder bucket', async ({ page }) => {
  await baseRoutes(page, { prescription: SHOULDER_RX });

  let prepBody = null;
  await page.route('**/functions/v1/bbf-agentic-recovery', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { prepBody = route.request().postDataJSON(); } catch { prepBody = {}; }
    await route.fulfill(json({ recovery_stretches: [], prep_drills: [], foam_rolling: [], meta: {} }));
  });

  await page.goto(`${HARNESS}?c=recovery`);
  await expect(page.getByTestId('vault-recovery')).toBeVisible();

  // One engine call with the COMPLETE picture — the flagged joint leads the prep.
  await expect.poll(() => prepBody?.yesterday_muscle_groups?.[0]).toBe('shoulders');
});

test('the Hub Prehab card renders the reported joint from the queue payload', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  await page.route('**/rest/v1/rpc/bbf_hub_hydration', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill(json({
          ok: true, uid: 'akeem', profile_id: 'p1', day: '2026-07-05', pipeline_state: null,
          nutrition_today: null, cardio_today: null,
          prehab_card: { queued: [{ joint_zone: 'shoulder', priority: 'strong', risk_score: 60 }], count: 1 },
          profile: { uid: 'akeem' }, intents: {}, defaults: null,
        })));
  await page.goto(`${HARNESS}?c=dashboard-hub`);
  const prehabCard = page.locator('.hub-card--prehab');
  await expect(prehabCard).toContainText('Shoulder');
  await expect(prehabCard).toContainText('Strong');
});
