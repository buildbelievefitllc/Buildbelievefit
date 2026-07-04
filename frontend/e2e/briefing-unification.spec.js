// e2e/briefing-unification.spec.js — Mandate 1: the unified Sovereign Briefing.
// Locks: (a) the Hub NO LONGER renders any Audio Brief card — even when the hydration
// payload carries a populated brief_playlist slice; (b) the unified player inside the
// check-in flow (SovereignBriefingCard) mounts, plays from the WORKING source, and
// shows the transplanted runtime metric read from the actually-loaded audio.

import { test, expect } from '@playwright/test';
import { silentWav } from './helpers/wav.js';

const HARNESS = '/e2e/harness/index.html';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

test('Hub renders NO audio brief card, even with a populated playlist slice', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  // Catch-all first (fail-fast for any stray supabase call), then the specific RPC.
  await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{}' }));
  await page.route('**/rest/v1/rpc/bbf_hub_hydration', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    await route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: true, uid: 'akeem', profile_id: 'p1', day: '2026-07-03', pipeline_state: null,
        nutrition_today: null, cardio_today: null,
        prehab_card: { queued: [], count: 0 },
        // Populated slice — the Hub must STILL not render a brief card (it's removed).
        brief_playlist: { tone: 'grounded', total_duration_ms: 42000, status: 'ready', fragment_count: 5 },
        profile: { uid: 'akeem' }, intents: {},
        defaults: {
          nutrition: { tier: 'foundation', tdee_kcal: 2765, protein_g: 180, carbs_g: 320, fat_g: 85, day_type: 'standard' },
          cardio: { effective_tier: 'Zone 2', recovery_state: 'unknown', duration_min: 30, ee_kcal_est: 257, sweat_loss_g_est: 367, rehydration_g: 551 },
        },
      }),
    });
  });

  await page.goto(`${HARNESS}?c=dashboard-hub`);
  await expect(page.getByTestId('dashboard-hub')).toBeVisible();
  await expect(page.locator('.hub-card--cardio .hub-metric-value').first()).toContainText('257');

  // The redundant Hub audio surface is gone — exactly the 3 remaining cards.
  await expect(page.locator('.hub-card--brief')).toHaveCount(0);
  await expect(page.locator('.hub-card')).toHaveCount(3);
});

test('Check-In unified player: exactly ONE play action, no legacy player, toggles play/pause', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{}' }));
  // The working audio source — a real decodable clip served at a fixture path.
  await page.route('**/__fixtures__/brief.wav', (route) => route.fulfill({
    status: 200,
    headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' },
    body: silentWav(2000),
  }));
  await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, { overrideRefPath: '/__fixtures__/brief.wav' });

  await page.goto(`${HARNESS}?c=sovereign-briefing`);

  const card = page.getByTestId('sovereign-briefing');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-phase', 'ready');

  // ONE unified play action: exactly one button in the card, zero native-controls
  // players (the legacy visible <audio controls> is gone — hidden engine only).
  await expect(card.locator('button')).toHaveCount(1);
  await expect(card.locator('audio[controls]')).toHaveCount(0);
  await expect(page.getByTestId('sovereign-briefing-audio')).toBeHidden();

  // Transplanted chrome intact: ready chip + REAL runtime from the loaded metadata.
  await expect(page.getByTestId('sovereign-briefing-ready-chip')).toBeVisible();
  await expect(page.getByTestId('sovereign-briefing-runtime')).toHaveText('0:02');

  // The single button is a true transport: play → pause label → play again.
  const play = page.getByTestId('sovereign-briefing-play');
  await play.click();
  await expect(play).toContainText(/Pause/i);
  await play.click();
  await expect(play).not.toContainText(/Pause/i);
});
