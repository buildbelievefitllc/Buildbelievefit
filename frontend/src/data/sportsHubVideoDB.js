// src/data/sportsHubVideoDB.js
// ─────────────────────────────────────────────────────────────────────────────
// BBF SPORTS HUB — INFINITE VIDEO DATABASE (bbf_sports_hub_unlimited) · ingestion
// pipeline + mapping API.
//
// Source: "BBF Sports Hub V5 Infinite Video Database Load" (CEO-supplied). That
// payload defines the production schema (metadata below) for 540 records
// (en/es/pt × volleyball/combat_sports/tennis × tutorial/match_highlights/
// championship_mindset) but ships only the 6 STRUCTURAL SAMPLE records seeded
// here — the full 195KB production file (EN-VB-001 … PT-TN-MIND-010) is delivered
// separately. See SPORTS_VIDEO_DB_STATUS.md for the data-gap report.
//
// ⚠ PLAYABILITY GUARD: the sample records carry PLACEHOLDER URLs
// (stream.bbfsports.com / assets.bbfsports.com) that do NOT resolve to a player.
// `isPlayable()` filters those out so the live UI (which already renders verified
// YouTube clips) NEVER shows a broken embed. When the production file lands with
// real URLs, the same mapping API surfaces them automatically — no code change.

export const VIDEO_DB_METADATA = {
  db_name: 'bbf_sports_hub_unlimited',
  version: '2.0.4',
  last_updated: '2024-05-22T08:15:00Z',
  total_records: 540,
  languages: ['en', 'es', 'pt'],
  sports: ['volleyball', 'combat_sports', 'tennis'],
  categories: ['tutorial', 'match_highlights', 'championship_mindset'],
};

// The 6 structural sample records, verbatim from the source payload. Placeholder
// URLs — retained for pipeline shape/parity, filtered from the UI by isPlayable().
export const VIDEO_DB_SAMPLES = [
  { id: 'EN-VB-001', language: 'en', sport: 'volleyball', category: 'tutorial', title: 'Mastering the Jump Serve: Part 1', duration: '08:45', thumbnail_url: 'https://assets.bbfsports.com/thumbnails/en_vb_001.jpg', video_url: 'https://stream.bbfsports.com/v/en_vb_001', tags: ['serving', 'fundamentals', 'advanced'] },
  { id: 'EN-VB-MIND-001', language: 'en', sport: 'volleyball', category: 'championship_mindset', title: 'The Psychology of the Final Set', duration: '12:20', thumbnail_url: 'https://assets.bbfsports.com/thumbnails/en_vb_m_001.jpg', video_url: 'https://stream.bbfsports.com/v/en_vb_m_001', tags: ['mindset', 'clutch', 'focus'] },
  { id: 'ES-CS-001', language: 'es', sport: 'combat_sports', category: 'tutorial', title: 'Técnicas de Boxeo: El Jab Perfecto', duration: '06:30', thumbnail_url: 'https://assets.bbfsports.com/thumbnails/es_cs_001.jpg', video_url: 'https://stream.bbfsports.com/v/es_cs_001', tags: ['boxeo', 'técnica', 'jab'] },
  { id: 'ES-CS-MIND-001', language: 'es', sport: 'combat_sports', category: 'championship_mindset', title: 'Mentalidad de Guerrero: Disciplina y Rigor', duration: '15:10', thumbnail_url: 'https://assets.bbfsports.com/thumbnails/es_cs_m_001.jpg', video_url: 'https://stream.bbfsports.com/v/es_cs_m_001', tags: ['mentalidad', 'disciplina', 'combate'] },
  { id: 'PT-TN-001', language: 'pt', sport: 'tennis', category: 'match_highlights', title: 'Melhores Momentos: Open do Brasil', duration: '10:00', thumbnail_url: 'https://assets.bbfsports.com/thumbnails/pt_tn_001.jpg', video_url: 'https://stream.bbfsports.com/v/pt_tn_001', tags: ['tênis', 'highlights', 'brasil'] },
  { id: 'PT-TN-MIND-001', language: 'pt', sport: 'tennis', category: 'championship_mindset', title: 'Resiliência em Quadra: A Mente de um Campeão', duration: '11:45', thumbnail_url: 'https://assets.bbfsports.com/thumbnails/pt_tn_m_001.jpg', video_url: 'https://stream.bbfsports.com/v/pt_tn_m_001', tags: ['mentalidade', 'resiliência', 'campeão'] },
];

// The live record set. Today this is the sample seed; when the production file is
// supplied, replace/extend this export (or import the JSON) and the whole mapping
// API below picks it up unchanged.
export const VIDEO_DB_RECORDS = VIDEO_DB_SAMPLES;

// Hosts that are structural placeholders (not real players).
const PLACEHOLDER_HOSTS = ['stream.bbfsports.com', 'assets.bbfsports.com'];

// A record is playable only when its video_url is a real, embeddable source —
// never a placeholder host. Keeps broken embeds out of the live UI.
export function isPlayable(rec) {
  const u = String(rec?.video_url || '');
  if (!u) return false;
  if (PLACEHOLDER_HOSTS.some((h) => u.includes(h))) return false;
  return /(?:youtube\.com|youtu\.be|vimeo\.com)\//i.test(u) || /\.(?:mp4|webm|m3u8)(?:$|\?)/i.test(u);
}

// Hub sportId → video-DB sport key. The DB groups boxing + MMA under combat_sports.
export function videoSportKey(sportId) {
  const s = String(sportId || '').toLowerCase();
  if (s === 'boxing' || s === 'mma' || s === 'multi') return 'combat_sports';
  if (s === 'volleyball') return 'volleyball';
  if (s === 'tennis') return 'tennis';
  return s; // unknown sports pass through (no match → empty result)
}

// Core query: filter records by sport / category / language. `playableOnly`
// (default true) drops placeholder records so callers can wire results straight
// into the UI safely.
export function queryVideos({ sport, category, language, playableOnly = true } = {}) {
  const sportKey = sport ? videoSportKey(sport) : null;
  return VIDEO_DB_RECORDS.filter((r) => {
    if (sportKey && r.sport !== sportKey) return false;
    if (category && r.category !== category) return false;
    if (language && r.language !== language) return false;
    if (playableOnly && !isPlayable(r)) return false;
    return true;
  });
}

// championship_mindset → Champion Mindset tab.
export function championshipMindsetVideos(sport, language, opts = {}) {
  return queryVideos({ sport, category: 'championship_mindset', language, ...opts });
}

// tutorial → interactive cards in Drills / Exercises.
export function tutorialVideos(sport, language, opts = {}) {
  return queryVideos({ sport, category: 'tutorial', language, ...opts });
}

// Diagnostics for the data-gap report / admin tooling: how many records loaded vs
// the schema's promised total, and how many are actually playable today.
export function videoDbStatus() {
  const loaded = VIDEO_DB_RECORDS.length;
  const playable = VIDEO_DB_RECORDS.filter(isPlayable).length;
  return {
    expected: VIDEO_DB_METADATA.total_records,
    loaded,
    playable,
    placeholders: loaded - playable,
    complete: loaded >= VIDEO_DB_METADATA.total_records && playable === loaded,
  };
}
