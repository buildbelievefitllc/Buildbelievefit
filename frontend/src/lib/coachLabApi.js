// src/lib/coachLabApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab data layer — the Research Vault (Pillar 1) backend contract.
//
// House convention (mirrors weeklyBriefApi / programApi): a raw fetch to
// FUNCTIONS_BASE with the anon key (the Supabase gateway requires it to route)
// PLUS the signed-in admin's server-revocable vault session token on the
// `x-bbf-session-token` header. The bbf-coach-vault edge function validates that
// token → admin/trainer/akeem before touching the RLS-sealed coach_knowledge_base
// table (service-role). NEVER trust a client-supplied user id.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

async function callVault(action, args = {}) {
  const token = getStoredVaultToken();
  if (!token) {
    const e = new Error('No admin session — sign in again.');
    e.code = 'no_session';
    throw e;
  }
  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-coach-vault`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'x-bbf-session-token': token,
      },
      body: JSON.stringify({ action, ...args }),
    });
  } catch {
    const e = new Error('Research Vault unreachable — check your connection.');
    e.code = 'transport';
    throw e;
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !data?.ok) {
    const e = new Error(data?.detail || data?.error || `vault_${res.status}`);
    e.code = data?.error || `http_${res.status}`;
    throw e;
  }
  return data;
}

// List the founder's saved research cards (newest first).
export const listResearch = () => callVault('list').then((d) => d.cards || []);

// Summarize pasted study text → a structured card, saved + returned.
export const ingestResearch = (rawText, category) =>
  callVault('ingest', { raw_text: rawText, category: category || undefined }).then((d) => d.card);

// Remove a card by id.
export const deleteResearch = (id) => callVault('delete', { id }).then((d) => d.deleted);

// The category taxonomy (matches the edge function + table CHECK-by-convention).
export const RESEARCH_CATEGORIES = ['biomechanics', 'bioenergetics', 'nutrition', 'pediatric-athletics'];
