// src/lib/seasonApi.js
// ─────────────────────────────────────────────────────────────────────────────
// SP-2 · Season Brain — client writer for the athlete's season calendar.
//
// bbf_set_my_season is token-gated (same security model as the youth intake /
// set-log writers: user resolved FROM the vault session, never the caller).
// The payload carries the season window, weekly practice load, and upcoming
// game dates — the deterministic calendar the Season Brain's weekly taper pass
// and the Hub's off/in-season default both read from.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

export async function setMySeason(uid, payload) {
  const token = getStoredVaultToken();
  if (!uid || !token) return { ok: false, error: 'no_session' };
  try {
    const { data, error } = await supabase.rpc('bbf_set_my_season', {
      p_uid: uid,
      p_session_token: token,
      p_payload: payload,
    });
    if (error) return { ok: false, error: error.message };
    return data ?? { ok: false, error: 'empty_response' };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
