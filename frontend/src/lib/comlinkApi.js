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

import { rosterCall } from './rosterApi.js';

// Incoming Pathfinder leads (most recent first).
export function fetchLeads(limit = 100) {
  return rosterCall('leads_list', { limit });
}

// Concierge run log (autonomous re-engagement audit). Read-only — the "Run Now"
// trigger (which AUTONOMOUSLY SENDS emails) is intentionally NOT wired here.
export function fetchConciergeLog(limit = 80) {
  return rosterCall('concierge_log', { limit });
}
