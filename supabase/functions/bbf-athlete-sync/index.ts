// supabase/functions/bbf-athlete-sync/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// BBF ATHLETE SYNC — the secure server bridge for the Athlete Blueprint.
//
//   GET  → read the athlete's progression identity from athlete_profiles:
//          { ok, current_tier, blueprint, profile{ sport, position, full_name,
//            gender, birth_date }, blueprint_updated_at }.
//   POST → persist the forged blueprint to the athlete's athlete_profiles record:
//          body { blueprint } → updates blueprint + blueprint_updated_at.
//
// Identity is resolved SERVER-SIDE from the athlete's revocable vault token (never a
// client-supplied id), exactly like bbf-weekly-brief / bbf-biokinetic-briefing. The
// athlete_profiles row is created by bbf_submit_youth_intake (the YouthIntake gate),
// so by the time the Sports Hub renders the Blueprint the row exists; a POST against
// a missing row returns { ok:false, error:'no_profile' } and the client keeps its
// offline cache. No Claude call (model-router N/A). Built-in Deno.serve.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

async function resolveUserId(supa: ReturnType<typeof createClient>, token: string): Promise<string | null> {
  const tok = String(token || '').trim();
  if (!tok) return null;
  const { data } = await supa.rpc('_bbf_uid_from_vault_token', { p_session_token: tok });
  return (typeof data === 'string' && data) ? data : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_unavailable', detail: 'Server identity store is unreachable.' }, 503);

  const url = new URL(req.url);
  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Parse body up-front for POST (also a fallback carrier for the vault token).
  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  }

  const token = req.headers.get('x-bbf-vault-token')
    || url.searchParams.get('vault_token')
    || (typeof body?.vault_token === 'string' ? body.vault_token : '')
    || '';

  const userId = await resolveUserId(supa, token);
  if (!userId) return jsonResponse({ error: 'invalid_session', detail: 'Vault session is invalid or expired.' }, 401);

  // ── GET · read the athlete's tier + saved blueprint ─────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supa
      .from('athlete_profiles')
      .select('current_tier, blueprint, blueprint_updated_at, sport, position, full_name, gender, birth_date')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return jsonResponse({ error: 'profile_read_failed', detail: error.message }, 502);
    if (!data) return jsonResponse({ ok: true, current_tier: null, blueprint: null, profile: null });
    return jsonResponse({
      ok: true,
      current_tier: data.current_tier ?? null,
      blueprint: data.blueprint ?? null,
      blueprint_updated_at: data.blueprint_updated_at ?? null,
      profile: {
        sport: data.sport ?? null,
        position: data.position ?? null,
        full_name: data.full_name ?? null,
        gender: data.gender ?? null,
        birth_date: data.birth_date ?? null,
      },
    });
  }

  // ── POST · persist the forged blueprint ─────────────────────────────────────
  const blueprint = body?.blueprint ?? null;
  if (blueprint === null || typeof blueprint !== 'object') {
    return jsonResponse({ error: 'missing_blueprint', detail: 'A blueprint object is required.' }, 400);
  }
  const { data, error } = await supa
    .from('athlete_profiles')
    .update({ blueprint, blueprint_updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('user_id');
  if (error) return jsonResponse({ error: 'blueprint_save_failed', detail: error.message }, 502);
  if (!data || !data.length) {
    // No profile row yet (athlete hasn't completed the youth intake gate) — the
    // client keeps its offline cache and re-syncs after intake.
    return jsonResponse({ ok: false, error: 'no_profile', detail: 'Complete the athlete intake first.' }, 404);
  }
  return jsonResponse({ ok: true, saved: true });
});
