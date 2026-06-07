// src/lib/prehabApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21.9 — Dynamic Prehab Matrix client. Fronts the bbf-agentic-prehab edge
// function (the "Live Library Recovery Matrix" engine).
//
//   POST {FUNCTIONS_BASE}/bbf-agentic-prehab
//   headers: apikey + Authorization: Bearer <anon>  (gateway routing — no admin
//            token: this engine is a global core feature, callable by any tier)
//   body:    { uid, reported_friction, client_context: { today } }
//   → 200    { matrix: [ { name, duration, focus, reason } ] }  (always exactly 3)
//
// The engine never returns a client-facing error state — on any upstream failure
// it serves a safe baseline matrix at HTTP 200. We still surface a clean error if
// the gateway/auth itself rejects the call (non-2xx).

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Client-local YYYY-MM-DD so day_key prefix matching uses the athlete's timezone.
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Normalize one matrix entry to the render shape; drop anything malformed.
function normalizeMovement(m) {
  if (!m || typeof m !== 'object') return null;
  const name = String(m.name || '').trim();
  if (!name) return null;
  return {
    name,
    duration: String(m.duration || '').trim(),
    focus: String(m.focus || '').trim(),
    reason: String(m.reason || '').trim(),
  };
}

export async function requestPrehabMatrix({ uid, friction = '', today, adminOverride = false } = {}) {
  if (!uid) {
    const e = new Error('Sign in to run the Friction Scanner.');
    e.code = 'no_uid';
    throw e;
  }

  const headers = { 'Content-Type': 'application/json' };
  // Gateway routing — without the anon key the request 401s at the edge.
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const body = {
    uid,
    // vault_token binds the call to the athlete's session so the edge fn resolves
    // identity + enforces the tier gate (server entitlement-gate, fail-closed).
    vault_token: getStoredVaultToken(),
    reported_friction: typeof friction === 'string' ? friction : '',
    client_context: { today: today || localDateKey() },
  };
  if (adminOverride) body.admin_override = true;

  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-agentic-prehab`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    const e = new Error('Network unreachable — the Recovery Matrix engine could not be reached.');
    e.code = 'network';
    e.cause = err;
    throw e;
  }

  const raw = await res.text();
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }

  if (!res.ok) {
    const slug = parsed?.error || parsed?.detail || raw || 'unknown error';
    // Server entitlement-gate (fail-closed) → clean, on-brand messages.
    const friendly =
      slug === 'tier_not_entitled'
        ? 'The Recovery Matrix isn’t included in your current plan — upgrade to unlock it.'
        : (slug === 'invalid_session' || slug === 'missing_session')
          ? 'Your session expired — sign in again to run the Friction Scanner.'
          : slug === 'account_locked'
            ? 'This account is locked. Contact your coach.'
            : `Recovery Matrix engine returned ${res.status} (${slug}).`;
    const e = new Error(friendly);
    e.code = res.status;
    e.slug = slug;
    throw e;
  }

  const matrix = Array.isArray(parsed?.matrix) ? parsed.matrix : [];
  return matrix.map(normalizeMovement).filter(Boolean);
}
