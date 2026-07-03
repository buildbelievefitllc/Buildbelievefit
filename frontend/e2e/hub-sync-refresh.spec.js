// e2e/hub-sync-refresh.spec.js — Round-2 Defect 3: Smart Cardio sync doesn't update Hub.
// Locks: dispatching the SAME window event SmartCardio fires on "Complete & Sync"
// (bbf:protocol-updated) makes the Hub re-hydrate and the Cardio block reflect the new
// session immediately. Uses RPC interception to serve a changed payload on the refetch.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

function payload(cardio) {
  return {
    ok: true, uid: 'akeem', profile_id: 'p1', day: '2026-07-03', pipeline_state: null,
    nutrition_today: null,
    cardio_today: cardio,
    prehab_card: { queued: [], count: 0 },
    brief_playlist: null,
    profile: { uid: 'akeem', full_name: 'Akeem', preferred_language: 'en', sport: 'general', tier: 'foundation' },
    intents: { tier: 'foundation', sport: 'general', locale: 'en' },
    defaults: {
      nutrition: { tier: 'foundation', tdee_kcal: 2765, protein_g: 180, carbs_g: 320, fat_g: 85, day_type: 'standard' },
      cardio: { effective_tier: 'Zone 2', recovery_state: 'unknown', duration_min: 30, ee_kcal_est: 257, sweat_loss_g_est: 367, rehydration_g: 551 },
    },
  };
}

test('Defect 3 — a Smart Cardio sync event re-hydrates the Hub immediately', async ({ page }) => {
  // Seed a vault session token so the hydration hook proceeds to fetch.
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });

  let calls = 0;
  await page.route('**/rest/v1/rpc/bbf_hub_hydration', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    calls += 1;
    const cardio = calls === 1
      ? { effective_tier: 'Zone 2', recovery_state: 'clear', ee_kcal_est: 111, duration_min: 11, sweat_loss_g_est: 100, rehydration_g: 150 }
      : { effective_tier: 'HIIT', recovery_state: 'clear', ee_kcal_est: 999, duration_min: 99, sweat_loss_g_est: 900, rehydration_g: 950 };
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(payload(cardio)) });
  });

  await page.goto(`${HARNESS}?c=dashboard-hub`);

  const energy = page.locator('.hub-card--cardio .hub-metric-value').first();
  await expect(energy).toContainText('111'); // initial hydration

  // Fire the exact event SmartCardio.completeProtocol() dispatches on "Complete & Sync".
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('bbf:protocol-updated', { detail: {} })));

  await expect(energy).toContainText('999'); // Hub re-hydrated with the logged session
  expect(calls).toBeGreaterThanOrEqual(2);
});
