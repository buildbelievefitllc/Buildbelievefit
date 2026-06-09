// src/components/sportshub/sportsVideos.js
// ─────────────────────────────────────────────────────────────────────────────
// Demonstration-video resolver for the Sports Hub daily protocol (DayProtocol
// workout/drills + the Native Sport Engine SportProtocol blocks).
//
// STRICT ACCURACY (CEO order — "The Bell Maneuver"): every entry is an EXACT,
// movement-specific YouTube tutorial sourced via a web-search sweep of each drill in
// the engine (sportsEngine.js) + hub (hubData.js). NO generic category fallback — a
// "Box Jump" must show a box-jump video, never a hip-thrust. A drill with no verified
// 1-to-1 clip resolves to null, and the renderer shows a clean text-only row.
//
// SPORT_VIDEO_MAP is keyed by a normalized drill name (lowercase, parentheticals and
// punctuation stripped) so phase/variant suffixes collapse onto one clip
// (e.g. "Box Jump (low box)" and "Box Jump" → the same key). IDs are flat YouTube ids
// (EN demonstration); VideoSlot still honors the language toggle (same clip per lang).
//
// DECOUPLED FROM THE VAULT MAP: gym lifts (Front Squat, RDL, Bench, Pull-Up, Walking
// Lunge…) still resolve through exerciseVideos.resolveVideoEntry (authorized + localized);
// this map only adds the sport-specific drills, so it never widens the Vault generator's
// allow-list.

import { resolveVideoEntry } from '../vault/exerciseVideos.js';

// Normalize a drill name → match key. Drops "(low box)", "(30m)", dashes, slashes, etc.
function norm(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')   // strip parentheticals
    .replace(/[^a-z0-9]+/g, ' ')  // punctuation / dashes / slashes → space
    .replace(/\s+/g, ' ')
    .trim();
}

// Web-sourced, movement-specific YouTube demonstration ids (verified via search sweep).
const SPORT_VIDEO_MAP = {
  // ── Plyometrics & power ──
  'box jump': 'G-bxQY57mKc',
  'broad jump': 'z1IDJMMg024',
  'broad jump to sprint': 'z1IDJMMg024',
  'depth jump': 'bMHL5xqKn3E',
  'single leg bound': 'oEQVVlMR-iU',
  'plyometric bounds': 'oEQVVlMR-iU',
  'lateral bound stick': 'b7OCZJPSJnQ',
  'med ball chest pass': 'pJ8amgzbZMM',
  'med ball rotational throw': 'DttZ5JU-b_U',
  'rotational med ball series': 'DttZ5JU-b_U',
  'rotational power throws': 'DttZ5JU-b_U',
  'trap bar jump': 'rZGkx5PaZSM',
  'hang clean': 'jpXqVba1mFo',
  'push press': 'Hqxjk5Z35SM',
  // ── Strength & core ──
  'back squat': 'CWl0apMgshk',
  'trap bar deadlift': 'VdTwE_pOKrg',
  'pallof press': 'dBAmQ9bx3JA',
  'anti rotation core circuit': 'dBAmQ9bx3JA',
  'loaded carries': 'lLAw6fUccKA',
  // ── Speed ──
  'acceleration sprints': 'FfuHfASyqkg',
  'acceleration mechanics': 'FfuHfASyqkg',
  'sprint intervals': 'FfuHfASyqkg',
  'repeat sprint conditioning': 'FfuHfASyqkg',
  'max velocity sprints': 'TOzj49VSl4Y',
  'max velocity fly 30s': 'wb5S5CJFUd0',
  'flying 20s': 'wb5S5CJFUd0',
  'wicket runs': 'GvRQ4YblhzM',
  'a skip b skip': 'rWZdDUGFjoI',
  'block starts': 'xXqGZamvZjw',
  'tempo runs': 'k5vqiyry2z8',
  // ── Agility / change of direction ──
  '5 10 5 pro agility': 'tYhCJd7LaBU',
  '5 10 5 pro shuttle': 'tYhCJd7LaBU',
  't drill': '1UOP7h0eH_8',
  'l drill': '_KtUvR2zcNU',
  'ladder icky shuffle': '9PDkdZD2eWA',
  'ladder two foot runs': '9PDkdZD2eWA',
  'agility ladder': '9PDkdZD2eWA',
  'lateral shuffle': 'FvykRh7kTN8',
  'reactive shuffle': 'FvykRh7kTN8',
  'crossover go': 'hL8fXalR_GY',
  'change of direction': 'hL8fXalR_GY',
  '1v1 change of direction': 'hL8fXalR_GY',
  // ── Basketball skill ──
  'defensive slide series': 'g3VcA1cc0d8',
  'form shooting footwork': '0L9Cy8tsOsA',
  'closeout live mirror': 'Bi8AyY5ufI0',
  'closeout slide': 'Bi8AyY5ufI0',
  'finishing off two feet': '37kSmm5BvXU',
  'finishing package': '37kSmm5BvXU',
  'catch and shoot form': 'tI0WKKxoleI',
  // ── Soccer skill ──
  'cone dribbling gates': 'Zu4pDph4DZc',
  'first touch wall series': 'wplJAHhkE1A',
  'first touch receiving': 'wplJAHhkE1A',
  // ── Baseball skill ──
  'throwing mechanics': 'o3Qz0LtQZ_I',
  'swing path': 'bcw45s0n7tc',
  // ── Volleyball skill ──
  'approach timing': 'mlMaDL-mDJg',
  'block footwork': 'amVtOHl4TAk',
  // ── Football skill ──
  'backpedal break': '86gU0dP5Jn4',
  'kick slide pass set': 'W8wRxKHCgvc',
};

// Resolve a drill/exercise NAME to an EXACT, verified video id, or null.
//   1. sport-drill map (web-sourced, movement-specific)
//   2. authorized Vault lift map (resolveVideoEntry — localized gym lifts)
//   3. null → renderer shows a clean text-only row (no inaccurate stand-in)
export function resolveAthleticVideo(name) {
  const hit = SPORT_VIDEO_MAP[norm(name)];
  if (hit) return hit;
  return resolveVideoEntry(name) || null;
}
