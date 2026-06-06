// _shared/tiktok-auth.ts — TikTok Content Posting API · OAuth + token lifecycle.
// ─────────────────────────────────────────────────────────────────────────────
// Single home for the TikTok auth handshake so neither edge function hardcodes a
// token or a model of "is this still valid?":
//   • bbf-tiktok-oauth   → uses buildAuthUrl / exchangeCode / refreshTokens / tokenStatus
//   • bbf-tiktok-publish → uses getValidAccessToken (auto-refreshes on the fly)
//
// SECRETS (Vault first via public.bbf_get_vault_secret, Deno.env fallback — the
// house pattern from bbf-card-distributor):
//   TIKTOK_CLIENT_KEY     — static app Client Key (from the TikTok developer console)
//   TIKTOK_CLIENT_SECRET  — static app Client Secret
//   TIKTOK_REDIRECT_URI   — optional; must EXACTLY match a redirect URI registered in
//                           the console. Defaults to the oauth function's own URL.
//   TIKTOK_TOKEN          — optional static access-token fallback (legacy / manual)
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Rotating access/refresh tokens live in public.bbf_tiktok_oauth_v1 (singleton id=1),
// read/written here with the service role (bypasses RLS) — never in the client bundle.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const TIKTOK_AUTH_BASE = 'https://www.tiktok.com';
const TIKTOK_API_BASE = 'https://open.tiktokapis.com';
export const TIKTOK_DEFAULT_SCOPES = 'user.info.basic,video.publish,video.upload';
const TOKEN_TABLE = 'bbf_tiktok_oauth_v1';

// Refresh the access token if it expires within this many seconds (clock-skew guard).
const REFRESH_SKEW_SEC = 120;

// ─── secret resolution: Vault first, env fallback (cached per cold start) ─────────
const _secretCache = new Map<string, string | null>();
export async function getSecret(name: string): Promise<string> {
  if (_secretCache.has(name)) return _secretCache.get(name) ?? '';
  let val: string | null = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bbf_get_vault_secret`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_name: name }),
    });
    if (res.ok) {
      const text = await res.text();
      try { const j = text ? JSON.parse(text) : null; if (typeof j === 'string') val = j; else if (Array.isArray(j) && j.length) val = j[0]; }
      catch { /* non-JSON */ }
    }
  } catch (_) { /* RPC absent / not migrated — fall back to env */ }
  if (!val) val = Deno.env.get(name) ?? null;
  _secretCache.set(name, val);
  return val ?? '';
}

export async function getClientCreds(): Promise<{ key: string; secret: string }> {
  const [key, secret] = await Promise.all([getSecret('TIKTOK_CLIENT_KEY'), getSecret('TIKTOK_CLIENT_SECRET')]);
  return { key, secret };
}

export async function getRedirectUri(fallback = ''): Promise<string> {
  const explicit = await getSecret('TIKTOK_REDIRECT_URI');
  return explicit || fallback;
}

// ─── token-store access (service role; bypasses RLS) ──────────────────────────────
export type TokenRow = {
  open_id: string | null;
  scope: string | null;
  access_token: string | null;
  refresh_token: string | null;
  access_expires_at: string | null;
  refresh_expires_at: string | null;
  auth_state: string | null;
  auth_state_at: string | null;
};

export async function loadTokens(): Promise<TokenRow | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TOKEN_TABLE}?id=eq.1&select=*`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) throw new Error(`token_load_${res.status}:${(await res.text()).slice(0, 200)}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? (rows[0] as TokenRow) : null;
}

// Partial upsert on the singleton row (PostgREST ON CONFLICT updates only the columns
// present in the payload, so callers can patch just the fields they own).
async function upsertTokens(patch: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TOKEN_TABLE}?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ id: 1, ...patch }),
  });
  if (!res.ok) throw new Error(`token_save_${res.status}:${(await res.text()).slice(0, 200)}`);
}

// ─── authorize URL (consent screen) ───────────────────────────────────────────────
export function buildAuthUrl(opts: { clientKey: string; redirectUri: string; state: string; scopes?: string }): string {
  const params = new URLSearchParams({
    client_key: opts.clientKey,
    scope: opts.scopes || TIKTOK_DEFAULT_SCOPES,
    response_type: 'code',
    redirect_uri: opts.redirectUri,
    state: opts.state,
  });
  return `${TIKTOK_AUTH_BASE}/v2/auth/authorize/?${params.toString()}`;
}

// Mint + persist a CSRF nonce for the authorize→callback handshake.
export async function startAuthState(): Promise<string> {
  const state = crypto.randomUUID().replace(/-/g, '');
  await upsertTokens({ auth_state: state, auth_state_at: new Date().toISOString() });
  return state;
}

// Verify (and one-shot clear) the CSRF nonce at the callback. 10-minute TTL.
export async function consumeAuthState(state: string): Promise<boolean> {
  if (!state) return false;
  const row = await loadTokens();
  if (!row?.auth_state || !row.auth_state_at) return false;
  const fresh = Date.now() - new Date(row.auth_state_at).getTime() < 10 * 60 * 1000;
  const match = row.auth_state === state;
  if (match) await upsertTokens({ auth_state: null, auth_state_at: null });
  return match && fresh;
}

// ─── token endpoint (code exchange + refresh share one shape) ─────────────────────
type TikTokTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function callTokenEndpoint(form: Record<string, string>): Promise<TikTokTokenResponse> {
  const res = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams(form).toString(),
  });
  const j = (await res.json().catch(() => ({}))) as TikTokTokenResponse;
  if (!res.ok || j.error || !j.access_token) {
    throw new Error(`tiktok_oauth_${res.status}:${j.error ?? ''}:${(j.error_description ?? '').slice(0, 160)}`);
  }
  return j;
}

async function persist(tok: TikTokTokenResponse): Promise<TokenRow> {
  const now = Date.now();
  const patch = {
    access_token: tok.access_token ?? null,
    refresh_token: tok.refresh_token ?? null,
    open_id: tok.open_id ?? null,
    scope: tok.scope ?? null,
    access_expires_at: tok.expires_in ? new Date(now + tok.expires_in * 1000).toISOString() : null,
    refresh_expires_at: tok.refresh_expires_in ? new Date(now + tok.refresh_expires_in * 1000).toISOString() : null,
  };
  await upsertTokens(patch);
  return { ...patch, auth_state: null, auth_state_at: null } as TokenRow;
}

export async function exchangeCode(opts: { code: string; redirectUri: string }): Promise<TokenRow> {
  const { key, secret } = await getClientCreds();
  if (!key || !secret) throw new Error('tiktok_client_creds_missing');
  const tok = await callTokenEndpoint({
    client_key: key,
    client_secret: secret,
    code: opts.code,
    grant_type: 'authorization_code',
    redirect_uri: opts.redirectUri,
  });
  return persist(tok);
}

export async function refreshTokens(): Promise<TokenRow> {
  const { key, secret } = await getClientCreds();
  if (!key || !secret) throw new Error('tiktok_client_creds_missing');
  const row = await loadTokens();
  if (!row?.refresh_token) throw new Error('tiktok_refresh_token_missing');
  const tok = await callTokenEndpoint({
    client_key: key,
    client_secret: secret,
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
  });
  return persist(tok);
}

// The one the publisher calls: always returns a live access token, refreshing first
// if the stored one is missing/expiring. Falls back to a static TIKTOK_TOKEN secret
// (legacy/manual injection) so a token provisioned the old way still works.
export async function getValidAccessToken(): Promise<string> {
  const row = await loadTokens().catch(() => null);
  if (row?.access_token) {
    const expMs = row.access_expires_at ? new Date(row.access_expires_at).getTime() : 0;
    const stillValid = expMs && expMs - Date.now() > REFRESH_SKEW_SEC * 1000;
    if (stillValid) return row.access_token;
    if (row.refresh_token) {
      try { const refreshed = await refreshTokens(); if (refreshed.access_token) return refreshed.access_token; }
      catch (_) { /* fall through to static fallback */ }
    }
    // No refresh path but we have *some* access token — return it; the caller surfaces
    // any 401 from TikTok rather than us guessing it's dead.
    return row.access_token;
  }
  const staticTok = await getSecret('TIKTOK_TOKEN');
  if (staticTok) return staticTok;
  throw new Error('tiktok_token_unavailable');
}

// Safe, value-free summary for status endpoints (never returns token material).
export async function tokenStatus(): Promise<Record<string, unknown>> {
  const { key, secret } = await getClientCreds();
  const row = await loadTokens().catch(() => null);
  const staticTok = await getSecret('TIKTOK_TOKEN');
  const accessExp = row?.access_expires_at ? new Date(row.access_expires_at).getTime() : 0;
  return {
    client_credentials: Boolean(key && secret),
    has_access_token: Boolean(row?.access_token) || Boolean(staticTok),
    has_refresh_token: Boolean(row?.refresh_token),
    access_token_source: row?.access_token ? 'oauth' : (staticTok ? 'static_secret' : null),
    access_expires_at: row?.access_expires_at ?? null,
    access_expired: accessExp ? accessExp <= Date.now() : null,
    refresh_expires_at: row?.refresh_expires_at ?? null,
    open_id: row?.open_id ?? null,
    scope: row?.scope ?? null,
  };
}
