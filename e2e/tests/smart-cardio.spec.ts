import { test, expect, type Page } from '@playwright/test';
import { seedClientSession, installSupabaseBaseline, json, isPreflight } from './support/vault.js';

/**
 * HELD ACCEPTANCE SPEC — Smart Cardio module (Terminal 4 lane)
 * ===========================================================
 * STATUS: COMMITTED, NOT RUN IN CI. Every test self-skips until the frontend
 * Smart Cardio UI is deployed (Terminal 2 is still building it). Enable with
 * BBF_CARDIO_READY=1.
 *
 * REALIGNED to the SHIPPED contract. The cardio read endpoint that actually went
 * live is the token-gated SECURITY DEFINER RPC `bbf_get_cardio` — NOT the earlier
 * proposed `bbf_get_cardio_plan`. The deprecated readiness/ratio/sessions shape
 * has been removed; those fields are not part of the live RPC.
 *
 * ── DATA CONTRACT (live — bbf_get_cardio) ────────────────────────────────────
 *   supabase.rpc('bbf_get_cardio', { p_session_token, p_log_limit })
 *     → { ok: true,
 *         protocols: [ {                       // active prescriptions, newest first
 *             id, zone, title, target_duration_min, intensity, protocol_detail, generated_at
 *           } ],
 *         logs: [ {                            // athlete's recent sessions, newest first
 *             id, protocol_id, session_date, zone, duration_min, intensity, avg_hr, notes, created_at
 *           } ] }
 *   zone ∈ {'hiit','tempo','zone2'} (bbf_cardio_zone enum).
 *   Invalid/expired token → { ok:false, error:'invalid_session' }.
 *
 * ── UI CONTRACT (frontend — required test hooks) ─────────────────────────────
 *   [data-testid="vault-tab-cardio"]     tab/button that opens the module
 *   [data-testid="smart-cardio-module"]  module container
 *   [data-testid="cardio-protocol"]      one per active protocol; carries
 *                                        [data-zone="hiit|tempo|zone2"]
 *     [data-testid="cardio-protocol-title"]     title
 *     [data-testid="cardio-protocol-zone"]      zone label (presentation T2's choice)
 *     [data-testid="cardio-protocol-duration"]  renders target_duration_min
 *     [data-testid="cardio-protocol-intensity"] intensity
 *     [data-testid="cardio-protocol-detail"]    protocol_detail
 *   [data-testid="cardio-log"]           one per logged session; carries
 *                                        [data-zone="…"]
 *     [data-testid="cardio-log-date"]       session_date
 *     [data-testid="cardio-log-duration"]   renders duration_min
 *   [data-testid="cardio-empty"]         empty state when no protocols are active
 *
 * Hermetic: the RPC is mocked and a tripwire asserts no call reaches the real
 * Supabase project host.
 */

const READY = process.env.BBF_CARDIO_READY === '1';

// Active prescriptions (bbf_cardio_protocols · is_active, newest-first).
const PROTOCOLS = [
  { id: 'p_z2',   zone: 'zone2', title: 'Aerobic Base',   target_duration_min: 30, intensity: 'conversational', protocol_detail: '30 min steady · 3.5 mph @ 8% incline · nasal breathing only', generated_at: '2026-06-01T12:00:00Z' },
  { id: 'p_hiit', zone: 'hiit',  title: 'EPOC Intervals', target_duration_min: 12, intensity: 'max',            protocol_detail: '6 × 1 min hard / 1 min easy on the assault bike',          generated_at: '2026-06-01T12:00:00Z' },
];

// Recent logged sessions (bbf_cardio_logs · session_date DESC).
const LOGS = [
  { id: 'l1', protocol_id: 'p_z2',   session_date: '2026-05-31', zone: 'zone2', duration_min: 32, intensity: 'conversational', avg_hr: 138, notes: 'felt strong', created_at: '2026-05-31T18:02:00Z' },
  { id: 'l2', protocol_id: 'p_hiit', session_date: '2026-05-29', zone: 'hiit',  duration_min: 12, intensity: 'max',            avg_hr: 171, notes: null,          created_at: '2026-05-29T07:14:00Z' },
];

async function mockCardioRpc(page: Page, body: unknown) {
  await page.route('**/rest/v1/rpc/bbf_get_cardio', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, body);
  });
}

test.describe('BBF Vault — Smart Cardio module (acceptance)', () => {
  test.beforeEach(() => {
    test.skip(
      !READY,
      'Held: enable once the Smart Cardio UI is deployed against the live bbf_get_cardio RPC (BBF_CARDIO_READY=1).',
    );
  });

  test('displays active cardio protocols with zone, title, duration, and detail', async ({ page }) => {
    await seedClientSession(page);
    const { realDbHits } = await installSupabaseBaseline(page);
    await mockCardioRpc(page, { ok: true, protocols: PROTOCOLS, logs: [] });

    await page.goto('/');
    await page.getByTestId('vault-tab-cardio').click();

    await expect(page.getByTestId('smart-cardio-module')).toBeVisible();

    const cards = page.getByTestId('cardio-protocol');
    await expect(cards).toHaveCount(PROTOCOLS.length);

    for (const p of PROTOCOLS) {
      const card = cards.filter({ hasText: p.title });
      await expect(card).toHaveCount(1);
      await expect(card).toHaveAttribute('data-zone', p.zone);
      await expect(card.getByTestId('cardio-protocol-title')).toHaveText(p.title);
      await expect(card.getByTestId('cardio-protocol-duration')).toContainText(String(p.target_duration_min));
      await expect(card.getByTestId('cardio-protocol-detail')).toContainText(p.protocol_detail);
    }

    // Hermetic: nothing touched the real database.
    expect(realDbHits).toHaveLength(0);
  });

  test('displays the athlete’s recent cardio logs, newest first', async ({ page }) => {
    await seedClientSession(page);
    await installSupabaseBaseline(page);
    await mockCardioRpc(page, { ok: true, protocols: PROTOCOLS, logs: LOGS });

    await page.goto('/');
    await page.getByTestId('vault-tab-cardio').click();

    const rows = page.getByTestId('cardio-log');
    await expect(rows).toHaveCount(LOGS.length);

    // RPC returns logs session_date DESC, so row order mirrors LOGS.
    for (let i = 0; i < LOGS.length; i++) {
      const row = rows.nth(i);
      await expect(row).toHaveAttribute('data-zone', LOGS[i].zone);
      await expect(row.getByTestId('cardio-log-duration')).toContainText(String(LOGS[i].duration_min));
      await expect(row.getByTestId('cardio-log-date')).toBeVisible();
    }
  });

  test('shows an empty state when no cardio is prescribed', async ({ page }) => {
    await seedClientSession(page);
    await installSupabaseBaseline(page);
    await mockCardioRpc(page, { ok: true, protocols: [], logs: [] });

    await page.goto('/');
    await page.getByTestId('vault-tab-cardio').click();

    await expect(page.getByTestId('cardio-empty')).toBeVisible();
    await expect(page.getByTestId('cardio-protocol')).toHaveCount(0);
  });
});
