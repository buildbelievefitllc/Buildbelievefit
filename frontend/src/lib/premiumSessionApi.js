// src/lib/premiumSessionApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Premium Audio Engine data layer (Product 1 · Biometric Narration & Music).
//
//   fetchPremiumSession({ plan, locale, age }) → today's PLAY CONTRACT (manifest
//       with short-TTL signed URLs) from bbf-premium-session-composer. Cache-first
//       server-side; a same-day second call is free.
//   resignPremiumAssets(paths)                → fresh signed URLs when a live
//       player's 12h URLs expire mid-session (single retry path).
//
// House convention: raw fetch to FUNCTIONS_BASE with the anon key (the gateway
// requires it to route) + the vault token on header AND body — mirrors
// forecastApi / prehabApi (NOT functions.invoke).

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

function fnHeaders(vaultToken) {
  const h = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (vaultToken) h['x-bbf-vault-token'] = vaultToken;
  return h;
}

async function callComposer(body) {
  const token = getStoredVaultToken();
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-premium-session-composer`, {
    method: 'POST',
    headers: fnHeaders(token),
    body: JSON.stringify({ ...body, vault_token: token }),
  });
  if (!res.ok) {
    let slug = `premium_session_failed_${res.status}`;
    try { slug = (await res.json())?.error || slug; } catch { /* non-JSON body */ }
    throw new Error(slug);
  }
  return res.json();
}

// Compose (or cache-read) today's premium session track. `plan` is the parsed
// workout-plan array the Program tab already holds (parseWorkoutPlan output) —
// sending it spares the server a lookup; the composer falls back to the server
// copy in bbf_active_clients when omitted.
export async function fetchPremiumSession({ plan, locale, age } = {}) {
  const j = await callComposer({ plan: plan ?? undefined, locale, age });
  if (!j?.ok || !j?.track) throw new Error(j?.error || 'premium_session_failed');
  return j.track;
}

// Refresh signed URLs for a set of manifest storage paths (free; entitlement-gated).
export async function resignPremiumAssets(paths) {
  const j = await callComposer({ action: 'resign', paths });
  if (!j?.ok) throw new Error(j?.error || 'resign_failed');
  return j.urls || {};
}
