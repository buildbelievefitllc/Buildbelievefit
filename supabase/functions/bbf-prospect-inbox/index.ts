// bbf-prospect-inbox — coach-side prospect queue (Stateful Gap Analyzer)
// ----------------------------------------------------------------------------
// Admin-gated read/act surface for NEW_PROSPECT cards in coach_action_inbox
// (written by bbf-agentic-interrogator). Comlink calls this to render the
// Prospects lane and to approve/stamp a card after copying the outreach draft.
//
//   POST { action:'list', limit? }
//     → { ok, total, cards:[{ id, type, status, insight_summary, proposed_action,
//         draft_message, created_at, processed_at, prospect_id, prospect:{ name,
//         contact_handle, gap_verdict, gap_report, created_at } }] }
//   POST { action:'process', card_id }
//     → { ok, card:{ id, status:'APPROVED', processed_at } }
//
// Auth mirrors bbf-admin-roster / bbf-athlete-acwr (§5/§7): X-BBF-Admin-Token ===
// BBF_COACH_AGENT_TOKEN OR a validated admin X-BBF-Session-Token. coach_action_inbox
// + prospect_leads are RLS-sealed; only this service-role function reads them.

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

async function pgGet(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) throw new Error(`pg_get_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function pgPatch(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pg_patch_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function pgRpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc_${res.status}:${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

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
  const action = String(body?.action ?? 'list');

  try {
    if (action === 'list') {
      const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 200);
      // Embed the linked prospect via the prospect_id FK.
      const rows = await pgGet(
        `coach_action_inbox?select=id,type,status,risk_score,insight_summary,proposed_action,` +
        `draft_message,created_at,processed_at,prospect_id,` +
        `prospect:prospect_leads(name,contact_handle,gap_verdict,gap_report,created_at)` +
        `&type=eq.NEW_PROSPECT&order=created_at.desc&limit=${limit}`,
      );
      const cards = Array.isArray(rows) ? rows : [];
      const pending = cards.filter((c: any) => String(c.status) !== 'APPROVED').length;
      return jsonResponse({ ok: true, total: cards.length, pending, cards });
    }

    if (action === 'process') {
      const cardId = String(body?.card_id ?? '');
      if (!cardId) return jsonResponse({ error: 'missing_card_id' }, 400);
      const nowISO = new Date().toISOString();
      const updated = await pgPatch(
        `coach_action_inbox?id=eq.${encodeURIComponent(cardId)}&type=eq.NEW_PROSPECT` +
        `&select=id,status,processed_at`,
        { status: 'APPROVED', processed_at: nowISO },
      );
      const card = Array.isArray(updated) && updated.length ? updated[0] : null;
      if (!card) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ ok: true, card });
    }

    return jsonResponse({ error: 'unknown_action' }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String(e).slice(0, 200) }, 500);
  }
});
