// bbf-content-manager — write/read bridge for the Digital Content Manager panel.
// ─────────────────────────────────────────────────────────────────────────────
// The Command Center "Digital Content Manager" (frontend/src/components/command/
// DigitalContentManager.jsx) stages pre-baked drafts from the STATIC
// bbf_master_content_engine.json library (no live LLM). On "Approve & Synthesize"
// the browser first calls bbf-studio-voiceover (the ONLY external API — ElevenLabs
// Akeem clone) to bake the MP3, then calls THIS function to persist a finalized,
// SCHEDULABLE row into bbf_content_manager_queue. The Distribution Calendar reads
// that queue and drag-and-drop reschedules a row's scheduled_at.
//
// This function is STRICTLY ADDITIVE: it never touches the live distributor batch
// tables (bbf_calling_cards_batch_v1 / bbf_reels_batch_v1), their distributors, or
// their crons. It owns exactly one table.
//
// SECURITY MODEL (CLAUDE.md §7 · mirrors bbf-studio-queue):
//   • verify_jwt:false — the admin SESSION token is the boundary, not the gateway JWT.
//   • Authorized iff a valid admin X-BBF-Session-Token resolves (via the canonical
//     _bbf_uid_from_vault_token) to a bbf_users row whose role is admin/trainer/coach
//     (or the `akeem` CEO fallback), OR the server-to-server shared secret
//     X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN. A valid NON-admin session is rejected.
//   • Only the SERVICE ROLE (held here, never shipped) reads/writes the queue.
//
// ACTIONS (POST JSON { action, ... }):
//   list        {}                              → { ok, items:[...] } (calendar feed)
//   approve     { series, target_angle?, hook?, caption?, studio_recipe?,
//                 voiceover_script?, audio_url?, audio_slug?, scheduled_at?, source_ref? }
//                                               → INSERT a status:'scheduled' row → { ok, item }
//   reschedule  { id, scheduled_at }            → UPDATE scheduled_at (the drag-drop RPC) → { ok, item }
//
// Secrets (auto-injected): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Optional: BBF_COACH_AGENT_TOKEN (server-to-server admin gate).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TABLE = 'bbf_content_manager_queue';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-session-token, x-bbf-vault-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_TOKEN  = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pgHeaders(): HeadersInit {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' };
}

// Trim → cap length → null when empty (blank optional fields stay NULL, not '').
function clip(v: unknown, max: number): string | null {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
}
// A finite JSON object or null (studio_recipe passes through verbatim).
function asObject(v: unknown): Record<string, unknown> | null {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? (v as Record<string, unknown>) : null;
}
// Validate an ISO timestamp; fall back to null so the DB default (now()) applies.
function asTimestamp(v: unknown): string | null {
  const s = (v == null ? '' : String(v)).trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// ─── Admin authorization (ported verbatim from bbf-studio-queue) ─────────────────
async function pgRpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: pgHeaders(), body: JSON.stringify(args) });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc_${res.status}:${text.slice(0, 200)}`);
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}
async function pgGet(path: string): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: pgHeaders() });
  if (!res.ok) throw new Error(`pg_get_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
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

async function resolveAdminUid(req: Request): Promise<string | null> {
  // 1) Legacy shared-secret path — server-to-server only (browser never sends it).
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return 'server';

  // 2) Admin-session path — the boundary for the Command Center browser.
  const session = req.headers.get('x-bbf-session-token') ?? req.headers.get('x-bbf-vault-token') ?? '';
  if (!session) return null;
  const userId = await uidFromSession(session);
  if (!userId) return null;
  try {
    const rows = await pgGet(
      `bbf_users?select=uid,role&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`,
    );
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u) return null;
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    if (role === 'admin' || role === 'trainer' || role === 'coach' || uname === 'akeem') return userId;
    return null;
  } catch (_) { return null; }
}

// ─── DB helpers (service role) ───────────────────────────────────────────────────
const ITEM_COLS = 'id,series,target_angle,hook,caption,studio_recipe,voiceover_script,cut_sheet,language,format,hashtags,recommended_post_time,audio_url,audio_slug,status,scheduled_at,source_ref,created_at,updated_at';

async function insertRow(row: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: { ...pgHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify([row]),
  });
  if (!res.ok) throw new Error(`insert_${res.status}:${(await res.text()).slice(0, 240)}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j) && j.length ? j[0] : null;
}

async function patchRow(id: string, patch: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...pgHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch_${res.status}:${(await res.text()).slice(0, 240)}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j) && j.length ? j[0] : null;
}

// ─── handler ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'backend_unconfigured' }, 503);

  const adminUid = await resolveAdminUid(req);
  if (!adminUid) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }
  const action = String(body?.action ?? '');
  const createdBy = adminUid === 'server' ? null : adminUid;

  try {
    // ── list: the calendar feed (all scheduled rows, soonest first) ───────────────
    if (action === 'list') {
      const rows = await pgGet(`${TABLE}?select=${ITEM_COLS}&order=scheduled_at.asc`) as Array<Record<string, unknown>>;
      return jsonResponse({ ok: true, items: Array.isArray(rows) ? rows : [] });
    }

    // ── approve: persist a finalized, scheduled row (post-synthesis) ──────────────
    if (action === 'approve') {
      const series = clip(body?.series, 80);
      if (!series) return jsonResponse({ error: 'missing_series' }, 400);
      const row: Record<string, unknown> = {
        series,
        target_angle: clip(body?.target_angle, 400),
        hook: clip(body?.hook, 300),
        caption: clip(body?.caption, 2200),
        studio_recipe: asObject(body?.studio_recipe),
        voiceover_script: clip(body?.voiceover_script, 4000),
        cut_sheet: clip(body?.cut_sheet, 2000),
        language: clip(body?.language, 8),
        format: clip(body?.format, 40),
        hashtags: clip(body?.hashtags, 800),
        recommended_post_time: clip(body?.recommended_post_time, 80),
        audio_url: clip(body?.audio_url, 600),
        audio_slug: clip(body?.audio_slug, 200),
        status: 'scheduled',
        scheduled_at: asTimestamp(body?.scheduled_at) ?? new Date().toISOString(),
        source_ref: clip(body?.source_ref, 120),
        created_by: createdBy,
      };
      const item = await insertRow(row);
      return jsonResponse({ ok: true, item });
    }

    // ── reschedule: drag-drop moved the block → update scheduled_at (the "RPC") ────
    if (action === 'reschedule') {
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const scheduled_at = asTimestamp(body?.scheduled_at);
      if (!scheduled_at) return jsonResponse({ error: 'bad_timestamp' }, 400);
      const item = await patchRow(id, { scheduled_at, updated_at: new Date().toISOString() });
      if (!item) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ ok: true, item });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
