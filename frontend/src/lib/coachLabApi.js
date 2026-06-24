// src/lib/coachLabApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab data layer — the Knowledge Ecosystem backend contracts.
//
//   Research Vault / Broadcast  → bbf-coach-vault  (list/ingest/delete/broadcast)
//   Coach's Arena               → bbf-coach-arena  (generate/critique)
//
// House convention (mirrors weeklyBriefApi / programApi): a raw fetch to
// FUNCTIONS_BASE with the anon key (the Supabase gateway requires it to route)
// PLUS the signed-in admin's server-revocable vault session token on the
// `x-bbf-session-token` header. Each edge function validates that token →
// admin/trainer/akeem before doing privileged (service-role) work.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

async function callCoachFn(fnName, action, args = {}) {
  const token = getStoredVaultToken();
  if (!token) {
    const e = new Error('No admin session — sign in again.');
    e.code = 'no_session';
    throw e;
  }
  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/${fnName}`, {
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
    const e = new Error('Coach Lab service unreachable — check your connection.');
    e.code = 'transport';
    throw e;
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !data?.ok) {
    const e = new Error(data?.detail || data?.error || `coachfn_${res.status}`);
    e.code = data?.error || `http_${res.status}`;
    throw e;
  }
  return data;
}

// ── Research Vault (Pillar 1) ──
export const listResearch = () => callCoachFn('bbf-coach-vault', 'list').then((d) => d.cards || []);
export const ingestResearch = (rawText, category) =>
  callCoachFn('bbf-coach-vault', 'ingest', { raw_text: rawText, category: category || undefined }).then((d) => d.card);
export const deleteResearch = (id) => callCoachFn('bbf-coach-vault', 'delete', { id }).then((d) => d.deleted);

// ── Broadcast Hub (Pillar 4) ──
export const broadcastResearch = (cardIds, format = 'email') =>
  callCoachFn('bbf-coach-vault', 'broadcast', { card_ids: cardIds, format }).then((d) => ({ newsletter: d.newsletter, format: d.format }));

// ── Coach's Arena (Pillar 3) ──
export const generateCase = () => callCoachFn('bbf-coach-arena', 'generate').then((d) => d.case);
export const critiqueProtocol = (theCase, protocol) =>
  callCoachFn('bbf-coach-arena', 'critique', { case: theCase, protocol }).then((d) => d.critique);

export const RESEARCH_CATEGORIES = ['biomechanics', 'bioenergetics', 'nutrition', 'pediatric-athletics'];
