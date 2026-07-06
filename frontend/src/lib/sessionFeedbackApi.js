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
// 'none' = athlete has no pain/complaint — skips prehab queue, pain forced to 0.
export const TARGET_AREAS = ['none', 'shoulder', 'lower_body', 'knee', 'neck', 'upper_body', 'full_body'];

// Window CustomEvent the workout loggers (FloorLogger / SmartCardio) fire the
// moment a session is completed; the Vault shell listens and opens the check-in
// modal. Decoupled cross-tree signal (same pattern as PROTOCOL_UPDATED_EVENT).
export const SESSION_COMPLETE_EVENT = 'bbf:session-complete';

export async function submitSessionFeedback({ uid, painScore, rpeScore, targetArea } = {}) {
  const vaultToken = getStoredVaultToken();
  if (!vaultToken) {
    const e = new Error('Your session expired — sign in again to log your check-in.');
    e.code = 'no_session';
    throw e;
  }

  const area = TARGET_AREAS.includes(targetArea) ? targetArea : 'full_body';
  const isNone = area === 'none';
  // When no target area, pain is 0 (nothing to score). RPE is always required.
  const pain = isNone ? 0 : Number(painScore);
  const rpe = Number(rpeScore);
  if ((!isNone && (!Number.isFinite(pain) || pain < 1 || pain > 10)) || !Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
    const e = new Error('Pain and difficulty must each be between 1 and 10.');
    e.code = 'invalid_input';
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

  // ── STATE INVALIDATION ON THE 200 (architectural reconciliation) ──
  // Broadcast the saved symptom payload the instant the write commits, so every
  // subscribed surface — the Hub (useHubHydration), Prehab & Recovery
  // (useActiveSymptom), the readiness store — re-routes immediately with the
  // reported target_area, then reconciles via its own refetch. Without this the
  // check-in mutation fired into a black hole and the prescription surfaces kept
  // rendering their defaults until a full reload.
  try {
    window.dispatchEvent(new CustomEvent('bbf:protocol-updated', {
      detail: {
        source: 'post_workout_checkin',
        target_area: parsed.target_area || area,
        pain_score: pain,
        rpe_score: rpe,
        prehab_queued: parsed.prehab_queued === true,
      },
    }));
  } catch { /* no window (SSR) — non-fatal */ }

  return { ok: true, feedbackId: parsed.feedback_id || null, targetArea: parsed.target_area || area, prehabQueued: parsed.prehab_queued === true };
}
