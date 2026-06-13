// src/lib/sportsRoster.js
// ─────────────────────────────────────────────────────────────────────────────
// The Sports Hub division roster — client-side athlete seed + the Routing Fork
// predicate (Terminal Echo · youth/sports bring-up).
//
// Mirrors personaResolver.js EXACTLY in spirit: there is NO athlete/division
// column on bbf_users and `bbf_verify_user_pin` does not return one, so — just as
// the monolith seeds each client's program key CLIENT-SIDE — we seed the
// youth/sports DIVISION here, keyed off the login slug. A seeded athlete is
// "flagged": the post-login Routing Fork (Login.jsx + App.jsx) sends them PAST the
// adult Sovereign Vault straight into The Sports Hub (pages/SportsHub.jsx),
// isolating the youth surface from the adult lifestyle programming.
//
// FORWARD-COMPAT (clean retirement path): the moment `bbf_verify_user_pin` returns
// an explicit athlete payload — a `sportsProfile` object, or a `division: 'sports'`
// / `type: 'athlete'` flag — resolveSportsProfile() honors THAT first; the slug
// seed is only the fallback for today's mock/test athletes. So this file deletes
// cleanly when the column ships; the fork keeps working off the server flag.

export const SPORTS_HUB_PATH = '/sports-hub';
export const VAULT_PATH = '/vault';

// Default profile for an account the auth payload flags sports-division but that
// has no client seed yet (e.g. a future RPC-flagged athlete). Keeps the Hub
// renderable rather than crashing on a null profile.
const DEFAULT_SPORTS_PROFILE = Object.freeze({
  division: 'sports',
  athleteName: 'Athlete',
  age: null,
  gradeLevel: null,
  sport: 'Multi-Sport',
  sportId: 'football',
  position: '—',
  positionCode: 'OL',
  focusAreas: [],
  team: 'BBF Athlete Portal',
});

// MOCK TEST ATHLETE — Sports Hub bring-up fixture. A 15-year-old American Football
// lineman: the exact profile the Routing Fork is verified against. LOCAL-STATE
// ONLY — no production row, no elevated access (a plain youth client). `sportId` /
// `positionCode` align with sportsData.js (PORTAL_SPORTS + COMBINE_BENCHMARKS) so
// the Hub's combine targets resolve from the platform's real benchmark table.
export const SPORTS_ROSTER = Object.freeze({
  marcus_bbf: Object.freeze({
    division: 'sports',
    athleteName: 'Marcus Vance',
    jerseyNo: 76,
    age: 15,
    gradeLevel: 'Freshman',
    sport: 'American Football',
    sportId: 'football',
    position: 'Offensive Lineman',
    positionCode: 'OL',
    // The CEO directive for this athlete: positional growth, explosive power, size.
    focusAreas: Object.freeze(['Positional Growth', 'Explosive Power', 'Size & Mass']),
    team: 'BBF Athlete Portal · Trench Unit',
  }),
});

function flagSaysSports(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'sports' || v === 'athlete' || v === 'youth';
}

// Resolve a Sports Hub profile from a user-ish object, or null when the account is
// NOT a sports athlete. Precedence: explicit auth-payload profile → slug seed →
// division/type flag (→ default profile) → null. Pure; safe on null/partial input.
export function resolveSportsProfile(user) {
  if (!user || typeof user !== 'object') return null;
  const { username, id, sportsProfile, division, type, role } = user;
  // Future RPC payload wins outright (explicit > seed, same precedence as personaResolver).
  if (sportsProfile && typeof sportsProfile === 'object') return sportsProfile;
  const slug = String(username || id || '').trim().toLowerCase();
  if (slug && Object.prototype.hasOwnProperty.call(SPORTS_ROSTER, slug)) return SPORTS_ROSTER[slug];
  // SERVER FLAG (the documented retirement path, now live): the Sports Portal's
  // hardwire RPC (sports_insert) provisions athletes as bbf_users.role='athlete',
  // and bbf_verify_user_pin returns role in the login envelope — so role IS the
  // explicit server flag. Without this check a hardwired athlete kept routing to
  // the adult Vault (the admin wrote a flag the fork never read).
  if (flagSaysSports(division) || flagSaysSports(type) || flagSaysSports(role)) return DEFAULT_SPORTS_PROFILE;
  return null;
}

// The boolean the Routing Fork branches on.
export function isSportsAthlete(user) {
  return resolveSportsProfile(user) !== null;
}

// Single source of truth for the post-login fork target: the Sports Hub for a
// flagged athlete, else the adult Sovereign Vault. Login.jsx (fresh sign-in +
// returning session) and App.jsx (the /vault bypass guard) both route through this.
export function homePathForUser(user) {
  return isSportsAthlete(user) ? SPORTS_HUB_PATH : VAULT_PATH;
}
