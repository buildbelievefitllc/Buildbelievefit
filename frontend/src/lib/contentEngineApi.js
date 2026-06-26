// src/lib/contentEngineApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin-side Content Engine RPCs (Command Center → "Content" panel). Every call is
// authorized SERVER-SIDE by the admin vault session token (p_session_token), gated by
// _bbf_is_admin_session — identical to the protocol-override / PIN-reset admin RPCs.
// The token is the persisted vault_token (never the PIN), read via getStoredVaultToken.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

async function adminRpc(fn, args) {
  const token = getStoredVaultToken();
  if (!token) {
    const e = new Error('No admin session — sign in again.');
    e.code = 'no_session';
    throw e;
  }
  const { data, error } = await supabase.rpc(fn, { p_session_token: token, ...args });
  if (error) throw new Error(error.message || 'Request failed.');
  return data;
}

// List every card in a deck (incl. hidden) for the editor.
export function listMarketingCards(deck = 'calibration') {
  return adminRpc('bbf_admin_list_marketing_cards', { p_deck: deck });
}

// Insert (card.id empty) or update (card.id set) a card. `card` is the full row shape.
export function upsertMarketingCard(card) {
  return adminRpc('bbf_admin_upsert_marketing_card', { p_card: card });
}

export function deleteMarketingCard(id) {
  return adminRpc('bbf_admin_delete_marketing_card', { p_id: id });
}
