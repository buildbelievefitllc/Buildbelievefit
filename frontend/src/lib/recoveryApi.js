// src/lib/recoveryApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Client wrappers for the knowledge-based PIN-recovery RPCs (migration
// 20260713120000). These are SECURITY DEFINER Postgres functions called with the
// anon key via supabase.rpc — the same posture as bbf_verify_user_pin. Security
// lives server-side: answers are bcrypt-hashed and never returned, the challenge
// endpoint is decoy-safe (anti-enumeration), and both the challenge and reset
// paths are per-username rate-limited. These wrappers only shape inputs/outputs.
//
// Two contexts:
//   • Authenticated (vault_token): setRecoveryQuestions / getRecoveryStatus — the
//     first-login setup gate + Settings management surface.
//   • Anonymous (pre-login): recoveryChallenge / recoveryReset — the Login gate a
//     locked-out client hits when they've forgotten their PIN.

import { supabase } from './supabaseClient.js';

// Set (or replace) the two security questions for the signed-in client.
// items: [{ slot:1, question_key, answer }, { slot:2, question_key, answer }]
export async function setRecoveryQuestions(vaultToken, items) {
  if (!vaultToken) return { ok: false, reason: 'no_session' };
  const { data, error } = await supabase.rpc('bbf_set_recovery_questions', {
    p_vault_token: vaultToken,
    p_items: items,
  });
  if (error) return { ok: false, reason: 'rpc_error', message: error.message };
  return data?.ok ? { ok: true } : { ok: false, reason: 'rejected' };
}

// Has the signed-in client set their questions yet? { ok, set, count }.
export async function getRecoveryStatus(vaultToken) {
  if (!vaultToken) return { ok: false, set: false };
  const { data, error } = await supabase.rpc('bbf_recovery_status', {
    p_vault_token: vaultToken,
  });
  if (error) return { ok: false, set: false };
  return { ok: true, set: Boolean(data?.set), count: Number(data?.count || 0) };
}

// Fetch the question to display for a username at the recovery gate. Always
// returns a question (a decoy for unknown/unset accounts) unless the account is
// rate-limited: { ok:true, question_key, slot } | { ok:false, locked, retryAfter }.
export async function recoveryChallenge(username) {
  const uid = (username || '').trim().toLowerCase();
  if (!uid) return { ok: false, reason: 'missing' };
  const { data, error } = await supabase.rpc('bbf_pin_recovery_challenge', { p_uid: uid });
  if (error) return { ok: false, reason: 'rpc_error' };
  if (!data?.ok) {
    return { ok: false, locked: Boolean(data?.locked), retryAfter: Number(data?.retry_after_seconds || 0) };
  }
  return { ok: true, questionKey: data.question_key, slot: data.slot };
}

// Verify the answer and reset the PIN. Generic on failure (never reveals whether
// the account/answer was the miss): { ok:true } | { ok:false, locked, retryAfter }.
export async function recoveryReset(username, answer, newPin) {
  const uid = (username || '').trim().toLowerCase();
  const { data, error } = await supabase.rpc('bbf_pin_recovery_reset', {
    p_uid: uid,
    p_answer: answer,
    p_new_pin: newPin,
  });
  if (error) return { ok: false, reason: 'rpc_error' };
  if (data?.ok) return { ok: true };
  return { ok: false, locked: Boolean(data?.locked), retryAfter: Number(data?.retry_after_seconds || 0) };
}
