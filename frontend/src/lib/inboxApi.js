// src/lib/inboxApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Agentic Command Center — browser-side caller for the bbf-agent-brain edge
// function's coach surface (list / resolve / health). Mirrors acwrApi.js's
// gateway+dual-auth shape exactly (anon apikey for gateway routing + the admin
// SESSION token / legacy shared secret for authorization).
//
// coach_action_inbox is RLS-sealed with no policies — the browser NEVER reads
// it via PostgREST. Everything routes through the brain's admin gate.
//
// Contract (verified against supabase/functions/bbf-agent-brain/index.ts):
//   POST {FUNCTIONS_BASE}/bbf-agent-brain { action:'list' }
//   200 → { ok:true, count, actions:[{ id, athlete_id, type, status, risk_score,
//           insight_summary, proposed_action, draft_message, created_at,
//           athlete:{ name, uid } }] }
//   POST { action:'resolve', id, status:'APPROVED'|'DISMISSED' }
//   200 → { ok:true, id, status }

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getCoachAdminToken } from './adminAuth.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

function brainHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  // Gateway routing — required even with verify_jwt:false (matches rosterCall).
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  // Authorization — the admin session token (zero-friction) and/or shared secret.
  const sessionToken = getStoredVaultToken();
  if (sessionToken) headers['X-BBF-Session-Token'] = sessionToken;
  const adminToken = getCoachAdminToken();
  if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;
  return headers;
}

async function brainCall(payload) {
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-agent-brain`, {
    method: 'POST',
    headers: brainHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`agent_brain_${res.status}`);
  return res.json();
}

// Pending inbox actions, newest first. Callers treat a throw as non-fatal.
export async function fetchActionInbox() {
  const body = await brainCall({ action: 'list' });
  return Array.isArray(body?.actions) ? body.actions : [];
}

// Approve (nudge sent) or dismiss a card. status: 'APPROVED' | 'DISMISSED'.
export async function resolveInboxAction(id, status) {
  if (!id) throw new Error('agent_brain_missing_id');
  const body = await brainCall({ action: 'resolve', id, status });
  return body?.ok === true;
}
