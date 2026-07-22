// src/lib/sportsCatalogApi.js
// ─────────────────────────────────────────────────────────────────────────────
// SP-1 · Sport Periodization Catalog — client readers/appliers.
//
//   • fetchMySportBlock(uid) — token-gated RPC (bbf_get_my_sport_block): the
//     server resolves the athlete's sport/position/phase/tier and returns the
//     FOUNDER-APPROVED baked block for that cell, or null. FAIL-OPEN: any
//     error/null → the Hub keeps the generic WEEK_TEMPLATE. The catalog can
//     only ever upgrade the week, never break it.
//   • approveCatalogBatch(batchId) — admin: activates a bake batch (drafts →
//     approved) through bbf-sport-periodization-bake's approve_batch action
//     (admin session-token gated, same dual-auth shape as inboxApi).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase, FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getCoachAdminToken } from './adminAuth.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Shape guard: exactly 7 days, each rest or carrying a non-empty exercises list.
// A malformed block reads as "no block" — WEEK_TEMPLATE fallback, never a crash.
export function isServableBlock(block) {
  const days = block?.days;
  if (!Array.isArray(days) || days.length !== 7) return false;
  return days.every((d) => d && typeof d === 'object'
    && (d.rest === true || (Array.isArray(d.exercises) && d.exercises.length > 0)));
}

export async function fetchMySportBlock(uid) {
  const token = getStoredVaultToken();
  if (!uid || !token) return null;
  try {
    const { data, error } = await supabase.rpc('bbf_get_my_sport_block', {
      p_uid: uid,
      p_session_token: token,
    });
    if (error || !data?.ok || !isServableBlock(data.block)) return null;
    return data; // { ok, block:{days,...}, phase, tier, sport, position_group, catalog_id }
  } catch {
    return null;
  }
}

export async function approveCatalogBatch(batchId) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  const sessionToken = getStoredVaultToken();
  if (sessionToken) headers['X-BBF-Session-Token'] = sessionToken;
  const adminToken = getCoachAdminToken();
  if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;

  const res = await fetch(`${FUNCTIONS_BASE}/bbf-sport-periodization-bake`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'approve_batch', batch_id: batchId }),
  });
  if (!res.ok) throw new Error(`catalog_approve_${res.status}`);
  return res.json();
}
