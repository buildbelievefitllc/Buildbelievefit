// src/data/sportsExpandedLogic.js
// ─────────────────────────────────────────────────────────────────────────────
// BBF SPORTS HUB — CORE EXPANSION · structured logic ingestion (production source).
//
// Ingests the CEO-supplied production payload `bbfSportsHubProduction.json`
// (schema 4.1) into the normalized ENGINE DATA LAYER the locked Hub tabs + Champion
// Mindset deck read from. Source data is FULLY TRILINGUAL (en/es/pt) and carries
// REAL, distinct YouTube URLs per sport (tutorials + championship mindset).
//
// Normalization applied here (raw JSON stays pristine + auditable):
//   • tier  middle_school/high_school → middle/high  (+ gender-aware tierLabel)
//   • trilingual { en, es, pt } maps; tolerates the source 'description_en_es' typo
//   • sport key  track_and_field → track  (matches the app's sport ids)
//
// ⚠ IMMUTABLE LAW ENFORCED AT INGESTION: the source Volleyball Off-Season block still
// lists "Barbell Back Squats" — a BANNED movement. `normalizeRegimen` substitutes it
// with a compliant Trap-Bar Squat (same max-power/structural stimulus, spine-safe load
// path) and flags `substituted` / `original` / `reason`. No back squat ships, ever.

import RAW from './bbfSportsHubProduction.json';

const TIER_ID = { youth: 'youth', middle_school: 'middle', high_school: 'high' };
const TIER_NAME = { youth: 'Youth', middle: 'Middle School', high: 'High School' };
const GENDER_SUFFIX = { coed: 'Coed', female: 'F', male: 'M' };
// Source sport key → app sport id.
const SPORT_KEY = { volleyball: 'volleyball', softball: 'softball', track_and_field: 'track', boxing: 'boxing', mma: 'mma' };

export const TIER_LABELS = {
  youth: { en: 'Youth', es: 'Juvenil', pt: 'Juvenil' },
  middle: { en: 'Middle School', es: 'Escuela Intermedia', pt: 'Ensino Fundamental' },
  high: { en: 'High School', es: 'Escuela Secundaria', pt: 'Ensino Médio' },
};
export const CATEGORY_LABELS = {
  technical: { en: 'Technical', es: 'Técnico', pt: 'Técnico' },
  physical: { en: 'Physical', es: 'Físico', pt: 'Físico' },
  mental: { en: 'Mental', es: 'Mental', pt: 'Mental' },
};

// Localized string from a { en, es?, pt? } map with EN fallback.
export function pick(map, lang) {
  if (!map) return '';
  return map[lang] || map.en || '';
}

function ytid(url) {
  const m = String(url || '').match(/[?&]v=([A-Za-z0-9_-]{11})/) || String(url || '').match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

// Trilingual map from a record's `${base}_en|es|pt` fields. Tolerates the source's
// `description_en_es` typo (treats it as the ES value when `_es` is absent).
function tri(rec, base) {
  return {
    en: rec[`${base}_en`] || '',
    es: rec[`${base}_es`] || rec[`${base}_en_es`] || '',
    pt: rec[`${base}_pt`] || '',
  };
}

function tierLabelOf(tier, gender) {
  return `${TIER_NAME[tier] || tier} (${GENDER_SUFFIX[gender] || 'Coed'})`;
}

// Immutable-Law guard: substitute any banned barbell back squat with a compliant
// trap-bar squat, preserving the prescription and flagging the swap.
const BANNED_SQUAT = /barbell\s+back\s+squat/i;
function normalizeRegimen(r) {
  const base = { name: r.exercise, sets: r.sets, reps: r.reps, tempo: r.tempo, focus: r.focus };
  if (BANNED_SQUAT.test(r.exercise || '')) {
    return {
      ...base,
      name: 'Trap-Bar Squats',
      substituted: true,
      original: r.exercise,
      reason: 'BBF Immutable Law — no barbell back squat; trap-bar squat delivers the same max-power / structural stimulus on a spine-safe load path.',
    };
  }
  return base;
}

function buildLogic() {
  const out = {};
  for (const [rawKey, d] of Object.entries(RAW.sports || {})) {
    const key = SPORT_KEY[rawKey] || rawKey;
    out[key] = {
      milestones: (d.milestones || []).map((m) => ({
        tier: TIER_ID[m.tier] || m.tier,
        tierLabel: tierLabelOf(TIER_ID[m.tier] || m.tier, m.gender),
        gender: m.gender,
        category: String(m.category || '').toLowerCase(),
        title: tri(m, 'title'),
        detail: tri(m, 'description'),
        target: m.required_reps,
      })),
      drills: (d.drills || []).map((dr) => ({
        tier: TIER_ID[dr.tier] || dr.tier,
        tierLabel: tierLabelOf(TIER_ID[dr.tier] || dr.tier, dr.gender),
        gender: dr.gender,
        title: tri(dr, 'title'),
        description: tri(dr, 'description'),
        volume: dr.reps_sets_or_duration,
      })),
      regimens: {
        inSeason: (d.exercise_regimens?.in_season || []).map(normalizeRegimen),
        offSeason: (d.exercise_regimens?.off_season || []).map(normalizeRegimen),
      },
      // Real, distinct demonstration tutorials (YouTube) for this discipline.
      tutorials: (d.youtube_videos || [])
        .map((v) => ({ title: tri(v, 'title'), url: v.url, ytid: ytid(v.url) }))
        .filter((v) => v.ytid),
      // Real championship-mindset films (YouTube) — feed the Champion Mindset deck.
      championshipMindset: (d.championship_mindset || [])
        .map((v) => ({ title: tri(v, 'title'), description: tri(v, 'description'), url: v.url, ytid: ytid(v.url) }))
        .filter((v) => v.ytid),
    };
  }
  return out;
}

export const SPORTS_EXPANDED_LOGIC = buildLogic();

// The disciplines this expansion pack covers (intake + engine target set).
export const EXPANDED_SPORT_IDS = Object.keys(SPORTS_EXPANDED_LOGIC);

// Build Drills-tab cards ({ name, detail, reps, videoId? }) for a sport. Explicit
// Training Drills first — each carries its real tutorial video where available —
// then Technical/Physical milestones as actionable skill drills. English-or-lang
// taxonomy so resolveAthleticVideo can still match verified clips for the rest.
export function expandedDrillCards(sportId, lang = 'en') {
  const sport = SPORTS_EXPANDED_LOGIC[sportId];
  if (!sport) return [];
  const tutorials = sport.tutorials || [];
  const fromDrills = (sport.drills || []).map((d, i) => ({
    name: pick(d.title, lang),
    detail: pick(d.description, lang),
    reps: d.volume,
    videoId: tutorials[i]?.ytid || tutorials[0]?.ytid || undefined,
  }));
  const fromMilestones = (sport.milestones || [])
    .filter((m) => m.category === 'technical' || m.category === 'physical')
    .map((m) => ({
      name: pick(m.title, lang),
      detail: pick(m.detail, lang),
      reps: m.target,
    }));
  return [...fromDrills, ...fromMilestones];
}

// Flat seasonal regimen list ({ name, sets, reps, tempo?, focus, ... }) for a sport.
export function expandedRegimens(sportId, season) {
  const sport = SPORTS_EXPANDED_LOGIC[sportId];
  if (!sport) return [];
  return (season === 'inseason' ? sport.regimens?.inSeason : sport.regimens?.offSeason) || [];
}

// Real championship-mindset films for a sport, shaped for the YouTube deck
// ({ title, id }). Falls back to EN title; always a real, playable YouTube id.
export function expandedMindsetVideos(sportId, lang = 'en') {
  const sport = SPORTS_EXPANDED_LOGIC[sportId];
  if (!sport) return [];
  return (sport.championshipMindset || []).map((v) => ({ title: pick(v.title, lang), id: v.ytid })).filter((v) => v.id);
}

// Real demonstration tutorials for a sport ({ title, id }).
export function expandedTutorialVideos(sportId, lang = 'en') {
  const sport = SPORTS_EXPANDED_LOGIC[sportId];
  if (!sport) return [];
  return (sport.tutorials || []).map((v) => ({ title: pick(v.title, lang), id: v.ytid })).filter((v) => v.id);
}
