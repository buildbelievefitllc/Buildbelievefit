// bbf-user-profile · cross-device dietary hydration
// ─────────────────────────────────────────────────────────────────
// Returns the dietary + macro intake for a given uid. The frontend
// calls this on login so users picking up the app on a fresh device
// (no localStorage.bbf_pathfinder cache) get their real preferences
// instead of the Omnivore/empty fallback. Read-only · RLS open via
// service-role key. Returns { ok: true, profile: {...} } or
// { ok: false, reason }. No auth gating beyond having a valid uid —
// the fields returned are non-sensitive client preferences.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);

  let payload;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ ok: false, reason: 'invalid_json' }, 400); }

  const uid = typeof payload?.uid === 'string' ? payload.uid.trim() : '';
  if (!uid) return jsonResponse({ ok: false, reason: 'uid_missing' }, 400);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return jsonResponse({ ok: false, reason: 'config_missing' }, 200);
  }

  const url = `${SUPABASE_URL}/rest/v1/bbf_users?uid=eq.${encodeURIComponent(uid)}&select=dietary_profile,allergens,food_likes,food_dislikes,tdee_target,macro_p,macro_c,macro_f&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) {
      console.error(`[bbf-user-profile] fetch failed: HTTP ${res.status}`);
      return jsonResponse({ ok: false, reason: `db_${res.status}` }, 200);
    }
    const rows = await res.json();
    const row  = (Array.isArray(rows) && rows[0]) || null;
    if (!row) {
      return jsonResponse({ ok: true, profile: null, reason: 'user_not_found' }, 200);
    }
    return jsonResponse({
      ok: true,
      profile: {
        dietary_profile: row.dietary_profile || 'Omnivore',
        allergens:       Array.isArray(row.allergens)     ? row.allergens     : [],
        food_likes:      Array.isArray(row.food_likes)    ? row.food_likes    : [],
        food_dislikes:   Array.isArray(row.food_dislikes) ? row.food_dislikes : [],
        tdee_target:     row.tdee_target || null,
        macro_p:         row.macro_p     || null,
        macro_c:         row.macro_c     || null,
        macro_f:         row.macro_f     || null,
      },
    }, 200);
  } catch (e) {
    console.error(`[bbf-user-profile] threw: ${e?.message}`);
    return jsonResponse({ ok: false, reason: 'fetch_threw' }, 200);
  }
});
