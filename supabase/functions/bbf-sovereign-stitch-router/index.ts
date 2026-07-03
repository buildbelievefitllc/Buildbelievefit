// ═══════════════════════════════════════════════════════════════════════════
// bbf-sovereign-stitch-router — the ZERO-API daily audio-stitching compiler (§3.4)
// ───────────────────────────────────────────────────────────────────────────
// ⚠ NAMING: the Phase-2.3 order labels this "bbf-bake-coach-static", but that name
//   is already the LIVE ElevenLabs TTS baker (coach-cue synthesis → coach-static
//   bucket). Its behavior is the opposite of what was described. What was DESCRIBED —
//   "extract the fragment inventory, generate the deterministic playlist, update
//   sovereign_brief_playlists WITHOUT any live LLM/TTS" — is the blueprint's daily
//   STITCHING ROUTER (§3.4/§4.1). This function IS that router, named to avoid
//   overwriting (and breaking) the existing baker.
//
// ZERO-API LAW (§0.2): this daily path invokes NO LLM and NO TTS. It reads the
// deterministic bbf_daily_brief_context payload + the pre-baked sovereign_audio_
// fragments (the allow-list), selects fragment keys, and assembles a gapless play
// contract into sovereign_brief_playlists. Postgres + Storage URLs only.
//
// GRAM STANDARD: digits ride screen_facts as integer grams; the voice is pre-baked.
// IDEMPOTENT: upsert on (athlete_id, day, locale). AUTH: admin token OR cron secret.
// POST { athlete_id?|user_id?, day?, locale? }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CORS, jsonResponse, normLocale, todayUTC, readConfigJson, type SupabaseClient } from '../_shared/onboarding-core.ts';
import {
  type Slot, type BriefPayload, rankBeats, selectBeats, resolveTone, s0Variant, s5Variant, s7Variant,
  buildScreenFacts, assemblePlaylist, DEFAULT_TIMING, type StitchTiming,
} from '../_shared/stitch-core.ts';

interface ResolvedItem { slot: Slot; variant_key: string; url: string | null; sha256: string | null; duration_ms: number; fallback: string | null; screen_fact_ids: string[]; script_text: string | null; }
const SLOT_ORDER: Record<Slot, number> = { S0: 0, S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, S6: 6, S7: 7 };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const ADMIN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '', CRON = Deno.env.get('CRON_SECRET') ?? '';
  if (!(ADMIN && (req.headers.get('x-bbf-admin-token') ?? '') === ADMIN) && !(CRON && (req.headers.get('x-cron-secret') ?? '') === CRON)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL'), SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const day = /^\d{4}-\d{2}-\d{2}/.test(String(body.day ?? '')) ? String(body.day).slice(0, 10) : todayUTC();
  const inputId = String(body.athlete_id ?? body.user_id ?? '').trim();
  if (!inputId) return jsonResponse({ ok: false, error: 'missing_athlete' }, 400);

  try {
    // Resolve profile_id (sovereign_brief_playlists keys on athlete_profiles.id) + locale.
    let profileId: string | null = null, locale = 'en';
    const { data: byProfile } = await supabase.from('athlete_profiles').select('id,preferred_language').eq('id', inputId).maybeSingle();
    if (byProfile?.id) { profileId = String(byProfile.id); locale = byProfile.preferred_language ?? 'en'; }
    else {
      const { data: byUser } = await supabase.from('athlete_profiles').select('id,preferred_language').eq('user_id', inputId).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (byUser?.id) { profileId = String(byUser.id); locale = byUser.preferred_language ?? 'en'; }
    }
    if (!profileId) return jsonResponse({ ok: false, error: 'athlete_unresolved', input: inputId }, 404);
    locale = normLocale(body.locale ?? locale);

    const timingCfg = await readConfigJson<{ gap_ms: number; gap_before_s7_ms: number }>(supabase, 'sovereign_stitch_timing_v1');
    const timing: StitchTiming = { gap_ms: timingCfg?.gap_ms ?? DEFAULT_TIMING.gap_ms, gap_before_s7_ms: timingCfg?.gap_before_s7_ms ?? DEFAULT_TIMING.gap_before_s7_ms };

    // ── Read the deterministic brief context (the router INPUT). Fail-open §3.8. ──
    const { data: ctx } = await supabase.from('bbf_daily_brief_context').select('payload').eq('athlete_id', profileId).eq('day', day).maybeSingle();

    let wantedSlots: Array<{ slot: Slot; variant_key: string; screen_fact_ids: string[] }>;
    let screenFacts: Array<{ id: string; label: string; value: string }> = [];
    let tone = 'steady';
    let beatsAudit: Record<string, unknown> = {};
    let source = 'stitched_zero_api';

    if (ctx?.payload) {
      const payload = ctx.payload as BriefPayload;
      const all = rankBeats(payload);
      const selected = selectBeats(all);
      const t = resolveTone(payload, selected);
      tone = t;
      screenFacts = buildScreenFacts(payload);
      beatsAudit = { ranked: all, selected, dropped: all.filter((a) => !selected.includes(a)) };
      // spine: S0 (req) + selected conditionals + S5 (req) + S7 (req), ordered by slot
      wantedSlots = [
        { slot: 'S0' as Slot, variant_key: s0Variant(payload.readiness.state), screen_fact_ids: ['readiness'] },
        ...selected.map((b) => ({ slot: b.slot, variant_key: b.variant_key, screen_fact_ids: b.screen_fact_ids })),
        { slot: 'S5' as Slot, variant_key: s5Variant(payload.cardio.effective_tier, payload.cardio.duration_min), screen_fact_ids: ['hr_cap', 'hydration'] },
        { slot: 'S7' as Slot, variant_key: s7Variant(t), screen_fact_ids: [] },
      ].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
    } else {
      // Fallback tier 3 · base_only (§3.8): always-baked, always-valid neutral open + close.
      source = 'base_only';
      wantedSlots = [
        { slot: 'S0' as Slot, variant_key: 'S0_NEUTRAL', screen_fact_ids: [] },
        { slot: 'S7' as Slot, variant_key: 'S7_STEADY', screen_fact_ids: [] },
      ];
    }

    // ── STEP 4 · MANIFEST RESOLUTION (the allow-list): (slot,key,locale) → fragment ──
    const keys = wantedSlots.map((w) => w.variant_key);
    const { data: frags } = await supabase.from('sovereign_audio_fragments').select('variant_key, public_url, duration_ms, sha256, script_text').in('variant_key', keys).eq('locale', locale).eq('status', 'active');
    const fragByKey = new Map<string, { url: string; duration_ms: number; sha256: string; script_text: string }>();
    for (const f of (frags ?? [])) fragByKey.set(f.variant_key, { url: f.public_url, duration_ms: Number(f.duration_ms) || 0, sha256: f.sha256, script_text: f.script_text });

    const REQUIRED = new Set<Slot>(['S0', 'S5', 'S7']);
    const resolved: ResolvedItem[] = [];
    let dropped = 0;
    for (const w of wantedSlots) {
      const frag = fragByKey.get(w.variant_key);
      if (!frag) {
        // MISS RULE: a conditional beat is dropped; a required slot degrades to a
        // device-TTS fallback item (never route to silence, never a blocked brief).
        if (REQUIRED.has(w.slot)) resolved.push({ slot: w.slot, variant_key: w.variant_key, url: null, sha256: null, duration_ms: 0, fallback: 'device_tts', screen_fact_ids: w.screen_fact_ids, script_text: null });
        else dropped++;
        continue;
      }
      resolved.push({ slot: w.slot, variant_key: w.variant_key, url: frag.url, sha256: frag.sha256, duration_ms: frag.duration_ms, fallback: null, screen_fact_ids: w.screen_fact_ids, script_text: frag.script_text });
    }

    // ── STEP 5 · PLAYLIST ASSEMBLY (gapless contract) ──
    const { playlist, total_duration_ms } = assemblePlaylist(resolved, timing);
    const transcript = resolved.map((r) => r.script_text).filter(Boolean).join(' ');
    const bakedResolved = resolved.filter((r) => r.url).length;

    const { data: pl, error: plErr } = await supabase.from('sovereign_brief_playlists').upsert({
      athlete_id: profileId, day, locale, playlist,
      screen_facts: screenFacts,
      beats_selected: { ...beatsAudit, source, dropped_count: dropped },
      tone, total_duration_ms, status: 'ready',
    }, { onConflict: 'athlete_id,day,locale' }).select('id').maybeSingle();
    if (plErr) throw new Error(`playlist:${plErr.message}`);

    console.log(`[bbf-sovereign-stitch-router] athlete=${profileId} day=${day} locale=${locale} source=${source} fragments=${playlist.length} baked=${bakedResolved} dropped=${dropped} total_ms=${total_duration_ms} tone=${tone}`);
    return jsonResponse({
      ok: true, athlete_id: profileId, day, locale, source, playlist_id: pl?.id ?? null,
      contract_version: 'sovereign_stitch_v1', tone, total_duration_ms,
      fragments: playlist.length, baked_resolved: bakedResolved, dropped,
      playback_directives: { preload: 'all', scheduling: 'sample_accurate', gap_source: 'gap_after_ms', seek_model: 'virtual_timeline', fact_sync: 'on_fragment_start' },
      fallback_chain: ['stitched', 'yesterday_playlist', 'base_only', 'device_tts'],
      transcript_len: transcript.length,
    }, 200);
  } catch (e) {
    console.error('[bbf-sovereign-stitch-router] fatal:', e instanceof Error ? e.message : String(e));
    return jsonResponse({ ok: false, error: 'stitch_failed', detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
