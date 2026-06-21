// src/lib/athleteSyncApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Athlete Sync data layer — the secure bridge to the athlete's server-side record.
//
//   getAthleteSync()           → GET  bbf-athlete-sync → { ok, current_tier,
//                                blueprint, profile } (the authoritative tier + the
//                                last forged blueprint).
//   saveAthleteBlueprint(bp)   → POST bbf-athlete-sync → persists the blueprint to
//                                athlete_profiles. { ok, saved } | { ok:false,
//                                error:'no_profile' }.
//
// House convention (mirrors readinessApi / forecastApi): raw fetch to FUNCTIONS_BASE
// with the anon key (gateway routing) + the athlete's vault token on the header so
// the edge fn resolves identity server-side.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

function syncHeaders(token) {
  const h = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (token) h['x-bbf-vault-token'] = token;
  return h;
}

export async function getAthleteSync() {
  const token = getStoredVaultToken();
  if (!token) throw new Error('missing_session');
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-athlete-sync`, { method: 'GET', headers: syncHeaders(token) });
  if (!res.ok) {
    let slug = `athlete_sync_failed_${res.status}`;
    try { slug = (await res.json())?.error || slug; } catch { /* non-JSON */ }
    throw new Error(slug);
  }
  return res.json();
}

export async function saveAthleteBlueprint(blueprint) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('missing_session');
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-athlete-sync`, {
    method: 'POST',
    headers: syncHeaders(token),
    body: JSON.stringify({ blueprint }),
  });
  if (!res.ok) {
    let slug = `athlete_sync_save_failed_${res.status}`;
    try { slug = (await res.json())?.error || slug; } catch { /* non-JSON */ }
    throw new Error(slug);
  }
  return res.json();
}
