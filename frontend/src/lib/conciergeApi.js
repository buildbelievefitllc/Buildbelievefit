// src/lib/conciergeApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Self-Serve Concierge data layer. Fronts the bbf-agentic-concierge edge function
// — the first-login "BBF Lab Concierge" that greets the member and lists EXACTLY
// the features their access band unlocks (no mirages).
//
//   POST {FUNCTIONS_BASE}/bbf-agentic-concierge
//   headers: apikey + Authorization: Bearer <anon>   (gateway routing)
//   body:    { vault_token, display_name?, locale? }
//   → 200    { locale, band, band_label, greeting, unlocked:[{feature,title,blurb}], first_move }
//   → 401/403 on a missing/expired/locked session or an unentitled tier.
//
// The server resolves identity + band SERVER-SIDE from the vault token (the body
// is never trusted for auth), so the only thing we MUST send is that token.
//
// CONTRACT: this returns the greeting payload on success, or `null` on ANY
// non-success (auth denial, network blip, malformed body). The concierge is a
// delight, never a blocker — the caller simply doesn't surface the modal when it
// returns null. We never throw, so onboarding can never crash the Vault.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Map the app's two-letter lang to the edge fn's locale hint (it normalizes too).
function toLocale(lang) {
  const l = String(lang || '').trim().toLowerCase();
  return l === 'es' || l === 'pt' ? l : 'en';
}

// Normalize one unlocked-feature card; drop anything malformed.
function normalizeCard(c) {
  if (!c || typeof c !== 'object') return null;
  const feature = String(c.feature || '').trim();
  const title = String(c.title || '').trim();
  if (!feature || !title) return null;
  return { feature, title, blurb: String(c.blurb || '').trim() };
}

// Fetch the tier-aware welcome for the authenticated member. Resolves to the
// greeting payload, or null when there is nothing to show.
export async function fetchConciergeGreeting({ displayName = '', lang = 'en' } = {}) {
  const token = getStoredVaultToken();
  if (!token) return null; // no session → nothing to onboard into

  const headers = { 'Content-Type': 'application/json' };
  // Gateway routing — without the anon key the request 401s at the edge.
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-agentic-concierge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        // vault_token binds the call to the member's session; the edge fn resolves
        // identity + the exact access band from it (fail-closed entitlement-gate).
        vault_token: token,
        display_name: typeof displayName === 'string' ? displayName.slice(0, 60) : '',
        locale: toLocale(lang),
      }),
    });
  } catch {
    return null; // network unreachable → silently skip the modal
  }

  // Non-2xx is an auth denial (no/expired session · locked · unentitled tier) —
  // exactly the cases where the member should NOT see an onboarding tour.
  if (!res.ok) return null;

  let data;
  try { data = await res.json(); } catch { return null; }
  if (!data || typeof data.greeting !== 'string' || !data.greeting.trim()) return null;

  const unlocked = Array.isArray(data.unlocked)
    ? data.unlocked.map(normalizeCard).filter(Boolean)
    : [];
  if (!unlocked.length) return null; // a tour with no tools is not worth showing

  return {
    locale: data.locale || toLocale(lang),
    band: data.band || '',
    bandLabel: data.band_label || '',
    greeting: data.greeting.trim(),
    unlocked,
    firstMove: typeof data.first_move === 'string' ? data.first_move.trim() : '',
  };
}
