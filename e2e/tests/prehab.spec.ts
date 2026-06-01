import { test, expect, type Page } from '@playwright/test';
import { seedClientSession, installSupabaseBaseline, json, isPreflight } from './support/vault.js';

/**
 * HELD ACCEPTANCE SPEC — Prehab / Mobility module (Terminal 4 lane)
 * ================================================================
 * STATUS: COMMITTED, NOT RUN IN CI. Every test is skipped until BOTH the
 * frontend Prehab UI and the Terminal-3 `bbf_get_prehab_routines` RPC are
 * deployed. Flip it on with `BBF_PREHAB_READY=1`.
 *
 * This file is the executable CONTRACT the frontend + data layers build to.
 *
 * ── DATA CONTRACT (Terminal 3 — bbf_prehab table + RPC) ──────────────────────
 *   supabase.rpc('bbf_get_prehab_routines', { target_uid })
 *     → { ok: true, routines: [
 *           { slug, name, sets:number, reps:string, cue:string, focus_area:string }
 *         ] }
 *   Returns the authenticated user's ASSIGNED prehab movements (per-user, from
 *   the DB — not the static catalog).
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

// The assigned movements the directive named, with the sets/reps/cues the UI
// must map and display faithfully.
const ROUTINES = [
  { slug: 'bird_dog', name: 'Bird Dog', sets: 3, reps: '12 per side', cue: 'Opposite arm + leg — pause at full extension, ribs locked', focus_area: 'core' },
  { slug: 'dead_bug', name: 'Dead Bug', sets: 3, reps: '8 per side', cue: 'Press your lower back into the floor — no rib flare', focus_area: 'core' },
  { slug: 'pallof_press', name: 'Pallof Press', sets: 3, reps: '20s hold per side', cue: 'Anti-rotation — resist the cable twisting your torso', focus_area: 'core' },
];

async function mockPrehabRpc(page: Page, body: unknown) {
  await page.route('**/rest/v1/rpc/bbf_get_prehab_routines', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, body);
  });
}

test.describe('BBF Vault — Prehab / Mobility module (acceptance)', () => {
  test.beforeEach(() => {
    test.skip(
      !READY,
      'Held: enable once the Prehab UI + bbf_get_prehab_routines RPC are deployed (BBF_PREHAB_READY=1).',
    );
  });

  test('fetches and displays assigned prehab routines with sets, reps, and cues', async ({ page }) => {
    await seedClientSession(page);
    const { realDbHits } = await installSupabaseBaseline(page);
    await mockPrehabRpc(page, { ok: true, routines: ROUTINES });

    await page.goto('/');
    await page.getByTestId('vault-tab-prehab').click();

    await expect(page.getByTestId('prehab-module')).toBeVisible();

    const cards = page.getByTestId('prehab-routine');
    await expect(cards).toHaveCount(ROUTINES.length);

    // Each assigned movement maps its name, sets, reps, and cue correctly.
    for (const r of ROUTINES) {
      const card = cards.filter({ hasText: r.name });
      await expect(card).toHaveCount(1);
      await expect(card.getByTestId('prehab-routine-name')).toHaveText(r.name);
      await expect(card.getByTestId('prehab-routine-sets')).toContainText(String(r.sets));
      await expect(card.getByTestId('prehab-routine-reps')).toContainText(r.reps);
      await expect(card.getByTestId('prehab-routine-cue')).toContainText(r.cue);
    }

    // Hermetic: nothing touched the real database.
    expect(realDbHits).toHaveLength(0);
  });

  test('shows an empty state when no prehab routines are assigned', async ({ page }) => {
    await seedClientSession(page);
    await installSupabaseBaseline(page);
    await mockPrehabRpc(page, { ok: true, routines: [] });

    await page.goto('/');
    await page.getByTestId('vault-tab-prehab').click();

    await expect(page.getByTestId('prehab-empty')).toBeVisible();
    await expect(page.getByTestId('prehab-routine')).toHaveCount(0);
  });
});
