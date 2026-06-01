// src/lib/personaResolver.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18.3 — Persona → program-key resolver (auth-payload layer).
//
// The legacy monolith maps each client to an authorized WP plan via a per-user
// `plan` key (bbf-app.html LP(): `WP[u.plan]`). That mapping is a CLIENT-SIDE
// seed (bbf-app.html:5834-5838 / 8465-8469) — there is NO persona/plan column on
// bbf_users, and `bbf_verify_user_pin` does not return one. So we resolve the
// program key in the auth layer, exactly as the monolith does, keyed off the
// login slug. Verified against prod: these are the live client uids.
//
//   ana_bbf    → ana_spring
//   jacky_bbf  → jacky_plan
//   jacque_bbf → jacque_plan
//   jordan_bbf → jordan_wayne
//   wayne_bbf  → jordan_wayne
//
// Unmapped accounts (new clients, test_bbf) resolve to null; ProgramGrid's
// getProgram() then falls back to DEFAULT_PROGRAM_KEY — no crash, no wrong-user
// data. When the PIN RPC eventually returns an explicit key, pass it as
// `explicitKey` and it wins (mirrors LP()'s "prefer seeded plan" precedence).

export const PERSONA_MAP = Object.freeze({
  ana_bbf: 'ana_spring',
  jacky_bbf: 'jacky_plan',
  jacque_bbf: 'jacque_plan',
  jordan_bbf: 'jordan_wayne',
  wayne_bbf: 'jordan_wayne',
});

// Returns the authorized WP key for a login slug, or null when unmapped.
// `explicitKey` (optional) — a key already on the session / auth payload; when
// present and non-empty it takes precedence over the slug map.
export function resolveProgramKey(slug, explicitKey) {
  if (typeof explicitKey === 'string' && explicitKey.trim()) {
    return explicitKey.trim();
  }
  const s = String(slug || '').trim().toLowerCase();
  return PERSONA_MAP[s] || null;
}
