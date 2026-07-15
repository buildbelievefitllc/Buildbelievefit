// src/lib/acwrApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Batch dual-engine ACWR for a roster group — the browser-side caller for the
// bbf-athlete-acwr edge function. Mirrors the rosterApi gateway+dual-auth shape
// exactly (anon apikey for gateway routing + the admin SESSION token / legacy
// shared secret for authorization). We NEVER call bbf_compute_acwr directly from
// the browser: the RPC is service_role/authenticated-only (anon revoked, §7), so
// the compute stays server-side in the edge function.
//
// Contract (verified against supabase/functions/bbf-athlete-acwr/index.ts):
//   POST {FUNCTIONS_BASE}/bbf-athlete-acwr  { athlete_ids:[bbf_users.id, …] }
//   200 → { ok:true, acwr:{ [id]: {
//             subjective: { acute:number, chronic:number, ratio:number } | null,
//             tonnage:    number | null
//           } } }
//
// Non-fatal overlay: callers swallow throws so the roster still paints.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getCoachAdminToken } from './adminAuth.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

export async function fetchAcwrBatch(athleteIds) {
  const ids = Array.isArray(athleteIds)
    ? [...new Set(athleteIds.filter(Boolean).map(String))]
    : [];
  if (!ids.length) return {};

  const headers = { 'Content-Type': 'application/json' };
  // Gateway routing — required even with verify_jwt:false (matches rosterCall).
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  // Authorization — the admin session token (zero-friction) and/or shared secret.
  const sessionToken = getStoredVaultToken();
  if (sessionToken) headers['X-BBF-Session-Token'] = sessionToken;
  const adminToken = getCoachAdminToken();
  if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;

  const res = await fetch(`${FUNCTIONS_BASE}/bbf-athlete-acwr`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ athlete_ids: ids }),
  });
  if (!res.ok) throw new Error(`acwr_${res.status}`);
  const body = await res.json().catch(() => null);
  return body?.acwr || {};
}
