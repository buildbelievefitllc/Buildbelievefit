import { test, expect, type Page } from '@playwright/test';
import { seedClientSession, installSupabaseBaseline, json, isPreflight } from './support/vault.js';

/**
 * HELD ACCEPTANCE SPEC — Prehab / Mobility module (Terminal 4 lane)
 * ================================================================
 * STATUS: COMMITTED, NOT RUN IN CI. Every test self-skips until BOTH the
 * frontend Prehab UI and the Terminal-3 read endpoint are deployed. Flip on
 * with `BBF_PREHAB_READY=1`.
 *
 * This file is the executable CONTRACT the frontend + data layers build to,
 * RECONCILED against the data layer Terminal 3 shipped in migration
 * 20260601030000_bbf_prehab_data_layer.sql:
 *   • bbf_prehab_catalog — master library: movement_key (slug), name_en/es/pt,
 *     region, focus_en, default_sets/default_reps (text), equipment. Public read.
 *   • bbf_client_prehab  — per-client assignments: movement_key (FK),
 *     target_sets (int), target_reps (text), notes. RLS on, NO policies →
 *     service-role only, so a read endpoint MUST front it.
 *
 * ⚠️ READ ENDPOINT PENDING (open contract with Terminal 3): T3 shipped the
 * tables only. Because bbf_client_prehab is service-role-only, the per-client
 * read needs a SECURITY DEFINER RPC (or edge fn) joining the two tables — the
 * same pattern as bbf_get_last_weights over bbf_sets. This spec mocks the
 * PROPOSED RPC `bbf_get_client_prehab(target_uid)`; confirm/rename when T3
 * builds the read path.
 *
 * ── PROPOSED READ SHAPE (join of the two tables, per authenticated user) ─────
 *   supabase.rpc('bbf_get_client_prehab', { target_uid })
 *     → { ok: true, routines: [
 *           { movement_key, name, region, target_sets:number,
 *             target_reps:string, cue:string, equipment:string }
 *         ] }
 *   name = catalog.name_en (localized later); cue = client.notes ?? catalog.focus_en.
 *
 * ── UI CONTRACT (frontend — required test hooks) ─────────────────────────────
 *   [data-testid="vault-tab-prehab"]      tab/button that opens the module
 *   [data-testid="prehab-module"]         module container
 *   [data-testid="prehab-routine"]        one per assigned movement
 *     [data-testid="prehab-routine-name"]   movement name
 *     [data-testid="prehab-routine-sets"]   target sets (renders the number)
 *     [data-testid="prehab-routine-reps"]   target reps
 *     [data-testid="prehab-routine-cue"]    instructional cue
 *   [data-testid="prehab-empty"]          empty state (no routines assigned)
 *
 * Hermetic: the RPC is mocked and a tripwire asserts no call reaches the real
 * Supabase project host — the spec never reads or writes production data.
 */

const READY = process.env.BBF_PREHAB_READY === '1';

// The directive's named movements, with the EXACT slugs/names/values Terminal 3
// seeded into bbf_prehab_catalog (target_sets/reps from a client assignment).
const ROUTINES = [
  { movement_key: 'bird_dog', name: 'Bird-Dogs', region: 'core', target_sets: 3, target_reps: '12 per side', cue: 'Anti-extension core; spinal stability (ribs locked)', equipment: 'Bodyweight' },
  { movement_key: 'dead_bug', name: 'Dead Bug', region: 'core', target_sets: 3, target_reps: '8 per side', cue: 'Anti-extension core; lumbar control', equipment: 'Bodyweight' },
  { movement_key: 'pallof_press_iso', name: 'Pallof Press ISO Hold', region: 'core', target_sets: 3, target_reps: '20s per side', cue: 'Anti-rotation core stability under torque', equipment: 'Cable/Band' },
];

// PROPOSED read RPC — reconcile the name with T3's read-path implementation.
const PREHAB_RPC = '**/rest/v1/rpc/bbf_get_client_prehab';

async function mockPrehabRpc(page: Page, body: unknown) {
  await page.route(PREHAB_RPC, (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, body);
  });
}

test.describe('BBF Vault — Prehab / Mobility module (acceptance)', () => {
  test.beforeEach(() => {
    test.skip(
      !READY,
      'Held: enable once the Prehab UI + the bbf_client_prehab read endpoint are deployed (BBF_PREHAB_READY=1).',
    );
  });

  test('fetches and displays assigned prehab routines with sets, reps, and cues', async ({ page }) => {
    await seedClientSession(page);
    const { realDbHits } = await installSupabaseBaseline(page);
    await mockPrehabRpc(page, { ok: true, routines: ROUTINES });

    await page.goto('/vault');
    await page.getByTestId('vault-tab-prehab').click();

    await expect(page.getByTestId('prehab-module')).toBeVisible();

    const cards = page.getByTestId('prehab-routine');
    await expect(cards).toHaveCount(ROUTINES.length);

    // Each assigned movement maps its name, target sets, target reps, and cue.
    for (const r of ROUTINES) {
      const card = cards.filter({ hasText: r.name });
      await expect(card).toHaveCount(1);
      await expect(card.getByTestId('prehab-routine-name')).toHaveText(r.name);
      await expect(card.getByTestId('prehab-routine-sets')).toContainText(String(r.target_sets));
      await expect(card.getByTestId('prehab-routine-reps')).toContainText(r.target_reps);
      await expect(card.getByTestId('prehab-routine-cue')).toContainText(r.cue);
    }

    // Hermetic: nothing touched the real database.
    expect(realDbHits).toHaveLength(0);
  });

  test('shows an empty state when no prehab routines are assigned', async ({ page }) => {
    await seedClientSession(page);
    await installSupabaseBaseline(page);
    await mockPrehabRpc(page, { ok: true, routines: [] });

    await page.goto('/vault');
    await page.getByTestId('vault-tab-prehab').click();

    await expect(page.getByTestId('prehab-empty')).toBeVisible();
    await expect(page.getByTestId('prehab-routine')).toHaveCount(0);
  });
});
