import { test, expect, type Page, type Route } from '@playwright/test';
import { installSupabaseBaseline, isPreflight, json, type SessionEnvelope } from './support/vault.js';

/**
 * BBF Command Center — Digital Content Manager
 * ============================================================================
 * Two browser-drone proofs of the additive content pipeline:
 *
 *   1. DRAG → DB: the Distribution Calendar drag-and-drops an approved post from
 *      one day to another and fires the reschedule RPC (bbf-content-manager
 *      action:'reschedule') with the NEW scheduled_at — i.e. the queue database
 *      update the drag is contracted to perform.
 *   2. API-MARGIN GUARD: the ElevenLabs voiceover endpoint (bbf-studio-voiceover)
 *      is NEVER called on load / ingestion — only on an explicit Approve &
 *      Synthesize click.
 *
 * Hermetic: an admin session is seeded into localStorage, every backend call is
 * intercepted, and installSupabaseBaseline's real-host tripwire guarantees the run
 * never touches production. Timezone pinned to UTC so calendar day-cells are
 * deterministic regardless of the runner's locale.
 */

test.use({ timezoneId: 'UTC' });

const ADMIN_SESSION: SessionEnvelope = {
  uid: 'akeem',
  vaultToken: 'e2e-admin-token',
  user: { id: 'akeem', username: 'akeem', role: 'admin', type: null, programKey: null },
  plans: null,
  authenticatedAt: Date.now(),
};

const ITEM_ID = '11111111-1111-1111-1111-111111111111';
const TINY_MP3 = Buffer.from([0xff, 0xfb, 0x90, 0x00]);

// Current month, pinned in UTC. Days 10 (source) and 20 (target) always exist and
// always render inside the month grid.
const NOW = new Date();
const Y = NOW.getUTCFullYear();
const M = NOW.getUTCMonth(); // 0-based
const pad2 = (n: number) => String(n).padStart(2, '0');
const dayIso = (d: number) => `${Y}-${pad2(M + 1)}-${pad2(d)}`;
const SRC_DAY = dayIso(10);
const TGT_DAY = dayIso(20);
const SCHEDULED_AT = `${SRC_DAY}T12:00:00.000Z`;

async function seedAdminSession(page: Page): Promise<void> {
  await page.addInitScript((s) => {
    localStorage.setItem('bbf.session.v1', JSON.stringify(s));
  }, ADMIN_SESSION);
}

/** A single scheduled queue row on the source day (drives the calendar). */
function seededItem() {
  return {
    id: ITEM_ID,
    series: 'Mindset Engine',
    target_angle: 'Discipline over motivation',
    hook: 'MOTIVATION IS A LIAR',
    caption: 'caption',
    studio_recipe: { visual: 'matte black', asset: 'a', format: 'reel' },
    voiceover_script: 'script',
    audio_url: 'https://x.supabase.co/storage/v1/object/public/studio-audio-vault/mind.mp3',
    audio_slug: 'mind',
    status: 'scheduled',
    scheduled_at: SCHEDULED_AT,
    source_ref: 'mind-001',
    created_at: SCHEDULED_AT,
    updated_at: SCHEDULED_AT,
  };
}

/**
 * Wire the two backends. `voiceoverCalls` / `rescheduleCalls` accumulate the request
 * bodies so a test can assert exactly WHAT fired and WHEN. Registered AFTER the
 * baseline so these specific handlers win.
 */
async function installBackends(page: Page) {
  const voiceoverCalls: any[] = [];
  const rescheduleCalls: any[] = [];
  const approveCalls: any[] = [];

  // The Akeem voiceover synth — the ONLY external API. Record + stub a baked URL.
  await page.route('**/functions/v1/bbf-studio-voiceover', (route: Route) => {
    if (isPreflight(route)) return;
    voiceoverCalls.push(route.request().postDataJSON?.() ?? {});
    return json(route, 200, { ok: true, url: 'https://x.supabase.co/storage/v1/object/public/studio-audio-vault/mind.mp3', slug: 'mind', cached: false });
  });

  // The content-manager bridge — route by action.
  await page.route('**/functions/v1/bbf-content-manager', (route: Route) => {
    if (isPreflight(route)) return;
    const body = route.request().postDataJSON?.() ?? {};
    if (body.action === 'list') return json(route, 200, { ok: true, items: [seededItem()] });
    if (body.action === 'approve') { approveCalls.push(body); return json(route, 200, { ok: true, item: { ...seededItem(), id: '22222222-2222-2222-2222-222222222222', source_ref: body.source_ref } }); }
    if (body.action === 'reschedule') { rescheduleCalls.push(body); return json(route, 200, { ok: true, item: { ...seededItem(), scheduled_at: body.scheduled_at } }); }
    return json(route, 400, { error: 'unknown_action' });
  });

  // Baked-clip preview playback.
  await page.route('**/storage/v1/object/public/studio-audio-vault/**', (route: Route) => {
    if (isPreflight(route)) return;
    return route.fulfill({ status: 200, headers: { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*' }, body: TINY_MP3 });
  });

  return { voiceoverCalls, rescheduleCalls, approveCalls };
}

/**
 * Fire a native HTML5 drag from `sourceSel` to `targetSel`. Playwright's mouse-based
 * dragTo does NOT trigger native dragstart/drop, so we dispatch the DnD events with a
 * shared DataTransfer — the calendar's handlers (which also track the id in a ref)
 * pick them up through React's delegated listeners.
 */
async function htmlDrag(page: Page, sourceSel: string, targetSel: string): Promise<void> {
  await page.evaluate(({ sourceSel, targetSel }) => {
    const src = document.querySelector(sourceSel);
    const tgt = document.querySelector(targetSel);
    if (!src || !tgt) throw new Error(`drag nodes missing: ${!src ? sourceSel : targetSel}`);
    const dt = new DataTransfer();
    const opts = (t: EventTarget) => ({ bubbles: true, cancelable: true, dataTransfer: dt }) as DragEventInit;
    src.dispatchEvent(new DragEvent('dragstart', opts(src)));
    tgt.dispatchEvent(new DragEvent('dragover', opts(tgt)));
    tgt.dispatchEvent(new DragEvent('drop', opts(tgt)));
    src.dispatchEvent(new DragEvent('dragend', opts(src)));
  }, { sourceSel, targetSel });
}

test.describe('BBF Command Center — Digital Content Manager', () => {
  test('drag-and-drop on the calendar reschedules the queue row (fires the DB update)', async ({ page }) => {
    await seedAdminSession(page);
    const { realDbHits } = await installSupabaseBaseline(page);
    const { rescheduleCalls } = await installBackends(page);

    await page.goto('/command/content-manager');

    // Panel mounts (admin-gated route passed).
    await expect(page.getByTestId('content-manager')).toBeVisible();

    // Switch to the Distribution Calendar and confirm the seeded post sits on day 10.
    await page.getByTestId('content-mgr-tab-calendar').click();
    const block = page.getByTestId(`cal-item-${ITEM_ID}`);
    await expect(block).toBeVisible();
    const srcCell = page.getByTestId(`cal-day-${SRC_DAY}`);
    await expect(srcCell.getByTestId(`cal-item-${ITEM_ID}`)).toBeVisible();

    // Drag the post from day 10 → day 20.
    await htmlDrag(page, `[data-testid="cal-item-${ITEM_ID}"]`, `[data-testid="cal-day-${TGT_DAY}"]`);

    // The reschedule RPC fired with the row id and the NEW day (time-of-day preserved).
    await expect.poll(() => rescheduleCalls.length).toBe(1);
    expect(rescheduleCalls[0].id).toBe(ITEM_ID);
    expect(String(rescheduleCalls[0].scheduled_at)).toContain(`${TGT_DAY}T12:00:00`);

    // Optimistic UI moved the block into the target day cell.
    await expect(page.getByTestId(`cal-day-${TGT_DAY}`).getByTestId(`cal-item-${ITEM_ID}`)).toBeVisible();

    expect(realDbHits).toHaveLength(0);
  });

  test('ElevenLabs fires only on Approve & Synthesize — never on ingestion', async ({ page }) => {
    await seedAdminSession(page);
    const { realDbHits } = await installSupabaseBaseline(page);
    const { voiceoverCalls, approveCalls } = await installBackends(page);

    await page.goto('/command/content-manager');
    await expect(page.getByTestId('content-manager')).toBeVisible();

    // Review Bucket rendered the static drafts — but NO synthesis has run.
    await expect(page.getByTestId('review-bucket')).toBeVisible();
    const firstCard = page.getByTestId('draft-card').first();
    await expect(firstCard).toBeVisible();
    expect(voiceoverCalls).toHaveLength(0);

    // Click Approve & Synthesize on the first draft → exactly one ElevenLabs call,
    // carrying the verbatim script (provided_script → no LLM), then an approve insert.
    const draftId = await firstCard.getAttribute('data-draft-id');
    await page.getByTestId(`draft-approve-${draftId}`).click();

    await expect.poll(() => voiceoverCalls.length).toBe(1);
    expect(voiceoverCalls[0].provided_script).toBeTruthy();
    await expect.poll(() => approveCalls.length).toBe(1);
    expect(approveCalls[0].source_ref).toBe(draftId);

    expect(realDbHits).toHaveLength(0);
  });

  test('outreach post with no reel_kit schedules WITHOUT an ElevenLabs call', async ({ page }) => {
    await seedAdminSession(page);
    const { realDbHits } = await installSupabaseBaseline(page);
    const { voiceoverCalls, approveCalls } = await installBackends(page);

    await page.goto('/command/content-manager');
    await expect(page.getByTestId('content-manager')).toBeVisible();

    // The EN outreach post (post_en_010) has reel_kit:null → its trigger reads
    // "Schedule · No VO" and must persist the row without touching ElevenLabs.
    const approveBtn = page.getByTestId('draft-approve-post_en_010');
    await expect(approveBtn).toBeVisible();
    await expect(approveBtn).toHaveText(/No VO/i);
    await approveBtn.click();

    await expect.poll(() => approveCalls.length).toBe(1);
    expect(approveCalls[0].source_ref).toBe('post_en_010');
    expect(approveCalls[0].audio_url ?? null).toBeNull();
    expect(voiceoverCalls).toHaveLength(0); // zero ElevenLabs spend for outreach

    expect(realDbHits).toHaveLength(0);
  });
});
