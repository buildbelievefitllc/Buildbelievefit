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
//   body:    { action, ...payload }
//     roster → { ok, count, clients:[…] }
//     detail → { ok, client:{…} }   ← keys on `id` (the bbf_users PK), NOT uid
//   401 unauthorized · 503 backend_unconfigured · 404 not_found · 500 server_error
//
// SILENT SESSION AUTH: bbf-admin-roster authorizes every action by the logged-in
// admin's session — NOT a manually-pasted/bundled secret. The anon key still rides
// in `apikey` to route the request through the gateway; the Authorization bearer
// carries the session's `vault_token` (minted at PIN login, persisted in the
// session), which the function verifies server-side and checks the admin/trainer
// role on (index.ts vaultTokenIsAdmin). No shared secret ever touches the client
// (CLAUDE.md §7); the legacy X-BBF-Admin-Token path stays for service-to-service.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Human-readable line for an HTTP status, so a surfaced error is precise rather
// than a bare code (parity with the monolith's _errMsg).
export function statusHint(status) {
  if (status === 400) return 'bad request (missing/invalid field)';
  if (status === 401) return 'unauthorized (session not cleared — sign in again)';
  if (status === 403) return 'gateway rejected the request (check anon apikey)';
  if (status === 404) return 'not found';
  if (status === 503) return 'backend not configured (missing secret)';
  return 'request failed';
}

// POST one action against bbf-admin-roster. Resolves to the parsed { ok:true, ... }
// body, or throws an Error whose message is already display-ready.
export async function rosterCall(action, payload = {}) {
  const headers = { 'Content-Type': 'application/json' };
  // `apikey` routes the request through the Supabase gateway; the Authorization
  // bearer is the SILENT credential — the session vault_token (falls back to the
  // anon key when no session, so a stale/absent session yields the function's clean
  // 401 rather than a gateway error).
  if (SUPABASE_ANON_KEY) headers.apikey = SUPABASE_ANON_KEY;
  const vaultToken = getStoredVaultToken();
  headers.Authorization = `Bearer ${vaultToken || SUPABASE_ANON_KEY}`;

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

// Max question length accepted by the coach action (mirrors index.ts).
export const COACH_MAX = 2000;

// Ask the Gemini Co-Coach about a client (keys on the `id` PK).
//
// ⚠️ WIRE-SHAPE (verified against bbf-admin-roster index.ts, NOT assumed):
//   • the edge function reads `question` — NOT `query`. We accept the caller's
//     `query` for ergonomics and map it to the `question` field on the wire.
//   • the answer text comes back in `answer` — NOT `response`.
// We mirror the server's empty/length guards so bad input fails fast.
//   → { ok:true, provider:'gemini', model, answer:"<text/markdown>",
//       telemetry:{ readiness:{checkins_90d,avg_score,last_score,trend_7d_vs_prior_7d},
//                   training:{days_logged_90d,last7_daily_volume} } }
export async function askCoCoach(id, query) {
  const question = String(query ?? '').trim();
  if (!question) {
    const e = new Error('Enter a question for the Co-Coach.');
    e.code = 'missing_question';
    throw e;
  }
  if (question.length > COACH_MAX) {
    const e = new Error(`Question too long — keep it under ${COACH_MAX.toLocaleString()} characters.`);
    e.code = 'question_too_long';
    throw e;
  }
  return rosterCall('coach', { id, question });
}

// ── Compile (regenerate) an athlete's AI performance plan ──────────────────────
// Cuisine styles the coach can bias a compiled plan toward. Kept here (not pulled
// from cuisineMeals.js) so the admin API module carries no UI dependency, and so
// the wire value the server folds into the generation prompt has a single owner.
export const CUISINE_STYLES = [
  { id: 'american', label: 'American' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'brazilian', label: 'Brazilian' },
];

// Recompile the athlete's nutrition schedule against the live orchestration
// engine. The browser NEVER holds the Render admin token (§7) — this relays
// through the admin gateway (anon-key pattern), and the edge function carries the
// secret server-side and forwards to Render's /api/rotate-nutrition.
//
// `opts.tdee_target` (optional) overrides the stored calorie target for THIS
// compile; blank/absent ⇒ the server uses the athlete's saved target. `opts.cuisine`
// is the style id from CUISINE_STYLES — the server folds it into the generation
// prompt so it genuinely steers meal selection.
//   → { ok:true, plan:{ name, cal, goal, days:[…] }, meta, persisted }
export async function compilePlan(id, opts = {}) {
  if (!id) {
    const e = new Error('Select an athlete before compiling a plan.');
    e.code = 'missing_id';
    throw e;
  }
  const payload = { id };
  const t = opts?.tdee_target;
  if (t !== undefined && t !== null && t !== '') {
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > TARGET_MAX) {
      const e = new Error(`Invalid calorie target: enter a number between 0 and ${TARGET_MAX.toLocaleString()}.`);
      e.code = 'invalid_value';
      throw e;
    }
    payload.tdee_target = Math.round(n);
  }
  const cuisine = String(opts?.cuisine ?? '').trim().toLowerCase();
  if (cuisine) payload.cuisine = cuisine;
  return rosterCall('compile', payload);
}
