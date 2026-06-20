// supabase/functions/bbf-prescription-checkin/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// POST-WORKOUT CHECK-IN WRITER — the client entry point of the prescription loop.
// Writes ONE row to session_feedback (service role); that INSERT fires the
// existing session_feedback tripwire → bbf-prescription-engine, which generates
// the athlete's next-day playlist. ZERO AI.
//
// WHY THIS EXISTS (not a direct browser insert): session_feedback is RLS
// service-role-only, AND the browser never holds the bbf_users UUID — it holds a
// username slug + a 24h vault_token (see AuthContext). So identity is resolved
// SERVER-SIDE from the vault bearer via the established _bbf_uid_from_vault_token
// RPC (same resolver the entitlement gate uses); the caller-supplied uid is NEVER
// trusted for identity (§7). A direct anon insert would both fail RLS and write a
// wrong (slug) user_id.
//
// AUTH: deploy verify_jwt:false. The Supabase gateway routes on the anon key; the
// REAL identity boundary is the vault_token (body `vault_token` or X-BBF-Vault-Token
// header). Mirrors bbf-agentic-recovery / -prehab. Identity-only (no tier gate): a
// post-session pain/RPE check-in is foundational logging, available to any valid
// vault session (locked accounts have their session rows revoked → never resolve).
//
// Response: 200 { ok, feedback_id, user_id, target_area } · 400 bad input ·
//           401 no/invalid session · 405 method · 500 write failure.
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

const KNOWN_AREAS = ['shoulder', 'lower_body', 'knee', 'neck', 'upper_body', 'full_body'];
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Server-authoritative identity: resolve bbf_users.id (uuid) from the 24h vault
// bearer via the established SECURITY DEFINER RPC. Returns null on any miss
// (expired / invalid / revoked-on-lock).
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

  const pain = num(payload.pain_score);
  const rpe = num(payload.rpe_score);
  if (pain === null || rpe === null) return jsonResponse({ error: 'missing_scores' }, 400);
  if (pain < 1 || pain > 10 || rpe < 1 || rpe > 10) return jsonResponse({ error: 'scores_out_of_range' }, 400);

  // Canonicalize the target area; unknown/empty → full_body (the engine also normalizes).
  const rawArea = String(payload.target_area ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  const targetArea = KNOWN_AREAS.includes(rawArea) ? rawArea : 'full_body';

  // Identity from the vault bearer (body or header) — never the client-supplied uid.
  const vaultToken = String(payload.vault_token ?? req.headers.get('x-bbf-vault-token') ?? '').trim();
  if (!vaultToken) return jsonResponse({ error: 'missing_session', detail: 'A vault session token is required.' }, 401);
  const userId = await uidFromVaultToken(SUPABASE_URL, SERVICE_KEY, vaultToken);
  if (!userId) return jsonResponse({ error: 'invalid_session', detail: 'Vault session is invalid or expired.' }, 401);

  // Service-role insert → fires the session_feedback tripwire → prescription engine.
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/session_feedback`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify({ user_id: userId, pain_score: pain, rpe_score: rpe, target_area: targetArea }),
    });
  } catch (e) {
    console.error(`[bbf-prescription-checkin] insert threw: ${(e as Error).message}`);
    return jsonResponse({ error: 'write_failed' }, 500);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[bbf-prescription-checkin] insert HTTP ${res.status}: ${detail}`);
    return jsonResponse({ error: 'write_failed', detail: `HTTP ${res.status}` }, 500);
  }
  const rows = await res.json().catch(() => null);
  const feedbackId = (Array.isArray(rows) && rows[0]?.id) ? rows[0].id : null;

  console.log(`[bbf-prescription-checkin] user=${userId} pain=${pain} rpe=${rpe} area=${targetArea} feedback_id=${feedbackId}`);
  return jsonResponse({ ok: true, feedback_id: feedbackId, user_id: userId, target_area: targetArea }, 200);
});
