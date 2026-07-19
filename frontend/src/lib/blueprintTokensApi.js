// src/lib/blueprintTokensApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Vanguard Blueprint — Master Program Generation Token ledger (client binding).
//
// Thin wrapper over the LIVE production SECURITY DEFINER functions:
//   • bbf_get_blueprint_tokens(p_session_token)     → read balance (no consume)
//   • bbf_consume_blueprint_token(p_session_token)  → decrement one (fail-closed on 0)
//
// ⚠️ SIGNATURE: both take the VAULT SESSION TOKEN (p_session_token text), NOT a
// user_id — identity is resolved SERVER-SIDE from the token (never trust a client
// user_id). The functions grant EXECUTE to anon+authenticated and self-seed the
// monthly allotment (blueprint_pro → 3, blueprint_basic / legacy blueprint → 1),
// resetting by UTC calendar month.
//
// SCOPE: only Blueprint tiers are metered by this ledger. Non-Blueprint tiers keep
// their existing generator behavior (the localStorage stopgap in Generator.jsx) —
// this file is never consulted for them.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// The tier slugs metered by the blueprint token ledger (matches _bbf_blueprint_allotment).
export const BLUEPRINT_TIERS = new Set(['blueprint_basic', 'blueprint_pro', 'blueprint']);

export function isBlueprintTier(tier) {
  return BLUEPRINT_TIERS.has(String(tier || '').trim().toLowerCase());
}

// Read the current balance WITHOUT consuming. Returns the server payload
//   { ok:true, remaining, allotment, period, seeded }
// or, on a transport failure, a sentinel with transport:true so the caller can
// fail-OPEN (never padlock a paying athlete on a network blip) rather than mistake
// it for a genuine exhaustion.
export async function getBlueprintTokens() {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session' };
  try {
    const { data, error } = await supabase.rpc('bbf_get_blueprint_tokens', { p_session_token: token });
    if (error) return { ok: false, error: 'transport', transport: true, detail: error.message };
    return data ?? { ok: false, error: 'empty' };
  } catch (e) {
    return { ok: false, error: 'transport', transport: true, detail: e?.message };
  }
}

// Consume one token. Returns
//   { ok:true, remaining, allotment, period }              — spent
//   { ok:false, error:'exhausted', remaining:0, ... }      — genuinely out (fail-CLOSED)
//   { ok:false, error:'transport', transport:true }        — network blip (caller fails OPEN)
export async function consumeBlueprintToken() {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session' };
  try {
    const { data, error } = await supabase.rpc('bbf_consume_blueprint_token', { p_session_token: token });
    if (error) return { ok: false, error: 'transport', transport: true, detail: error.message };
    return data ?? { ok: false, error: 'empty' };
  } catch (e) {
    return { ok: false, error: 'transport', transport: true, detail: e?.message };
  }
}
