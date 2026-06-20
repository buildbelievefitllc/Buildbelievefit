// src/lib/sessionFeedbackApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Post-Workout Check-In client. Fronts the bbf-prescription-checkin edge function
// — the entry point of the Dynamic Prescription closed loop.
//
//   POST {FUNCTIONS_BASE}/bbf-prescription-checkin
//   headers: apikey + Authorization: Bearer <anon>   (gateway routing)
//   body:    { uid, vault_token, pain_score, rpe_score, target_area }
//   → 200    { ok, feedback_id, user_id, target_area }
//
// WHY NOT a direct `supabase.from('session_feedback').insert(...)`: that table is
// RLS service-role-only, and the browser only holds a username slug + vault_token
// (never the bbf_users UUID). The edge function resolves the real UUID SERVER-SIDE
// from the vault_token and does the privileged write — which fires the DB tripwire
// that generates the athlete's next-day playlist. Same pattern as prehabApi.js.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Canonical body_part values (must match clinical_exercises.body_part / the engine).
export const TARGET_AREAS = ['shoulder', 'lower_body', 'knee', 'neck', 'upper_body', 'full_body'];

export async function submitSessionFeedback({ uid, painScore, rpeScore, targetArea } = {}) {
  const vaultToken = getStoredVaultToken();
  if (!vaultToken) {
    const e = new Error('Your session expired — sign in again to log your check-in.');
    e.code = 'no_session';
    throw e;
  }

  const pain = Number(painScore);
  const rpe = Number(rpeScore);
  if (!Number.isFinite(pain) || pain < 1 || pain > 10 || !Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
    const e = new Error('Pain and difficulty must each be between 1 and 10.');
    e.code = 'invalid_input';
    throw e;
  }
  const area = TARGET_AREAS.includes(targetArea) ? targetArea : 'full_body';

  const headers = { 'Content-Type': 'application/json' };
  // Gateway routing — without the anon key the request 401s at the edge.
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-prescription-checkin`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        // uid is advisory only — the server resolves identity from vault_token.
        uid: uid || '',
        vault_token: vaultToken,
        pain_score: pain,
        rpe_score: rpe,
        target_area: area,
      }),
    });
  } catch (err) {
    const e = new Error('Network unreachable — your check-in could not be saved.');
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
        ? 'Your session expired — sign in again to log your check-in.'
        : (slug === 'scores_out_of_range' || slug === 'missing_scores')
          ? 'Pain and difficulty must each be between 1 and 10.'
          : `Check-in could not be saved (${res.status}).`;
    const e = new Error(friendly);
    e.code = res.status;
    e.slug = slug;
    throw e;
  }

  return { ok: true, feedbackId: parsed.feedback_id || null, targetArea: parsed.target_area || area };
}
