// src/lib/comlinkApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Comlink data layer — a THIRD distinct path (after the Client Hub edge
// function and the Panopticon's anon PostgREST).
//
// Mirrors the monolith's BBF_LEADS / BBF_CONCIERGE: POST to the RENDER EXPRESS
// backend (not Supabase). SILENT SESSION AUTH: both endpoints authorize off the
// logged-in admin's session — we send the session vault_token as Authorization:
// Bearer, and the Render endpoint verifies it + checks the admin/trainer role
// (index.js vaultTokenIsAdmin). No shared secret in the client (§7); the legacy
// X-BBF-Admin-Token gate stays server-side for service-to-service callers.
//
//   POST {API_BASE}/api/leads-list     { limit }  → { ok, total, provisioned,
//        pending, leads:[{ id, source, email, full_name, phone, tier, created_at,
//        provisioned, dietary_profile, allergens[], age, sex, height, weight,
//        primary_goal, program, health_notes }] }
//   POST {API_BASE}/api/concierge-log  { limit }  → { ok, runs:[{ run_id,
//        started_at, sent, failed, skipped, actions:[{ lead_email, priority,
//        score, action_type, email_subject, error }] }] }
//
// ⚠️ CORS: these endpoints HARD-403 (origin_not_allowed) any origin not in the
// backend's ALLOWED_ORIGINS. The React app's origin must be added there or the
// browser blocks every request (surfaced here as a network/CORS error, never a
// silent hang).

import { getStoredVaultToken } from '../context/AuthContext.jsx';

const API_BASE = 'https://buildbelievefit.onrender.com';

function statusHint(status) {
  if (status === 401) return 'unauthorized (session not cleared — sign in again)';
  if (status === 403) return 'origin not allowed — add this origin to the backend CORS allowlist';
  if (status === 429) return 'rate limited — wait a minute and retry';
  if (status === 503) return 'backend not configured (BBF_ADMIN_TOKEN unset)';
  return 'request failed';
}

// POST one Comlink endpoint. Resolves to the parsed { ok:true, ... } body or
// throws a display-ready, coded Error.
async function comlinkPost(path, payload = {}) {
  const headers = { 'Content-Type': 'application/json' };
  // SILENT session auth — the Authorization bearer carries the session vault_token,
  // which the Render endpoint verifies + role-checks (vaultTokenIsAdmin). No shared
  // secret in the client (§7). Authorization is allow-listed in the backend CORS.
  const vaultToken = getStoredVaultToken();
  if (vaultToken) headers.Authorization = `Bearer ${vaultToken}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // A cross-origin block (origin not allowlisted) rejects fetch before any
    // status is readable — name it precisely so the fix is obvious.
    const e = new Error('Network/CORS error — the request never reached the server. If this origin is new, it must be added to the backend CORS allowlist.');
    e.code = 'network';
    throw e;
  }

  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }

  if (!res.ok || !body?.ok) {
    const slug = body?.error || raw || 'unknown error';
    const e = new Error(`Error ${res.status} — ${statusHint(res.status)} (${slug}).`);
    e.code = 'http';
    throw e;
  }
  return body;
}

// Incoming Pathfinder leads (most recent first).
export function fetchLeads(limit = 100) {
  return comlinkPost('/api/leads-list', { limit });
}

// Concierge run log (autonomous re-engagement audit). Read-only — the "Run Now"
// trigger (which AUTONOMOUSLY SENDS emails) is intentionally NOT wired here.
export function fetchConciergeLog(limit = 80) {
  return comlinkPost('/api/concierge-log', { limit });
}
