// src/lib/languageLabApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Language Lab write/read layer — the three Mastery Views' vault-token RPCs
// (finalized in the Language Mastery engine migration):
//   bbf_log_language_attempt     — append-only session ledger + streak/EWMA loop
//   bbf_save_pimsleur_checkpoint — Audio Dojo resume tracker
//   bbf_get_language_dashboard   — one-read profile + checkpoint hydration
// Same non-throwing contract as useVocabGym's shim: no session → resolved no-op.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

async function rpc(fn, args) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session' };
  try {
    const { data, error } = await supabase.rpc(fn, { p_session_token: token, ...args });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false, error: 'empty' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

export function logLanguageAttempt({ language, module, itemsTotal = 0, itemsCorrect = 0, fluencyScore = null, durationS = null, items = [] }) {
  return rpc('bbf_log_language_attempt', {
    p_language: language, p_module: module,
    p_items_total: itemsTotal, p_items_correct: itemsCorrect,
    p_fluency_score: fluencyScore, p_duration_s: durationS,
    p_items: items,
  });
}

export function savePimsleurCheckpoint({ language, lesson, fragmentSeq = 0, positionMs = 0, listenedMs = 0, status = 'in_progress' }) {
  return rpc('bbf_save_pimsleur_checkpoint', {
    p_language: language, p_lesson: lesson,
    p_fragment_seq: fragmentSeq, p_position_ms: positionMs,
    p_listened_ms: listenedMs, p_status: status,
  });
}

export function getLanguageDashboard(language) {
  return rpc('bbf_get_language_dashboard', { p_language: language });
}

// ── Curriculum Engine (Guided Track) ─────────────────────────────────────────
//   bbf_get_curriculum_track    — active day + dose requirements + live counters
//   bbf_log_curriculum_progress — bump one dose metric; completing the daily
//                                 checklist stamps the unlock flag for day N+1
export function getCurriculumTrack(language) {
  return rpc('bbf_get_curriculum_track', { p_language: language });
}

export function logCurriculumProgress({ language, metric, count = 1 }) {
  return rpc('bbf_log_curriculum_progress', { p_language: language, p_metric: metric, p_count: count });
}

// ── BBF Fables (narrative curriculum) ────────────────────────────────────────
//   bbf_get_curriculum_episode — the day's serialized scene + its drill
//   sentences + vocab chips. Null day resolves the caller's active curriculum
//   day server-side. Same non-throwing contract: no session / no row → The
//   Path keeps its built-in fallback bank.
export function getCurriculumEpisode(language, day = null) {
  return rpc('bbf_get_curriculum_episode', { p_language: language, p_day: day });
}
