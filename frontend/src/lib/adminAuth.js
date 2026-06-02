// src/lib/adminAuth.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign admin-token store for the Command Center — the runtime credential the
// privileged coach surfaces replay as the `X-BBF-Admin-Token` header.
//
// WHY THIS EXISTS (the 401 fix): the roster (bbf-admin-roster) and Comlink
// (Render /api/leads-list · /api/concierge-log) endpoints STILL gate every request
// on a shared-secret admin token server-side — verified in
// supabase/functions/bbf-admin-roster/index.ts:223 (compares BBF_COACH_AGENT_TOKEN)
// and index.js leads/concierge handlers (compare BBF_ADMIN_TOKEN). The earlier
// "zero-friction" change (commit 088c7d8) stripped the token from the browser but
// left those server gates intact → every coach surface 401'd. This restores the
// live monolith's proven hydration (bbf-app.html `_adminToken()`):
//
//   resolution order:  in-memory  →  window.BBF_* runtime global  →  sessionStorage
//
// SECURITY (CLAUDE.md §7 — "no exposed credentials in client bundles"): the secret
// is NEVER built into the bundle. It is either injected at runtime (a window global
// from a non-committed env.js, exactly like the monolith) or typed once by the CEO
// into the unlock gate and cached in sessionStorage for the tab session only —
// never localStorage, never source. `clearAdminToken()` wipes it on sign-out.
//
// TWO TOKENS: the Supabase edge gate compares BBF_COACH_AGENT_TOKEN; the Render
// gate compares BBF_ADMIN_TOKEN. They may be one shared secret or two distinct
// ones, so we key them separately. The unlock gate sets both from a single value
// (the common case) or each independently; a deploy can also inject distinct
// window globals. We reuse the monolith's exact sessionStorage keys, so a token
// already cached by the legacy app in the same browser session is picked up here.

const SS_COACH = 'BBF_COACH_AGENT_TOKEN'; // Supabase bbf-admin-roster gate (roster, analytics roster, co-coach)
const SS_RENDER = 'BBF_ADMIN_TOKEN'; // Render leads-list / concierge-log gate (Comlink)

// In-memory wins (set by the unlock gate this session). null ⇒ fall through to the
// runtime global, then the session cache.
let _coach = null;
let _render = null;

function fromWindow(key) {
  try {
    return typeof window !== 'undefined' && window[key] ? String(window[key]) : '';
  } catch {
    return '';
  }
}

function fromSession(key) {
  try {
    return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) || '';
  } catch {
    return '';
  }
}

// Resolved Supabase admin token (bbf-admin-roster). Memory → window global → session.
export function getCoachAdminToken() {
  return _coach || fromWindow(SS_COACH) || fromSession(SS_COACH) || '';
}

// Resolved Render admin token (Comlink). Memory → window global → session.
export function getRenderAdminToken() {
  return _render || fromWindow(SS_RENDER) || fromSession(SS_RENDER) || '';
}

// True once at least one surface can authenticate. The unlock gate sets BOTH from a
// single entry, so one unlock hydrates every gated surface for the session.
export function hasAdminToken() {
  return !!getCoachAdminToken() || !!getRenderAdminToken();
}

// Persist the typed token(s) for the tab session. `render` defaults to `coach` when
// omitted (the common single-secret deploy). Never touches localStorage (§7).
export function setAdminToken(coach, render) {
  const c = String(coach || '').trim();
  const r = String(render ?? coach ?? '').trim();
  _coach = c || null;
  _render = r || null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (c) sessionStorage.setItem(SS_COACH, c);
      else sessionStorage.removeItem(SS_COACH);
      if (r) sessionStorage.setItem(SS_RENDER, r);
      else sessionStorage.removeItem(SS_RENDER);
    }
  } catch {
    /* private-mode / quota — the token stays in memory for this tab */
  }
}

// Wipe everywhere on sign-out so the next user of the tab can't replay the secret.
export function clearAdminToken() {
  _coach = null;
  _render = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SS_COACH);
      sessionStorage.removeItem(SS_RENDER);
    }
  } catch {
    /* ignore */
  }
}
