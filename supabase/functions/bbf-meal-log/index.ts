// supabase/functions/bbf-meal-log/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// MEAL-LOG WRITER — persists a tap-to-log wheel action to nutrition_intake_log.
// The client entry point of the nutrition adherence loop.
//
// WHY AN EDGE FN (not a browser insert): nutrition_intake_log is RLS service-role
// ONLY, and the browser holds a username slug + a 24h vault_token — never the
// bbf_users UUID, and never the athlete_profiles UUID the ledger keys on. Identity
// is resolved SERVER-SIDE from the vault bearer via _bbf_uid_from_vault_token, then
// the athlete profile is resolved from it. Mirrors bbf-prescription-checkin.
//
// TIER: identity-only (any valid vault session). Logging your own intake is
// FOUNDATIONAL — base_nutrition rides every paying path — so it is not tier-gated
// here (the paid, differentiated surfaces are gated in the UI + their own fns).
//
// THE GRAM STANDARD: protein/carbs/fat/serving are INTEGER grams in and stored as
// integer grams; kcal is a generated column (4P+4C+9F) — the client never sends it.
//
// IDEMPOTENT TOGGLE: every write carries a stable client_meal_key (`<source>:<day>:
// <idx>`). action:'log' UPSERTs on (athlete_id, day, client_meal_key) so a re-tap or
// double-fire heals instead of duplicating; action:'unlog' DELETEs that one row.
// Best-effort + soft-fail: a missing profile / transient error returns 200 { ok:false }
// so the optimistic wheel can revert without a hard crash; only a bad session 401s.
//
// Response: 200 { ok:true, action, client_meal_key, day } ·
//           200 { ok:false, error } (soft: no_profile / write_failed) ·
//           400 bad input · 401 no/invalid session · 405 method.
// Deploy verify_jwt:false (gateway routes on the anon key; the vault_token is the
// real identity boundary).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-vault-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// nutrition_intake_log.meal_slot CHECK taxonomy.
const KNOWN_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'pre', 'peri', 'post'];
function normalizeSlot(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (KNOWN_SLOTS.includes(s)) return s;
  if (s.includes('break')) return 'breakfast';
  if (s.includes('lunch') || s.includes('midday')) return 'lunch';
  if (s.includes('dinner') || s.includes('supper') || s.includes('evening')) return 'dinner';
  if (s.startsWith('pre')) return 'pre';
  if (s.startsWith('post')) return 'post';
  if (s.startsWith('peri') || s.includes('intra')) return 'peri';
  return 'snack'; // safest default — a snack never mis-slots a real meal window
}

const intGram = (v: unknown): number => Math.max(0, Math.round(Number(v) || 0));

async function uidFromVaultToken(supabaseUrl: string, serviceKey: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/_bbf_uid_from_vault_token`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_session_token: token }),
    });
    if (!r.ok) return null;
    const v = await r.json().catch(() => null); // scalar RPC → uuid string or null
    return (typeof v === 'string' && v) ? v : null;
  } catch { return null; }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const action = String(payload.action ?? 'log').trim().toLowerCase();
  if (action !== 'log' && action !== 'unlog') return jsonResponse({ error: 'bad_action' }, 400);

  const clientMealKey = String(payload.client_meal_key ?? '').trim();
  if (!clientMealKey) return jsonResponse({ error: 'missing_meal_key' }, 400);

  // Identity from the vault bearer (body or header) — never the client-supplied uid.
  const vaultToken = String(payload.vault_token ?? req.headers.get('x-bbf-vault-token') ?? '').trim();
  if (!vaultToken) return jsonResponse({ error: 'missing_session', detail: 'A vault session token is required.' }, 401);
  const userId = await uidFromVaultToken(SUPABASE_URL, SERVICE_KEY, vaultToken);
  if (!userId) return jsonResponse({ error: 'invalid_session', detail: 'Vault session is invalid or expired.' }, 401);

  const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  // Resolve the athlete profile the intake ledger keys on. No profile → soft-fail
  // (200 ok:false) so the optimistic wheel can revert; never a hard crash.
  let profileId: string | null = null;
  try {
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/athlete_profiles?user_id=eq.${encodeURIComponent(userId)}&select=id&order=created_at.asc&limit=1`,
      { headers: svc },
    );
    const rows = pr.ok ? await pr.json().catch(() => []) : [];
    profileId = Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : null;
  } catch { profileId = null; }
  if (!profileId) {
    console.warn(`[bbf-meal-log] no athlete profile for user=${userId} (soft-fail)`);
    return jsonResponse({ ok: false, error: 'no_profile' }, 200);
  }

  // Day defaults to today (UTC); a client may pass an explicit YYYY-MM-DD.
  const rawDay = String(payload.day ?? '').trim();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : new Date().toISOString().slice(0, 10);

  try {
    if (action === 'unlog') {
      const del = await fetch(
        `${SUPABASE_URL}/rest/v1/nutrition_intake_log` +
        `?athlete_id=eq.${encodeURIComponent(profileId)}` +
        `&day=eq.${encodeURIComponent(day)}` +
        `&client_meal_key=eq.${encodeURIComponent(clientMealKey)}`,
        { method: 'DELETE', headers: { ...svc, Prefer: 'return=minimal' } },
      );
      if (!del.ok) {
        const detail = await del.text().catch(() => '');
        console.error(`[bbf-meal-log] unlog HTTP ${del.status}: ${detail}`);
        return jsonResponse({ ok: false, error: 'write_failed' }, 200);
      }
      console.log(`[bbf-meal-log] user=${userId} profile=${profileId} unlog key=${clientMealKey} day=${day}`);
      return jsonResponse({ ok: true, action: 'unlog', client_meal_key: clientMealKey, day }, 200);
    }

    // action === 'log' — integer-gram macros; kcal is generated server-side.
    const protein_g = intGram(payload.protein_g);
    const carbs_g = intGram(payload.carbs_g);
    const fat_g = intGram(payload.fat_g);
    // serving_g is NOT NULL; default to the macronutrient mass when unstated.
    const serving_g = Math.max(intGram(payload.serving_g), protein_g + carbs_g + fat_g, 0);
    const meal_slot = normalizeSlot(payload.meal_slot);
    const food_label = String(payload.food_label ?? '').trim().slice(0, 240) || meal_slot;

    // UPSERT on (athlete_id, day, client_meal_key) — a re-tap heals, never dupes.
    const ins = await fetch(
      `${SUPABASE_URL}/rest/v1/nutrition_intake_log?on_conflict=athlete_id,day,client_meal_key`,
      {
        method: 'POST',
        headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          athlete_id: profileId, day, meal_slot, food_label,
          serving_g, protein_g, carbs_g, fat_g, client_meal_key: clientMealKey,
        }),
      },
    );
    if (!ins.ok) {
      const detail = await ins.text().catch(() => '');
      console.error(`[bbf-meal-log] log HTTP ${ins.status}: ${detail}`);
      return jsonResponse({ ok: false, error: 'write_failed' }, 200);
    }
    console.log(`[bbf-meal-log] user=${userId} profile=${profileId} log key=${clientMealKey} day=${day} slot=${meal_slot} P=${protein_g} C=${carbs_g} F=${fat_g}`);
    return jsonResponse({ ok: true, action: 'log', client_meal_key: clientMealKey, day }, 200);
  } catch (e) {
    console.error(`[bbf-meal-log] threw: ${(e as Error).message}`);
    return jsonResponse({ ok: false, error: 'write_failed' }, 200);
  }
});
