// src/lib/protocolOverrideApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Command Center MANUAL OVERRIDE — the Commander's hand on the Autonomous Referee.
// Calls the admin-validating RPCs (migration 20260609150000) via the standard
// supabase.rpc() pattern. Each RPC self-gates on the stored 24h vault session token
// → admin role server-side, so a non-admin call returns not_authorized. This avoids
// re-deploying the 940-line bbf-admin-roster monolith for two new writes.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

async function adminRpc(fn, args) {
  const token = getStoredVaultToken();
  if (!token) { const e = new Error('No admin session — sign in again.'); e.code = 'no_session'; throw e; }
  const { data, error } = await supabase.rpc(fn, { p_session_token: token, ...args });
  if (error) {
    const m = String(error.message || '');
    const msg = /not_authorized/.test(m) ? 'Not authorized — an admin session is required.'
      : /athlete_not_found/.test(m) ? 'No athlete found for this id.'
      : m || 'Override request failed.';
    const e = new Error(msg); e.code = error.code || 'rpc_error'; throw e;
  }
  return data;
}

// Read the staged sports_protocol (jsonb | null) for an athlete (bbf_users id).
export function getSportsProtocol(id) {
  return adminRpc('bbf_admin_get_sports_protocol', { p_id: id });
}

// Force the sports_protocol (Phase override). `protocol` = buildSportsProtocol(...) output.
export function setSportsProtocol(id, protocol) {
  return adminRpc('bbf_admin_set_sports_protocol', { p_id: id, p_protocol: protocol });
}

// Force the meal_plan (Nutrition recalc). `plan` = buildMealPlan(...) output.
export function setMealPlan(id, plan) {
  return adminRpc('bbf_admin_set_meal_plan', { p_id: id, p_plan: plan });
}

// List athletes with a staged sports_protocol — the Command Center Sports Portal roster.
export function listSportsAthletes() {
  return adminRpc('bbf_admin_list_sports_athletes', {});
}

// LIVE plan hydration (Centralization fix): the freshest meal_plan /
// workout_plan / sports_protocol + clinical intake (age · height/weight ·
// clinical history) for a client — bbf_users first, then the NEWEST
// bbf_active_clients mirror row (ordered join; the old unordered limit=1
// could hydrate the dossier from a stale intake row).
export function getLivePlans(id) {
  return adminRpc('bbf_admin_client_live_plans', { p_client_id: id });
}
