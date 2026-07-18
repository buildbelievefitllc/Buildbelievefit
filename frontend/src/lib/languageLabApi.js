// src/lib/languageLabApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Language Lab write/read layer — the three Mastery Views' vault-token RPCs
// (finalized in the Language Mastery engine migration):
//   bbf_log_language_attempt     — append-only session ledger + streak/EWMA loop
//   bbf_save_pimsleur_checkpoint — Audio Dojo resume tracker
//   bbf_get_language_dashboard   — one-read profile + checkpoint hydration
// Same non-throwing contract as useVocabGym's shim: no session → resolved no-op.

import { supabase, FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';
import { getCoachAdminToken } from './adminAuth.js';

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

// Shared admin-token-gated POST to a Language Lab edge function (the Immersion
// engine gateway pattern): anon bearer + X-BBF-Admin-Token, non-throwing.
async function adminFn(name, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) { headers.apikey = SUPABASE_ANON_KEY; headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`; }
  const adminToken = getCoachAdminToken();
  if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }
    if (!res.ok) return { ok: false, status: res.status, error: (data && data.error) || 'request_failed', detail: data?.detail };
    return data || { ok: false, error: 'empty' };
  } catch (e) {
    return { ok: false, status: 0, error: String((e && e.message) || e) };
  }
}

// bbf-fables-bake — CEO-only episode baker (admin-token gateway, same pattern
// as the Immersion engine). Generates the day's episode on the FABLE tier and
// lands it as pending_review; returns the freshly baked episode payload.
export function bakeFablesEpisode({ language, day }) {
  return adminFn('bbf-fables-bake', { language, day });
}

// Daily drills — Gemini 2.5 Flash translation targets (The Path's dynamic
// bank for days with no Fables episode). Served by bbf-fables-bake's
// `daily_drills` mode (the project is at its edge-function cap, so the drills
// rung lives inside the Path's content baker). Fail-closed server-side; the
// caller keeps its built-in fallback bank on any non-ok result.
export function generatePathDrills({ language, day, count = 5 }) {
  return adminFn('bbf-fables-bake', { mode: 'daily_drills', language, day, count });
}
