// src/components/language/useVocabGym.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.2 — the Vocab Gym data hook (LANGUAGE_MASTERY §2.2 SRS).
//
// Fetches the athlete's daily SRS due queue and drives the two write actions the
// flashcard needs — review (Leitner flip) and flag_term (priority escalation) —
// all through the vault-token RPC layer finalized in Phase 3.2:
//   • bbf_get_vocab_queue    → today's due terms, ranked hardest-first
//   • bbf_review_vocab_term  → box +1 / reset + schedules the next due_at
//   • bbf_flag_vocab_term    → the flag_term action (due-now + priority_boost)
//
// Mirrors languageProgressApi.js EXACTLY: p_session_token gate, best-effort +
// non-throwing (no session → resolved no-op, never blanks the gym), and the mount
// effect performs no synchronous setState (defers to the awaited fetch).
//
// @typedef {Object} VocabCard   // one row of bbf_vocab_mastery (v2)
// @property {string} term @property {number} box_level @property {string} source
// @property {string|null} error_cluster @property {number} priority_boost
// @property {number} correct @property {number} attempts
// @property {string} last_reviewed @property {string|null} due_at

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { getStoredVaultToken } from '../../context/AuthContext.jsx';

// Vault-token RPC shim — identical contract to languageProgressApi.rpc.
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

/**
 * @param {'es'|'pt'} [language]
 * @returns {{ loading:boolean, error:string|null, queue:VocabCard[], dueCount:number, total:number,
 *            reload:()=>Promise<void>, reviewTerm:(term:string, correct:boolean)=>Promise<Object>,
 *            flagTerm:(term:string)=>Promise<Object> }}
 */
export function useVocabGym(language = 'es') {
  // Normalize ANY Portuguese identifier — 'pt', 'PT-BR', 'pt_BR', 'português',
  // 'Brazilian Portuguese' — to the canonical 'pt' the SRS tables speak. The old
  // strict equality (language === 'pt') silently coerced regional codes like
  // 'pt-BR' to the SPANISH queue, which read as "Queue clear" for Portuguese.
  const t = String(language || '').trim().toLowerCase();
  const lang = (t === 'pt' || t.startsWith('pt-') || t.startsWith('pt_') || t.startsWith('port') || t.includes('brazil') || t.includes('brasil') || t === 'br')
    ? 'pt' : 'es';
  const [state, setState] = useState({ loading: true, error: null, queue: [], dueCount: 0, total: 0 });
  const alive = useRef(true);

  const applyQueue = useCallback((res) => ({
    loading: false,
    error: res.ok ? null : res.error,
    queue: res.ok && Array.isArray(res.queue) ? res.queue : [],
    dueCount: res.ok ? (res.due_count || 0) : 0,
    total: res.ok ? (res.total || 0) : 0,
  }), []);

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await rpc('bbf_get_vocab_queue', { p_language: lang, p_limit: 20 });
    if (alive.current) setState(applyQueue(res));
  }, [lang, applyQueue]);

  // Mount / language-change fetch. No synchronous setState in the effect body —
  // the awaited fetch resolves and applies in the deferred continuation.
  useEffect(() => {
    alive.current = true;
    rpc('bbf_get_vocab_queue', { p_language: lang, p_limit: 20 })
      .then((res) => { if (alive.current) setState(applyQueue(res)); });
    return () => { alive.current = false; };
  }, [lang, applyQueue]);

  // Record a flip. On success, drop the term from the local queue (it's scheduled
  // forward server-side) so the drill advances without a full refetch.
  const reviewTerm = useCallback(async (term, correct) => {
    const res = await rpc('bbf_review_vocab_term', { p_language: lang, p_term: term, p_correct: !!correct });
    if (alive.current && res.ok) {
      setState((s) => ({ ...s, queue: s.queue.filter((q) => q.term !== term), dueCount: Math.max(0, s.dueCount - 1) }));
    }
    return res;
  }, [lang]);

  // flag_term — escalate to priority review. Leaves the card in the queue (it's
  // due now and boosted); the UI reflects the flagged state locally.
  const flagTerm = useCallback(async (term) => {
    const res = await rpc('bbf_flag_vocab_term', { p_language: lang, p_term: term });
    if (alive.current && res.ok) {
      setState((s) => ({ ...s, queue: s.queue.map((q) => (q.term === term ? { ...q, priority_boost: Math.max(Number(q.priority_boost) || 0, 0.5), flagged: true } : q)) }));
    }
    return res;
  }, [lang]);

  return { ...state, reload, reviewTerm, flagTerm };
}
