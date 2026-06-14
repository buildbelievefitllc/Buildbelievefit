import { test, expect, type Page, type Route } from '@playwright/test';
import {
  CLIENT_SESSION,
  installSupabaseBaseline,
  isPreflight,
  json,
  seedClientSession,
  type SessionEnvelope,
} from './support/vault.js';

/**
 * BBF Vault — Check-In: Manual Health Input + Health Connect diagnostic (Terminal 4)
 * ================================================================================
 * Browser-drone coverage of the Sovereign Readiness fixes:
 *
 *   1. The readiness engine never zeroes out — a hand-entered baseline (no
 *      wearable) produces a REAL, actionable score through the SAME pipeline a
 *      Health Connect sync uses (bbf_upsert_daily_biometrics → engine →
 *      bbf_log_daily_protocol).
 *   2. "Save Baseline" writes the canonical recovery shape and the engine logs a
 *      protocol with a non-null, non-zero readiness_score.
 *   3. The Health Connect Status panel reports the bridge as Disconnected on web
 *      and shows a Null payload snapshot with a "Never" last-sync — the zero-guess
 *      diagnostic.
 *
 * Hermetic: every Supabase REST/RPC call is intercepted; a tripwire aborts (and
 * records) any call to the real project host so the run can never touch prod.
 *
 * Verified against source: SovereignClientHub.jsx (governor default 'manual',
 * Manual Health Input form + testids), manualBaseline.js (recovery shape),
 * vitalsPipeline.js (runManualVitalsPipeline), biometricsApi.js (RPC names),
 * HealthConnectStatus.jsx (diagnostic testids).
 */

// The Sovereign biometric RPCs are vault-token gated client-side, so the seeded
// session MUST carry a vaultToken (getStoredVaultToken reads session.vaultToken).
const SESSION: SessionEnvelope = { ...CLIENT_SESSION, vaultToken: 'e2e-vault-token' };

const MANUAL = { sleepHours: '8', activeKcal: '350', quality: 8, stress: 3 };

interface Captures {
  days: Array<Record<string, unknown>>;
  protocols: Array<Record<string, unknown>>;
}

/** Stub the biometric ledger surface (registered AFTER the baseline so it wins). */
async function stubBiometrics(page: Page): Promise<Captures> {
  const captures: Captures = { days: [], protocols: [] };

  // Mount read — start with an empty ledger (no prior telemetry).
  await page.route('**/rest/v1/rpc/bbf_get_biometric_ledger', (route: Route) => {
    if (isPreflight(route)) return;
    return json(route, 200, { ok: true, as_of: '2026-06-14', series: [], latest_protocol: null });
  });

  // Manual save → upsert the day. Capture p_day; echo it back as the series so the
  // engine scores against a real (single-day) series.
  await page.route('**/rest/v1/rpc/bbf_upsert_daily_biometrics', (route: Route) => {
    if (isPreflight(route)) return;
    let day: Record<string, unknown> = {};
    try { day = (route.request().postDataJSON()?.p_day as Record<string, unknown>) || {}; } catch { day = {}; }
    captures.days.push(day);
    return json(route, 200, { ok: true, biometric_id: 'e2e-bio-1', series: [day] });
  });

  // Engine verdict persisted here. Capture p_protocol for the score assertion.
  await page.route('**/rest/v1/rpc/bbf_log_daily_protocol', (route: Route) => {
    if (isPreflight(route)) return;
    let protocol: Record<string, unknown> = {};
    try { protocol = (route.request().postDataJSON()?.p_protocol as Record<string, unknown>) || {}; } catch { protocol = {}; }
    captures.protocols.push(protocol);
    return json(route, 200, { ok: true, protocol_id: 'e2e-proto-1' });
  });

  return captures;
}

/** Set a range <input> value the React way (native setter + input event). */
async function setRange(page: Page, testId: string, value: number): Promise<void> {
  await page.getByTestId(testId).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const proto = window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.describe('BBF Vault — Check-In manual health input', () => {
  test('a hand-entered baseline yields a real readiness score (engine never zeroes out)', async ({ page }) => {
    await seedClientSession(page, SESSION);
    const { realDbHits } = await installSupabaseBaseline(page);
    const captures = await stubBiometrics(page);

    // Land in the Vault and open the Check-In tab.
    await page.goto('/vault');
    await expect(page.locator('.cv-greet')).toContainText('@jacque_bbf');
    await page.getByRole('tab', { name: 'Check-In' }).click();
    await expect(page.getByTestId('sovereign-client-hub')).toBeVisible();

    // Governor defaults to Manual Baseline → the Manual Health Input form is shown.
    const form = page.getByTestId('sch-manual-input');
    await expect(form).toBeVisible();

    // The Health Connect diagnostic is present and reports Disconnected on web.
    await expect(page.getByTestId('sch-hc-state')).toContainText('Disconnected');

    // Fill the baseline: sleep hours + active kcal (numeric), quality + stress (sliders).
    await page.getByTestId('sch-mi-sleep-h').fill(MANUAL.sleepHours);
    await page.getByTestId('sch-mi-burn').fill(MANUAL.activeKcal);
    await setRange(page, 'sch-mi-sleep-q', MANUAL.quality);
    await setRange(page, 'sch-mi-stress', MANUAL.stress);

    // Save → local Dexie write + the full readiness pipeline.
    await page.getByTestId('sch-mi-save').click();
    await expect(page.getByTestId('sch-mi-ok')).toBeVisible();

    // The verdict dossier renders a REAL numeric score (never '—', never 0).
    const score = page.getByTestId('sch-score');
    await expect(score).toBeVisible();
    const scoreText = (await score.textContent())?.trim() ?? '';
    expect(scoreText).not.toBe('—');
    const scoreNum = Number(scoreText);
    expect(Number.isFinite(scoreNum)).toBeTruthy();
    expect(scoreNum).toBeGreaterThan(0);

    // The day was upserted in the canonical recovery shape (sleep hours → minutes,
    // no fabricated HRV) and the engine logged a non-null, non-zero score.
    expect(captures.days).toHaveLength(1);
    expect(captures.days[0]).toMatchObject({ sleep_minutes: 480, active_calories_burned: 350 });
    expect(captures.days[0].hrv_ms ?? null).toBeNull();

    expect(captures.protocols).toHaveLength(1);
    const logged = Number(captures.protocols[0].readiness_score);
    expect(Number.isFinite(logged)).toBeTruthy();
    expect(logged).toBeGreaterThan(0);

    // Diagnostic payload snapshot: no native sync ever ran → Null + Never.
    await page.getByTestId('sch-hc-status').locator('summary').click();
    await expect(page.getByTestId('sch-hc-lastsync')).toContainText('Never');
    await expect(page.getByTestId('sch-hc-payload')).toContainText('Null');

    // Nothing ever touched production.
    expect(realDbHits).toHaveLength(0);
  });
});
