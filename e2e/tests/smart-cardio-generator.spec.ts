import { test, expect, type Page } from '@playwright/test';
import { seedClientSession, installSupabaseBaseline, json, isPreflight } from './support/vault.js';

/**
 * HELD ACCEPTANCE SPEC — Smart Cardio GENERATOR interaction (Terminal 4 lane)
 * ==========================================================================
 * STATUS: COMMITTED, NOT RUN IN CI. Every test self-skips behind the same
 * BBF_CARDIO_READY=1 gate as smart-cardio.spec.ts (Terminal 2 is still building
 * the Smart Cardio React surface). Do NOT un-hold.
 *
 * COMPANION to smart-cardio.spec.ts. That spec covers the READ path
 * (`bbf_get_cardio` → stored protocols + logs). THIS spec covers the on-demand
 * GENERATOR: the athlete enters available minutes, the UI POSTs to the
 * `bbf-agentic-cardio` edge function, and renders the returned protocol.
 *
 * ── DATA CONTRACT (live — bbf-agentic-cardio FROZEN CONTRACT) ────────────────
 *   POST /functions/v1/bbf-agentic-cardio   body { uid, available_minutes }
 *     → { ok: true,
 *         modality: { tier:'HIIT'|'Tempo'|'Zone 2', machine, label, strategy },
 *         protocol_steps: [ { start_min, end_min,
 *                             phase:'warmup'|'work'|'recovery'|'steady'|'cooldown',
 *                             label, target } ],            // contiguous, ends at available_minutes
 *         protocol_text: string,                            // flat backward-compat
 *         total_minutes: number,
 *         cns_downregulation: { fatigue_level, score, ...,
 *             base_tier, effective_tier, down_regulated:boolean },  // down_regulated = base≠effective
 *         roi: { toast, detail, primary_metric },           // the "Sovereign Toast"
 *         meta: { source:'claude'|'fallback', model, generated_at } }
 *   The tier is deterministic by minutes (HIIT <20, Tempo ≤35, Zone 2 >35) and
 *   may be stepped DOWN one level when CNS fatigue (from bbf_sets) is elevated.
 *
 * ── UI CONTRACT (frontend — required test hooks) ─────────────────────────────
 *   [data-testid="vault-tab-cardio"]        opens the Cardio module
 *   [data-testid="cardio-gen-minutes"]      minutes input (athlete's time budget)
 *   [data-testid="cardio-gen-submit"]       fires the POST
 *   [data-testid="cardio-gen-modality"]     modality badge; carries
 *                                           [data-tier="HIIT|Tempo|Zone 2"] (EFFECTIVE tier)
 *   [data-testid="cardio-gen-step"]         one per protocol_steps entry; carries
 *                                           [data-phase="warmup|work|recovery|steady|cooldown"]
 *     [data-testid="cardio-gen-step-time"]    renders start_min–end_min
 *     [data-testid="cardio-gen-step-label"]   label
 *     [data-testid="cardio-gen-step-target"]  target
 *   [data-testid="cardio-gen-roi-toast"]    roi.toast (Sovereign Toast headline)
 *   [data-testid="cardio-gen-roi-metric"]   roi.primary_metric
 *   [data-testid="cardio-gen-softened"]     softened-tier badge — rendered ONLY when
 *                                           cns_downregulation.down_regulated === true;
 *                                           carries [data-base-tier] + [data-effective-tier]
 *
 * Hermetic: the edge-function POST is mocked and a tripwire asserts no call
 * reaches the real Supabase project host.
 */

const READY = process.env.BBF_CARDIO_READY === '1';

// CNS fresh → no down-regulation. 18 min ⇒ deterministic HIIT.
const GEN_FRESH = {
  ok: true,
  uid: 'jacque_bbf',
  available_minutes: 18,
  modality: { tier: 'HIIT', machine: 'Assault Bike', label: 'Assault Bike — HIIT', strategy: 'High-Intensity Interval Training (Max EPOC)' },
  protocol_steps: [
    { start_min: 0,  end_min: 2,  phase: 'warmup',   label: 'Warm-up · easy spin',        target: 'RPE 4' },
    { start_min: 2,  end_min: 15, phase: 'work',     label: '13 rounds · 30s max / 30s easy', target: 'RPE 9 on work' },
    { start_min: 15, end_min: 18, phase: 'cooldown', label: 'Cool-down · easy spin',       target: 'RPE 3' },
  ],
  protocol_text: '00:00–02:00  Warm-up · easy spin · RPE 4',
  total_minutes: 18,
  cns_downregulation: {
    fatigue_level: 'fresh', score: 12, window_days: 3, recent_sets: 20, high_rpe_sets: 2, avg_rpe: 6.5,
    biomechanical_redline: false, down_regulate: false,
    base_tier: 'HIIT', effective_tier: 'HIIT', down_regulated: false,
    source: 'bbf_sets', guidance: '2 high-RPE sets in 3d — CNS has headroom for the prescribed tier.',
  },
  roi: { toast: 'Short, sharp, and metabolically expensive.', detail: 'Work above ventilatory threshold drives prolonged post-session oxygen debt.', primary_metric: '12-18h elevated EPOC' },
  meta: { source: 'claude', model: 'claude-opus-4-7', generated_at: '2026-06-01T12:00:00Z' },
};

// CNS elevated → tier stepped down HIIT → Tempo. down_regulated = true.
const GEN_DOWNREG = {
  ok: true,
  uid: 'jacque_bbf',
  available_minutes: 18,
  modality: { tier: 'Tempo', machine: 'Treadmill', label: 'Treadmill — Tempo', strategy: 'Moderate/Tempo Work (Caloric Burn)' },
  protocol_steps: [
    { start_min: 0,  end_min: 3,  phase: 'warmup',   label: 'Warm-up walk',          target: '3.5 mph / 2% incline' },
    { start_min: 3,  end_min: 15, phase: 'steady',   label: 'Tempo · hold the line',  target: '6.0 mph / 4% incline · RPE 7' },
    { start_min: 15, end_min: 18, phase: 'cooldown', label: 'Cool-down',              target: '3.0 mph flat' },
  ],
  protocol_text: '00:00–03:00  Warm-up walk · 3.5 mph / 2% incline',
  total_minutes: 18,
  cns_downregulation: {
    fatigue_level: 'elevated', score: 62, window_days: 3, recent_sets: 38, high_rpe_sets: 7, avg_rpe: 8.1,
    biomechanical_redline: false, down_regulate: true,
    base_tier: 'HIIT', effective_tier: 'Tempo', down_regulated: true,
    source: 'bbf_sets', guidance: '7 high-RPE sets in 3d — CNS taxed; softening intensity one tier.',
  },
  roi: { toast: 'The caloric-burn sweet spot without redlining the CNS.', detail: 'Sustained tempo maximizes calories while staying below the threshold that taxes tomorrow’s lift.', primary_metric: 'High caloric burn, low CNS cost' },
  meta: { source: 'claude', model: 'claude-opus-4-7', generated_at: '2026-06-01T12:00:00Z' },
};

// Mock the edge-function POST and capture the request body for a round-trip check.
async function mockGenerator(page: Page, body: unknown) {
  const captured: { body: any } = { body: null };
  await page.route('**/functions/v1/bbf-agentic-cardio', (route) => {
    if (isPreflight(route)) return;
    try { captured.body = route.request().postDataJSON(); } catch { captured.body = null; }
    return json(route, 200, body);
  });
  return captured;
}

test.describe('BBF Vault — Smart Cardio generator (acceptance)', () => {
  test.beforeEach(() => {
    test.skip(
      !READY,
      'Held: enable once the Smart Cardio generator UI is deployed against bbf-agentic-cardio (BBF_CARDIO_READY=1).',
    );
  });

  test('generates a minute-by-minute protocol + Sovereign Toast (CNS fresh)', async ({ page }) => {
    await seedClientSession(page);
    const { realDbHits } = await installSupabaseBaseline(page);
    const posted = await mockGenerator(page, GEN_FRESH);

    await page.goto('/vault');
    await page.getByTestId('vault-tab-cardio').click();
    await page.getByTestId('cardio-gen-minutes').fill('18');
    await page.getByTestId('cardio-gen-submit').click();

    // Modality badge reflects the effective tier + machine.
    const modality = page.getByTestId('cardio-gen-modality');
    await expect(modality).toBeVisible();
    await expect(modality).toHaveAttribute('data-tier', GEN_FRESH.modality.tier);
    await expect(modality).toContainText(GEN_FRESH.modality.machine);

    // Minute-by-minute grid: one row per protocol step, in order.
    const steps = page.getByTestId('cardio-gen-step');
    await expect(steps).toHaveCount(GEN_FRESH.protocol_steps.length);
    for (let i = 0; i < GEN_FRESH.protocol_steps.length; i++) {
      const s = GEN_FRESH.protocol_steps[i];
      const row = steps.nth(i);
      await expect(row).toHaveAttribute('data-phase', s.phase);
      await expect(row.getByTestId('cardio-gen-step-time')).toBeVisible();
      await expect(row.getByTestId('cardio-gen-step-label')).toContainText(s.label);
      await expect(row.getByTestId('cardio-gen-step-target')).toContainText(s.target);
    }

    // Sovereign Toast (physiological ROI).
    await expect(page.getByTestId('cardio-gen-roi-toast')).toContainText(GEN_FRESH.roi.toast);
    await expect(page.getByTestId('cardio-gen-roi-metric')).toContainText(GEN_FRESH.roi.primary_metric);

    // CNS fresh → no softened-tier badge.
    await expect(page.getByTestId('cardio-gen-softened')).toHaveCount(0);

    // The minutes input wired through to the POST; nothing hit the real DB.
    expect(posted.body?.available_minutes).toBe(18);
    expect(realDbHits).toHaveLength(0);
  });

  test('surfaces the softened-tier badge when CNS fatigue down-regulates the tier', async ({ page }) => {
    await seedClientSession(page);
    await installSupabaseBaseline(page);
    await mockGenerator(page, GEN_DOWNREG);

    await page.goto('/vault');
    await page.getByTestId('vault-tab-cardio').click();
    await page.getByTestId('cardio-gen-minutes').fill('18');
    await page.getByTestId('cardio-gen-submit').click();

    // Softened-tier badge appears, showing base → effective.
    const softened = page.getByTestId('cardio-gen-softened');
    await expect(softened).toBeVisible();
    await expect(softened).toHaveAttribute('data-base-tier', GEN_DOWNREG.cns_downregulation.base_tier);
    await expect(softened).toHaveAttribute('data-effective-tier', GEN_DOWNREG.cns_downregulation.effective_tier);

    // The modality badge reflects the EFFECTIVE (down-regulated) tier, not the base.
    await expect(page.getByTestId('cardio-gen-modality')).toHaveAttribute('data-tier', GEN_DOWNREG.modality.tier);

    // Grid + Sovereign Toast still render for the softened protocol.
    await expect(page.getByTestId('cardio-gen-step')).toHaveCount(GEN_DOWNREG.protocol_steps.length);
    await expect(page.getByTestId('cardio-gen-roi-toast')).toContainText(GEN_DOWNREG.roi.toast);
  });
});
