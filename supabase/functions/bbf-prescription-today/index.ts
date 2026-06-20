// supabase/functions/bbf-prescription-today/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// PRESCRIPTION READER — surfaces the athlete's freshest generated queue. ZERO AI.
// The closing half of the Dynamic Prescription loop: bbf-prescription-checkin
// writes session_feedback → the tripwire runs bbf-prescription-engine → a row
// lands in active_playlists; THIS function reads it back for the recovery screen.
//
// Returns the latest ACTIVE playlist (most-future scheduled_for, newest first) —
// i.e. the athlete's next prescribed session (the engine always schedules
// next-day). active_playlists is RLS service-role-only and the browser never
// holds the bbf_users UUID, so identity is resolved SERVER-SIDE from the 24h
// vault_token (same _bbf_uid_from_vault_token resolver as the gate); the
// caller-supplied uid is never trusted (§7).
//
// AUTH: verify_jwt:false (gateway routes on the anon key; the real boundary is
// the vault_token, body `vault_token` or X-BBF-Vault-Token). Identity-only —
// reading your own recovery queue is foundational. Mirrors bbf-prescription-checkin.
//
// Response: 200 { ok, playlist } (playlist null when none) · 401 no/invalid
//           session · 405 method · 503 config.
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

async function uidFromVaultToken(supabaseUrl: string, serviceKey: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/_bbf_uid_from_vault_token`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_session_token: token }),
    });
    if (!r.ok) return null;
    const v = await r.json().catch(() => null);
    return (typeof v === 'string' && v) ? v : null;
  } catch { return null; }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { /* empty body is fine — token may ride the header */ }

  const vaultToken = String(payload.vault_token ?? req.headers.get('x-bbf-vault-token') ?? '').trim();
  if (!vaultToken) return jsonResponse({ error: 'missing_session', detail: 'A vault session token is required.' }, 401);
  const userId = await uidFromVaultToken(SUPABASE_URL, SERVICE_KEY, vaultToken);
  if (!userId) return jsonResponse({ error: 'invalid_session', detail: 'Vault session is invalid or expired.' }, 401);

  // Latest active queue = the athlete's next prescribed session.
  const select = 'id,target_area,action,intensity_modifier,exercises,scheduled_for,pain_score,rpe_score,created_at';
  const qs = `user_id=eq.${encodeURIComponent(userId)}&status=eq.active` +
    `&order=scheduled_for.desc,created_at.desc&limit=1&select=${select}`;
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/active_playlists?${qs}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
  } catch (e) {
    console.error(`[bbf-prescription-today] read threw: ${(e as Error).message}`);
    return jsonResponse({ error: 'read_failed' }, 500);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[bbf-prescription-today] read HTTP ${res.status}: ${detail}`);
    return jsonResponse({ error: 'read_failed', detail: `HTTP ${res.status}` }, 500);
  }
  const rows = await res.json().catch(() => null);
  const playlist = (Array.isArray(rows) && rows.length) ? rows[0] : null;

  console.log(`[bbf-prescription-today] user=${userId} playlist=${playlist ? playlist.id : 'none'}`);
  return jsonResponse({ ok: true, playlist }, 200);
});
