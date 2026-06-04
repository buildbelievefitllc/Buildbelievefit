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
// ADMIN-TOKEN (RESTORED): bbf-admin-roster still gates EVERY action on the
// X-BBF-Admin-Token shared secret server-side (index.ts:223 compares it against
// BBF_COACH_AGENT_TOKEN → 401 otherwise). The earlier "zero-friction" change
// dropped the header from the browser but never relaxed the gate, so the roster
// 401'd ("unauthorized"). We re-attach the token, hydrated at runtime from the
// shared adminAuth store (window global / sessionStorage / the unlock gate) — it
// is NEVER bundled (CLAUDE.md §7). The anon/publishable key still rides along for
// gateway routing; the admin token is the authorization on top.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getCoachAdminToken } from './adminAuth.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Human-readable line for an HTTP status, so a surfaced error is precise rather
// than a bare code (parity with the monolith's _errMsg).
export function statusHint(status) {
  if (status === 400) return 'bad request (missing/invalid field)';
  if (status === 401) return 'unauthorized (admin token missing or rejected)';
  if (status === 403) return 'gateway rejected the request (check anon apikey)';
  if (status === 404) return 'not found';
  if (status === 503) return 'backend not configured (missing secret)';
  return 'request failed';
}

// POST one action against bbf-admin-roster via the standard anon-key pattern.
// Resolves to the parsed { ok:true, ... } body, or throws an Error whose message
// is already display-ready ("Error 401 — unauthorized (…).").
export async function rosterCall(action, payload = {}) {
  const headers = { 'Content-Type': 'application/json' };
  // Gateway routing headers — without these the request never reaches the
  // function (it 401s at the edge). The anon key is safe in the bundle.
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  // Admin authorization — the function's real security boundary, now DUAL:
  //   • the logged-in admin's SESSION token (the zero-friction path — the edge
  //     function validates it via _bbf_uid_from_vault_token + an admin-role check,
  //     so a Sovereign auto-unlocks every surface with no manual paste), AND/OR
  //   • the legacy shared secret, if a deploy injected one (kept for parity).
  // Neither is ever bundled (§7). The server authorizes if EITHER is valid-admin.
  const sessionToken = getStoredVaultToken();
  if (sessionToken) headers['X-BBF-Session-Token'] = sessionToken;
  const adminToken = getCoachAdminToken();
  if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;

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
  // Active UI language (LangContext) → relayed through bbf-admin-roster to
  // /api/rotate-nutrition so the regenerated plan is generated in the athlete's
  // language. Constrained to the supported set; omitted (server-defaults to en)
  // for anything else.
  const lang = String(opts?.lang ?? '').trim().toLowerCase().slice(0, 2);
  if (lang === 'es' || lang === 'pt') payload.lang = lang;
  return rosterCall('compile', payload);
}

// ── Executive Access Control (Command Center · Access Control tab) ──────────────
// Roster-derived account status → display label + brand-aligned accent. The server
// owns the derivation (bbf-admin-roster deriveAccountStatus); this is presentation
// only. Anything unrecognized renders as 'active' so a new server value never blanks
// a row.
export const ACCOUNT_STATUS_META = {
  active: { label: 'Active', color: 'var(--grn)' },
  delinquent: { label: 'Delinquent', color: 'var(--gold-deep)' },
  locked: { label: 'Locked', color: 'var(--red)' },
};
export function accountStatusMeta(status) {
  return ACCOUNT_STATUS_META[String(status || '').toLowerCase()] || ACCOUNT_STATUS_META.active;
}

// The pricing matrix (bbf_tiers) for the tier-reassignment dropdown.
//   → { ok:true, tiers:[{ slug, display_name, category, price_cents, billing_type }] }
export function fetchTiers() {
  return rosterCall('tiers');
}

// Manually reassign an athlete's subscription tier (comp / up / downgrade,
// bypassing Stripe). Keys on the uid slug. The server (bbf_admin_set_tier) owns the
// allowlist + the akeem-locked-to-sovereign guard, so a rejected change surfaces as
// a precise "Error 409 — … (akeem_locked_to_sovereign)." rather than failing silent.
//   → { ok:true, uid, subscription_tier }
export function reassignTier(uid, tier) {
  const slug = String(uid || '').trim().toLowerCase();
  const next = String(tier || '').trim().toLowerCase();
  if (!slug) {
    const e = new Error('Select an athlete before reassigning a tier.');
    e.code = 'missing_uid';
    throw e;
  }
  if (!next) {
    const e = new Error('Choose a tier to assign.');
    e.code = 'invalid_tier';
    throw e;
  }
  return rosterCall('set_tier', { uid: slug, tier: next });
}

// THE KILL SWITCH — lock or unlock an athlete's account. Locking sets
// access_status='locked' AND revokes every live vault_token server-side, so the
// athlete's Vault is ejected to the public login on its next heartbeat and a
// re-login is refused (bbf_verify_user_pin). akeem can never be locked.
//   status: 'locked' | 'unlocked'
//   → { ok:true, uid, access_status, sessions_revoked }
export function setAccessStatus(uid, status) {
  const slug = String(uid || '').trim().toLowerCase();
  const next = String(status || '').trim().toLowerCase();
  if (!slug) {
    const e = new Error('Select an athlete before changing account access.');
    e.code = 'missing_uid';
    throw e;
  }
  if (next !== 'locked' && next !== 'unlocked') {
    const e = new Error('Account status must be locked or unlocked.');
    e.code = 'invalid_status';
    throw e;
  }
  return rosterCall('set_status', { uid: slug, status: next });
}

// ── Assign a compiled Nutrition Locker protocol to an athlete's row ────────────
// Wire for the admin NUTRITION LOCKER (NutritionLocker.jsx). The locker compiles a
// 7-day diet protocol client-side from the Advanced Culinary Parameter Console, then
// pushes it here so it persists on the SELECTED athlete's database row.
//
// CONTRACT (server action `assign_nutrition`, owned + built in parallel by
// Terminal H). The browser NEVER holds the service-role key (§7) — this relays
// through the same token-gated admin gateway as every other roster action, and the
// edge function carries the secret server-side and writes the row. Until that action
// ships, the gateway returns 400 `unknown_action`, which rosterCall surfaces verbatim
// (the locker treats it as a non-fatal "endpoint provisioning" notice).
//
//   POST {FUNCTIONS_BASE}/bbf-admin-roster
//   body: { action:'assign_nutrition', id, plan, tdee_target?, diet_style?,
//           allergens?, fasting_window?, phase?, directive?, source }
//     • id             → bbf_users PK of the targeted scholar (REQUIRED)
//     • plan           → { name, cal, goal, fasting, fasting_hours, days:[{day,meals:[{m,i}]}] }
//                        (the same meal_plan JSON shape mealData.js consumes)
//     • tdee_target    → compiled Base Daily Energy Capacity (0..TARGET_MAX)
//     • diet_style     → DIET_STYLES id folded into the regime label
//     • allergens      → the Allergy Restrict Exemption string
//     • fasting_window → OPTIONAL time-restricted-feeding pace id ('off' | '12:12' |
//                        '14:10' | '16:8' | '18:6' | '20:4'). 'off'/absent ⇒ TRF is
//                        disabled — never assume 16/8 (CEO override).
//     • phase          → Athletic Phase Assignment (oversight console)
//     • directive      → Coach Directive Mandate free-text (oversight console)
//     • source         → 'scheduler' | 'oversight' (which surface pushed it)
//   → { ok:true, persisted?, ... }
export async function assignNutrition(id, payload = {}) {
  if (!id) {
    const e = new Error('Select a nutrition scholar before pushing a protocol.');
    e.code = 'missing_id';
    throw e;
  }
  const body = { id, source: payload.source || 'scheduler' };
  if (payload.plan) body.plan = payload.plan;
  if (payload.diet_style) body.diet_style = String(payload.diet_style);
  if (payload.allergens) body.allergens = String(payload.allergens);
  if (payload.fasting_window) body.fasting_window = String(payload.fasting_window);
  if (payload.phase) body.phase = String(payload.phase);
  if (payload.directive) body.directive = String(payload.directive).slice(0, COACH_MAX);

  const t = payload.tdee_target;
  if (t !== undefined && t !== null && t !== '') {
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > TARGET_MAX) {
      const e = new Error(`Invalid calorie target: enter a number between 0 and ${TARGET_MAX.toLocaleString()}.`);
      e.code = 'invalid_value';
      throw e;
    }
    body.tdee_target = Math.round(n);
  }
  return rosterCall('assign_nutrition', body);
}
