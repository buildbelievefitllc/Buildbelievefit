// bbf-studio-compiler — Studio V4 Ad Compiler backend pipeline.
// ─────────────────────────────────────────────────────────────────────────────
// Orchestration + storage layer for the text-overlay-and-B-roll ad pipeline
// (NO AI avatars — pure background footage + hook/sub-line text + audio).
//
// WHY NO FFMPEG HERE: a Deno edge function has no bundled ffmpeg binary and a
// CPU/wall-clock budget nowhere near a real 1080×1920 video transcode. The
// actual pixel/audio stitching runs client-side through the SAME proven engine
// the interactive Video Engine tab already uses (WebCodecs + mp4-muxer —
// SovereignFoundry.js, "the Isolation Protocol") — that IS this stack's
// existing rendering API. This function's job is everything AROUND that encode:
// validate the request, track state so the UI has a real "Rendering…" signal,
// mint a one-shot signed upload for the finished MP4, verify it landed, and
// serve the public URL.
//
// ACTIONS (POST JSON { action, ... }):
//   create   { background_video_url, audio_track_url, hook_text?, sub_line_text?,
//              hook_font?, hook_font_size?, text_layout? }
//            → validates the payload, inserts a status:'queued' row
//            → { ok, id, spec:{ hook_font, hook_font_size, text_layout } }
//   sign     { id } → flips the job to 'rendering', mints a one-shot signed
//            upload URL for bbf_studio_exports/{id}.mp4
//            → { ok, uploadUrl, bucket, path, contentType }
//   complete { id, duration_sec? } → HEADs the uploaded object, then flips the
//            job to 'completed' with the public URL
//            → { ok, output_url, duration_sec }
//   fail     { id, error } → flips the job to 'failed' with the reason
//            → { ok }
//   get      { id } → single job row (poll target) → { ok, job }
//   list     { limit? } → recent jobs (Queue tab) → { ok, jobs }
//
// SECURITY MODEL (mirrors bbf-studio-queue / CLAUDE.md §7):
//   • verify_jwt:false — the admin SESSION token is the boundary.
//   • Authorized iff a valid admin X-BBF-Session-Token (resolves to an
//     admin/trainer bbf_users row, or the `akeem` CEO fallback) OR the legacy
//     shared secret X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN (server-to-
//     server only). A valid non-admin session is rejected.
//   • The upload path is server-GENERATED ({id}.mp4) — never caller-chosen.
//
// Secrets (auto-injected): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Optional: BBF_COACH_AGENT_TOKEN (server-to-server admin gate).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-session-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_TOKEN  = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';

const BUCKET = 'bbf_studio_exports';
const TABLE  = 'bbf_studio_compiler_jobs';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_RE = /^https?:\/\/\S+$/i;
const HOOK_FONTS = ['bebas', 'anton', 'barlow'];
const TEXT_LAYOUTS = ['bottom', 'center', 'top'];

function clip(v: unknown, max: number): string | null {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
}

function pgHeaders(): HeadersInit {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' };
}

// ─── Admin authorization (ported from bbf-studio-queue) ──────────────────────────
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
async function pgPatch(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH', headers: { ...pgHeaders(), Prefer: 'return=representation' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pg_patch_${res.status}:${(await res.text()).slice(0, 200)}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j) && j.length ? j[0] : null;
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
    ) as Array<Record<string, unknown>>;
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return row?.user_id ? String(row.user_id) : null;
  } catch (_) { return null; }
}

async function authorize(req: Request): Promise<{ ok: boolean; userId: string | null }> {
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return { ok: true, userId: null };

  const session = req.headers.get('x-bbf-session-token') ?? '';
  if (!session) return { ok: false, userId: null };
  const userId = await uidFromSession(session);
  if (!userId) return { ok: false, userId: null };
  try {
    const rows = await pgGet(`bbf_users?select=uid,role,access_status&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`) as Array<Record<string, unknown>>;
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u) return { ok: false, userId: null };
    // LOCKED accounts must not reach the write path (parity with bbf-sovereign-studio).
    if (String(u.access_status ?? '').toLowerCase() === 'locked') return { ok: false, userId: null };
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    return { ok: role === 'admin' || role === 'trainer' || uname === 'akeem', userId };
  } catch (_) { return { ok: false, userId: null }; }
}

// ─── Storage helpers (service role) ──────────────────────────────────────────────
async function mintSignedUpload(path: string): Promise<{ uploadUrl: string }> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: 'POST', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!r.ok) throw new Error(`sign_${r.status}:${(await r.text()).slice(0, 200)}`);
  const j = await r.json().catch(() => null) as { url?: string } | null;
  const raw = String(j?.url ?? '');
  if (!raw) throw new Error('sign_no_url');
  const uploadUrl = /^https?:\/\//.test(raw) ? raw
    : raw.startsWith('/storage/v1') ? `${SUPABASE_URL}${raw}`
      : `${SUPABASE_URL}/storage/v1${raw.startsWith('/') ? raw : '/' + raw}`;
  return { uploadUrl };
}
async function assetExists(path: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`, { method: 'HEAD' });
    return r.ok;
  } catch (_) { return false; }
}
function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ─── handler ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'backend_unconfigured' }, 503);

  const auth = await authorize(req);
  if (!auth.ok) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }
  const action = String(body?.action ?? '');

  try {
    // ── create: validate the compile request, insert the queued job ──────────
    if (action === 'create') {
      const backgroundUrl = clip(body?.background_video_url, 2000);
      const audioUrl = clip(body?.audio_track_url, 2000);
      if (!backgroundUrl || !URL_RE.test(backgroundUrl)) return jsonResponse({ error: 'invalid_background_video_url' }, 400);
      if (!audioUrl || !URL_RE.test(audioUrl)) return jsonResponse({ error: 'invalid_audio_track_url' }, 400);

      const hookFont = HOOK_FONTS.includes(String(body?.hook_font)) ? String(body?.hook_font) : 'bebas';
      const textLayout = TEXT_LAYOUTS.includes(String(body?.text_layout)) ? String(body?.text_layout) : 'bottom';
      const hookFontSize = Math.min(260, Math.max(40, Math.round(Number(body?.hook_font_size)) || 138));

      const row: Record<string, unknown> = {
        status: 'queued',
        background_video_url: backgroundUrl,
        audio_track_url: audioUrl,
        hook_text: clip(body?.hook_text, 500),
        sub_line_text: clip(body?.sub_line_text, 500),
        hook_font: hookFont,
        hook_font_size: hookFontSize,
        text_layout: textLayout,
        output_bucket: BUCKET,
        created_by: auth.userId,
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
        method: 'POST', headers: { ...pgHeaders(), Prefer: 'return=representation' }, body: JSON.stringify([row]),
      });
      if (!res.ok) throw new Error(`insert_${res.status}:${(await res.text()).slice(0, 240)}`);
      const inserted = (await res.json().catch(() => null))?.[0] ?? null;
      if (!inserted?.id) throw new Error('insert_no_id');

      return jsonResponse({ ok: true, id: inserted.id, spec: { hook_font: hookFont, hook_font_size: hookFontSize, text_layout: textLayout } });
    }

    // ── sign: flip to 'rendering', mint the one-shot MP4 upload URL ───────────
    if (action === 'sign') {
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const path = `${id}.mp4`;
      const { uploadUrl } = await mintSignedUpload(path);
      await pgPatch(`${TABLE}?id=eq.${id}`, { status: 'rendering', updated_at: new Date().toISOString() });
      return jsonResponse({ ok: true, uploadUrl, bucket: BUCKET, path, contentType: 'video/mp4' });
    }

    // ── complete: verify the asset landed, finalize the job with its public URL ──
    if (action === 'complete') {
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const path = `${id}.mp4`;
      if (!(await assetExists(path))) return jsonResponse({ error: 'asset_not_found', detail: `${BUCKET}/${path} is not in storage` }, 409);

      const durationSec = Number(body?.duration_sec);
      const outputUrl = publicUrl(path);
      await pgPatch(`${TABLE}?id=eq.${id}`, {
        status: 'completed',
        output_path: path,
        output_url: outputUrl,
        duration_sec: Number.isFinite(durationSec) ? durationSec : null,
        updated_at: new Date().toISOString(),
      });
      return jsonResponse({ ok: true, output_url: outputUrl, duration_sec: Number.isFinite(durationSec) ? durationSec : null });
    }

    // ── fail: record the render failure, never silent ─────────────────────────
    if (action === 'fail') {
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      await pgPatch(`${TABLE}?id=eq.${id}`, { status: 'failed', error: clip(body?.error, 500) || 'unknown', updated_at: new Date().toISOString() });
      return jsonResponse({ ok: true });
    }

    // ── get: single job row (poll target) ──────────────────────────────────────
    if (action === 'get') {
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const rows = await pgGet(`${TABLE}?select=*&id=eq.${id}&limit=1`) as Array<Record<string, unknown>>;
      const job = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (!job) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ ok: true, job });
    }

    // ── list: recent jobs (Queue tab) ──────────────────────────────────────────
    if (action === 'list') {
      const limit = Math.min(Math.max(Number(body?.limit) || 25, 1), 100);
      const cols = 'id,status,hook_text,sub_line_text,output_url,duration_sec,error,created_at,updated_at';
      const jobs = await pgGet(`${TABLE}?select=${cols}&order=created_at.desc&limit=${limit}`) as Array<Record<string, unknown>>;
      return jsonResponse({ ok: true, jobs: Array.isArray(jobs) ? jobs : [] });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
