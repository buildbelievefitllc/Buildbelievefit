// bbf-card-distributor — "The Distributor" · social distribution of the BBF
// calling-card batch (bbf_calling_cards_batch_v1 → Meta + TikTok).
// ─────────────────────────────────────────────────────────────────────────────
// SCAFFOLD STATUS: integration logic complete; awaiting LIVE API tokens (injected
// by the CEO into Supabase Vault). This function never posts on its own — see the
// four hard gates below.
//
// WHAT IT DOES
//   Pulls queued calling cards, resolves each card's rendered image from Storage
//   (the `calling-cards-v1` bucket Drone Bravo is producing), and pushes
//   {image + caption} to the social endpoints:
//     • Meta — Instagram (IG Graph API, 2-step create→publish)
//     • Meta — Facebook Page (Graph API /photos)
//     • TikTok — Content Posting API (Direct Post, PULL_FROM_URL photo)
//
// THE FLIP RULE (CEO directive, non-negotiable):
//   A row is flipped to status='posted' IFF every targeted, enabled channel
//   returns a confirmed HTTP 200. Any non-200 → the row is marked 'failed' (with
//   an audit trail) and is NOT flipped to 'posted'. A row whose image asset is not
//   yet in Storage is released back to 'queued' (Bravo may still be rendering it).
//
// FOUR SAFETY GATES (so a live blast can never happen by accident):
//   1. Admin-only — X-BBF-Admin-Token must equal BBF_COACH_AGENT_TOKEN (else 401).
//   2. Dry-run by default — a 'distribute' call previews only; it posts and mutates
//      ONLY when the body explicitly carries { "live": true }.
//   3. Token-gated — a channel is "enabled" only if its Vault secrets are present;
//      with no tokens, nothing is enabled and nothing can post.
//   4. Asset-gated — a card is posted only if its rendered image exists in Storage.
//
// SECRETS — pulled from Supabase Vault first (public.bbf_get_vault_secret, a
// service_role-only SECURITY DEFINER reader; see the companion migration), with a
// Deno.env fallback so either injection path works:
//   META_TOKEN          — Meta Graph API access token (IG + FB)
//   META_IG_USER_ID     — Instagram Business user id (enables the IG channel)
//   META_FB_PAGE_ID     — Facebook Page id (enables the FB channel)
//   TIKTOK_TOKEN        — TikTok Content Posting API access token (enables TikTok)
//   META_GRAPH_VERSION  — optional, defaults to v21.0
//   BBF_CARDS_BUCKET    — optional, defaults to 'calling-cards-v1'
//   BBF_CARDS_EXT       — optional, defaults to 'png'
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

const TABLE = 'bbf_calling_cards_batch_v1';

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
  } catch (_) { /* RPC absent / not yet migrated — fall back to env */ }
  if (!val) val = Deno.env.get(name) ?? null;
  _secretCache.set(name, val);
  return val ?? '';
}

// ─── Channel configuration (derived from which secrets are present) ──────────────
type ChannelKey = 'instagram' | 'facebook' | 'tiktok';

async function resolveConfig() {
  const [metaToken, igUser, fbPage, tiktokToken, graphVer, bucket, ext] = await Promise.all([
    getSecret('META_TOKEN'), getSecret('META_IG_USER_ID'), getSecret('META_FB_PAGE_ID'),
    getSecret('TIKTOK_TOKEN'), getSecret('META_GRAPH_VERSION'), getSecret('BBF_CARDS_BUCKET'),
    getSecret('BBF_CARDS_EXT'),
  ]);
  return {
    metaToken, igUser, fbPage, tiktokToken,
    graph: `https://graph.facebook.com/${graphVer || 'v21.0'}`,
    bucket: bucket || 'calling-cards-v1',
    // Preferred extension (JPEG for the studio/IG path). resolveAssetUrl still
    // falls back to legacy .png for the resvg batch renderer's cards.
    ext: (ext || 'jpg').replace(/^\./, ''),
    enabled: {
      instagram: Boolean(metaToken && igUser),
      facebook: Boolean(metaToken && fbPage),
      tiktok: Boolean(tiktokToken),
    } as Record<ChannelKey, boolean>,
  };
}
type Config = Awaited<ReturnType<typeof resolveConfig>>;

// Public Storage URL for a card's rendered image (by id convention).
function assetUrl(cfg: Config, id: string, ext: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(cfg.bucket)}/${id}.${ext}`;
}
async function headOk(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch (_) { return false; }
}
// Resolve the real asset URL by probing candidate extensions in preference order:
// JPEG first (the studio pipeline + what Instagram requires), then any legacy PNG
// (the resvg batch renderer at tools/calling-cards still emits .png). Returns the
// existing URL or null. This lets JPEG (studio) and PNG (batch) cards coexist in the
// same bucket/table without a global-extension flip breaking the other producer.
async function resolveAssetUrl(cfg: Config, id: string): Promise<string | null> {
  const cands = [...new Set([cfg.ext, 'jpg', 'jpeg', 'png'])];
  for (const ext of cands) {
    const url = assetUrl(cfg, id, ext);
    if (await headOk(url)) return url;
  }
  return null;
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
    // tiktok
    const r = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', {
      headers: { Authorization: `Bearer ${cfg.tiktokToken}` },
    });
    return { active: r.ok, status: r.status, detail: r.ok ? undefined : (await r.text()).slice(0, 200) };
  } catch (e) {
    return { active: false, status: 0, detail: String((e as Error)?.message ?? e) };
  }
}

// ─── Posting integrations — each returns { ok, status, ref?, detail? } ───────────
// A channel "succeeds" ONLY on a confirmed HTTP 200.
type PostResult = { ok: boolean; status: number; ref?: string; detail?: string };

async function postInstagram(cfg: Config, imageUrl: string, caption: string): Promise<PostResult> {
  // Step 1 — create media container.
  const create = await fetch(`${cfg.graph}/${cfg.igUser}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: cfg.metaToken }),
  });
  const cj = await create.json().catch(() => ({}));
  if (create.status !== 200 || !cj?.id) {
    return { ok: false, status: create.status, detail: `ig_create:${JSON.stringify(cj).slice(0, 200)}` };
  }
  const containerId = String(cj.id);

  // Step 1b — POLL until the container finishes processing. Publishing a container
  // before IG has finished ingesting the image is the #1 cause of intermittent
  // publish 400s ("Media ID is not available"). Up to ~20s (10 × 2s); normally 1-2.
  let ready = false;
  for (let i = 0; i < 10; i += 1) {
    const s = await fetch(`${cfg.graph}/${containerId}?fields=status_code&access_token=${encodeURIComponent(cfg.metaToken)}`);
    const sj = await s.json().catch(() => ({}));
    const code = sj?.status_code;
    if (code === 'FINISHED') { ready = true; break; }
    if (code === 'ERROR' || code === 'EXPIRED') {
      return { ok: false, status: 400, detail: `ig_container_${String(code).toLowerCase()}:${JSON.stringify(sj).slice(0, 160)}` };
    }
    await new Promise((r) => setTimeout(r, 2000)); // IN_PROGRESS — wait and re-poll
  }
  if (!ready) return { ok: false, status: 408, detail: `ig_container_not_ready:${containerId}` };

  // Step 2 — publish the (now-FINISHED) container.
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

// Facebook Page publishing requires a PAGE access token. A USER/system token —
// even with pages_manage_posts granted — returns "(#200) publish_actions ...
// deprecated" on POST /{page}/photos. Exchange META_TOKEN → Page token once
// (module-cached), falling back to META_TOKEN so a token that can already post
// directly (e.g. a properly-scoped system-user token) keeps working unchanged.
// Instagram is unaffected — it still publishes with META_TOKEN directly.
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

async function postFacebook(cfg: Config, imageUrl: string, caption: string): Promise<PostResult> {
  const pageToken = await facebookPageToken(cfg);
  const r = await fetch(`${cfg.graph}/${cfg.fbPage}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: imageUrl, caption, access_token: pageToken }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status !== 200 || !(j?.id || j?.post_id)) {
    return { ok: false, status: r.status, detail: `fb:${JSON.stringify(j).slice(0, 200)}` };
  }
  return { ok: true, status: 200, ref: String(j.post_id ?? j.id) };
}

async function postTikTok(cfg: Config, imageUrl: string, caption: string): Promise<PostResult> {
  // Content Posting API — Direct Post, photo via PULL_FROM_URL. The init call
  // returns 200 + publish_id on acceptance (publishing then completes async; a
  // status poll can be layered on later — see README "Enhancements").
  const r = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.tiktokToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: { title: caption.slice(0, 90), description: caption, privacy_level: 'PUBLIC_TO_EVERYONE' },
      source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: [imageUrl] },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    }),
  });
  const j = await r.json().catch(() => ({}));
  const publishId = j?.data?.publish_id;
  const errCode = j?.error?.code;
  if (r.status !== 200 || !publishId || (errCode && errCode !== 'ok')) {
    return { ok: false, status: r.status, detail: `tiktok:${JSON.stringify(j).slice(0, 200)}` };
  }
  return { ok: true, status: 200, ref: String(publishId) };
}

async function postToChannel(cfg: Config, ch: ChannelKey, imageUrl: string, caption: string): Promise<PostResult> {
  if (ch === 'instagram') return postInstagram(cfg, imageUrl, caption);
  if (ch === 'facebook') return postFacebook(cfg, imageUrl, caption);
  return postTikTok(cfg, imageUrl, caption);
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
        note: channelsConfigured.length ? undefined : 'No channels configured — inject META_TOKEN / META_IG_USER_ID / META_FB_PAGE_ID / TIKTOK_TOKEN into Vault.',
      });
    }

    // ── verify: authenticated test call per configured channel (never posts) ────────
    if (action === 'verify') {
      const results: Record<string, unknown> = {};
      for (const ch of (['instagram', 'facebook', 'tiktok'] as ChannelKey[])) {
        results[ch] = cfg.enabled[ch] ? await verifyChannel(cfg, ch) : { active: false, status: 0, detail: 'not_configured' };
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
      const rows = await pgGet(`${TABLE}?select=id,caption,headline,platform_target,status,post_refs&status=eq.queued${idFilter}&order=created_at.asc&limit=${limit}`);
      const queued = Array.isArray(rows) ? rows : [];

      const report: any[] = [];
      let posted = 0, failed = 0, skipped = 0, previewed = 0;

      for (const row of queued) {
        const id = String(row.id);
        const caption = String(row.caption ?? '');
        const imageUrl = await resolveAssetUrl(cfg, id);        // GATE 4 (probes .jpg → .png)
        const haveAsset = !!imageUrl;

        // ---- DRY RUN: preview only, no posting, no DB writes ----
        if (!live) {
          previewed++;
          report.push({ id, would_post_to: onlyChannels, asset_present: haveAsset, image_url: imageUrl, caption_preview: caption.slice(0, 80), composed_preview: withLocalTags(caption).slice(0, 240) });
          continue;
        }

        // ---- LIVE ----
        if (!imageUrl) {
          // Asset not rendered yet — leave queued, do not consume the row.
          skipped++;
          report.push({ id, result: 'skipped_no_asset' });
          await writeAudit(id, { last_error: 'asset_not_in_storage' });
          continue;
        }

        // Atomic claim: only succeeds if the row is still 'queued' (prevents
        // double-posting under concurrent runs).
        let claimed: any[] = [];
        try { claimed = await pgPatch(`${TABLE}?id=eq.${encodeURIComponent(id)}&status=eq.queued&select=id`, { status: 'posting' }); }
        catch (_) { claimed = []; }
        if (!Array.isArray(claimed) || !claimed.length) { skipped++; report.push({ id, result: 'skipped_already_claimed' }); continue; }

        // Prior per-channel successes (from an earlier partial run). A channel that
        // already returned a confirmed 200 + ref is NEVER re-posted — this makes a
        // 'failed' row (e.g. FB posted but IG errored) safely retryable: only the
        // missing channel(s) fire, so Facebook is never double-posted. Closes the
        // partial-post "leak" where one channel's transient error stranded the row.
        const prior: Record<string, { status?: number; ref?: string | null }> =
          (row.post_refs && typeof row.post_refs === 'object') ? row.post_refs : {};

        // Post to every targeted channel; collect per-channel results.
        const channelResults: Record<string, PostResult> = {};
        let allOk = true;
        for (const ch of onlyChannels) {
          const had = prior[ch];
          if (had && had.status === 200 && had.ref) {
            channelResults[ch] = { ok: true, status: 200, ref: String(had.ref), detail: 'already_posted' };
            continue; // idempotent skip — already live on this channel
          }
          try {
            const r = await postToChannel(cfg, ch, imageUrl, (ch === 'instagram' || ch === 'facebook') ? withLocalTags(caption) : caption);
            channelResults[ch] = r;
            if (!r.ok) allOk = false;
          } catch (e) {
            channelResults[ch] = { ok: false, status: 0, detail: String((e as Error)?.message ?? e) };
            allOk = false;
          }
        }

        // Merge prior refs with this run's results so the audit trail stays cumulative.
        // Persist each channel's `detail` too — for a failure that's the API's actual
        // error string (e.g. IG's `ig_create:...`), which makes a 'failed' row
        // self-diagnosing instead of surfacing only a bare HTTP status code.
        const refs = { ...prior, ...Object.fromEntries(Object.entries(channelResults).map(([k, v]) => [k, { status: v.status, ref: v.ref ?? null, ...(v.ok ? {} : { detail: v.detail ?? null }) }])) };
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
