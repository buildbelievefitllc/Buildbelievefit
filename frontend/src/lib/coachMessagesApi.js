// src/lib/coachMessagesApi.js
// ─────────────────────────────────────────────────────────────────────────────
// FOUNDER FIVE — Athlete Feed Chat messaging bridge (coach↔athlete comms).
//
// Both sides ride SECURITY DEFINER RPCs over the deny-all bbf_coach_messages
// table (migration 20260708160000_bbf_coach_athlete_comms):
//   COACH   (Command Center) — self-gates server-side on _bbf_is_admin_session:
//     bbf_coach_thread(token, client_id)        → { ok, messages[] } (marks replies coach-read)
//     bbf_coach_send_message(token, client_id, body) → { ok, message }
//   ATHLETE (Vault / native app) — identity resolved from the vault token; an
//   athlete can only ever touch their OWN thread:
//     bbf_athlete_inbox(token)        → { ok, unread, messages[] }
//     bbf_athlete_unread_count(token) → { ok, unread }   ← the notification flag
//     bbf_athlete_mark_read(token)    → { ok, marked }
//     bbf_athlete_send_message(token, body) → { ok, message }
//
// The client never asserts identity or role — the token is the credential and
// the server is the boundary (§7).

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

export const MESSAGE_MAX = 2000;

async function rpc(fn, args = {}) {
  const token = getStoredVaultToken();
  if (!token) { const e = new Error('no_session'); e.code = 'no_session'; throw e; }
  const { data, error } = await supabase.rpc(fn, { p_session_token: token, ...args });
  if (error) { const e = new Error(error.message || 'rpc_error'); e.code = error.code || 'rpc_error'; throw e; }
  if (!data?.ok) { const e = new Error(data?.error || 'request_failed'); e.code = data?.error || 'request_failed'; throw e; }
  return data;
}

// ── COACH side (Founder Five dossier) ────────────────────────────────────────
export async function coachThread(clientId) {
  const d = await rpc('bbf_coach_thread', { p_client_id: clientId });
  return Array.isArray(d.messages) ? d.messages : [];
}
export async function coachSendMessage(clientId, body) {
  const d = await rpc('bbf_coach_send_message', { p_client_id: clientId, p_body: body });
  return d.message;
}
// Real 7-day committed fueling history (nutrition_daily_sync), admin-gated.
export async function adminNutritionHistory(clientId, days = 7) {
  const d = await rpc('bbf_admin_nutrition_history', { p_client_id: clientId, p_days: days });
  return Array.isArray(d.days) ? d.days : [];
}

// ── ATHLETE side (Vault / BBF Lab app) ───────────────────────────────────────
export async function athleteInbox() {
  const d = await rpc('bbf_athlete_inbox');
  return { unread: Number(d.unread) || 0, messages: Array.isArray(d.messages) ? d.messages : [] };
}
export async function athleteUnreadCount() {
  const d = await rpc('bbf_athlete_unread_count');
  return Number(d.unread) || 0;
}
export async function athleteMarkRead() {
  const d = await rpc('bbf_athlete_mark_read');
  return Number(d.marked) || 0;
}
export async function athleteSendMessage(body) {
  const d = await rpc('bbf_athlete_send_message', { p_body: body });
  return d.message;
}

export function commsErrorMessage(e) {
  const map = {
    no_session: 'No active session — sign in again.',
    invalid_session: 'Session expired — sign in again.',
    not_authorized: 'This action is restricted to the coaching tier.',
    unknown_client: 'Unknown athlete — refresh the roster.',
    invalid_body: `Message must be 1–${MESSAGE_MAX} characters.`,
  };
  if (map[e?.code]) return map[e.code];
  if (/fetch|network/i.test(String(e?.message || ''))) return 'Network unreachable — check your connection and retry.';
  return e?.message || 'Something went wrong.';
}
