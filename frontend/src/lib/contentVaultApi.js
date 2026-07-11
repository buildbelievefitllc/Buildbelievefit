// src/lib/contentVaultApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Read layer for the Marketing Vault grid. Streams rows straight from the
// `content_vault` table via the anon Supabase client. The table's RLS grants SELECT
// to everyone (content_vault_public_read) — the rows are public marketing CDN URLs +
// placeholder captions — while INSERT/UPDATE/DELETE stay service-role only (the
// seat/edit path runs server-side), so nothing sensitive is exposed and the grid
// still reflects live DB state.

import { supabase } from './supabaseClient.js';

const COLUMNS = 'id,title,video_url,caption_body,status,platform_targets,bgm_source_url,created_at';

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
