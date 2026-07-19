// src/lib/blueprintTokensApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Server-authoritative Blueprint program-generation token. The balance lives in
// bbf_blueprint_tokens (RLS-SEALED — zero client writes) and is only ever read or
// decremented through the SECURITY DEFINER RPCs, which resolve identity from the
// vault session token. A client can therefore neither forge a balance nor spend
// another account's tokens — the localStorage meter this replaces could do both.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Read the caller's remaining tokens for the current UTC month.
// Returns { ok:true, remaining:number } or { ok:false, error, remaining:null }.
export async function fetchBlueprintTokens() {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session', remaining: null };
  const { data, error } = await supabase.rpc('bbf_get_blueprint_tokens', { p_session_token: token });
  if (error || !data || data.ok !== true) {
    return { ok: false, error: error?.message || data?.error || 'read_failed', remaining: null };
  }
  return { ok: true, remaining: Number(data.remaining) };
}

// Atomically consume ONE token. Returns { ok:true, remaining } on success, or
// { ok:false, error:'exhausted'|'invalid_session'|…, remaining } on denial. The
// decrement is atomic server-side, so it is the real gate — the UI state is advisory.
export async function consumeBlueprintToken() {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session', remaining: null };
  const { data, error } = await supabase.rpc('bbf_consume_blueprint_token', { p_session_token: token });
  if (error) return { ok: false, error: error.message || 'rpc_error', remaining: null };
  if (!data || data.ok !== true) return { ok: false, error: data?.error || 'denied', remaining: data?.remaining ?? null };
  return { ok: true, remaining: Number(data.remaining) };
}
