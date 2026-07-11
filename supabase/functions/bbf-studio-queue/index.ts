// bbf-studio-queue — secure "Queue this post" write-path for Sovereign Studio.
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Studio (the React "Studio V4" panel, frontend/src/components/
// SovereignStudioV4/) runs in the browser and must NEVER hold a service-role or
// admin secret. This function is the trusted bridge between that client-side
// design tool and the Supabase auto-post queue:
//
//   • The browser bakes a post (JPEG card/reel-cover/phone/spotlight, or an MP4
//     reel) entirely client-side, then asks THIS function for a one-shot signed
//     upload URL, uploads the asset directly to Storage, and confirms.
//   • Only the SERVICE ROLE (held here, never shipped) mints the signed URL and
//     writes the queued row. The browser holds nothing but its 24h vault session.
//
// SECURITY MODEL (CLAUDE.md §7 · mirrors bbf-admin-roster):
//   • verify_jwt:false — the admin SESSION token is the security boundary, not
//     the gateway JWT (parity with bbf-admin-roster / bbf-co-coach).
//   • Authorized iff EITHER a valid admin X-BBF-Session-Token (resolves via the
//     canonical _bbf_uid_from_vault_token to a bbf_users row whose role is
//     admin/trainer, or the `akeem` CEO fallback) OR the legacy shared secret
//     X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN (server-to-server only; the
//     browser never sends it). A valid NON-admin session is rejected.
//   • The upload path is server-GENERATED ({uuid}.{ext}) so a caller can never
//     choose a path and clobber an existing card/reel id.
//
// ACTIONS (POST JSON { action, ... }):
//   sign     { kind:'image'|'video' }
//            → { ok, id, kind, bucket, path, ext, contentType, uploadUrl, token }
//   confirm  { id, kind, now?, headline?, body?, eye_label?, cta?, caption?, color_palette? }
//            → HEAD the just-uploaded object exists, then INSERT a status:'queued'
//              row into the matching batch table → { ok, id, table, status }.
//            → If now:true, immediately fire the matching distributor for THIS id
//              (image→bbf-card-distributor, video→bbf-reel-distributor) and return
//              { ok, status:'posted'|'failed', posted_now:true, distribute }
//
// ROUTING (kind → bucket / ext / table) — kept in lockstep with the distributors:
//   image → calling-cards-v1 / jpg / bbf_calling_cards_batch_v1  (bbf-card-distributor)
//   video → reels-v1         / mp4 / bbf_reels_batch_v1          (bbf-reel-distributor)
// A plain queued row (no scheduled_for — that column does not exist) posts on the
// next daily distributor drip, which is the intended behavior.
//
// Secrets (auto-injected): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Optional (kept aligned with the distributors): BBF_COACH_AGENT_TOKEN (admin
// gate), BBF_CARDS_BUCKET/BBF_CARDS_EXT, REELS_BUCKET/REELS_EXT.

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

// kind → storage bucket / extension / batch table. Buckets+exts resolved from the
// SAME env (with the same defaults) the distributors read, so the asset the browser
// uploads lands exactly where the distributor later looks for it.
type Kind = 'image' | 'video';
const ROUTING: Record<Kind, { bucket: string; ext: string; table: string; contentType: string; distributor: string }> = {
  image: {
    bucket: Deno.env.get('BBF_CARDS_BUCKET') || 'calling-cards-v1',
    // JPEG, hardcoded — NOT env-overridable. Instagram's Content Publishing API
    // rejects PNG image posts (400 at container creation); it only accepts JPEG.
    // The studio bakes JPEG (StudioLayout.getStageBlob) and the distributor
    // probes .jpg first, so the whole image path is JPEG end-to-end.
    ext: 'jpg',
    table: 'bbf_calling_cards_batch_v1',
    contentType: 'image/jpeg',
    distributor: 'bbf-card-distributor',
  },
  video: {
    bucket: Deno.env.get('REELS_BUCKET') || 'reels-v1',
    ext: (Deno.env.get('REELS_EXT') || 'mp4').replace(/^\./, ''),
    table: 'bbf_reels_batch_v1',
    contentType: 'video/mp4',
    distributor: 'bbf-reel-distributor',
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function normKind(v: unknown): Kind { return v === 'video' ? 'video' : 'image'; }
// Trim → cap length → null when empty (so blank optional fields stay NULL, not '').
function clip(v: unknown, max: number): string | null {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
}

function pgHeaders(): HeadersInit {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' };
}

// ─── Admin authorization (ported from bbf-admin-roster) ──────────────────────────
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

// Resolve user_id from a vault session token (canonical SECURITY DEFINER resolver,
// with a service-role fallback if it isn't PostgREST-exposed). Mirrors admin-roster.
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
  // 1) Legacy shared-secret path — server-to-server only (browser never sends it).
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return true;

  // 2) Admin-session path — the boundary for the public Studio browser.
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
    // A LOCKED account must never reach the write path (this function posts to
    // the public internet) — parity with bbf-sovereign-studio's read-side gate,
    // which was previously STRICTER than this posting path.
    if (String(u.access_status ?? '').toLowerCase() === 'locked') return false;
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    return role === 'admin' || role === 'trainer' || uname === 'akeem';
  } catch (_) { return false; }
}

// ─── Storage helpers (service role) ──────────────────────────────────────────────
// Mint a one-shot signed upload URL for bucket/{path}. Returns an absolute URL the
// browser PUTs the baked asset to (no service role needed client-side; the signed
// token authorizes that single object write only).
async function mintSignedUpload(bucket: string, path: string): Promise<{ uploadUrl: string; token: string }> {
  // Auth-only headers (NO Content-Type) — the storage create-signed-upload route
  // is a bodyless POST and rejects an empty application/json body (Fastify 400).
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}`, {
    method: 'POST', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!r.ok) throw new Error(`sign_${r.status}:${(await r.text()).slice(0, 200)}`);
  const j = await r.json().catch(() => null) as { url?: string } | null;
  const raw = String(j?.url ?? '');
  if (!raw) throw new Error('sign_no_url');
  const uploadUrl = /^https?:\/\//.test(raw)
    ? raw
    : raw.startsWith('/storage/v1')
      ? `${SUPABASE_URL}${raw}`
      : `${SUPABASE_URL}/storage/v1${raw.startsWith('/') ? raw : '/' + raw}`;
  let token = '';
  try { token = new URL(uploadUrl).searchParams.get('token') ?? ''; } catch (_) { /* token optional in response */ }
  return { uploadUrl, token };
}

// Existence gate — HEAD the public object (identical to the distributors' assetExists).
async function assetExists(bucket: string, path: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`, { method: 'HEAD' });
    return r.ok;
  } catch (_) { return false; }
}

// Guarded row mutations (PATCH/DELETE with a status filter + return=representation
// so the caller can tell "matched nothing" apart from "succeeded").
async function pgPatchRows(path: string, patch: Record<string, unknown>): Promise<unknown[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...pgHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch_${res.status}:${(await res.text()).slice(0, 200)}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j) ? j : [];
}
async function pgDeleteRows(path: string): Promise<unknown[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { ...pgHeaders(), Prefer: 'return=representation' },
  });
  if (!res.ok) throw new Error(`delete_${res.status}:${(await res.text()).slice(0, 200)}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j) ? j : [];
}

async function insertQueuedRow(table: string, row: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...pgHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify([row]),
  });
  if (!res.ok) throw new Error(`insert_${res.status}:${(await res.text()).slice(0, 240)}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j) && j.length ? j[0] : null;
}

// Post NOW: fire the matching distributor for this single id (server-to-server). The
// distributor's gate is X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN, which we hold in
// env — so the public Studio browser never needs it. Returns the distributor JSON.
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
      const cfg = ROUTING[kind];
      const id = crypto.randomUUID();
      const path = `${id}.${cfg.ext}`;
      const { uploadUrl, token } = await mintSignedUpload(cfg.bucket, path);
      return jsonResponse({
        ok: true, id, kind, bucket: cfg.bucket, path, ext: cfg.ext,
        contentType: cfg.contentType, uploadUrl, token,
      });
    }

    // ── confirm: verify the asset landed, then queue the row (service role) ──────
    if (action === 'confirm') {
      const kind = normKind(body?.kind);
      const cfg = ROUTING[kind];
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const path = `${id}.${cfg.ext}`;

      if (!(await assetExists(cfg.bucket, path))) {
        return jsonResponse({ error: 'asset_not_found', detail: `${cfg.bucket}/${path} is not in storage` }, 409);
      }

      const row: Record<string, unknown> = {
        id,                                   // MUST equal the uploaded object stem
        status: 'queued',                     // posts on the next daily drip
        platform_target: clip(body?.platform_target, 40) || 'online', // from the V4 IG/FB toggle (distributor still routes by enabled channels)
        headline: clip(body?.headline, 300),
        body: clip(body?.body, 2000),
        eye_label: clip(body?.eye_label, 200),
        cta: clip(body?.cta, 200),
        caption: clip(body?.caption, 2200),
        color_palette: clip(body?.color_palette, 40),
      };
      const inserted = await insertQueuedRow(cfg.table, row);

      // POST NOW (optional): immediately distribute this one row via the matching
      // distributor. The row was written 'queued' first, so the distributor's atomic
      // claim (queued→posting→posted/failed) and flip rule apply unchanged. A reel
      // blocks here on Meta's transcode (~60–90s) before reporting back.
      if (body?.now === true) {
        // VIDEO reels block on Meta's transcode (~60–90s). Awaiting that inside the
        // request makes the browser/gateway time out and surface a FALSE error even
        // when the reel posts. So fire the distributor in the BACKGROUND (survives the
        // response via waitUntil) and return immediately as 'posting'; the browser
        // polls action:'poststatus' for the verdict.
        if (kind === 'video') {
          const bg = distributeNow(cfg.distributor, id)
            .catch((e) => { console.error('[bbf-studio-queue] bg distribute failed:', String((e as Error)?.message ?? e)); });
          try { (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(bg); } catch (_) { /* best effort */ }
          return jsonResponse({ ok: true, id, kind, table: cfg.table, status: 'posting', posted_now: true, async: true, row: inserted });
        }
        // IMAGE cards post fast — keep the synchronous verdict.
        const dist = await distributeNow(cfg.distributor, id);
        const summary = (dist.result && dist.result.summary) ? dist.result.summary : null;
        const posted = !!summary && Number(summary.posted) > 0;
        const failed = !!summary && Number(summary.failed) > 0;
        return jsonResponse({
          ok: dist.ok && posted,
          id, kind, table: cfg.table,
          status: posted ? 'posted' : (failed ? 'failed' : 'queued'),
          posted_now: true,
          distribute: dist.result,
          row: inserted,
        }, dist.ok ? 200 : 502);
      }

      return jsonResponse({ ok: true, id, kind, table: cfg.table, status: 'queued', row: inserted });
    }

    // ── poststatus: lightweight read of a row's distribution verdict (for the
    //    browser to poll a backgrounded POST NOW reel until posted/failed) ─────────
    if (action === 'poststatus') {
      const kind = normKind(body?.kind);
      const cfg = ROUTING[kind];
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const rows = await pgGet(`${cfg.table}?select=status,last_error,post_refs&id=eq.${encodeURIComponent(id)}&limit=1`) as Array<Record<string, unknown>>;
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
      return jsonResponse({ ok: true, id, kind, status: row.status ?? null, last_error: row.last_error ?? null, post_refs: row.post_refs ?? null });
    }

    // ── retry: flip a FAILED row back to queued; now:true re-fires the distributor
    //    immediately. Safe against double-posting: the distributors replay the row's
    //    post_refs idempotently, so a channel that already returned a confirmed 200
    //    is never re-posted — only the missing channel(s) fire.
    if (action === 'retry') {
      const kind = normKind(body?.kind);
      const cfg = ROUTING[kind];
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const flipped = await pgPatchRows(
        `${cfg.table}?id=eq.${encodeURIComponent(id)}&status=eq.failed&select=id`,
        { status: 'queued', last_error: null },
      );
      if (!flipped.length) return jsonResponse({ error: 'not_retryable', detail: 'row is not in failed state' }, 409);
      if (body?.now === true) {
        // Same async split as confirm: reels block on Meta's transcode, so fire in
        // the background and let the browser poll poststatus; cards verdict sync.
        if (kind === 'video') {
          const bg = distributeNow(cfg.distributor, id)
            .catch((e) => { console.error('[bbf-studio-queue] bg retry distribute failed:', String((e as Error)?.message ?? e)); });
          try { (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(bg); } catch (_) { /* best effort */ }
          return jsonResponse({ ok: true, id, kind, status: 'posting', async: true });
        }
        const dist = await distributeNow(cfg.distributor, id);
        const summary = (dist.result && dist.result.summary) ? dist.result.summary : null;
        const posted = !!summary && Number(summary.posted) > 0;
        return jsonResponse(
          { ok: dist.ok && posted, ...(dist.ok && posted ? {} : { error: 'distribute_failed' }), id, kind, status: posted ? 'posted' : 'failed', distribute: dist.result },
          dist.ok ? 200 : 502,
        );
      }
      return jsonResponse({ ok: true, id, kind, status: 'queued' });
    }

    // ── cancel: remove a still-QUEUED row (and its uploaded asset) before the drip
    //    picks it up. Rows already posting/posted are past the point of recall.
    if (action === 'cancel') {
      const kind = normKind(body?.kind);
      const cfg = ROUTING[kind];
      const id = String(body?.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ error: 'bad_id' }, 400);
      const gone = await pgDeleteRows(`${cfg.table}?id=eq.${encodeURIComponent(id)}&status=eq.queued&select=id`);
      if (!gone.length) return jsonResponse({ error: 'not_cancellable', detail: 'row is not queued (already posting/posted, or missing)' }, 409);
      // Best-effort asset cleanup — a leftover public object is harmless but tidy to drop.
      try {
        await fetch(`${SUPABASE_URL}/storage/v1/object/${cfg.bucket}/${id}.${cfg.ext}`, {
          method: 'DELETE', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
        });
      } catch (_) { /* best effort */ }
      return jsonResponse({ ok: true, id, kind, cancelled: true });
    }

    // ── list: recent jobs across both batch tables (queue monitor read) ──────────
    if (action === 'list') {
      const limit = Math.min(Math.max(Number(body?.limit) || 25, 1), 100);
      const cols = 'id,status,headline,caption,platform_target,created_at,posted_at,last_error,attempts';
      const pull = async (kind: Kind) => {
        const cfg = ROUTING[kind];
        const rows = await pgGet(`${cfg.table}?select=${cols}&order=created_at.desc&limit=${limit}`) as Array<Record<string, unknown>>;
        return (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, kind }));
      };
      const [images, videos] = await Promise.all([pull('image'), pull('video')]);
      const jobs = [...images, ...videos]
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
        .slice(0, limit);
      const counts: Record<string, number> = {};
      for (const j of jobs) counts[String(j.status ?? 'unknown')] = (counts[String(j.status ?? 'unknown')] || 0) + 1;
      return jsonResponse({ ok: true, jobs, counts });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
