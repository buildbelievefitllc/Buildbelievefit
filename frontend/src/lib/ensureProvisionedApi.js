// src/lib/ensureProvisionedApi.js
// ─────────────────────────────────────────────────────────────────────────────
// The vault-landing provisioning guard client. Calls the vault-token-gated RPC
// bbf_ensure_provisioned, which fast-path returns ready when the athlete already
// has an athlete_profiles row + today's athlete_nutrition_targets_daily contract,
// and otherwise seeds the baseline rows in-database, then re-asserts readiness.
//
// WHY AN RPC (not an edge fn): the RPC is SECURITY DEFINER and self-verifies the
// vault_token server-side (the browser holds only a slug + token, never the
// profile UUID). No new edge surface, one round-trip. Mirrors bbf_nutrition_today.
//
// Returns { ready, provisioned, profileId } on success, or null on a soft failure
// (transport / not-deployed) — the caller then FAILS OPEN (renders the degraded
// Hub) so a provisioning hiccup never locks a paying athlete out.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

export async function fetchEnsureProvisioned(uid) {
  const token = getStoredVaultToken();
  // No identity yet → nothing to gate; the route guard owns sign-in.
  if (!uid || !token) return { ready: true, provisioned: false, profileId: null };

  const { data, error } = await supabase.rpc('bbf_ensure_provisioned', {
    p_uid: String(uid).trim().toLowerCase(),
    p_session_token: token,
  });

  if (error || !data || data.ok === false) return null; // soft failure → caller fail-opens
  return {
    ready: data.ready === true,
    provisioned: data.provisioned === true,
    profileId: data.profile_id || null,
  };
}
