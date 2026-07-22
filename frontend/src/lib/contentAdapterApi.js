// src/lib/contentAdapterApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Trilingual Content Adapter — client caller. Takes English hooks and stages
// culturally adapted ES/PT drafts into bbf_content_manager_queue (status
// 'draft', source_ref 'trilingual-adapter:<batch>') via bbf-trilingual-adapter.
// Same dual-auth shape as inboxApi (anon apikey routing + admin session token).
// ─────────────────────────────────────────────────────────────────────────────

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getCoachAdminToken } from './adminAuth.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

export async function adaptHooksTrilingual(hooks, languages = ['es', 'pt']) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  const sessionToken = getStoredVaultToken();
  if (sessionToken) headers['X-BBF-Session-Token'] = sessionToken;
  const adminToken = getCoachAdminToken();
  if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;

  const res = await fetch(`${FUNCTIONS_BASE}/bbf-trilingual-adapter`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ hooks, languages }),
  });
  if (!res.ok && res.status !== 202) throw new Error(`trilingual_adapter_${res.status}`);
  return res.json();
}
