// ═══════════════════════════════════════════════════════════════════════════
// bbf-studio-batch-compiler — Content Studio V4 render-pipeline compiler
// ───────────────────────────────────────────────────────────────────────────
// Server-side prepare step for the client-side (WebCodecs, Isolation Protocol)
// encoder: resolves studio_overlay_presets, localizes every overlay text layer to the
// target locale, freezes the gram stat-bindings (binding_snapshot), assembles the
// z-ordered timeline + resolution ladder, and CREATES the studio_render_jobs mirror
// rows with the client-minted UUIDs. The encode itself stays client-side; this
// function produces the deterministic render spec + the telemetry row.
//
// TRILINGUAL (non-negotiable): no English literal is ever emitted — overlay text
// resolves from each layer's content[locale] by the target locale (en/es/pt).
// PRIVACY (§2.3): stat bindings resolve to a REAL athlete's ledger ONLY for a
// Directed job (audience='directed' + target_athlete_id); social jobs use demo
// values flagged demo:true — never a real athlete's grams on a public reel.
// IDEMPOTENCY: client-minted UUID PK + ON CONFLICT (id) DO NOTHING — a dropped
// connection re-send never duplicates a job.
// AUTH: admin session OR shared secret. GRAM STANDARD: bindings are integer grams.
// POST { jobs: [{ id, kind?, preset_id?, overlay?, locale?, audience?, target_athlete_id?,
//                 device_class?, lane?, gram_override?: { "<binding.source>": <int grams> } }] }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { CORS, jsonResponse, UUID_RE, pgGet, pgUpsert, authorizeAdmin } from '../_shared/studio-io.ts';
import {
  type OverlayState, type Locale, normLoc, mergeOverlay, assembleTimeline, resolveLadder,
  LADDER_FALLBACK, type LadderCfg,
} from '../_shared/studio-core.ts';

const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Demo grams for social jobs (DATA, not real athlete data — privacy boundary §2.3).
const DEMO_BINDINGS: Record<string, number> = {
  'workload.tonnage_g': 143335, 'nutrition.protein_g': 196, 'nutrition.carbs_g': 322, 'nutrition.fat_g': 77,
  'cardio.rehydration_g': 701, 'cardio.sweat_loss_g': 467, 'cardio.ee_kcal': 316, 'metrics.body_mass_g': 81647,
};

// Collect the distinct stat-badge binding sources referenced by an overlay.
function bindingSources(overlay: OverlayState): string[] {
  const set = new Set<string>();
  for (const l of (overlay.layers ?? [])) if (l.type === 'stat_badge' && l.binding?.source) set.add(l.binding.source);
  return [...set];
}

// Resolve real integer-gram ledger values for a Directed target athlete.
async function resolveRealBindings(profileId: string, userId: string | null, sources: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  const need = (p: string) => sources.some((s) => s.startsWith(p));
  if (need('workload.')) {
    const rows = await pgGet(`athlete_workload_daily?select=tonnage_g&athlete_id=eq.${profileId}&load_vector=eq.total&order=day.desc&limit=1`).catch(() => []) as Array<{ tonnage_g?: number }>;
    out['workload.tonnage_g'] = num(rows?.[0]?.tonnage_g);
  }
  if (need('nutrition.')) {
    const rows = await pgGet(`athlete_nutrition_targets_daily?select=protein_g,carbs_g,fat_g&athlete_id=eq.${profileId}&order=day.desc&limit=1`).catch(() => []) as Array<Record<string, number>>;
    out['nutrition.protein_g'] = num(rows?.[0]?.protein_g); out['nutrition.carbs_g'] = num(rows?.[0]?.carbs_g); out['nutrition.fat_g'] = num(rows?.[0]?.fat_g);
  }
  if (need('cardio.') && userId) {
    const rows = await pgGet(`bbf_cardio_prescription?select=rehydration_g,sweat_loss_g_est,ee_kcal_est&user_id=eq.${userId}&status=eq.active&order=prescribed_for.desc&limit=1`).catch(() => []) as Array<Record<string, number>>;
    out['cardio.rehydration_g'] = num(rows?.[0]?.rehydration_g); out['cardio.sweat_loss_g'] = num(rows?.[0]?.sweat_loss_g_est); out['cardio.ee_kcal'] = num(rows?.[0]?.ee_kcal_est);
  }
  if (need('metrics.')) {
    const rows = await pgGet(`athlete_body_metrics?select=body_mass_g&athlete_id=eq.${profileId}&order=measured_on.desc&limit=1`).catch(() => []) as Array<{ body_mass_g?: number }>;
    out['metrics.body_mass_g'] = num(rows?.[0]?.body_mass_g);
  }
  // Any referenced source we didn't fill stays null (badge renders '—', never wrong).
  for (const s of sources) if (!(s in out)) out[s] = null;
  return out;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const jobs = Array.isArray(body.jobs) ? body.jobs as Array<Record<string, unknown>> : (body.id ? [body] : []);
  if (!jobs.length) return jsonResponse({ ok: false, error: 'no_jobs' }, 400);

  // Resolution ladder config (studio_ladder_v1) — one read for the batch.
  let ladderCfg: LadderCfg = LADDER_FALLBACK;
  try {
    const rows = await pgGet(`bbf_app_config?select=value&key=eq.studio_ladder_v1&limit=1`) as Array<{ value?: string }>;
    if (rows?.[0]?.value) { const p = JSON.parse(rows[0].value) as Partial<LadderCfg>; if (p.high && p.mid && p.low) ladderCfg = p as LadderCfg; }
  } catch (_) { /* fallback matches the seed */ }

  const results: Array<Record<string, unknown>> = [];
  const jobRows: Record<string, unknown>[] = [];

  for (const job of jobs) {
    const id = String(job.id ?? '');
    if (!UUID_RE.test(id)) { results.push({ id, status: 'rejected', reason: 'bad_uuid' }); continue; }
    try {
      const kind = String(job.kind ?? 'reel');
      const audience = String(job.audience ?? 'social');
      const targetAthleteId = String(job.target_athlete_id ?? '').trim() || null;

      // ── resolve preset (by id, then default) merged with per-job overrides ──
      let preset: OverlayState | null = null;
      if (job.preset_id) {
        const rows = await pgGet(`studio_overlay_presets?select=overlay_json&id=eq.${encodeURIComponent(String(job.preset_id))}&limit=1`).catch(() => []) as Array<{ overlay_json?: OverlayState }>;
        preset = rows?.[0]?.overlay_json ?? null;
      }
      if (!preset && !job.overlay) {
        const rows = await pgGet(`studio_overlay_presets?select=overlay_json&is_default=eq.true&limit=1`).catch(() => []) as Array<{ overlay_json?: OverlayState }>;
        preset = rows?.[0]?.overlay_json ?? null;
      }
      const overlay = mergeOverlay(preset, (job.overlay as OverlayState) ?? null);

      // ── resolve locale: Directed LOCKS to the athlete's language; social uses the job locale ──
      let locale: Locale = normLoc(job.locale ?? overlay.locale);
      let profileId: string | null = null, userId: string | null = null;
      if (audience === 'directed' && targetAthleteId) {
        const rows = await pgGet(`athlete_profiles?select=id,user_id,preferred_language&id=eq.${targetAthleteId}&limit=1`).catch(() => []) as Array<{ id?: string; user_id?: string; preferred_language?: string }>;
        if (rows?.[0]?.id) { profileId = String(rows[0].id); userId = rows[0].user_id ? String(rows[0].user_id) : null; locale = normLoc(rows[0].preferred_language); }
      }

      // ── freeze gram bindings (real ledger for Directed, demo for social) ──
      const sources = bindingSources(overlay);
      let bindingValues: Record<string, number | null> = {}; let bindingDemo = true;
      if (audience === 'directed' && profileId) { bindingValues = await resolveRealBindings(profileId, userId, sources); bindingDemo = false; }
      else { for (const s of sources) bindingValues[s] = DEMO_BINDINGS[s] ?? null; bindingDemo = true; }

      // ── gram_override (§V4 benchmark override) — admin forces a binding source to a
      // specific INTEGER-gram value (e.g. a 150000 g tonnage benchmark). Shape:
      // { "<source>": <int grams> }. Applied AFTER real/demo resolution so it wins;
      // non-integer / negative values are ignored (defense-in-depth over the UI gate).
      let bindingOverride = false;
      const ov = job.gram_override;
      if (ov && typeof ov === 'object') {
        for (const [s, v] of Object.entries(ov as Record<string, unknown>)) {
          const g = num(v);
          if (g != null && Number.isInteger(g) && g >= 0) { bindingValues[s] = g; bindingOverride = true; }
        }
      }

      // ── assemble the timeline + ladder ──
      const timeline = assembleTimeline(overlay, locale, bindingValues, bindingDemo);
      const ladder = resolveLadder(job.device_class as string | undefined, ladderCfg);
      const lane = ['A', 'B', 'C'].includes(String(job.lane)) ? String(job.lane) : null;

      // ── register the mirror row (client-minted UUID · ON CONFLICT DO NOTHING) ──
      jobRows.push({ id, kind, lane, ladder, status: 'queued', progress_pct: 0, created_by: auth.userId, updated_at: new Date().toISOString() });
      results.push({ id, status: 'compiled', kind, locale, audience, binding_demo: bindingDemo, binding_override: bindingOverride, ladder, lane, timeline });
    } catch (e) {
      results.push({ id, status: 'error', reason: e instanceof Error ? e.message : String(e) });
    }
  }

  // Batch-insert all mirror rows idempotently in one round trip.
  let mirrored = 0;
  if (jobRows.length) {
    try { const ins = await pgUpsert('studio_render_jobs', jobRows, { onConflict: 'id', ignoreDuplicates: true }) as unknown[] | null; mirrored = Array.isArray(ins) ? ins.length : 0; }
    catch (e) { console.error('[bbf-studio-batch-compiler] mirror upsert failed (non-fatal):', e instanceof Error ? e.message : String(e)); }
  }

  console.log(`[bbf-studio-batch-compiler] jobs=${jobs.length} compiled=${results.filter((r) => r.status === 'compiled').length} mirrored=${mirrored}`);
  return jsonResponse({ ok: true, count: results.length, mirrored, jobs: results }, 200);
});
