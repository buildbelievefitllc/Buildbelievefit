// supabase/functions/bbf-prescription-engine/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// THE DYNAMIC PRESCRIPTION ENGINE — clinical closed-loop feedback. ZERO AI.
//
// Fired by the session_feedback tripwire (pg_net → this webhook) on every
// post-session check-in. It:
//   1. Validates the shared-secret header (the trigger is the only caller;
//      manual/test calls pass the same X-BBF-Prescription-Secret).
//   2. Classifies the check-in DETERMINISTICALLY (safety-first ordering):
//        REGRESS  pain>=7 OR rpe>=8   → types [prehab, recovery]        · 0.5x
//        PROGRESS pain<=3 AND rpe<=4  → types [strengthening, mobility] · 1.1x
//        MAINTAIN otherwise            → types [mobility, prehab]        · 0.8x
//   3. Builds the NEXT DAY's 4-movement playlist for the user's target pain area
//      from clinical_exercises (region + prescribed types, gently backfilled to
//      4 so a thin region never short-changes the queue).
//   4. CHAMPION'S MINDSET OVERRIDE — ALWAYS appends exactly ONE
//      breathing_and_meditation (mental_wellness) finisher for nervous-system
//      regulation, regardless of regress/progress/maintain.
//   5. Writes the queue to active_playlists (superseding any prior active queue
//      for the same user/area/day so the latest check-in wins).
//
// NO model-router (§4 N/A — no Claude call). Mirrors the deterministic clinical
// pattern of bbf-agentic-prehab and bbf-evaluate-athlete-progress.
//
// LOOP-SAFE: writes ONLY active_playlists; the tripwire fires only on
// session_feedback INSERT → no recursion.
// Deploy with verify_jwt:false (server-to-server pg_net call; auth = shared secret).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-prescription-secret',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const KNOWN_AREAS = ['shoulder', 'lower_body', 'knee', 'neck', 'upper_body', 'full_body'];
const MENTAL_WELLNESS_LIBRARY = 'breathing_and_meditation';

const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Map a reported area to a canonical clinical_exercises.body_part. target_area
// SHOULD already be canonical; this only defends against synonyms / free text.
// Unknown → 'full_body' (the safe, always-populated general region).
function normalizeArea(raw: unknown): string {
  const a = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (KNOWN_AREAS.includes(a)) return a;
  const map: Record<string, string> = {
    shoulders: 'shoulder', rotator_cuff: 'shoulder', delt: 'shoulder',
    lower_back: 'lower_body', low_back: 'lower_body', back: 'lower_body', lumbar: 'lower_body',
    hip: 'lower_body', hips: 'lower_body', glute: 'lower_body', glutes: 'lower_body', hamstring: 'lower_body',
    knees: 'knee', patella: 'knee', patellar: 'knee', acl: 'knee',
    cervical: 'neck', trap: 'neck', traps: 'neck',
    upper_back: 'upper_body', thoracic: 'upper_body', wrist: 'upper_body', wrists: 'upper_body',
    elbow: 'upper_body', forearm: 'upper_body', arm: 'upper_body', arms: 'upper_body', chest: 'upper_body',
    full: 'full_body', total_body: 'full_body', whole_body: 'full_body', general: 'full_body',
  };
  return map[a] || 'full_body';
}

type Action = 'regress' | 'progress' | 'maintain';
interface Plan { action: Action; types: string[]; backfill: string[]; modifier: number; }

// Deterministic classifier. REGRESS is evaluated FIRST (safety-first): a high
// pain OR high RPE always de-loads, even if the other score looks fine.
function classify(pain: number, rpe: number): Plan {
  if (pain >= 7 || rpe >= 8) return { action: 'regress', types: ['prehab', 'recovery'], backfill: ['mobility'], modifier: 0.5 };
  if (pain <= 3 && rpe <= 4) return { action: 'progress', types: ['strengthening', 'mobility'], backfill: ['prehab'], modifier: 1.1 };
  return { action: 'maintain', types: ['mobility', 'prehab'], backfill: ['recovery'], modifier: 0.8 };
}

// Light seeded shuffle (LCG Fisher-Yates) — daily variety without an LLM, and
// reproducible for a given seed so the same check-in yields the same queue.
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = (seed >>> 0) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Exercise { id: string; name: string; body_part: string; type: string; }

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // ── Shared-secret auth (mirrors bbf-evaluate-athlete-progress). The deploy
  //    toolset can't set function env vars, so BOTH the tripwire and this
  //    function read the secret from bbf_app_config. ──
  const { data: cfg } = await supabase.from('bbf_app_config').select('value').eq('key', 'prescription_engine_secret').maybeSingle();
  const SECRET = (cfg?.value as string) || '';
  if (!SECRET) return jsonResponse({ error: 'config_missing_secret' }, 503);
  if (req.headers.get('x-bbf-prescription-secret') !== SECRET) return jsonResponse({ error: 'unauthorized' }, 401);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const userId = String(payload.user_id || '').trim();
  const pain = num(payload.pain_score);
  const rpe = num(payload.rpe_score);
  if (!userId) return jsonResponse({ error: 'missing_user_id' }, 400);
  if (pain === null || rpe === null) return jsonResponse({ error: 'missing_scores' }, 400);
  if (pain < 1 || pain > 10 || rpe < 1 || rpe > 10) return jsonResponse({ error: 'scores_out_of_range' }, 400);

  const area = normalizeArea(payload.target_area);
  const plan = classify(pain, rpe);
  // Seed the daily shuffle on the check-in minute (varies day-to-day, stable per check-in).
  const seed = Math.floor(Date.parse(String(payload.created_at || '')) / 60000) || (pain * 100 + rpe);

  // ── Assemble exactly 4 region movements: prescribed types → gentle backfill →
  //    full_body fallback. Guarantees a full queue even for a thin region. ──
  const picked: Exercise[] = [];
  const seen = new Set<string>();
  const take = (rows: Exercise[] | null) => {
    for (const r of rows || []) {
      if (picked.length >= 4) break;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      picked.push(r);
    }
  };

  try {
    // 1) region + prescribed types
    const q1 = await supabase.from('clinical_exercises')
      .select('id,name,body_part,type').eq('active', true).eq('body_part', area).in('type', plan.types);
    take(shuffle((q1.data as Exercise[]) || [], seed));

    // 2) region + gentle backfill types
    if (picked.length < 4) {
      const q2 = await supabase.from('clinical_exercises')
        .select('id,name,body_part,type').eq('active', true).eq('body_part', area).in('type', plan.backfill);
      take(shuffle((q2.data as Exercise[]) || [], seed + 1));
    }

    // 3) full_body fallback (only if the region itself was too thin)
    if (picked.length < 4 && area !== 'full_body') {
      const q3 = await supabase.from('clinical_exercises')
        .select('id,name,body_part,type').eq('active', true).eq('body_part', 'full_body')
        .in('type', [...plan.types, ...plan.backfill]);
      take(shuffle((q3.data as Exercise[]) || [], seed + 2));
    }
  } catch (e) {
    console.error(`[bbf-prescription-engine] library query failed: ${(e as Error).message}`);
    return jsonResponse({ error: 'library_unavailable' }, 503);
  }

  // Region movements carry the volume/hold-time modifier.
  const movements = picked.slice(0, 4).map((e, i) => ({
    slot: i + 1, kind: 'movement', id: e.id, name: e.name,
    body_part: e.body_part, type: e.type, volume_modifier: plan.modifier,
  }));

  // ── CHAMPION'S MINDSET OVERRIDE — always exactly ONE mental_wellness finisher.
  //    Never scaled by the volume modifier (nervous-system regulation runs full). ──
  let finisher: Record<string, unknown> | null = null;
  const qbm = await supabase.from('clinical_exercises')
    .select('id,name,body_part,type').eq('active', true).eq('body_part', MENTAL_WELLNESS_LIBRARY);
  const bmPool = shuffle((qbm.data as Exercise[]) || [], seed + 7);
  if (bmPool.length) {
    const e = bmPool[0];
    finisher = { slot: movements.length + 1, kind: 'mental_wellness', id: e.id, name: e.name, body_part: e.body_part, type: e.type, volume_modifier: 1.0 };
  } else {
    // Safety library is seeded with 8 entries; this should never fire.
    console.error('[bbf-prescription-engine] mental_wellness library empty — finisher skipped');
  }

  const exercises = finisher ? [...movements, finisher] : movements;

  // Next day (UTC) — the engine prescribes tomorrow's queue.
  const d = new Date(); d.setUTCDate(d.getUTCDate() + 1);
  const scheduledFor = d.toISOString().slice(0, 10);

  // Supersede any prior ACTIVE queue for the same user/area/day, then insert the new one.
  await supabase.from('active_playlists').update({ status: 'superseded' })
    .eq('user_id', userId).eq('target_area', area).eq('scheduled_for', scheduledFor).eq('status', 'active');

  const { data: ins, error: insErr } = await supabase.from('active_playlists').insert({
    user_id: userId,
    target_area: area,
    action: plan.action,
    intensity_modifier: plan.modifier,
    exercises,
    scheduled_for: scheduledFor,
    status: 'active',
    pain_score: pain,
    rpe_score: rpe,
    source_feedback_id: (payload.feedback_id as string) || null,
  }).select('id').maybeSingle();

  if (insErr) {
    console.error(`[bbf-prescription-engine] insert failed: ${insErr.message}`);
    return jsonResponse({ error: 'insert_failed', detail: insErr.message }, 500);
  }

  console.log(
    `[bbf-prescription-engine] user=${userId} pain=${pain} rpe=${rpe} area=${area} ` +
    `action=${plan.action} mod=${plan.modifier} movements=${movements.length} ` +
    `finisher=${finisher ? finisher.id : 'none'} sched=${scheduledFor} engine=deterministic`,
  );

  return jsonResponse({
    ok: true,
    action: plan.action,
    intensity_modifier: plan.modifier,
    target_area: area,
    scheduled_for: scheduledFor,
    playlist_id: ins?.id ?? null,
    movement_count: movements.length,
    mental_wellness: finisher ? finisher.id : null,
    exercises,
  }, 200);
});
