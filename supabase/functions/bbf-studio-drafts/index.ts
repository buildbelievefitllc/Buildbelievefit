// bbf-studio-drafts — Vault Export History write/read path for Sovereign Studio V4.
// ─────────────────────────────────────────────────────────────────────────────
// THE PROBLEM (Galaxy S25 Ultra field failure): the Studio renders reels/cards
// entirely client-side, but getting the finished blob ONTO the phone is fragile
// (installed-PWA blob anchors die silently; share sheets need a fresh tap). Until
// now the render lived only in browser memory — a failed save meant a lost render.
//
// THIS FUNCTION makes every finished export durable: the browser uploads the baked
// blob to the PRIVATE studio-drafts-v1 bucket via a one-shot signed URL, a ledger
// row lands in bbf_studio_export_drafts, and ANY later device/session (the laptop)
// lists the history and pulls the file back down through a short-lived signed
// download URL. Render on the phone → retrieve on the laptop.
//
// SECURITY MODEL (identical to bbf-studio-queue · CLAUDE.md §7):
//   • verify_jwt:false — the admin vault SESSION token is the boundary.
//   • Authorized iff EITHER a valid admin X-BBF-Session-Token (resolves via
//     _bbf_uid_from_vault_token to an admin/trainer bbf_users row, or the `akeem`
//     CEO fallback) OR the server-to-server X-BBF-Admin-Token shared secret.
//   • Storage paths are server-GENERATED ({uuid}.{ext}); the bucket is PRIVATE —
//     reads only ever happen through signed URLs minted here (service role).
//
// ACTIONS (POST JSON { action, ... }):
//   sign     { kind:'image'|'video' }
//            → { ok, id, kind, bucket, path, ext, contentType, uploadUrl }
//   confirm  { id, kind, file_name?, mode?, caption?, duration_sec?, frames?, source_device? }
//            → HEAD the uploaded object (service role — private bucket), then
//              INSERT the ledger row → { ok, id, draft }
//   list     { limit? } → { ok, drafts:[…], count }
//   download { id } → { ok, id, url, file_name, content_type }  (6h signed URL,
//              Content-Disposition: attachment via the ?download= param)
//   delete   { id } → remove the storage object + the ledger row → { ok, id }
//   promote  { id, now?, platform_target? } → SERVER-SIDE copy of the stored blob
//              into the auto-post pipeline (studio-drafts-v1 → calling-cards-v1 /
//              reels-v1) + a status:'queued' batch row carrying the draft's saved
//              caption — so a reel rendered on the phone posts from the laptop (or
//              any device) with ZERO re-upload. now:true fires the distributor
//              immediately (video → background, poll bbf-studio-queue poststatus
//              with the returned queue_id; image → synchronous verdict).
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

const BUCKET = 'studio-drafts-v1';
const TABLE  = 'bbf_studio_export_drafts';
const DOWNLOAD_TTL_SEC = 21600; // 6h — long enough to move devices, short enough to stay private

type Kind = 'image' | 'video';
const EXT: Record<Kind, { ext: string; contentType: string }> = {
  image: { ext: 'jpg', contentType: 'image/jpeg' },
  video: { ext: 'mp4', contentType: 'video/mp4' },
};

// promote → the auto-post pipeline's routing (kept in lockstep with
// bbf-studio-queue: same env overrides, same defaults, same batch tables).
const QUEUE_ROUTING: Record<Kind, { bucket: string; ext: string; table: string; distributor: string }> = {
  image: {
    bucket: Deno.env.get('BBF_CARDS_BUCKET') || 'calling-cards-v1',
    ext: 'jpg',
    table: 'bbf_calling_cards_batch_v1',
    distributor: 'bbf-card-distributor',
  },
  video: {
    bucket: Deno.env.get('REELS_BUCKET') || 'reels-v1',
    ext: (Deno.env.get('REELS_EXT') || 'mp4').replace(/^\./, ''),
    table: 'bbf_reels_batch_v1',
    distributor: 'bbf-reel-distributor',
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function normKind(v: unknown): Kind { return v === 'image' ? 'image' : 'video'; }
function clip(v: unknown, max: number): string | null {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
}
function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function pgHeaders(): HeadersInit {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' };
}

// ─── Admin authorization (ported verbatim from bbf-studio-queue) ──────────────────
async function pgRpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: pgHeaders(), body: JSON.stringify(args),
  });
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

async function isAuthorized(req: Request): Promise<boolean> {
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return true;

  const session = req.headers.get('x-bbf-session-token') ?? '';
  if (!session) return false;
  const userId = await uidFromSession(session);
  if (!userId) return false;
  try {
    const rows = await pgGet(
      `bbf_users?select=uid,role,access_status&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`,
    );
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u) return false;
    // LOCKED accounts must not reach a function that can promote assets into the
    // live auto-post pipeline (parity with bbf-sovereign-studio's gate).
    if (String(u.access_status ?? '').toLowerCase() === 'locked') return false;
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    return role === 'admin' || role === 'trainer' || uname === 'akeem';
  } catch (_) { return false; }
}

// ─── Storage helpers (service role · PRIVATE bucket) ──────────────────────────────
async function mintSignedUpload(path: string): Promise<string> {
  // Auth-only headers (NO Content-Type) — the create-signed-upload route is a
  // bodyless POST and rejects an empty application/json body (Fastify 400).
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: 'POST', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!r.ok) throw new Error(`sign_${r.status}:${(await r.text()).slice(0, 200)}`);
  const j = await r.json().catch(() => null) as { url?: string } | null;
  const raw = String(j?.url ?? '');
  if (!raw) throw new Error('sign_no_url');
  return /^https?:\/\//.test(raw)
    ? raw
    : raw.startsWith('/storage/v1')
      ? `${SUPABASE_URL}${raw}`
      : `${SUPABASE_URL}/storage/v1${raw.startsWith('/') ? raw : '/' + raw}`;
}

// Existence + size gate for a PRIVATE object — unlike the queue's public HEAD,
// this must go through the authenticated object route with the service role.
async function privateObjectStat(path: string): Promise<{ exists: boolean; bytes: number | null }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'HEAD', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    if (!r.ok) return { exists: false, bytes: null };
    const len = Number(r.headers.get('content-length'));
    return { exists: true, bytes: Number.isFinite(len) && len > 0 ? len : null };
  } catch (_) { return { exists: false, bytes: null }; }
}

// Short-lived signed DOWNLOAD URL. `download=<name>` makes storage answer with
// Content-Disposition: attachment — the browser saves the file with its real
// export name instead of navigating to a raw video/image view.
async function mintSignedDownload(path: string, fileName: string): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST', headers: pgHeaders(), body: JSON.stringify({ expiresIn: DOWNLOAD_TTL_SEC }),
  });
  if (!r.ok) throw new Error(`dl_sign_${r.status}:${(await r.text()).slice(0, 200)}`);
  const j = await r.json().catch(() => null) as { signedURL?: string; signedUrl?: string } | null;
  const raw = String(j?.signedURL ?? j?.signedUrl ?? '');
  if (!raw) throw new Error('dl_sign_no_url');
  const abs = /^https?:\/\//.test(raw)
    ? raw
    : raw.startsWith('/storage/v1')
      ? `${SUPABASE_URL}${raw}`
      : `${SUPABASE_URL}/storage/v1${raw.startsWith('/') ? raw : '/' + raw}`;
  return `${abs}${abs.includes('?') ? '&' : '?'}download=${encodeURIComponent(fileName)}`;
}

async function deleteObject(path: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'DELETE', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  return r.ok || r.status === 404; // already gone = success for our purposes
}

async function insertDraft(row: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: { ...pgHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify([row]),
  });
  if (!res.ok) throw new Error(`insert_${res.status}:${(await res.text()).slice(0, 240)}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j) && j.length ? j[0] : null;
}

async function getDraft(id: string): Promise<Record<string, unknown> | null> {
  const rows = await pgGet(`${TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`) as Array<Record<string, unknown>>;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function insertRow(table: string, row: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...pgHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify([row]),
  });
  if (!res.ok) throw new Error(`insert_${res.status}:${(await res.text()).slice(0, 240)}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j) && j.length ? j[0] : null;
}

// Server-side object copy (private draft vault → public distributor bucket) so a
// promote never touches the device. Storage's copy endpoint first; download +
// re-upload fallback for older storage-api builds without cross-bucket copy.
async function copyObject(srcBucket: string, srcKey: string, dstBucket: string, dstKey: string, contentType: string): Promise<void> {
  const cp = await fetch(`${SUPABASE_URL}/storage/v1/object/copy`, {
    method: 'POST',
    headers: pgHeaders(),
    body: JSON.stringify({ bucketId: srcBucket, sourceKey: srcKey, destinationBucket: dstBucket, destinationKey: dstKey }),
  });
  if (cp.ok) return;
  const dl = await fetch(`${SUPABASE_URL}/storage/v1/object/${srcBucket}/${srcKey}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!dl.ok) throw new Error(`copy_download_${dl.status}`);
  const bytes = await dl.arrayBuffer();
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${dstBucket}/${dstKey}`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: bytes,
  });
  if (!up.ok) throw new Error(`copy_upload_${up.status}`);
}

// Fire the matching distributor for one queued id (server-to-server, same gate
// the queue function uses). Requires BBF_COACH_AGENT_TOKEN in env.
async function distributeNow(distributor: string, id: string): Promise<{ ok: boolean; status: number; result: any }> {
  if (!ADMIN_TOKEN) return { ok: false, status: 0, result: { error: 'admin_token_unset' } };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${distributor}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-BBF-Admin-Token': ADMIN_TOKEN },
    body: JSON.stringify({ action: 'distribute', live: true, limit: 1, ids: [id] }),
  });
  const result = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, result };
}

// ─── handler ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'backend_unconfigured' }, 503);

  if (!(await isAuthorized(req))) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }
  const action = String(body?.action ?? '');

  try {
    // ── sign: mint a one-shot signed upload URL for a server-generated path ──────
    if (action === 'sign') {
      const kind = normKind(body?.kind);
      const cfg = EXT[kind];
      const id = crypto.randomUUID();
      const path = `${id}.${cfg.ext}`;
      const uploadUrl = await mintSignedUpload(path);
      return jsonResponse({ ok: true, id, kind, bucket: BUCKET, path, ext: cfg.ext, contentType: cfg.contentType, uploadUrl });
    }

    // ── confirm: verify the blob landed (service-role HEAD), write the ledger row ─
    if (action === 'confirm') {
      const kind = normKind(body?.kind);
      const cfg = EXT[kind];
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const path = `${id}.${cfg.ext}`;

      const stat = await privateObjectStat(path);
      if (!stat.exists) {
        return jsonResponse({ error: 'asset_not_found', detail: `${BUCKET}/${path} is not in storage` }, 409);
      }

      const draft = await insertDraft({
        id,
        status: 'stored',
        kind,
        mode: clip(body?.mode, 40),
        file_name: clip(body?.file_name, 200) || path,
        content_type: cfg.contentType,
        bytes: stat.bytes,                       // server-verified, never client-claimed
        duration_sec: num(body?.duration_sec),
        frames: num(body?.frames),
        caption: clip(body?.caption, 2200),
        source_device: clip(body?.source_device, 40),
        storage_bucket: BUCKET,
        storage_path: path,
      });
      return jsonResponse({ ok: true, id, draft });
    }

    // ── list: recent drafts (the HISTORY tab read) ────────────────────────────────
    if (action === 'list') {
      const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
      const cols = 'id,kind,mode,file_name,content_type,bytes,duration_sec,frames,caption,source_device,created_at';
      const rows = await pgGet(
        `${TABLE}?select=${cols}&status=eq.stored&order=created_at.desc&limit=${limit}`,
      ) as Array<Record<string, unknown>>;
      const drafts = Array.isArray(rows) ? rows : [];
      return jsonResponse({ ok: true, drafts, count: drafts.length });
    }

    // ── download: mint a short-lived signed URL for one draft ────────────────────
    if (action === 'download') {
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const draft = await getDraft(id);
      if (!draft || draft.status !== 'stored') return jsonResponse({ error: 'not_found' }, 404);
      const fileName = String(draft.file_name || draft.storage_path);
      const url = await mintSignedDownload(String(draft.storage_path), fileName);
      return jsonResponse({ ok: true, id, url, file_name: fileName, content_type: draft.content_type, expires_in: DOWNLOAD_TTL_SEC });
    }

    // ── promote: draft → auto-post queue, entirely server-side. Copies the blob
    //    into the distributor bucket, inserts a queued batch row (draft caption
    //    carried over), and optionally fires the distributor now. The device that
    //    rendered the draft is not involved — this is the "render on the phone,
    //    post from the laptop" bridge. ───────────────────────────────────────────
    if (action === 'promote') {
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const draft = await getDraft(id);
      if (!draft || draft.status !== 'stored') return jsonResponse({ error: 'not_found' }, 404);

      const kind: Kind = draft.kind === 'image' ? 'image' : 'video';
      const q = QUEUE_ROUTING[kind];
      const queueId = crypto.randomUUID();
      const destKey = `${queueId}.${q.ext}`;

      await copyObject(BUCKET, String(draft.storage_path), q.bucket, destKey, String(draft.content_type || EXT[kind].contentType));

      await insertRow(q.table, {
        id: queueId,                        // MUST equal the copied object's stem
        status: 'queued',
        platform_target: clip(body?.platform_target, 40) || 'online',
        caption: clip(body?.caption, 2200) ?? (draft.caption ? String(draft.caption) : null),
        headline: clip(body?.headline, 300) ?? (draft.file_name ? String(draft.file_name) : null),
      });

      if (body?.now === true) {
        if (kind === 'video') {
          const bg = distributeNow(q.distributor, queueId)
            .catch((e) => { console.error('[bbf-studio-drafts] bg promote distribute failed:', String((e as Error)?.message ?? e)); });
          try { (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(bg); } catch (_) { /* best effort */ }
          return jsonResponse({ ok: true, id, queue_id: queueId, kind, status: 'posting', async: true });
        }
        const dist = await distributeNow(q.distributor, queueId);
        const summary = (dist.result && dist.result.summary) ? dist.result.summary : null;
        const posted = !!summary && Number(summary.posted) > 0;
        return jsonResponse(
          { ok: dist.ok && posted, ...(dist.ok && posted ? {} : { error: 'distribute_failed' }), id, queue_id: queueId, kind, status: posted ? 'posted' : 'failed', distribute: dist.result },
          dist.ok ? 200 : 502,
        );
      }
      return jsonResponse({ ok: true, id, queue_id: queueId, kind, status: 'queued' });
    }

    // ── delete: remove the blob + the ledger row ─────────────────────────────────
    if (action === 'delete') {
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const draft = await getDraft(id);
      if (!draft) return jsonResponse({ error: 'not_found' }, 404);
      const gone = await deleteObject(String(draft.storage_path));
      if (!gone) return jsonResponse({ error: 'storage_delete_failed' }, 502);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: pgHeaders(),
      });
      if (!res.ok) return jsonResponse({ error: `row_delete_${res.status}` }, 502);
      return jsonResponse({ ok: true, id, deleted: true });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
