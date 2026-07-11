// src/lib/contentVaultApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Read layer for the Marketing Vault grid. Streams rows straight from the
// `content_vault` table via the anon Supabase client. The table's RLS grants SELECT
// to everyone (content_vault_public_read) — the rows are public marketing CDN URLs +
// placeholder captions — while INSERT/UPDATE/DELETE stay service-role only (the
// seat/edit path runs server-side), so nothing sensitive is exposed and the grid
// still reflects live DB state.

import { supabase, FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

const COLUMNS = 'id,title,video_url,caption_body,status,platform_targets,bgm_source_url,created_at';

// Admin-gated writes (Meta dispatch + secure purge) route through bbf-content-manager
// — the same function the Command Center is already authorized to via the vault
// session token. content_vault has NO client-write RLS, so these CANNOT run on the
// anon client (a browser delete/patch silently affects 0 rows); the edge function
// holds the service role + the Meta secret and does the real work server-side.
const MANAGER_FN = `${FUNCTIONS_BASE}/bbf-content-manager`;

function managerHeaders(token) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...(token ? { 'x-bbf-session-token': token } : {}),
  };
}

async function callManager(payload) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('no_admin_session');
  const r = await fetch(MANAGER_FN, { method: 'POST', headers: managerHeaders(token), body: JSON.stringify(payload) });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error((j && (j.error || j.detail)) || `manager_${r.status}`);
  return j;
}

// LIVE-dispatch a clip to Instagram Reels + Facebook Page video via the Meta Graph
// API (server-side). Resolves { published, channels } — `published` is true only
// when EVERY targeted channel returned a confirmed 200.
export async function dispatchToMeta({ id, video_url, caption_body }) {
  return callManager({ action: 'vault_dispatch', id, video_url, caption: caption_body });
}

// Permanently purge a clip: Tier A deletes the raw .mp4 from Storage (videos/marketing/*),
// Tier B deletes the content_vault row. Both run under the service role in the edge fn.
export async function purgeVaultItem({ id, video_url }) {
  return callManager({ action: 'vault_purge', id, video_url });
}

// One-shot fetch — newest first.
export async function fetchContentVault() {
  const { data, error } = await supabase
    .from('content_vault')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message || 'content_vault_read_failed');
  return Array.isArray(data) ? data : [];
}

// Live subscription — invokes `onChange` on any INSERT/UPDATE/DELETE so the grid
// re-pulls. Returns an unsubscribe fn (safe to call in a cleanup). Realtime is a
// best-effort enhancement over the initial fetch: if the socket never connects the
// grid still shows the fetched rows.
export function subscribeContentVault(onChange) {
  const channel = supabase
    .channel('content_vault_stream')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'content_vault' }, () => {
      try { onChange(); } catch { /* swallow — a bad handler must not kill the socket */ }
    })
    .subscribe();
  return () => { try { supabase.removeChannel(channel); } catch { /* noop */ } };
}
