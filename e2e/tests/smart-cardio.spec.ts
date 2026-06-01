import { test, expect, type Page } from '@playwright/test';
import { seedClientSession, installSupabaseBaseline, json, isPreflight } from './support/vault.js';

/**
 * HELD ACCEPTANCE SPEC — Smart Cardio module (Terminal 4 lane)
 * ===========================================================
 * STATUS: COMMITTED, NOT RUN IN CI. Every test is skipped until BOTH the
 * frontend Smart Cardio UI and the Terminal-3 `bbf_get_cardio_plan` RPC are
 * deployed. Flip it on with `BBF_CARDIO_READY=1`.
 *
 * "Smart Cardio" surfaces the Autonomic Readiness Engine (are-engine.js):
 * prescribed Zone 2 / Zone 4 sessions, the 80/20 Z2/Z4 ratio guidance, and the
 * `auditConcurrent` readiness verdict (Zone-4 HIIT vs a 1RM/strength goal →
 * interference). This file is the CONTRACT the frontend + data layers build to.
 *
 * ── DATA CONTRACT (Terminal 3 — bbf_get_cardio_plan RPC) ─────────────────────
 *   supabase.rpc('bbf_get_cardio_plan', { target_uid })
 *     → { ok: true,
 *         readiness: { tier: 'clear'|'caution'|'interference', message: string },
 *         ratio: string,                         // e.g. "80/20 Z2/Z4"
 *         sessions: [ { slug, modality, zone, target_minutes:number,
 *                       hr_range:string, cue:string } ] }
 *
 * ── UI CONTRACT (frontend — required test hooks) ─────────────────────────────
 *   [data-testid="vault-tab-cardio"]      tab/button that opens the module
 *   [data-testid="smart-cardio-module"]   module container
 *   [data-testid="cardio-readiness"]      readiness banner; carries
 *                                         [data-tier="clear|caution|interference"]
 *   [data-testid="cardio-ratio"]          Z2/Z4 ratio guidance
 *   [data-testid="cardio-session"]        one per prescribed session
 *     [data-testid="cardio-modality"]       e.g. "Treadmill"
 *     [data-testid="cardio-zone"]           e.g. "Zone 2"
 *     [data-testid="cardio-duration"]       e.g. "30 min" (renders target_minutes)
 *     [data-testid="cardio-cue"]            params / HR cue
 *   [data-testid="cardio-empty"]          empty state (no cardio prescribed)
 *
 * Hermetic: the RPC is mocked and a tripwire asserts no call reaches the real
 * Supabase project host.
 */

const READY = process.env.BBF_CARDIO_READY === '1';

const SESSIONS = [
  { slug: 'z2_base', modality: 'Treadmill', zone: 'Zone 2', target_minutes: 30, hr_range: '60–70% HR', cue: '3 mph, Level 6 incline — nasal-breathing pace' },
  { slug: 'z4_intervals', modality: 'Bike', zone: 'Zone 4', target_minutes: 12, hr_range: '85–95% HR', cue: '6 × 1 min hard / 1 min easy' },
];

const PLAN_CLEAR = {
  ok: true,
  readiness: { tier: 'clear', message: 'No interference — your Zone 2 base supports your current strength goal.' },
  ratio: '80/20 Z2/Z4',
  sessions: SESSIONS,
};

const PLAN_INTERFERENCE = {
  ok: true,
  readiness: { tier: 'interference', message: 'Zone 4 HIIT logged against a 1RM goal — interference risk. Move hard cardio away from leg day.' },
  ratio: '80/20 Z2/Z4',
  sessions: SESSIONS,
};

async function mockCardioRpc(page: Page, body: unknown) {
  await page.route('**/rest/v1/rpc/bbf_get_cardio_plan', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, body);
  });
}

test.describe('BBF Vault — Smart Cardio module (acceptance)', () => {
  test.beforeEach(() => {
    test.skip(
      !READY,
      'Held: enable once the Smart Cardio UI + bbf_get_cardio_plan RPC are deployed (BBF_CARDIO_READY=1).',
    );
  });

  test('displays prescribed sessions with zone, modality, duration, and cue', async ({ page }) => {
    await seedClientSession(page);
    const { realDbHits } = await installSupabaseBaseline(page);
    await mockCardioRpc(page, PLAN_CLEAR);

    await page.goto('/');
    await page.getByTestId('vault-tab-cardio').click();

    await expect(page.getByTestId('smart-cardio-module')).toBeVisible();
    await expect(page.getByTestId('cardio-ratio')).toContainText('80/20');

    const sessions = page.getByTestId('cardio-session');
    await expect(sessions).toHaveCount(SESSIONS.length);

    for (const s of SESSIONS) {
      const card = sessions.filter({ hasText: s.zone });
      await expect(card).toHaveCount(1);
      await expect(card.getByTestId('cardio-modality')).toContainText(s.modality);
      await expect(card.getByTestId('cardio-zone')).toContainText(s.zone);
      await expect(card.getByTestId('cardio-duration')).toContainText(String(s.target_minutes));
      await expect(card.getByTestId('cardio-cue')).toContainText(s.cue);
    }

    expect(realDbHits).toHaveLength(0);
  });

  test('surfaces a CLEAR readiness verdict when there is no interference', async ({ page }) => {
    await seedClientSession(page);
    await installSupabaseBaseline(page);
    await mockCardioRpc(page, PLAN_CLEAR);

    await page.goto('/');
    await page.getByTestId('vault-tab-cardio').click();

    const banner = page.getByTestId('cardio-readiness');
    await expect(banner).toHaveAttribute('data-tier', 'clear');
    await expect(banner).toContainText(PLAN_CLEAR.readiness.message);
  });

  test('surfaces an INTERFERENCE readiness verdict (Zone 4 vs 1RM goal)', async ({ page }) => {
    await seedClientSession(page);
    await installSupabaseBaseline(page);
    await mockCardioRpc(page, PLAN_INTERFERENCE);

    await page.goto('/');
    await page.getByTestId('vault-tab-cardio').click();

    const banner = page.getByTestId('cardio-readiness');
    await expect(banner).toHaveAttribute('data-tier', 'interference');
    await expect(banner).toContainText('interference');
  });

  test('shows an empty state when no cardio is prescribed', async ({ page }) => {
    await seedClientSession(page);
    await installSupabaseBaseline(page);
    await mockCardioRpc(page, { ok: true, readiness: { tier: 'clear', message: 'No cardio prescribed yet.' }, ratio: '80/20 Z2/Z4', sessions: [] });

    await page.goto('/');
    await page.getByTestId('vault-tab-cardio').click();

    await expect(page.getByTestId('cardio-empty')).toBeVisible();
    await expect(page.getByTestId('cardio-session')).toHaveCount(0);
  });
});
