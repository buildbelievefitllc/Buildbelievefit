// src/lib/commandFeedApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 20.5 — Live data layer for the Sovereign Command Center roster.
//
// Talks to the bbf-command-feed edge function (Terminal 3). Mirrors the proven
// bbf-admin-roster call convention (rosterApi.js): the Supabase gateway needs the
// anon apikey + Authorization to ROUTE the request. ZERO-FRICTION (Phase 23): the
// X-BBF-Admin-Token gate is gone — the feed loads via the standard anon-key
// pattern, no token prompt.
//
// Contract (per Terminal 3):
//   POST {FUNCTIONS_BASE}/bbf-command-feed
//   headers: apikey + Authorization: Bearer <anon>
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
// Error(displayMessage) on failure.
export async function fetchCommandFeed() {
  const headers = { 'Content-Type': 'application/json' };
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
    const slug = body?.detail || body?.error || raw || `status ${res.status}`;
    throw new Error(`Feed error ${res.status} — ${slug}.`);
  }

  const clients = Array.isArray(body?.clients) ? body.clients : [];
  return clients.map(normalizeClient);
}
