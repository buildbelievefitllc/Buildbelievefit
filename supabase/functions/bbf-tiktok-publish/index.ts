// bbf-tiktok-publish — TikTok Content Posting API · VIDEO Direct Post.
// ─────────────────────────────────────────────────────────────────────────────
// The video counterpart to bbf-card-distributor (which posts PHOTO calling cards).
// Publishes a single video to the BBF brand account's TikTok via the official
// Content Posting API, holds NO static token (it pulls a fresh access token from
// _shared/tiktok-auth.ts, auto-refreshing), and emits the resulting video_id that
// bbf-signal-tracker already polls into bbf_posting_history.
//
// SOURCE MODES (pick per call):
//   • FILE_UPLOAD   — caller streams a LOCAL file straight to TikTok. Init returns an
//                     upload_url + chunk plan; the caller PUTs the bytes. No Storage
//                     round-trip, no URL-domain verification. (The Calling Card path.)
//   • PULL_FROM_URL — TikTok fetches the video from a URL (the URL's domain must be a
//                     verified property in the TikTok console). For Storage-hosted /
//                     batch pipelines.
//
// SAFETY GATES (mirrors the Distributor so a live post can't happen by accident):
//   1. Admin-only — X-BBF-Admin-Token must equal BBF_COACH_AGENT_TOKEN (else 401).
//   2. Dry-run by default — `init` previews (creator gate + plan) and posts NOTHING
//      unless the body explicitly carries { "live": true }.
//   3. Token-gated — no provisioned OAuth token ⇒ nothing can post.
//   4. Privacy-gated — the requested privacy_level must be in the creator's
//      privacy_level_options (TikTok's creator-info gate). Unaudited apps only get
//      SELF_ONLY (private); we NEVER silently upgrade past what TikTok allows.
//
// ACTIONS (POST JSON, all admin-gated):
//   { action:'status' }                         → readiness snapshot (no external call)
//   { action:'verify' }                         → creator_info query (read-only, never posts)
//   { action:'init', live, source, caption, … } → start a Direct Post (gated)
//   { action:'poll', publish_id }               → fetch publish status (+ final video id)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getValidAccessToken, tokenStatus } from '../_shared/tiktok-auth.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};

const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
const TIKTOK_API_BASE = 'https://open.tiktokapis.com';

// Chunk bounds for FILE_UPLOAD (TikTok: min 5 MB, max 64 MB per chunk; the final
// chunk absorbs the remainder).
const MAX_CHUNK = 64 * 1024 * 1024;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

type TikTokEnvelope = { data?: Record<string, unknown>; error?: { code?: string; message?: string; log_id?: string } };

async function tiktokPost(path: string, accessToken: string, payload: unknown): Promise<{ status: number; env: TikTokEnvelope }> {
  const res = await fetch(`${TIKTOK_API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(payload),
  });
  const env = (await res.json().catch(() => ({}))) as TikTokEnvelope;
  return { status: res.status, env };
}

function envOk(status: number, env: TikTokEnvelope): boolean {
  return status === 200 && (!env.error || env.error.code === 'ok' || !env.error.code);
}

// Build the FILE_UPLOAD chunk plan the caller will PUT against.
function planChunks(videoSize: number): { chunk_size: number; total_chunk_count: number; chunks: { index: number; start: number; end: number }[] } {
  if (videoSize <= MAX_CHUNK) {
    return { chunk_size: videoSize, total_chunk_count: 1, chunks: [{ index: 0, start: 0, end: videoSize - 1 }] };
  }
  const chunk_size = MAX_CHUNK;
  const total_chunk_count = Math.floor(videoSize / chunk_size);
  const chunks: { index: number; start: number; end: number }[] = [];
  for (let i = 0; i < total_chunk_count; i++) {
    const start = i * chunk_size;
    const end = i === total_chunk_count - 1 ? videoSize - 1 : start + chunk_size - 1; // last chunk takes the remainder
    chunks.push({ index: i, start, end });
  }
  return { chunk_size, total_chunk_count, chunks };
}

// Read-only creator gate: allowed privacy options + interaction toggles + limits.
async function queryCreatorInfo(accessToken: string): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; detail?: string }> {
  const { status, env } = await tiktokPost('/v2/post/publish/creator_info/query/', accessToken, {});
  if (!envOk(status, env) || !env.data) {
    return { ok: false, status, detail: `creator_info:${JSON.stringify(env.error ?? env).slice(0, 200)}` };
  }
  return { ok: true, status, data: env.data };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // GATE 1 — admin only.
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try { body = req.headers.get('content-type')?.includes('application/json') ? await req.json() : {}; }
  catch { return jsonResponse({ error: 'bad_json' }, 400); }

  const action = String(body?.action ?? 'status');

  try {
    // ── status: readiness, no external call ───────────────────────────────────────
    if (action === 'status') {
      const tok = await tokenStatus();
      return jsonResponse({
        ok: true, action,
        ready_to_post: Boolean(tok.has_access_token),
        token: tok,
        note: tok.has_access_token ? undefined : 'No TikTok token yet — run bbf-tiktok-oauth { action:"authorize" } and complete the consent flow.',
      });
    }

    // For everything below we need a live access token.
    let accessToken = '';
    try { accessToken = await getValidAccessToken(); }
    catch (e) {
      return jsonResponse({ error: 'token_unavailable', detail: String((e as Error)?.message ?? e), hint: 'Complete bbf-tiktok-oauth authorize flow first.' }, 412);
    }

    // ── verify: authenticated creator-info read (never posts) ─────────────────────
    if (action === 'verify') {
      const info = await queryCreatorInfo(accessToken);
      if (!info.ok) return jsonResponse({ ok: false, action, active: false, status: info.status, detail: info.detail }, 200);
      return jsonResponse({
        ok: true, action, active: true,
        creator: {
          username: info.data?.creator_username ?? null,
          nickname: info.data?.creator_nickname ?? null,
          privacy_level_options: info.data?.privacy_level_options ?? [],
          comment_disabled: info.data?.comment_disabled ?? null,
          duet_disabled: info.data?.duet_disabled ?? null,
          stitch_disabled: info.data?.stitch_disabled ?? null,
          max_video_post_duration_sec: info.data?.max_video_post_duration_sec ?? null,
        },
      });
    }

    // ── init: start a Direct Post. Dry-run unless { live:true }. ──────────────────
    if (action === 'init') {
      const live = body?.live === true;                                  // GATE 2
      const source = String(body?.source ?? 'FILE_UPLOAD').toUpperCase();
      const caption = String(body?.caption ?? '').slice(0, 2200);        // TikTok title cap
      const requestedPrivacy = body?.privacy_level ? String(body.privacy_level) : '';

      if (source !== 'FILE_UPLOAD' && source !== 'PULL_FROM_URL') {
        return jsonResponse({ error: 'bad_source', detail: 'source must be FILE_UPLOAD or PULL_FROM_URL' }, 400);
      }

      // Resolve the creator gate (allowed privacy + limits).
      const info = await queryCreatorInfo(accessToken);
      if (!info.ok) return jsonResponse({ error: 'creator_info_failed', detail: info.detail, status: info.status }, 502);
      const allowed = (Array.isArray(info.data?.privacy_level_options) ? info.data?.privacy_level_options : []) as string[];
      // Default to the safest available option (SELF_ONLY when present — the only one an
      // unaudited app gets). Never upgrade past TikTok's allow-list.
      const privacy_level = requestedPrivacy || (allowed.includes('SELF_ONLY') ? 'SELF_ONLY' : (allowed[0] ?? 'SELF_ONLY'));
      if (allowed.length && !allowed.includes(privacy_level)) {            // GATE 4
        return jsonResponse({
          error: 'privacy_not_allowed',
          detail: `privacy_level '${privacy_level}' is not permitted for this app/creator`,
          allowed_privacy: allowed,
          hint: allowed.includes('SELF_ONLY') ? 'Use SELF_ONLY until the app passes TikTok audit for public Direct Post.' : undefined,
        }, 412);
      }

      const post_info: Record<string, unknown> = {
        title: caption,
        privacy_level,
        disable_comment: body?.disable_comment === true,
        disable_duet: body?.disable_duet === true,
        disable_stitch: body?.disable_stitch === true,
      };
      if (typeof body?.cover_timestamp_ms === 'number') post_info.video_cover_timestamp_ms = body.cover_timestamp_ms;

      // Assemble source_info + a client-facing plan.
      let source_info: Record<string, unknown>;
      let plan: Record<string, unknown> | undefined;
      if (source === 'FILE_UPLOAD') {
        const videoSize = Number(body?.video_size);
        if (!Number.isFinite(videoSize) || videoSize <= 0) {
          return jsonResponse({ error: 'video_size_required', detail: 'FILE_UPLOAD requires a positive integer video_size (bytes)' }, 400);
        }
        const p = planChunks(videoSize);
        source_info = { source: 'FILE_UPLOAD', video_size: videoSize, chunk_size: p.chunk_size, total_chunk_count: p.total_chunk_count };
        plan = { video_size: videoSize, ...p };
      } else {
        const videoUrl = String(body?.video_url ?? '');
        if (!videoUrl) return jsonResponse({ error: 'video_url_required', detail: 'PULL_FROM_URL requires video_url' }, 400);
        source_info = { source: 'PULL_FROM_URL', video_url: videoUrl };
      }

      // ---- DRY RUN: gate + plan only, nothing posted ----
      if (!live) {
        return jsonResponse({
          ok: true, action, mode: 'dry_run', source, privacy_level, allowed_privacy: allowed,
          would_post: { post_info, source_info },
          chunk_plan: plan,
          note: 'Dry run — no upload initiated. Re-send with { "live": true } to start the post.',
        });
      }

      // ---- LIVE: initialize the Direct Post ----
      const { status, env } = await tiktokPost('/v2/post/publish/video/init/', accessToken, { post_info, source_info });
      const publishId = (env.data?.publish_id as string) ?? '';
      if (!envOk(status, env) || !publishId) {
        return jsonResponse({ error: 'init_failed', status, detail: JSON.stringify(env.error ?? env).slice(0, 300) }, 502);
      }
      return jsonResponse({
        ok: true, action, mode: 'live', source, privacy_level,
        publish_id: publishId,
        upload_url: (env.data?.upload_url as string) ?? null,   // FILE_UPLOAD only — caller PUTs bytes here
        chunk_plan: plan,                                       // FILE_UPLOAD only
        next: source === 'FILE_UPLOAD'
          ? 'PUT each chunk to upload_url (Content-Range bytes start-end/total), then poll { action:"poll", publish_id }.'
          : 'Poll { action:"poll", publish_id } until PUBLISH_COMPLETE.',
      });
    }

    // ── poll: publish-status fetch (+ final video id when complete) ───────────────
    if (action === 'poll') {
      const publishId = String(body?.publish_id ?? '');
      if (!publishId) return jsonResponse({ error: 'publish_id_required' }, 400);
      const { status, env } = await tiktokPost('/v2/post/publish/status/fetch/', accessToken, { publish_id: publishId });
      if (!envOk(status, env)) return jsonResponse({ error: 'poll_failed', status, detail: JSON.stringify(env.error ?? env).slice(0, 300) }, 502);
      const s = String(env.data?.status ?? 'UNKNOWN');
      // TikTok's field is (sic) misspelled `publicaly_available_post_id`.
      const postIds = (env.data?.publicaly_available_post_id as string[]) ?? (env.data?.publicly_available_post_id as string[]) ?? [];
      return jsonResponse({
        ok: true, action, publish_id: publishId,
        status: s,
        complete: s === 'PUBLISH_COMPLETE',
        failed: s === 'FAILED',
        video_id: Array.isArray(postIds) && postIds.length ? String(postIds[0]) : null, // feed to bbf-signal-tracker
        fail_reason: env.data?.fail_reason ?? null,
        uploaded_bytes: env.data?.uploaded_bytes ?? null,
      });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
