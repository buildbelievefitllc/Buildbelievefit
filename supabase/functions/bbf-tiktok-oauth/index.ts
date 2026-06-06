// bbf-tiktok-oauth — TikTok Content Posting API · OAuth handshake + token refresh.
// ─────────────────────────────────────────────────────────────────────────────
// Turns the static Client Key/Secret into a self-refreshing access token for the
// BBF brand account, so bbf-tiktok-publish never holds a token that goes stale.
// All token material is stored server-side (public.bbf_tiktok_oauth_v1, service-role
// RLS) and is NEVER returned to a caller. See _shared/tiktok-auth.ts.
//
// FLOW (one-time, then automatic):
//   1. Admin POST { action:'authorize' }  → returns a TikTok consent URL.
//   2. CEO opens it once in any browser, approves → TikTok redirects to this
//      function's GET callback with ?code&state. We verify the CSRF state, exchange
//      the code for tokens, persist them, and render a success page. Done.
//   3. bbf-tiktok-publish auto-refreshes the access token from then on. A manual
//      Admin POST { action:'refresh' } is available for cron / belt-and-suspenders.
//
// ACTIONS (POST JSON, admin-gated via X-BBF-Admin-Token == BBF_COACH_AGENT_TOKEN):
//   { action:'authorize', redirect_uri?, scopes? } → { ok, authorize_url, state, redirect_uri }
//   { action:'refresh' }                           → { ok, token: <status> }
//   { action:'status' }                            → { ok, token: <status> }
// GET ?code&state  → OAuth callback (public; protected by the CSRF state nonce).
// GET ?error       → consent declined (renders a readable error page).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildAuthUrl, getClientCreds, getRedirectUri, startAuthState, consumeAuthState,
  exchangeCode, refreshTokens, tokenStatus, TIKTOK_DEFAULT_SCOPES,
} from '../_shared/tiktok-auth.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};

const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function htmlResponse(title: string, message: string, ok: boolean, status = 200): Response {
  const accent = ok ? '#6a0dad' : '#b00020';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BBF · TikTok ${ok ? 'Connected' : 'Error'}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090909;color:#f4f4f4;
font-family:-apple-system,BlinkMacSystemFont,'Barlow Condensed',Segoe UI,Roboto,sans-serif}
.card{max-width:34rem;padding:2.5rem;text-align:center}
h1{font-size:1.9rem;letter-spacing:.04em;color:${accent};margin:0 0 .75rem}
p{font-size:1.05rem;line-height:1.5;color:#cfcfcf}
.tag{display:inline-block;margin-top:1.25rem;padding:.4rem .9rem;border:1px solid ${accent};
border-radius:999px;color:${accent};font-size:.8rem;letter-spacing:.12em;text-transform:uppercase}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p>
<span class="tag">Build · Believe · Fit</span></div></body></html>`;
  return new Response(html, { status, headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' } });
}

// The function's own public URL (default redirect target), minus query/trailing slash.
function selfUrl(req: Request): string {
  const u = new URL(req.url);
  return `${u.origin}${u.pathname}`.replace(/\/$/, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // ── GET: OAuth callback from TikTok (browser redirect) ──────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const err = url.searchParams.get('error');
    if (err) {
      const desc = url.searchParams.get('error_description') || 'The authorization was declined.';
      return htmlResponse('TikTok authorization cancelled', desc, false, 400);
    }
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') ?? '';
    if (!code) {
      // Bare GET (health/sanity check) — not an error, just nothing to do.
      return htmlResponse('BBF TikTok OAuth', 'This endpoint completes the TikTok connection. Start it from the admin console.', true);
    }
    try {
      const valid = await consumeAuthState(state);
      if (!valid) return htmlResponse('Authorization could not be verified', 'The security token did not match or has expired. Please restart the connection from the admin console.', false, 403);
      const redirectUri = await getRedirectUri(selfUrl(req));
      const row = await exchangeCode({ code, redirectUri });
      return htmlResponse('TikTok connected ✓', `The BBF brand account is now linked (open_id ${String(row.open_id ?? '').slice(0, 10)}…). You can close this tab — publishing is live.`, true);
    } catch (e) {
      return htmlResponse('Token exchange failed', String((e as Error)?.message ?? e), false, 502);
    }
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // ── POST: admin-gated actions ───────────────────────────────────────────────────
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try { body = req.headers.get('content-type')?.includes('application/json') ? await req.json() : {}; }
  catch { return jsonResponse({ error: 'bad_json' }, 400); }

  const action = String(body?.action ?? 'status');

  try {
    if (action === 'authorize') {
      const { key } = await getClientCreds();
      if (!key) return jsonResponse({ error: 'client_key_missing', detail: 'Inject TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET into Vault or env first.' }, 412);
      const redirectUri = await getRedirectUri(typeof body?.redirect_uri === 'string' && body.redirect_uri ? String(body.redirect_uri) : selfUrl(req));
      const scopes = typeof body?.scopes === 'string' && body.scopes ? String(body.scopes) : TIKTOK_DEFAULT_SCOPES;
      const state = await startAuthState();
      const authorize_url = buildAuthUrl({ clientKey: key, redirectUri, state, scopes });
      return jsonResponse({
        ok: true, action, authorize_url, state, redirect_uri: redirectUri, scopes,
        note: 'Open authorize_url once in a browser to grant access. redirect_uri MUST be registered (exact match) in the TikTok developer console.',
      });
    }

    if (action === 'refresh') {
      const row = await refreshTokens();
      return jsonResponse({ ok: true, action, refreshed: true, token: await tokenStatus().catch(() => ({})), open_id: row.open_id ?? null });
    }

    if (action === 'status') {
      return jsonResponse({ ok: true, action, token: await tokenStatus() });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
