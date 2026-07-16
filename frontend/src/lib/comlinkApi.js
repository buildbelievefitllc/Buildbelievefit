// src/lib/comlinkApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Comlink data layer.
//
// REWIRED: Comlink rides the SAME session-authed gate as the rest of the Command
// Center — it calls bbf-admin-roster (with the admin's X-BBF-Session-Token), which
// reads the leads / concierge data DIRECTLY via the service role (bbf_leads /
// bbf_lead_actions). No browser→Render call, no separate Render token. Benefits:
//   • a logged-in admin auto-unlocks Comlink via their session token — no manual
//     paste, no second token to juggle (§7), and
//   • the prior server→Render relay (and its BBF_RENDER_ADMIN_TOKEN mismatch, which
//     threw the Comlink "admin_token_invalid" crash) is gone entirely.
//
// Response shapes are unchanged (Render's bodies are returned verbatim):
//   leads_list     → { ok, total, provisioned, pending, leads:[…] }
//   concierge_log  → { ok, runs:[{ run_id, started_at, sent, failed, skipped, actions:[…] }] }
//
// Phase 21 — TDEE / Daily Burn calculator micro-leads (bbf_tdee_leads). A separate,
// unscreened lane: no PAR-Q/liability on file, so it is DELIBERATELY never merged
// into leads_list — Comlink renders it as its own "TDEE Signals" view.
//   tdee_leads_list → { ok, total, converted, leads:[…] }

import { rosterCall } from './rosterApi.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getCoachAdminToken } from './adminAuth.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// ── Prospects (Routine Interrogator lead capture) ──────────────────────────────
// NEW_PROSPECT cards in coach_action_inbox, served by the admin-gated
// bbf-prospect-inbox edge function (same gateway + dual-auth shape as rosterCall).
async function prospectCall(action, payload = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  const sessionToken = getStoredVaultToken();
  if (sessionToken) headers['X-BBF-Session-Token'] = sessionToken;
  const adminToken = getCoachAdminToken();
  if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;

  const res = await fetch(`${FUNCTIONS_BASE}/bbf-prospect-inbox`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || body?.detail || `Error ${res.status}`);
  }
  return body;
}

// Prospect inbox — NEW_PROSPECT cards (+ embedded prospect lead), newest first.
//   → { ok, total, pending, cards:[{ id, status, insight_summary, proposed_action,
//        draft_message, created_at, processed_at, prospect:{…} }] }
export function fetchProspectInbox(limit = 100) {
  return prospectCall('list', { limit });
}

// Approve a prospect card: stamps processed_at + status='APPROVED'.
//   → { ok, card:{ id, status, processed_at } }
export function processProspectCard(cardId) {
  return prospectCall('process', { card_id: cardId });
}

// Incoming Pathfinder leads (most recent first).
export function fetchLeads(limit = 100) {
  return rosterCall('leads_list', { limit });
}

// Concierge run log (autonomous re-engagement audit). Read-only — the "Run Now"
// trigger (which AUTONOMOUSLY SENDS emails) is intentionally NOT wired here.
export function fetchConciergeLog(limit = 80) {
  return rosterCall('concierge_log', { limit });
}

// TDEE / Daily Burn calculator micro-leads (most recent first).
export function fetchTdeeLeads(limit = 100) {
  return rosterCall('tdee_leads_list', { limit });
}
