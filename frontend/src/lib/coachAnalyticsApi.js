// src/lib/coachAnalyticsApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 22.x — Coach analytics data layer (Terminal-5 backend contracts).
//
// Two SECURITY DEFINER RPCs, both gated by p_admin_pin → bbf_verify_admin_pin:
//   bbf_coach_client_analytics(p_admin_pin, p_uid, p_window_days=30)
//     → { ok, summary{...}, volume_series[], readiness_series[], session_frequency[] }
//   bbf_coach_body_composition(p_admin_pin, p_uid)
//     → { ok, series[], progression{first_pct,last_pct,delta_pct} }
// Unauthorized → { ok:false, error:'unauthorized', lockout_active, retry_after_seconds }.
// (Shapes verified live against prod before this was written.)
//
// SESSION PIN CACHE: the admin PIN is held in MODULE memory for the session so the
// coach types it once, then every window switch (30/60/90) and client swap reuses
// it — never re-prompted, never persisted to storage. Cleared on unauthorized or
// explicit clearAdminPin() (e.g. sign-out).

import { supabase } from './supabaseClient.js';

let _adminPin = null; // in-memory only — never localStorage

export const setAdminPin = (pin) => { _adminPin = (pin || '').trim() || null; };
export const getAdminPin = () => _adminPin;
export const hasAdminPin = () => !!_adminPin;
export const clearAdminPin = () => { _adminPin = null; };

// Shared error coder so the UI can branch: 'no_pin' | 'unauthorized' (with lockout
// fields) | 'not_found' | 'transport'. Never throws a raw Supabase error string.
function authError(data) {
  const e = new Error(data?.error === 'unauthorized' ? 'Admin PIN rejected.' : 'Request failed.');
  e.code = data?.error || 'error';
  e.lockoutActive = !!data?.lockout_active;
  e.retryAfter = Number(data?.retry_after_seconds || 0);
  return e;
}

async function callRpc(fn, args) {
  if (!_adminPin) {
    const e = new Error('Admin PIN required.'); e.code = 'no_pin'; throw e;
  }
  const { data, error } = await supabase.rpc(fn, { p_admin_pin: _adminPin, ...args });
  if (error) {
    const e = new Error(`Analytics unavailable — ${error.message || 'RPC error'}.`); e.code = 'transport'; throw e;
  }
  if (!data?.ok) {
    if (data?.error === 'unauthorized') {
      // A rejected PIN is stale — drop it so the gate returns instead of silently
      // retrying a bad credential on every window switch.
      clearAdminPin();
      throw authError(data);
    }
    const e = new Error(data?.error === 'user_not_found' ? 'Client not found.' : 'Analytics unavailable.');
    e.code = data?.error || 'error';
    throw e;
  }
  return data;
}

// 30/60/90-day training analytics for one client.
export function fetchClientAnalytics(uid, windowDays = 30) {
  return callRpc('bbf_coach_client_analytics', { p_uid: uid, p_window_days: windowDays });
}

// Body-composition series + progression for one client.
export function fetchBodyComposition(uid) {
  return callRpc('bbf_coach_body_composition', { p_uid: uid });
}
