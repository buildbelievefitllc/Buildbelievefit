// bbf-athlete-acwr — In-House Equity Mandate · dual-engine ACWR for the roster
// ----------------------------------------------------------------------------
// Batch ACWR for a roster group, computed 100% in-house at zero API cost:
//   • SUBJECTIVE (Foster sRPE): the deterministic bbf_compute_acwr(p_athlete_id)
//     RPC (duration*sRPE, acute EWMA N=7 / chronic N=28). The RPC is locked to
//     service_role/authenticated (anon revoked, §7), so it runs HERE server-side
//     and is never exposed to the browser's anon client.
//   • PHYSICAL (mechanical tonnage): the latest athlete_workload_daily.acwr,
//     bridged bbf_users.id → athlete_profiles.user_id → athlete_profiles.id.
// Missing data ⇒ null (never a fabricated number).
//
// Auth mirrors bbf-admin-roster exactly (CLAUDE.md §5/§7): the legacy shared
// secret X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN, OR a validated admin
// session token X-BBF-Session-Token. verify_jwt is disabled at the gateway; the
// authorization is enforced in-function. Deterministic, zero AI.
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-bbf-admin-token, x-bbf-session-token',
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
const ADMIN_TOKEN  = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';

// ── Service-role PostgREST helpers (bypass RLS) ─────────────────────────────
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

// ── Dual authorization (parity with bbf-admin-roster) ───────────────────────
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

async function isAuthorized(req: Request): Promise<boolean> {
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return true;
  const session = req.headers.get('x-bbf-session-token') ?? '';
  if (!session) return false;
  const userId = await uidFromSession(session);
  if (!userId) return false;
  try {
    const rows = await pgGet(
      `bbf_users?select=uid,role&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`,
    );
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u) return false;
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    return role === 'admin' || role === 'trainer' || uname === 'akeem';
  } catch (_) { return false; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'backend_unconfigured' }, 503);
  if (!(await isAuthorized(req))) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }

  const ids = Array.isArray(body?.athlete_ids)
    ? [...new Set((body.athlete_ids as unknown[]).map((x) => String(x)).filter(Boolean))].slice(0, 100)
    : [];
  if (!ids.length) return jsonResponse({ ok: true, acwr: {} });

  try {
    // ── PHYSICAL tonnage ACWR — bridge to athlete_profiles, latest per athlete ──
    const tonnageById: Record<string, number | null> = {};
    try {
      const inUsers = ids.map((i) => encodeURIComponent(i)).join(',');
      const profs = await pgGet(`athlete_profiles?select=id,user_id&user_id=in.(${inUsers})`);
      const profToUser: Record<string, string> = {};
      const profIds: string[] = [];
      for (const p of (Array.isArray(profs) ? profs : [])) {
        if (p?.id && p?.user_id) { profToUser[String(p.id)] = String(p.user_id); profIds.push(String(p.id)); }
      }
      if (profIds.length) {
        const inProf = profIds.map((i) => encodeURIComponent(i)).join(',');
        const wl = await pgGet(
          `athlete_workload_daily?select=athlete_id,acwr,day&athlete_id=in.(${inProf})&order=day.desc`,
        );
        for (const r of (Array.isArray(wl) ? wl : [])) {
          const uid = profToUser[String(r.athlete_id)];
          if (uid && tonnageById[uid] === undefined) {
            tonnageById[uid] = r.acwr == null ? null : Number(r.acwr);
          }
        }
      }
    } catch (_) { /* tonnage overlay non-fatal → leaves nulls */ }

    // ── SUBJECTIVE sRPE ACWR — one deterministic RPC per athlete (bounded) ──────
    const out: Record<string, {
      subjective: { acute: number; chronic: number; ratio: number } | null;
      tonnage: number | null;
    }> = {};
    await Promise.all(ids.map(async (id) => {
      let subjective: { acute: number; chronic: number; ratio: number } | null = null;
      try {
        const r = await pgRpc('bbf_compute_acwr', { p_athlete_id: id });
        const row = Array.isArray(r) && r.length ? r[0] : (r && typeof r === 'object' ? r : null);
        if (row) {
          subjective = {
            acute: Number(row.acute_ewma) || 0,
            chronic: Number(row.chronic_ewma) || 0,
            ratio: Number(row.acwr) || 0,
          };
        }
      } catch (_) { /* leave subjective null for this athlete */ }
      out[id] = { subjective, tonnage: tonnageById[id] ?? null };
    }));

    return jsonResponse({ ok: true, acwr: out });
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String(e).slice(0, 200) }, 500);
  }
});
