// src/data/sportsVideoLibrary.js
// ─────────────────────────────────────────────────────────────────────────────
// BBF SPORTS HUB — genuine demonstration video library (schema 5.1).
//
// Ingests `bbfSportsHubVideoLibrary.json` (CEO-supplied) — VERIFIED, distinct,
// real YouTube tutorials per sport × language (no index-padding, no single-clip
// duplication). Covers Volleyball, Tennis, and Boxing/MMA (the source groups the
// combat disciplines under `boxing_multi`).
//
// These videos are surfaced through the LOCKED Drills tab: buildHubModel attaches
// one library clip per drill card as a trilingual { en, es, pt } id map, and
// VideoSlot resolves it to the athlete's active language at render (EN fallback).
// Card order stays language-stable (drill check-off persists by index), only the
// embedded clip localizes.

import RAW from './bbfSportsHubVideoLibrary.json';

// App sport id → source library key. The source groups boxing + MMA as boxing_multi.
const APP_TO_LIB = {
  volleyball: 'volleyball',
  tennis: 'tennis',
  boxing: 'boxing_multi',
  mma: 'boxing_multi',
  soccer: 'soccer',
  baseball: 'baseball',
};

// Normalized: { [libKey]: { en:[{id,title,description}], es:[...], pt:[...] } }
const LIBRARY = (() => {
  const out = {};
  for (const [key, d] of Object.entries(RAW.sports || {})) {
    const byLang = d.youtube_videos_by_language || {};
    out[key] = {};
    for (const lang of ['en', 'es', 'pt']) {
      out[key][lang] = (byLang[lang] || [])
        .map((v) => ({ id: v.video_id || '', title: v.title || '', description: v.description || '' }))
        .filter((v) => v.id);
    }
  }
  return out;
})();

// True when this sport has a genuine demonstration-video library.
export function hasVideoLibrary(sportId) {
  const key = APP_TO_LIB[sportId];
  return !!(key && LIBRARY[key]);
}

// Full per-language list for a sport ({ en:[…], es:[…], pt:[…] }) or null.
export function videoLibraryFor(sportId) {
  const key = APP_TO_LIB[sportId];
  return (key && LIBRARY[key]) || null;
}

// Trilingual { en, es, pt } YouTube-id map for the Nth drill card — each language
// cycles its OWN list independently (lengths differ by language), so every card
// gets a distinct, real, language-correct clip. Returns null when no library /
// no usable ids. Shaped for VideoSlot's localized videoId prop.
export function videoLibraryIdMap(sportId, index = 0) {
  const lib = videoLibraryFor(sportId);
  if (!lib) return null;
  const at = (arr) => (arr && arr.length ? arr[index % arr.length].id : '');
  const map = { en: at(lib.en), es: at(lib.es), pt: at(lib.pt) };
  // Guarantee an EN value so VideoSlot always has a fallback target.
  if (!map.en) map.en = map.es || map.pt || '';
  return map.en || map.es || map.pt ? map : null;
}
