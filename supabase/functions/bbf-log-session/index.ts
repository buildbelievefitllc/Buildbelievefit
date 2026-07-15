// bbf-log-session — In-House Equity Mandate · athlete-side sRPE session logger
// ----------------------------------------------------------------------------
// The athlete's browser only holds a username slug + vault session token (never
// the bbf_users UUID), and bbf_athlete_load_logs is RLS-sealed (no policies →
// anon/authenticated fully denied). So this edge function resolves the real
// athlete UUID SERVER-SIDE from the vault token and does the privileged insert
// with the service role — the same trust pattern as bbf-prescription-checkin.
//
//   POST {FUNCTIONS_BASE}/bbf-log-session
//   body: { uid?, vault_token, duration_minutes, srpe_intensity, session_type? }
//   200 → { ok:true, log_id, athlete_id, load_au, session_timestamp }
//
// load_au (duration*sRPE) is a GENERATED column — never written here. The
// SUBJECTIVE ACWR engine (bbf_compute_acwr) reads exactly these rows.
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function pgGet(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) throw new Error(`pg_get_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function pgRpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc_${res.status}:${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

async function pgPost(path: string, rows: unknown): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`pg_post_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Resolve the athlete's bbf_users UUID from the vault session token (server-side,
// never trusting a browser-supplied id). Mirrors bbf-admin-roster/uidFromSession.
async function uidFromSession(session: string): Promise<string | null> {
  try {
    const r = await pgRpc('_bbf_uid_from_vault_token', { p_session_token: session });
    const id = typeof r === 'string' ? r : (Array.isArray(r) && r.length ? r[0] : null);
    if (id) return String(id);
  } catch (_) { /* fall through */ }
  try {
    const nowISO = new Date().toISOString();
    const rows = await pgGet(
      `bbf_vault_sessions?select=user_id&token=eq.${encodeURIComponent(session)}` +
      `&expires_at=gt.${encodeURIComponent(nowISO)}&limit=1`,
    );
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return row?.user_id ? String(row.user_id) : null;
  } catch (_) { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'backend_unconfigured' }, 503);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }

  // Identity — resolved from the token, not the browser.
  const vaultToken = String(body?.vault_token ?? '');
  if (!vaultToken) return jsonResponse({ error: 'missing_session' }, 401);
  const athleteId = await uidFromSession(vaultToken);
  if (!athleteId) return jsonResponse({ error: 'invalid_session' }, 401);

  // Validate the Foster inputs. Duration 1..1440 min; sRPE (Borg CR10) integer 1..10.
  const duration = Math.round(Number(body?.duration_minutes));
  const srpe = Math.round(Number(body?.srpe_intensity));
  if (!Number.isFinite(duration) || duration < 1 || duration > 1440) {
    return jsonResponse({ error: 'invalid_duration' }, 400);
  }
  if (!Number.isFinite(srpe) || srpe < 1 || srpe > 10) {
    return jsonResponse({ error: 'invalid_srpe' }, 400);
  }
  const sessionType = String(body?.session_type ?? 'sovereign_session').slice(0, 64) || 'sovereign_session';

  try {
    const inserted = await pgPost('bbf_athlete_load_logs', [{
      athlete_id: athleteId,
      session_type: sessionType,
      duration_minutes: duration,
      srpe_intensity: srpe,
    }]);
    const row = Array.isArray(inserted) && inserted.length ? inserted[0] : null;
    return jsonResponse({
      ok: true,
      log_id: row?.log_id ?? null,
      athlete_id: athleteId,
      load_au: row?.load_au ?? duration * srpe,
      session_timestamp: row?.session_timestamp ?? null,
    });
  } catch (e) {
    return jsonResponse({ error: 'insert_failed', detail: String(e).slice(0, 200) }, 500);
  }
});
