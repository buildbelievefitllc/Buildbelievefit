// src/lib/rosterApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for talking to the bbf-admin-roster edge function.
//
// Why a shared module (not per-component fetch): the gateway-auth shape is the
// exact thing that broke the legacy monolith — omitting the anon apikey made the
// gateway 401 before the function ran. Keeping ONE call site means the Roster and
// the Dossier can never drift apart on it. (Mirrors the codebase's model-router
// ethos: one module, thin callers.)
//
// Contract (verified against supabase/functions/bbf-admin-roster/index.ts):
//   POST {FUNCTIONS_BASE}/bbf-admin-roster
//   headers: apikey + Authorization: Bearer <anon>   → gateway routing (REQUIRED
//            even with verify_jwt:false; the function 401s at the edge otherwise)
//            X-BBF-Admin-Token: <secret>             → the real authorization gate
//   body:    { action, ...payload }
//     roster → { ok, count, clients:[…] }
//     detail → { ok, client:{…} }   ← keys on `id` (the bbf_users PK), NOT uid
//   401 unauthorized · 503 backend_unconfigured · 404 not_found · 500 server_error
//
// SECURITY (CLAUDE.md §7): the admin token is a shared secret, NEVER bundled. It
// is entered at runtime and held in sessionStorage under the monolith's own key
// (BBF_COACH_AGENT_TOKEN) so the two surfaces share one convention.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';

const TOKEN_KEY = 'BBF_COACH_AGENT_TOKEN';

export const readToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
export const writeToken = (t) => {
  try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* storage blocked */ }
};
export const clearToken = () => {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
};

// Human-readable line for an HTTP status, so a surfaced error is precise rather
// than a bare code (parity with the monolith's _errMsg).
export function statusHint(status) {
  if (status === 400) return 'bad request (missing/invalid field)';
  if (status === 401) return 'admin token missing or mismatched';
  if (status === 403) return 'gateway rejected the request (check anon apikey)';
  if (status === 404) return 'not found';
  if (status === 503) return 'backend not configured (missing secret)';
  return 'request failed';
}

// POST one action against bbf-admin-roster with the full gateway + admin auth.
// Resolves to the parsed { ok:true, ... } body, or throws an Error whose message
// is already display-ready ("Error 401 — admin token missing or mismatched (…).").
export async function rosterCall(action, payload = {}) {
  const t = readToken();
  if (!t) {
    const e = new Error('Admin token required — authenticate to load data.');
    e.code = 'no_token';
    throw e;
  }

  const headers = { 'Content-Type': 'application/json', 'X-BBF-Admin-Token': t };
  // Gateway routing headers — without these the request never reaches the
  // function (it 401s at the edge). The anon key is safe in the bundle.
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(`${FUNCTIONS_BASE}/bbf-admin-roster`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });

  // Read the body once as text so the EXACT server string surfaces whether the
  // response is ok or an error envelope.
  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }

  if (!res.ok) {
    const slug = body?.detail || body?.error || raw || 'unknown error';
    throw new Error(`Error ${res.status} — ${statusHint(res.status)} (${slug}).`);
  }
  if (!body?.ok) {
    throw new Error(body?.error || body?.detail || 'Malformed response.');
  }
  return body;
}

// Normalise any thrown value into a display string. Our coded client-side errors
// (no_token / invalid_value / no_fields) already carry a friendly message; server
// errors carry their "Error NNN — …" prefix from rosterCall; anything else that
// threw before a status is a network/CORS failure.
export function toErrorMessage(e) {
  const msg = e?.message || String(e);
  if (e?.code) return msg;
  return /^Error /.test(msg) ? msg : `Network/CORS error — ${msg}.`;
}

// ── Action wrappers — thin, contract-documenting callers of rosterCall. ─────────

// The editable macro target fields and the server-side numeric cap. Mirrored from
// bbf-admin-roster update_target (index.ts) so client + server agree on bounds.
export const TARGET_FIELDS = ['tdee_target', 'macro_p', 'macro_c', 'macro_f'];
export const TARGET_MAX = 20000;

// 90-day analytics for a client (keys on the `id` PK).
//   → { ok:true, readiness:[{ score, sleep_quality, soreness_level, t }],
//                 volume:[{ date, volume }] }
export function fetchAnalytics(id) {
  return rosterCall('analytics', { id });
}

// Persist edited macro targets. `fields` is a subset of TARGET_FIELDS; empty /
// null / '' entries are skipped (treated as "leave unchanged"). We mirror the
// server guard (finite, 0..TARGET_MAX) so bad input fails fast without a round
// trip, and require at least one field (the server 400s with no_fields otherwise).
//   → { ok:true, client:{ id, tdee_target, macro_p, macro_c, macro_f } }  ← PARTIAL
//     row: merge it into existing detail state, never replace.
export async function updateTargets(id, fields) {
  const patch = {};
  for (const k of TARGET_FIELDS) {
    const v = fields?.[k];
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > TARGET_MAX) {
      const e = new Error(`Invalid ${k.replace('macro_', '').toUpperCase()}: enter a number between 0 and ${TARGET_MAX.toLocaleString()}.`);
      e.code = 'invalid_value';
      throw e;
    }
    patch[k] = Math.round(n);
  }
  if (!Object.keys(patch).length) {
    const e = new Error('No changes to save.');
    e.code = 'no_fields';
    throw e;
  }
  return rosterCall('update_target', { id, ...patch });
}
