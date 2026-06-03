// src/lib/comlinkApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Comlink data layer.
//
// REWIRED (Advanced Auth Elevation): Comlink no longer calls the Render Express
// backend directly from the browser. It now rides the SAME session-authed gate as
// the rest of the Command Center — bbf-admin-roster relays `leads_list` /
// `concierge_log` to Render server-side using the server-held BBF_RENDER_ADMIN_TOKEN
// (the exact relay the `compile` action already uses). Benefits:
//   • a logged-in admin auto-unlocks Comlink via their session token — no manual
//     paste, no separate Render token in the browser (§7), and
//   • the browser→Render CORS allowlist fragility disappears (the call is now
//     same-origin to Supabase, then server-to-server to Render).
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
