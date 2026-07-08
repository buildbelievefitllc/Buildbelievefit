// src/lib/eagleEyeApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Live data layer for BBF EAGLE EYE — the Command Center's secondary brain.
//
// Talks to the bbf-eagle-eye edge function. Mirrors the proven bbf-command-feed
// call convention (commandFeedApi.js): the Supabase gateway needs the anon apikey
// + Authorization to ROUTE the request, AND the function gates every call on the
// admin token OR a validated admin session token. Neither is ever bundled (§7).
//
// Two calls:
//   fetchEagleEye()          → roster scan (deterministic alignment for every client)
//   fetchEagleEyeDeepRead(uid) → one client + optional Claude synthesis of its logic

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getCoachAdminToken } from './adminAuth.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  // Admin authorization — DUAL: the logged-in admin's session token (zero-friction,
  // validated server-side) and/or the legacy shared secret. Server authorizes if
  // EITHER is valid-admin. Never bundled (§7).
  const sessionToken = getStoredVaultToken();
  if (sessionToken) headers['X-BBF-Session-Token'] = sessionToken;
  const adminToken = getCoachAdminToken();
  if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;
  return headers;
}

async function post(payload) {
  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-eagle-eye`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload || {}),
    });
  } catch {
    throw new Error('Network/CORS error — could not reach Eagle Eye.');
  }
  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const slug = body?.detail || body?.error || raw || `status ${res.status}`;
    throw new Error(`Eagle Eye error ${res.status} — ${slug}.`);
  }
  if (!body?.ok) throw new Error(body?.error || body?.detail || 'Malformed response.');
  return body;
}

// Roster scan → { generated_at, iso_year, iso_week, summary, client_count, clients }.
export function fetchEagleEye() {
  return post({});
}

// Deep read one client → { client, synthesis, synthesis_model }.
export function fetchEagleEyeDeepRead(uid) {
  return post({ mode: 'deep_read', uid });
}
