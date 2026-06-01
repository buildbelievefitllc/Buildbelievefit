// src/lib/commandFeedApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 20.5 — Live data layer for the Sovereign Command Center roster.
//
// Talks to the bbf-command-feed edge function (Terminal 3). Mirrors the proven
// bbf-admin-roster call convention (rosterApi.js): the Supabase gateway needs the
// anon apikey + Authorization to ROUTE the request, and the real authorization is
// the X-BBF-Admin-Token shared secret. The token is the same BBF_COACH_AGENT_TOKEN
// the Client Hub uses (sessionStorage) — so the coach authenticates once.
//
// Contract (per Terminal 3):
//   POST {FUNCTIONS_BASE}/bbf-command-feed
//   headers: apikey + Authorization: Bearer <anon> + X-BBF-Admin-Token: <secret>
//   200 → { clients: [{ uid, name, overall_status,
//                        training:{ status }, nutrition:{ status }, … }] }
//
// Mapping into the CommandRoster client shape (CLAUDE-directed):
//   training.status   → Form Check toggle      (green ⇒ on)
//   nutrition.status  → Nutrition toggle        (green ⇒ on)
//   biometrics.status → Biometrics toggle       (NOT in the contract yet —
//                       wired defensively so it lights up the moment the feed
//                       adds it; until then it reads off)
//   overall_status    → Active/Paused pill      (green ⇒ Active, else Paused)

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { readToken } from './rosterApi.js';

const isGreen = (s) => String(s || '').trim().toLowerCase() === 'green';

// Normalize one feed client → the row shape CommandRoster renders.
function normalizeClient(c) {
  return {
    id: c.uid,
    name: c.name || c.uid || 'Unknown',
    tier: c.tier || 'Sovereign',
    overallStatus: c.overall_status || null,
    status: isGreen(c.overall_status) ? 'active' : 'paused',
    modules: {
      biometrics: isGreen(c.biometrics?.status),
      nutrition: isGreen(c.nutrition?.status),
      formCheck: isGreen(c.training?.status),
    },
  };
}

// Fetch + normalize the live roster. Resolves to an array of row objects; throws
// Error(displayMessage) on failure (no_token carries e.code for the auth gate).
export async function fetchCommandFeed() {
  const t = readToken();
  if (!t) {
    const e = new Error('Admin token required to load the live roster.');
    e.code = 'no_token';
    throw e;
  }

  const headers = { 'Content-Type': 'application/json', 'X-BBF-Admin-Token': t };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-command-feed`, { method: 'POST', headers, body: '{}' });
  } catch {
    throw new Error('Network/CORS error — could not reach the command feed.');
  }

  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }

  if (!res.ok) {
    if (res.status === 401) {
      const e = new Error('Admin token rejected — re-authenticate.');
      e.code = 'no_token';
      throw e;
    }
    const slug = body?.detail || body?.error || raw || `status ${res.status}`;
    throw new Error(`Feed error ${res.status} — ${slug}.`);
  }

  const clients = Array.isArray(body?.clients) ? body.clients : [];
  return clients.map(normalizeClient);
}
