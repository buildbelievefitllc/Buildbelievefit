// src/lib/languageProgressApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Cross-device persistence for the 90-Day Language Mastery Vocab Gym. Thin wrapper
// over the vault-token-gated RPCs (bbf_save_language_score / bbf_record_vocab_attempt
// / bbf_get_language_progress) — the SAME session-token pattern the biometric ledger
// uses. Every call is best-effort + non-throwing: with no session it degrades to a
// silent no-op so the games still run fully on localStorage. Tables live behind RLS;
// only the SECURITY DEFINER RPCs reach them.

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

// Load this athlete's game bests + spaced-repetition mastery summary.
// → { ok, scores: { mode: { best_score, best_streak, plays } }, mastery: {...} }
export function loadLanguageProgress() {
  return rpc('bbf_get_language_progress', {});
}

// Persist a finished game's best score + streak (server keeps the max). Fire-and-forget.
export function saveLanguageScore(mode, score, streak) {
  return rpc('bbf_save_language_score', {
    p_mode: String(mode || ''),
    p_score: Math.max(0, Math.round(Number(score) || 0)),
    p_streak: Math.max(0, Math.round(Number(streak) || 0)),
  });
}

// Record a single spaced-repetition attempt for a term (Leitner box up/reset). Fire-and-forget.
export function recordVocabAttempt(term, correct) {
  return rpc('bbf_record_vocab_attempt', { p_term: String(term || ''), p_correct: !!correct });
}
