// src/lib/prescriptionApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Prescription reader client. Fronts the bbf-prescription-today edge function —
// the closing half of the Dynamic Prescription loop. Returns the athlete's latest
// ACTIVE playlist (their next prescribed recovery/prehab session) or null.
//
//   POST {FUNCTIONS_BASE}/bbf-prescription-today
//   headers: apikey + Authorization: Bearer <anon>   (gateway routing)
//   body:    { vault_token }
//   → 200    { ok, playlist | null }
//
// Like the check-in writer, identity is resolved SERVER-SIDE from the vault_token
// (active_playlists is RLS service-role-only; the browser has no bbf_users UUID).

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

export async function fetchTodaysPrescription() {
  const vaultToken = getStoredVaultToken();
  if (!vaultToken) {
    const e = new Error('Your session expired — sign in again.');
    e.code = 'no_session';
    throw e;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-prescription-today`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ vault_token: vaultToken }),
    });
  } catch (err) {
    const e = new Error('Network unreachable — could not load your prescription.');
    e.code = 'network';
    e.cause = err;
    throw e;
  }

  const raw = await res.text();
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }

  if (!res.ok || !parsed?.ok) {
    const slug = parsed?.error || parsed?.detail || raw || 'unknown_error';
    const friendly =
      (slug === 'invalid_session' || slug === 'missing_session')
        ? 'Your session expired — sign in again.'
        : `Could not load your prescription (${res.status}).`;
    const e = new Error(friendly);
    e.code = res.status;
    e.slug = slug;
    throw e;
  }

  return parsed.playlist || null;
}
