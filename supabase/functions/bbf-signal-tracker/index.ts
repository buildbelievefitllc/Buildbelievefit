// bbf-signal-tracker — Social Signal Tracking Loop (Premium Vault telemetry).
// ─────────────────────────────────────────────────────────────────────────────
// Polls the Meta Graph API and the TikTok API for the performance metrics of
// posted assets — impressions, click-throughs, DM opens — and appends one
// snapshot row per asset to public.bbf_posting_history (service role). The
// Generator reads that history to analyze what is working.
//
// MAKES NO LLM CALL — this is a pure ETL poller, so it intentionally sits
// outside the Claude _shared/model-router (CLAUDE.md §4). It follows the §5
// edge-function conventions: CORS + jsonResponse, OPTIONS preflight, an
// X-BBF-Admin-Token shared-secret gate, and service-role PostgREST writes.
//
// ┌─ DEFENSIVE / INERT-UNTIL-PROVISIONED ──────────────────────────────────────┐
// │ The function is safe to deploy and schedule BEFORE any social credentials  │
// │ exist. For each platform whose token is unset it logs "Awaiting            │
// │ Credentials", polls nothing, and writes nothing. It NEVER fabricates a     │
// │ metric: a value the platform does not report is stored as NULL, not 0.     │
// └────────────────────────────────────────────────────────────────────────────┘
//
// Request:  POST /functions/v1/bbf-signal-tracker
//           X-BBF-Admin-Token: <BBF_COACH_AGENT_TOKEN>   (required)
//           Body (optional): { "assets": [ { "asset_id": "<platform media id>",
//                              "platform": "meta"|"tiktok", "media_id"?: "...",
//                              "posted_at"?: "<iso8601>" } ] }
//           With no body, the tracker re-polls the distinct assets already in
//           bbf_posting_history (a scheduled refresh). Until a posting pipeline
//           feeds the table, an empty table simply yields status "no_assets".
//
// Success:  200 { ok:true, status, platforms:{meta,tiktok}, polled, written,
//                 awaiting, errors }
// Errors:   non-2xx { error:"<slug>", detail?:"..." }
//
// Secrets:  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (auto-injected by runtime)
//           BBF_COACH_AGENT_TOKEN                      (admin invoke gate)
//           META_GRAPH_ACCESS_TOKEN                    (enables Meta polling)
//           META_GRAPH_VERSION   (optional, default "v21.0")
//           META_INSIGHT_METRICS (optional, default "impressions" — comma list)
//           TIKTOK_ACCESS_TOKEN                        (enables TikTok polling)
//           TIKTOK_API_BASE      (optional, default "https://open.tiktokapis.com")

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

const TABLE = 'bbf_posting_history';
const VALID_PLATFORMS = ['meta', 'tiktok'];

// A metric value we are confident about, or null when the platform did not
// report it. `undefined` is normalized to null on the way into the row so the
// column is an honest NULL rather than a missing/defaulted number.
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ─── Meta Graph API — Instagram/Facebook media insights ────────────────────────
// GET /{version}/{media_id}/insights?metric=<set>&access_token=...
// Returns { data: [ { name, values:[{ value }] }, ... ] }. We map the requested
// metric names onto our three columns by candidate name, null-filling anything
// the asset/account does not expose. click_throughs / dm_opens are only present
// for asset types + metric sets that support them (e.g. CTA/messaging insights);
// expand META_INSIGHT_METRICS once the posting pipeline declares the asset type.
async function pollMeta(asset: any, token: string, version: string, metrics: string) {
  const mediaId = String(asset.media_id || asset.asset_id);
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}/insights` +
    `?metric=${encodeURIComponent(metrics)}&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 300) };

  let body: any = null;
  try { body = JSON.parse(text); } catch (_) { return { ok: false, status: 502, error: 'meta envelope not JSON' }; }

  const data: any[] = Array.isArray(body?.data) ? body.data : [];
  const byName = (names: string[]) => {
    for (const n of names) {
      const row = data.find((d) => d?.name === n);
      const val = row?.values?.[0]?.value;
      if (typeof val === 'number') return val;
    }
    return null;
  };

  return {
    ok: true,
    metrics: {
      impressions:    byName(['impressions']),
      click_throughs: byName(['website_clicks', 'link_clicks', 'inline_link_clicks', 'clicks']),
      dm_opens:       byName(['messaging_conversation_started_7d', 'total_messaging_connections', 'dm_opens']),
    },
  };
}

// ─── TikTok API — organic video metrics (Display API video.query) ──────────────
// POST {base}/v2/video/query/?fields=id,view_count,... with { filters:{ video_ids } }.
// view_count is the organic impressions equivalent. Click-throughs and DM opens
// are not exposed by the organic Display API (they live in the Business/Marketing
// analytics API behind an advertiser id) — stored NULL here until that is wired.
async function pollTikTok(asset: any, token: string, base: string) {
  const videoId = String(asset.media_id || asset.asset_id);
  const url = `${base.replace(/\/$/, '')}/v2/video/query/?fields=${encodeURIComponent('id,view_count,like_count,comment_count,share_count')}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters: { video_ids: [videoId] } }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 300) };

  let body: any = null;
  try { body = JSON.parse(text); } catch (_) { return { ok: false, status: 502, error: 'tiktok envelope not JSON' }; }

  const video = body?.data?.videos?.find((v: any) => String(v?.id) === videoId) || body?.data?.videos?.[0] || null;
  if (!video) return { ok: false, status: 404, error: 'tiktok video not found in response' };

  return {
    ok: true,
    metrics: {
      impressions:    typeof video.view_count === 'number' ? video.view_count : null,
      click_throughs: null, // not in organic Display API
      dm_opens:       null, // not in organic Display API
    },
  };
}

// ─── Service-role PostgREST access (bypasses RLS) ──────────────────────────────
async function dbDistinctAssets(url: string, key: string): Promise<any[]> {
  const q = `${url}/rest/v1/${TABLE}?select=asset_id,platform,posted_at&order=fetched_at.desc&limit=500`;
  try {
    const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    // de-dupe by asset_id+platform, keeping the most recent posted_at seen.
    const seen = new Map<string, any>();
    for (const r of rows) {
      const k = `${r.platform}:${r.asset_id}`;
      if (!seen.has(k)) seen.set(k, r);
    }
    return [...seen.values()];
  } catch (_) {
    return [];
  }
}

async function dbInsertRows(url: string, key: string, rows: unknown[]): Promise<boolean> {
  if (!rows.length) return true;
  try {
    const res = await fetch(`${url}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  // Admin invoke gate — this poller is cron/admin-only, never client-facing.
  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (!expectedToken) {
    console.error('[bbf-signal-tracker] BBF_COACH_AGENT_TOKEN not configured — refusing to run.');
    return jsonResponse({ error: 'config_missing_admin_token' }, 503);
  }
  if ((req.headers.get('x-bbf-admin-token') || '') !== expectedToken) {
    return jsonResponse({ error: 'unauthorized', detail: 'valid X-BBF-Admin-Token required.' }, 401);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[bbf-signal-tracker] missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    return jsonResponse({ error: 'config_missing_supabase' }, 503);
  }

  // Platform credentials → readiness.
  const META_TOKEN   = Deno.env.get('META_GRAPH_ACCESS_TOKEN');
  const META_VERSION = Deno.env.get('META_GRAPH_VERSION') || 'v21.0';
  const META_METRICS = Deno.env.get('META_INSIGHT_METRICS') || 'impressions';
  const TIKTOK_TOKEN = Deno.env.get('TIKTOK_ACCESS_TOKEN');
  const TIKTOK_BASE  = Deno.env.get('TIKTOK_API_BASE') || 'https://open.tiktokapis.com';

  const ready = {
    meta:   !!META_TOKEN,
    tiktok: !!TIKTOK_TOKEN,
  };
  const platformStatus = {
    meta:   ready.meta   ? 'ready' : 'awaiting_credentials',
    tiktok: ready.tiktok ? 'ready' : 'awaiting_credentials',
  };

  // Inert short-circuit: neither platform provisioned → log + no-op (no writes).
  if (!ready.meta && !ready.tiktok) {
    console.log('[bbf-signal-tracker] Awaiting Credentials — META and TIKTOK. No polling performed, no rows written.');
    return jsonResponse({
      ok: true,
      status: 'awaiting_credentials',
      platforms: platformStatus,
      polled: 0,
      written: 0,
      awaiting: 0,
      errors: 0,
      note: 'Provision META_GRAPH_ACCESS_TOKEN and/or TIKTOK_ACCESS_TOKEN to activate the loop.',
    });
  }
  if (!ready.meta)   console.log('[bbf-signal-tracker] Awaiting Credentials — META (Meta polling skipped).');
  if (!ready.tiktok) console.log('[bbf-signal-tracker] Awaiting Credentials — TIKTOK (TikTok polling skipped).');

  // Resolve the asset worklist: explicit body, else refresh known table assets.
  let payload: any = {};
  try { payload = await req.json(); } catch (_) { payload = {}; }
  let assets: any[] = Array.isArray(payload?.assets) ? payload.assets : [];
  if (!assets.length) assets = await dbDistinctAssets(SUPABASE_URL, SERVICE_KEY);

  // Validate + keep only well-formed, known-platform assets.
  assets = assets.filter((a) => a && a.asset_id && VALID_PLATFORMS.indexOf(a.platform) !== -1);

  if (!assets.length) {
    console.log('[bbf-signal-tracker] No posted assets to poll yet (table empty / none supplied).');
    return jsonResponse({
      ok: true,
      status: 'no_assets',
      platforms: platformStatus,
      polled: 0,
      written: 0,
      awaiting: 0,
      errors: 0,
      note: 'Credentials present but no assets to poll. Supply { assets:[...] } or seed via the posting pipeline.',
    });
  }

  const fetchedAt = new Date().toISOString();
  const rows: any[] = [];
  let awaiting = 0;
  let errors = 0;

  for (const asset of assets) {
    if (!ready[asset.platform as 'meta' | 'tiktok']) { awaiting++; continue; }

    let result: any;
    try {
      result = asset.platform === 'meta'
        ? await pollMeta(asset, META_TOKEN as string, META_VERSION, META_METRICS)
        : await pollTikTok(asset, TIKTOK_TOKEN as string, TIKTOK_BASE);
    } catch (err) {
      errors++;
      console.warn(`[bbf-signal-tracker] poll threw for ${asset.platform}:${asset.asset_id}:`, String((err as Error)?.message || err));
      continue;
    }

    if (!result?.ok) {
      errors++;
      console.warn(`[bbf-signal-tracker] poll failed for ${asset.platform}:${asset.asset_id}:`, result?.status, result?.error);
      continue;
    }

    rows.push({
      asset_id:       String(asset.asset_id),
      platform:       asset.platform,
      posted_at:      asset.posted_at ?? null,
      impressions:    num(result.metrics.impressions),
      click_throughs: num(result.metrics.click_throughs),
      dm_opens:       num(result.metrics.dm_opens),
      fetched_at:     fetchedAt,
    });
  }

  // Persist only real, polled rows. Never write a row we could not measure.
  const wrote = await dbInsertRows(SUPABASE_URL, SERVICE_KEY, rows);
  if (!wrote) {
    console.error('[bbf-signal-tracker] row insert failed.');
    return jsonResponse({ error: 'db_write_failed', detail: 'metrics polled but insert was rejected.' }, 502);
  }

  console.log(`[bbf-signal-tracker] polled=${assets.length} written=${rows.length} awaiting=${awaiting} errors=${errors}`);
  return jsonResponse({
    ok: true,
    status: 'logged',
    platforms: platformStatus,
    polled: assets.length,
    written: rows.length,
    awaiting,
    errors,
    fetched_at: fetchedAt,
  });
});
