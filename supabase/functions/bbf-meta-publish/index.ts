// bbf-meta-publish — Terminal Delta · Instagram Reels distribution (official Graph API).
// ─────────────────────────────────────────────────────────────────────────────
// Publishes a Reel to the BBF Instagram Business account via Meta's Content
// Publishing API — no browser, no scraping. Three responsibilities:
//   1. AUTH      — read/refresh the 60-day long-lived IG token from bbf_system_config
//                  (service-role RLS; Vault/env fallback for bootstrap).
//   2. CAPTION   — turn a short user_prompt into an optimized Reel caption via Claude,
//                  routed through the model router (§4 — never a hardcoded model).
//   3. PUBLISH   — resumable Reels flow: create REELS container → upload the binary →
//                  poll status_code until FINISHED → media_publish.
//
// SAFETY (house posture): admin-gated; dry-run by default (posts only on { live:true });
// every Claude call passes the spend-gate and writes bbf_llm_calls telemetry.
//
// ACTIONS (POST JSON, admin-gated via X-BBF-Admin-Token == BBF_COACH_AGENT_TOKEN):
//   { action:'status' }                                   → token/config readiness (no external call)
//   { action:'set_token', long_lived_token, ig_user_id, expires_in_days? }  → store the token
//   { action:'refresh_token' }                            → refresh the long-lived token now
//   { action:'publish', live?, video_url, user_prompt?, caption?, share_to_feed? } → publish a Reel
//
// SECRETS (auto-injected by Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   BBF_COACH_AGENT_TOKEN, ANTHROPIC_API_KEY. Optional for token refresh: META_APP_ID,
//   META_APP_SECRET. Bootstrap fallback (parity with bbf-card-distributor): META_TOKEN,
//   META_IG_USER_ID, META_GRAPH_VERSION.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { routeAndLog } from '../_shared/model-router.ts';
import { logLlmCall } from '../_shared/llm-telemetry.ts';
import { checkSpendGate, spendLimitResponse } from '../_shared/spend-gate.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_TOKEN  = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const supa = (SUPABASE_URL && SERVICE_ROLE)
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// Approximate per-MTok USD pricing — feeds the spend kill-switch via bbf_llm_calls.
// Tunable; the kill-switch only needs order-of-magnitude accuracy.
const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5':  { in: 1,  out: 5 },
  'claude-sonnet-4-6': { in: 3,  out: 15 },
  'claude-opus-4-8':   { in: 15, out: 75 },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function estimateCost(model: string, inTok?: number | null, outTok?: number | null): number | null {
  if (inTok == null && outTok == null) return null;
  const p = PRICE_PER_MTOK[model] ?? PRICE_PER_MTOK['claude-sonnet-4-6'];
  return +((((inTok ?? 0) / 1e6) * p.in) + (((outTok ?? 0) / 1e6) * p.out)).toFixed(6);
}
function extractText(content: any[]): string {
  if (!Array.isArray(content)) return '';
  for (const b of content) if (b && b.type === 'text' && typeof b.text === 'string') return b.text;
  return '';
}

// ─── AUTH · 60-day long-lived IG token lifecycle ──────────────────────────────────
interface MetaConfig { token: string; igUser: string; version: string; graph: string; expiresAt: string | null; }

async function getMetaConfig(): Promise<MetaConfig> {
  let token = '', igUser = '', version = '', expiresAt: string | null = null;
  if (supa) {
    const { data } = await supa.from('bbf_system_config')
      .select('meta_ig_access_token,meta_ig_token_expires_at,meta_ig_user_id,meta_graph_version')
      .eq('id', 1).maybeSingle();
    if (data) {
      token = data.meta_ig_access_token || '';
      igUser = data.meta_ig_user_id || '';
      version = data.meta_graph_version || '';
      expiresAt = data.meta_ig_token_expires_at || null;
    }
  }
  // Bootstrap fallback (parity with bbf-card-distributor).
  if (!token)  token  = Deno.env.get('META_TOKEN') ?? '';
  if (!igUser) igUser = Deno.env.get('META_IG_USER_ID') ?? '';
  if (!version) version = Deno.env.get('META_GRAPH_VERSION') ?? 'v21.0';
  return { token, igUser, version, expiresAt, graph: `https://graph.facebook.com/${version}` };
}

async function storeMetaToken(token: string, igUser: string, expiresInSec: number): Promise<void> {
  if (!supa) return;
  const patch: Record<string, unknown> = {
    id: 1,
    meta_ig_access_token: token,
    meta_ig_token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (igUser) patch.meta_ig_user_id = igUser;
  await supa.from('bbf_system_config').upsert(patch, { onConflict: 'id' });
}

// Exchange the current long-lived token for a fresh 60-day one (needs app creds).
async function refreshLongLived(current: string, version: string): Promise<{ token: string; expiresIn: number } | null> {
  const appId = Deno.env.get('META_APP_ID') ?? '';
  const appSecret = Deno.env.get('META_APP_SECRET') ?? '';
  if (!appId || !appSecret || !current) return null;
  const url = `https://graph.facebook.com/${version}/oauth/access_token?grant_type=fb_exchange_token`
    + `&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}`
    + `&fb_exchange_token=${encodeURIComponent(current)}`;
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return null;
  return { token: j.access_token, expiresIn: Number(j.expires_in ?? 60 * 24 * 3600) };
}

// Config + auto-refresh when inside a 7-day skew window.
async function resolveLiveToken(): Promise<MetaConfig> {
  const cfg = await getMetaConfig();
  if (cfg.token && cfg.expiresAt) {
    const msLeft = new Date(cfg.expiresAt).getTime() - Date.now();
    if (msLeft < 7 * 24 * 3600 * 1000) {
      const refreshed = await refreshLongLived(cfg.token, cfg.version);
      if (refreshed) {
        await storeMetaToken(refreshed.token, cfg.igUser, refreshed.expiresIn);
        return { ...cfg, token: refreshed.token, expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() };
      }
    }
  }
  return cfg;
}

// ─── CAPTION · Claude via the model router (§4) ───────────────────────────────────
async function generateCaption(userPrompt: string): Promise<{ caption: string; model: string }> {
  const model = routeAndLog('bbf-meta-publish', 'reel_caption');
  const system = 'You are the Build Believe Fit (BBF) social copywriter. Write ONE Instagram Reels caption '
    + 'in the BBF brand voice — motivating, grounded in joint health, strength, and cardio; never hype or medical claims. '
    + 'Keep it under ~125 words with 1-3 tasteful emojis, then a final line of 8-12 relevant fitness hashtags. '
    + 'Return ONLY the caption text — no preamble, no quotes.';
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: 'user', content: userPrompt }] }),
  });
  const body = await res.json().catch(() => null);
  const latencyMs = Date.now() - t0;
  const usage = body?.usage ?? {};
  const ok = res.ok && Array.isArray(body?.content);
  const caption = ok ? extractText(body.content).trim() : '';
  const resolvedModel = body?.model ?? model;
  await logLlmCall(supa, {
    agent: 'bbf-meta-publish', model: resolvedModel, ok, latencyMs,
    inputTokens: usage.input_tokens ?? null, outputTokens: usage.output_tokens ?? null,
    finishReason: body?.stop_reason ?? null, promptName: 'reel_caption',
    costUsd: estimateCost(resolvedModel, usage.input_tokens, usage.output_tokens),
    error: ok ? null : `anthropic_${res.status}`,
  });
  if (!ok || !caption) throw new Error(`caption_generation_failed_${res.status}`);
  return { caption, model: resolvedModel };
}

// ─── PUBLISH · resumable Reels flow ───────────────────────────────────────────────
async function createContainer(cfg: MetaConfig, caption: string, shareToFeed: boolean): Promise<{ id: string; uri?: string }> {
  const r = await fetch(`${cfg.graph}/${cfg.igUser}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'REELS', upload_type: 'resumable', caption, share_to_feed: shareToFeed, access_token: cfg.token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error(`container_create_${r.status}:${JSON.stringify(j).slice(0, 240)}`);
  return { id: String(j.id), uri: j.uri };
}

async function uploadBinary(cfg: MetaConfig, containerId: string, uploadUri: string | undefined, bytes: Uint8Array): Promise<void> {
  const url = uploadUri || `https://rupload.facebook.com/ig-api-upload/${cfg.version}/${containerId}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `OAuth ${cfg.token}`, offset: '0', file_size: String(bytes.byteLength), 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`binary_upload_${r.status}:${JSON.stringify(j).slice(0, 240)}`);
}

async function pollContainer(cfg: MetaConfig, containerId: string, maxAttempts = 30, delayMs = 4000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const r = await fetch(`${cfg.graph}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(cfg.token)}`);
    const j = await r.json().catch(() => ({}));
    const code = j.status_code;
    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`container_status_${code}:${JSON.stringify(j).slice(0, 240)}`);
    await sleep(delayMs);
  }
  throw new Error(`container_poll_timeout:${containerId}`);
}

async function publishContainer(cfg: MetaConfig, containerId: string): Promise<string> {
  const r = await fetch(`${cfg.graph}/${cfg.igUser}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: cfg.token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error(`media_publish_${r.status}:${JSON.stringify(j).slice(0, 240)}`);
  return String(j.id);
}

// ─── handler ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!supa) return jsonResponse({ error: 'backend_unconfigured' }, 503);

  // GATE 1 — admin only.
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try { body = req.headers.get('content-type')?.includes('application/json') ? await req.json() : {}; }
  catch { return jsonResponse({ error: 'bad_json' }, 400); }

  const action = String(body?.action ?? 'status');

  try {
    // ── status — readiness, no external call ──────────────────────────────────────
    if (action === 'status') {
      const cfg = await getMetaConfig();
      const expMs = cfg.expiresAt ? new Date(cfg.expiresAt).getTime() : 0;
      return jsonResponse({
        ok: true, action,
        ready_to_post: Boolean(cfg.token && cfg.igUser),
        has_token: Boolean(cfg.token), ig_user_id: cfg.igUser || null,
        token_expires_at: cfg.expiresAt, token_expired: expMs ? expMs <= Date.now() : null,
        graph_version: cfg.version,
        note: (cfg.token && cfg.igUser) ? undefined : 'Set the IG token + ig_user_id via { action:"set_token" } or the migration seed.',
      });
    }

    // ── set_token — store the long-lived token ────────────────────────────────────
    if (action === 'set_token') {
      const longLived = String(body?.long_lived_token ?? '');
      const igUser = String(body?.ig_user_id ?? '');
      const days = Math.max(1, Math.min(60, Number(body?.expires_in_days) || 60));
      if (!longLived) return jsonResponse({ error: 'long_lived_token_required' }, 400);
      await storeMetaToken(longLived, igUser, days * 24 * 3600);
      const cfg = await getMetaConfig();
      return jsonResponse({ ok: true, action, stored: true, ig_user_id: cfg.igUser || null, token_expires_at: cfg.expiresAt });
    }

    // ── refresh_token — force a refresh now ───────────────────────────────────────
    if (action === 'refresh_token') {
      const cfg = await getMetaConfig();
      if (!cfg.token) return jsonResponse({ error: 'no_token_to_refresh' }, 412);
      const refreshed = await refreshLongLived(cfg.token, cfg.version);
      if (!refreshed) return jsonResponse({ error: 'refresh_failed', detail: 'set META_APP_ID / META_APP_SECRET, or refresh manually' }, 502);
      await storeMetaToken(refreshed.token, cfg.igUser, refreshed.expiresIn);
      return jsonResponse({ ok: true, action, refreshed: true, token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() });
    }

    // ── publish — the Reel. Dry-run unless { live:true }. ─────────────────────────
    if (action === 'publish') {
      const live = body?.live === true;                                   // GATE 2
      const videoUrl = String(body?.video_url ?? '');
      const userPrompt = String(body?.user_prompt ?? '');
      const providedCaption = String(body?.caption ?? '');
      const shareToFeed = body?.share_to_feed !== false;
      if (!videoUrl) return jsonResponse({ error: 'video_url_required' }, 400);

      const cfg = await resolveLiveToken();                               // GATE 3 (token)
      if (!cfg.token || !cfg.igUser) {
        return jsonResponse({ error: 'meta_not_configured', detail: 'missing IG token or ig_user_id — run set_token first' }, 412);
      }

      // Caption: use the provided one, else generate from the prompt (spend-gated).
      let caption = providedCaption;
      let model: string | null = null;
      if (!caption) {
        if (!userPrompt) return jsonResponse({ error: 'caption_or_user_prompt_required' }, 400);
        if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);
        const verdict = await checkSpendGate(SUPABASE_URL, SERVICE_ROLE);
        if (verdict.stopped) return spendLimitResponse(verdict);
        const gen = await generateCaption(userPrompt);
        caption = gen.caption; model = gen.model;
      }

      // ---- DRY RUN: caption preview + asset reachability, nothing posted ----
      if (!live) {
        let assetReachable: boolean | null = null;
        try { assetReachable = (await fetch(videoUrl, { method: 'HEAD' })).ok; } catch { assetReachable = false; }
        return jsonResponse({
          ok: true, action, mode: 'dry_run', caption, caption_model: model,
          would_post: { ig_user_id: cfg.igUser, video_url: videoUrl, share_to_feed: shareToFeed },
          asset_reachable: assetReachable,
          note: 'Dry run — no container created, nothing published. Re-send with { "live": true } to post.',
        });
      }

      // ---- LIVE: resumable create → upload → poll → publish ----
      const container = await createContainer(cfg, caption, shareToFeed);
      const vr = await fetch(videoUrl);
      if (!vr.ok) return jsonResponse({ error: 'video_fetch_failed', status: vr.status, detail: videoUrl }, 502);
      const bytes = new Uint8Array(await vr.arrayBuffer());
      await uploadBinary(cfg, container.id, container.uri, bytes);
      await pollContainer(cfg, container.id);
      const mediaId = await publishContainer(cfg, container.id);

      return jsonResponse({
        ok: true, action, mode: 'live',
        media_id: mediaId,            // IG media id — feed to bbf-signal-tracker (platform:'meta')
        container_id: container.id,
        caption, caption_model: model,
        video_bytes: bytes.byteLength,
      });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
