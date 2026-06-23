// bbf-reel-distributor — "The Reel Distributor" · video twin of bbf-card-distributor.
// ─────────────────────────────────────────────────────────────────────────────
// Posts queued reels (bbf_reels_batch_v1 → Meta) to:
//   • Instagram — Reels (Graph API: container create with video_url → poll
//     status_code until FINISHED → media_publish)
//   • Facebook — Page video (Graph API /{page-id}/videos with file_url)
//   • TikTok — switch present but DISABLED for now.
//
// Mirrors bbf-card-distributor EXACTLY: the four safety gates, the atomic claim
// (queued→posting), the FLIP RULE, the PostgREST helpers, and the
// status/verify/distribute actions. Only the asset (mp4) + the two posting
// integrations differ.
//
// THE FLIP RULE (CEO directive, non-negotiable):
//   A row flips to status='posted' IFF every targeted, enabled channel returns a
//   confirmed HTTP 200 (IG: media_publish 200; FB: /videos 200 + id). Any non-200
//   → 'failed' (audited). A row whose mp4 isn't in Storage → 'failed' immediately
//   (last_error='asset_not_in_storage') so the cron never loops on the same row.
//
// FOUR SAFETY GATES:
//   1. Admin-only — X-BBF-Admin-Token must equal BBF_COACH_AGENT_TOKEN (else 401).
//   2. Dry-run by default — posts only when the body carries { "live": true }.
//   3. Token-gated — a channel is enabled only if its Vault secrets are present.
//   4. Asset-gated — a reel posts only if its mp4 exists in Storage.
//
// SECRETS — Supabase Vault first (public.bbf_get_vault_secret), env fallback. The
// SAME secrets the cards use (do NOT read bbf_system_config):
//   META_TOKEN · META_IG_USER_ID · META_FB_PAGE_ID · META_GRAPH_VERSION (opt) ·
//   REELS_BUCKET (opt, default 'reels-v1') · REELS_EXT (opt, default 'mp4')
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   BBF_COACH_AGENT_TOKEN (admin gate).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
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

const TABLE = 'bbf_reels_batch_v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── LOCAL HASHTAG BLOCK ─────────────────────────────────────────────────────────
// Appended to every caption at POST time (after the existing caption, separated by
// two newlines) so all already-queued rows pick it up automatically — no row rewrite.
// Tune this ONE line freely; stay under IG's 2,200-char / 30-hashtag caps.
const LOCAL_TAGS =
  '#BuckeyeAZ #GoodyearAZ #AvondaleAZ #SurpriseAZ #MaricopaCounty #WestValleyAZ #PhoenixFitness #ArizonaFitness';

// Compose the final caption: original first, two newlines, then the local tag block.
function withLocalTags(caption: string): string {
  return caption ? `${caption}\n\n${LOCAL_TAGS}` : LOCAL_TAGS;
}

// ─── PostgREST helpers (service-role; bypasses RLS) — house pattern ──────────────
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
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc_${res.status}:${text.slice(0, 200)}`);
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

// ─── Secret resolution: Supabase Vault first, env fallback (cached per-call) ─────
const _secretCache = new Map<string, string | null>();
async function getSecret(name: string): Promise<string> {
  if (_secretCache.has(name)) return _secretCache.get(name) ?? '';
  let val: string | null = null;
  try {
    const r = await pgRpc('bbf_get_vault_secret', { p_name: name });
    if (typeof r === 'string') val = r;
    else if (Array.isArray(r) && r.length) val = r[0];
  } catch (_) { /* RPC absent — fall back to env */ }
  if (!val) val = Deno.env.get(name) ?? null;
  _secretCache.set(name, val);
  return val ?? '';
}

// ─── Channel configuration (derived from which secrets are present) ──────────────
type ChannelKey = 'instagram' | 'facebook' | 'tiktok';

async function resolveConfig() {
  const [metaToken, igUser, fbPage, graphVer, bucket, ext] = await Promise.all([
    getSecret('META_TOKEN'), getSecret('META_IG_USER_ID'), getSecret('META_FB_PAGE_ID'),
    getSecret('META_GRAPH_VERSION'), getSecret('REELS_BUCKET'), getSecret('REELS_EXT'),
  ]);
  return {
    metaToken, igUser, fbPage,
    graph: `https://graph.facebook.com/${graphVer || 'v21.0'}`,
    bucket: bucket || 'reels-v1',
    ext: (ext || 'mp4').replace(/^\./, ''),
    enabled: {
      instagram: Boolean(metaToken && igUser),
      facebook: Boolean(metaToken && fbPage),
      tiktok: false, // DISABLED for now — switch retained, no posting path.
    } as Record<ChannelKey, boolean>,
  };
}
type Config = Awaited<ReturnType<typeof resolveConfig>>;

// Public Storage URL for a reel's mp4 (by id convention) — used as IG video_url + FB file_url.
function assetUrl(cfg: Config, id: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(cfg.bucket)}/${id}.${cfg.ext}`;
}
async function assetExists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch (_) { return false; }
}

// ─── Connection verification (authenticated, read-only — never posts) ────────────
async function verifyChannel(cfg: Config, ch: ChannelKey): Promise<{ active: boolean; status: number; detail?: string }> {
  try {
    if (ch === 'instagram') {
      const r = await fetch(`${cfg.graph}/${cfg.igUser}?fields=username&access_token=${encodeURIComponent(cfg.metaToken)}`);
      return { active: r.ok, status: r.status, detail: r.ok ? undefined : (await r.text()).slice(0, 200) };
    }
    if (ch === 'facebook') {
      const r = await fetch(`${cfg.graph}/${cfg.fbPage}?fields=name&access_token=${encodeURIComponent(cfg.metaToken)}`);
      return { active: r.ok, status: r.status, detail: r.ok ? undefined : (await r.text()).slice(0, 200) };
    }
    return { active: false, status: 0, detail: 'disabled' }; // tiktok
  } catch (e) {
    return { active: false, status: 0, detail: String((e as Error)?.message ?? e) };
  }
}

// ─── Posting integrations — each returns { ok, status, ref?, detail? } ───────────
// A channel "succeeds" ONLY on a confirmed HTTP 200.
type PostResult = { ok: boolean; status: number; ref?: string; detail?: string };

// Poll an IG media container's processing status until FINISHED (lifted from
// bbf-meta-publish). Bounded so a stuck transcode can't hang the function.
async function pollContainer(cfg: Config, containerId: string, maxAttempts = 20, delayMs = 4000): Promise<{ ok: boolean; detail?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const r = await fetch(`${cfg.graph}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(cfg.metaToken)}`);
    const j = await r.json().catch(() => ({}));
    const code = j?.status_code;
    if (code === 'FINISHED') return { ok: true };
    if (code === 'ERROR' || code === 'EXPIRED') return { ok: false, detail: `status_${code}:${JSON.stringify(j).slice(0, 160)}` };
    await sleep(delayMs);
  }
  return { ok: false, detail: `poll_timeout:${containerId}` };
}

// INSTAGRAM Reels via hosted URL: create container (video_url) → poll → publish.
async function postInstagram(cfg: Config, videoUrl: string, caption: string): Promise<PostResult> {
  // 1 — create the REELS container from the public mp4 URL (no resumable upload).
  const create = await fetch(`${cfg.graph}/${cfg.igUser}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: true, access_token: cfg.metaToken }),
  });
  const cj = await create.json().catch(() => ({}));
  if (create.status !== 200 || !cj?.id) {
    return { ok: false, status: create.status, detail: `ig_create:${JSON.stringify(cj).slice(0, 200)}` };
  }
  const containerId = String(cj.id);
  // 2 — poll the container until Meta finishes ingesting/transcoding the video.
  const poll = await pollContainer(cfg, containerId);
  if (!poll.ok) return { ok: false, status: 0, detail: `ig_poll:${poll.detail}` };
  // 3 — publish the finished container.
  const publish = await fetch(`${cfg.graph}/${cfg.igUser}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: cfg.metaToken }),
  });
  const pj = await publish.json().catch(() => ({}));
  if (publish.status !== 200 || !pj?.id) {
    return { ok: false, status: publish.status, detail: `ig_publish:${JSON.stringify(pj).slice(0, 200)}` };
  }
  return { ok: true, status: 200, ref: String(pj.id) };
}

// Facebook Page publishing requires a PAGE access token (a user/system token hits
// "(#200) publish_actions deprecated"). Exchange META_TOKEN → Page token once
// (module-cached), with a fallback to META_TOKEN. Mirrors bbf-card-distributor.
let _fbPageToken: string | null = null;
async function facebookPageToken(cfg: Config): Promise<string> {
  if (_fbPageToken) return _fbPageToken;
  try {
    const r = await fetch(`${cfg.graph}/${cfg.fbPage}?fields=access_token&access_token=${encodeURIComponent(cfg.metaToken)}`);
    const j = await r.json().catch(() => ({}));
    if (r.status === 200 && j?.access_token) {
      _fbPageToken = String(j.access_token);
      return _fbPageToken;
    }
  } catch (_) { /* fall back to the user token below */ }
  return cfg.metaToken;
}

// FACEBOOK Page video via hosted URL: POST /{page-id}/videos with file_url.
async function postFacebook(cfg: Config, videoUrl: string, caption: string): Promise<PostResult> {
  const pageToken = await facebookPageToken(cfg);
  const r = await fetch(`${cfg.graph}/${cfg.fbPage}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: videoUrl, description: caption, access_token: pageToken }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status !== 200 || !(j?.id || j?.post_id)) {
    return { ok: false, status: r.status, detail: `fb:${JSON.stringify(j).slice(0, 200)}` };
  }
  return { ok: true, status: 200, ref: String(j.post_id ?? j.id) };
}

async function postToChannel(cfg: Config, ch: ChannelKey, videoUrl: string, caption: string): Promise<PostResult> {
  if (ch === 'instagram') return postInstagram(cfg, videoUrl, caption);
  if (ch === 'facebook') return postFacebook(cfg, videoUrl, caption);
  return { ok: false, status: 0, detail: 'tiktok_disabled' }; // never reached (not enabled)
}

// Best-effort audit write (no-op if the optional audit columns aren't migrated yet).
async function writeAudit(id: string, patch: Record<string, unknown>): Promise<void> {
  try { await pgPatch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, patch); } catch (_) { /* columns optional */ }
}

// ─── handler ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'backend_unconfigured' }, 503);

  // GATE 1 — admin only.
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try { body = req.headers.get('content-type')?.includes('application/json') ? await req.json() : {}; }
  catch { return jsonResponse({ error: 'bad_json' }, 400); }

  const action = String(body?.action ?? 'status');
  const cfg = await resolveConfig();
  const channelsConfigured = (['instagram', 'facebook', 'tiktok'] as ChannelKey[]).filter((c) => cfg.enabled[c]);

  try {
    // ── status: queue snapshot + which channels are configured (no external calls) ──
    if (action === 'status') {
      const rows = await pgGet(`${TABLE}?select=status`);
      const counts: Record<string, number> = {};
      for (const r of (Array.isArray(rows) ? rows : [])) counts[r.status] = (counts[r.status] || 0) + 1;
      return jsonResponse({
        ok: true,
        action: 'status',
        queue: { queued: counts['queued'] || 0, posted: counts['posted'] || 0, failed: counts['failed'] || 0, by_status: counts },
        channels: { instagram: cfg.enabled.instagram, facebook: cfg.enabled.facebook, tiktok: cfg.enabled.tiktok },
        channels_configured: channelsConfigured,
        bucket: cfg.bucket,
        note: channelsConfigured.length ? undefined : 'No channels configured — inject META_TOKEN / META_IG_USER_ID / META_FB_PAGE_ID into Vault.',
      });
    }

    // ── verify: authenticated test call per configured channel (never posts) ────────
    if (action === 'verify') {
      const results: Record<string, unknown> = {};
      for (const ch of (['instagram', 'facebook', 'tiktok'] as ChannelKey[])) {
        results[ch] = cfg.enabled[ch] ? await verifyChannel(cfg, ch) : { active: false, status: 0, detail: ch === 'tiktok' ? 'disabled' : 'not_configured' };
      }
      const anyActive = Object.values(results).some((r) => (r as { active?: boolean })?.active);
      return jsonResponse({ ok: true, action: 'verify', any_active: anyActive, connections: results });
    }

    // ── distribute: the job. Dry-run unless { live:true }. ──────────────────────────
    if (action === 'distribute') {
      const live = body?.live === true;                 // GATE 2 — must be explicit
      const limit = Math.max(1, Math.min(100, Number(body?.limit) || 25));
      const onlyChannels = Array.isArray(body?.channels)
        ? (body.channels as string[]).filter((c) => channelsConfigured.includes(c as ChannelKey)) as ChannelKey[]
        : channelsConfigured;

      if (!onlyChannels.length) {
        return jsonResponse({ error: 'no_channel_configured', detail: 'inject tokens into Vault before distributing' }, 412);
      }

      // Select queued rows (optionally a specific id set).
      const idFilter = Array.isArray(body?.ids) && body.ids.length
        ? `&id=in.(${(body.ids as string[]).map((x) => `"${x}"`).join(',')})`
        : '';
      const rows = await pgGet(`${TABLE}?select=id,caption,status&status=eq.queued${idFilter}&order=created_at.asc&limit=${limit}`);
      const queued = Array.isArray(rows) ? rows : [];

      const report: any[] = [];
      let posted = 0, failed = 0, skipped = 0, previewed = 0;

      for (const row of queued) {
        const id = String(row.id);
        const caption = String(row.caption ?? '');
        const videoUrl = assetUrl(cfg, id);
        const haveAsset = await assetExists(videoUrl);          // GATE 4

        // ---- DRY RUN: preview only, no posting, no DB writes ----
        if (!live) {
          previewed++;
          report.push({ id, would_post_to: onlyChannels, asset_present: haveAsset, video_url: videoUrl, caption_preview: caption.slice(0, 80), composed_preview: withLocalTags(caption).slice(0, 240) });
          continue;
        }

        // ---- LIVE ----
        if (!haveAsset) {
          // Asset absent — mark failed immediately so the cron is not stuck on
          // this row forever. Rows with a missing mp4 are unresolvable by the
          // distributor; failing them lets the queue advance to the next row.
          await pgPatch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, { status: 'failed', last_error: 'asset_not_in_storage' });
          failed++;
          report.push({ id, result: 'failed_no_asset', video_url: videoUrl });
          continue;
        }

        // Atomic claim: only succeeds if the row is still 'queued' (prevents
        // double-posting under concurrent runs).
        let claimed: any[] = [];
        try { claimed = await pgPatch(`${TABLE}?id=eq.${encodeURIComponent(id)}&status=eq.queued&select=id`, { status: 'posting' }); }
        catch (_) { claimed = []; }
        if (!Array.isArray(claimed) || !claimed.length) { skipped++; report.push({ id, result: 'skipped_already_claimed' }); continue; }

        // Post to every targeted channel; collect per-channel results.
        const channelResults: Record<string, PostResult> = {};
        let allOk = true;
        for (const ch of onlyChannels) {
          try {
            const r = await postToChannel(cfg, ch, videoUrl, (ch === 'instagram' || ch === 'facebook') ? withLocalTags(caption) : caption);
            channelResults[ch] = r;
            if (!r.ok) allOk = false;
          } catch (e) {
            channelResults[ch] = { ok: false, status: 0, detail: String((e as Error)?.message ?? e) };
            allOk = false;
          }
        }

        const refs = Object.fromEntries(Object.entries(channelResults).map(([k, v]) => [k, { status: v.status, ref: v.ref ?? null }]));
        if (allOk) {
          // FLIP RULE — 'posted' only when every channel returned HTTP 200.
          await pgPatch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, { status: 'posted' });
          await writeAudit(id, { posted_at: new Date().toISOString(), post_refs: refs, last_error: null });
          posted++;
          report.push({ id, result: 'posted', channels: channelResults });
        } else {
          // Any non-200 → 'failed' (terminal, audited) so a live post is never
          // silently duplicated on a blind retry.
          await pgPatch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, { status: 'failed' });
          await writeAudit(id, { last_error: JSON.stringify(refs).slice(0, 500), post_refs: refs });
          failed++;
          report.push({ id, result: 'failed', channels: channelResults });
        }
      }

      return jsonResponse({
        ok: true,
        action: 'distribute',
        mode: live ? 'live' : 'dry_run',
        channels: onlyChannels,
        selected: queued.length,
        summary: live ? { posted, failed, skipped } : { previewed },
        report,
      });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
