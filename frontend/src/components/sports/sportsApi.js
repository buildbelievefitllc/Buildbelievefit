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

export async function fetchSportsRoster() {
  const body = await rosterCall('sports_roster');
  return Array.isArray(body.athletes) ? body.athletes : [];
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
