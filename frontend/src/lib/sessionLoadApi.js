// src/lib/sessionLoadApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Athlete-side session LOAD logger (Foster sRPE). Fronts the bbf-log-session edge
// function — the write side of the in-house ACWR engine. Same trust pattern as
// sessionFeedbackApi: the browser only holds a username slug + vault token, so the
// edge function resolves the real bbf_users UUID SERVER-SIDE and does the RLS-
// sealed insert into bbf_athlete_load_logs. We never send a raw athlete_id.
//
//   POST {FUNCTIONS_BASE}/bbf-log-session
//   body: { uid?, vault_token, duration_minutes, srpe_intensity, session_type? }
//   → 200 { ok, log_id, athlete_id, load_au, session_timestamp }

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Window CustomEvent fired the instant a session load commits — surfaces subscribe
// to refresh (parity with SESSION_COMPLETE_EVENT / bbf:protocol-updated).
export const SESSION_LOAD_LOGGED_EVENT = 'bbf:session-load-logged';

export async function submitSessionLoad({ uid, durationMinutes, srpeIntensity, sessionType } = {}) {
  const vaultToken = getStoredVaultToken();
  if (!vaultToken) {
    const e = new Error('Your session expired — sign in again to log your session.');
    e.code = 'no_session';
    throw e;
  }

  const duration = Math.round(Number(durationMinutes));
  const srpe = Math.round(Number(srpeIntensity));
  if (!Number.isFinite(duration) || duration < 1 || duration > 1440) {
    const e = new Error('Enter a session length between 1 and 1440 minutes.');
    e.code = 'invalid_duration';
    throw e;
  }
  if (!Number.isFinite(srpe) || srpe < 1 || srpe > 10) {
    const e = new Error('Rate your session intensity from 1 to 10.');
    e.code = 'invalid_srpe';
    throw e;
  }

  const headers = { 'Content-Type': 'application/json' };
  // Gateway routing — without the anon key the request 401s at the edge.
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-log-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uid: uid || '', // advisory only — the server resolves identity from the token
        vault_token: vaultToken,
        duration_minutes: duration,
        srpe_intensity: srpe,
        session_type: sessionType || 'sovereign_session',
      }),
    });
  } catch (err) {
    const e = new Error('Network unreachable — your session could not be saved.');
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
        ? 'Your session expired — sign in again to log your session.'
        : slug === 'invalid_duration'
          ? 'Enter a session length between 1 and 1440 minutes.'
          : slug === 'invalid_srpe'
            ? 'Rate your session intensity from 1 to 10.'
            : `Session could not be saved (${res.status}).`;
    const e = new Error(friendly);
    e.code = res.status;
    e.slug = slug;
    throw e;
  }

  // Broadcast so subscribed surfaces refresh (the coach roster's strain radar
  // reconciles on its own next pull).
  try {
    window.dispatchEvent(new CustomEvent(SESSION_LOAD_LOGGED_EVENT, {
      detail: { load_au: parsed.load_au, log_id: parsed.log_id, session_timestamp: parsed.session_timestamp },
    }));
  } catch { /* no window (SSR) — non-fatal */ }

  return { ok: true, logId: parsed.log_id || null, loadAu: parsed.load_au ?? (duration * srpe) };
}
