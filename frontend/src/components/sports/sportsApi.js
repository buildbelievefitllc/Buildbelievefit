// src/components/sports/sportsApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Live data layer for the BBF Sports Portal & Athlete Database.
//
// Rides the session-authed bbf-admin-roster edge function (rosterCall already
// attaches the admin's X-BBF-Session-Token, so a logged-in Sovereign is authorized
// with no manual token). Two actions:
//   • sports_roster → the live youth-athlete records (bbf_athlete_progression ⋈
//                     bbf_users): { athletes:[{ id, user_id, name, uid, sport,
//                     position, phase, target_phase, mesocycle_week,
//                     rpe_avg_last_3, friction_avg_last_3, guardian_consent, … }] }
//   • sports_insert → guarded youth insert (guardian consent REQUIRED server-side).

import { rosterCall } from '../../lib/rosterApi.js';

// ─── Strict youth-roster isolation (Command Center · Sports Portal) ───────────────
// The Sports Portal is the YOUTH surface (BBF Athlete Portal). Its data table must
// render youth athletes ONLY — never adult lifestyle clients. The bbf-admin-roster
// `sports_roster` action joins bbf_athlete_progression ⋈ bbf_users, so any legacy
// adult client that happens to carry a progression row — e.g. the "Founder 5"
// (ana_bbf / jacky_bbf / jacque_bbf / jordan_bbf / wayne_bbf, all role:'client') —
// would otherwise BLEED into this view. We gate it here, at the single data funnel,
// so SportsPortal stays a pure renderer (no per-component filtering to drift).
//
// THE YOUTH FLAG — the YOUTH access group from lib/entitlements.js (TIER_TO_GROUP):
// the canonical Rising Athlete SKU + its legacy storefront equivalent. These are the
// ONLY subscription tiers that denote a youth athlete; every adult/legacy lifestyle
// tier — AND an empty/grandfathered (NULL) tier — is NOT youth and is excluded. (A
// "treat NULL as youth" shortcut would dangerously re-admit NULL-tier grandfathered
// legacy adults, so the gate is a strict allowlist, never a denylist.)
export const YOUTH_TIERS = new Set(['rising_athlete', 'youth_athlete']);

// True iff a roster row is a genuine youth athlete. Two positive signals, OR'd:
//   • a youth subscription tier (a paying Rising Athlete), OR
//   • role === 'athlete' — the identity the portal's OWN guarded inject path
//     (sports_insert) mints for a youth athlete with no subscription tier yet.
// An adult — standard client, legacy profile, or the Founder 5 (role:'client', adult
// or NULL tier) — satisfies NEITHER clause, so it is filtered out of this view.
//
// NOTE: `role` is not yet on the sports_roster wire payload (the edge function joins
// bbf_users.role but does not return it), so the role clause is forward-compatible —
// inert today, it lights up injected youth the moment the backend surfaces `role`.
// Until then a freshly-injected (tier-less) athlete must be assigned the
// rising_athlete tier to appear; tier gating alone already delivers the strict
// adult-exclusion this fix is for. Pure + null-safe.
export function isYouthAthlete(row) {
  if (!row || typeof row !== 'object') return false;
  if (String(row.role || '').trim().toLowerCase() === 'athlete') return true;
  return YOUTH_TIERS.has(String(row.subscription_tier || '').trim().toLowerCase());
}

export async function fetchSportsRoster() {
  const body = await rosterCall('sports_roster');
  const rows = Array.isArray(body.athletes) ? body.athletes : [];
  // Strict youth gate — adults (incl. the Founder 5) never reach the data table.
  return rows.filter(isYouthAthlete);
}

// Inject a real youth athlete. `guardianConsent` MUST be true — the edge function
// rejects the write otherwise (child-data protection). Resolves to the new athlete
// record; throws a display-ready Error on failure (guardian_consent_required, etc.).
export async function insertAthlete({ name, sport, position, phase = 'off', guardianConsent }) {
  const body = await rosterCall('sports_insert', {
    name: String(name || '').trim(),
    sport,
    position,
    phase,
    guardian_consent: guardianConsent === true,
  });
  return body.athlete;
}

// Friendlier copy for the coded server slugs the inject form can surface.
export function injectErrorMessage(e) {
  const m = String(e?.message || e);
  if (/guardian_consent_required/.test(m)) return 'Guardian consent is required to inject a youth athlete.';
  if (/missing_name/.test(m)) return 'Enter the athlete’s name.';
  if (/missing_sport/.test(m)) return 'Select a discipline (sport).';
  if (/missing_position/.test(m)) return 'Select a position.';
  return m;
}
