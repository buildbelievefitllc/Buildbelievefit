// src/lib/blueprintTokensApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Server-authoritative Blueprint program-generation token. The balance lives in
// bbf_blueprint_tokens (RLS-SEALED — zero client writes) and is only ever read or
// decremented through the SECURITY DEFINER RPCs, which resolve identity from the
// vault session token. A client can therefore neither forge a balance nor spend
// another account's tokens — the localStorage meter this replaces could do both.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Read the caller's remaining tokens for the current UTC month.
// Returns { ok:true, remaining:number } or { ok:false, error, remaining:null }.
export async function fetchBlueprintTokens() {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session', remaining: null };
  const { data, error } = await supabase.rpc('bbf_get_blueprint_tokens', { p_session_token: token });
  if (error || !data || data.ok !== true) {
    return { ok: false, error: error?.message || data?.error || 'read_failed', remaining: null };
  }
  return { ok: true, remaining: Number(data.remaining) };
}

// Atomically consume ONE token. Returns { ok:true, remaining } on success, or
// { ok:false, error:'exhausted'|'invalid_session'|…, remaining } on denial. The
// decrement is atomic server-side, so it is the real gate — the UI state is advisory.
export async function consumeBlueprintToken() {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session', remaining: null };
  const { data, error } = await supabase.rpc('bbf_consume_blueprint_token', { p_session_token: token });
  if (error) return { ok: false, error: error.message || 'rpc_error', remaining: null };
  if (!data || data.ok !== true) return { ok: false, error: data?.error || 'denied', remaining: data?.remaining ?? null };
  return { ok: true, remaining: Number(data.remaining), allotment: data.allotment != null ? Number(data.allotment) : undefined };
}

// ── MICRO-TRANSACTION REFILL HOOK (skeleton) ─────────────────────────────────
// Standalone token top-ups on TOP of the monthly allotment. IMPORTANT: the actual
// credit is applied SERVER-SIDE only — Stripe webhook → an edge function (service
// role) → the bbf_credit_blueprint_tokens(user_id, count) RPC, which is deliberately
// NOT callable from the browser (a client crediting itself would be forgeable). This
// module owns only the two client halves: (1) START the purchase, (2) REFRESH the
// balance via fetchBlueprintTokens() once the webhook has credited it. This is the
// seam those halves meet at — the Stripe checkout + webhook land next.

// The standalone top-up SKUs. `stripePriceId` is filled once the Stripe products
// exist; note the pro refill is discounted ($0.99 vs $1.99) as a tier perk.
export const REFILL_PACKS = {
  basic: { tokens: 1, price: '$1.99', forTier: 'blueprint_basic', stripePriceId: null },
  pro:   { tokens: 1, price: '$0.99', forTier: 'blueprint_pro',   stripePriceId: null },
};

// SKELETON — begin a standalone token-refill purchase. Wire this to a refill Checkout
// session (mirror UpgradeOverlay's createUpgradeCheckout, authed by the vault token)
// once REFILL_PACKS carry live Stripe price IDs. Returns the pack so a CTA can render
// today; resolves { ok:false, error:'refill_not_wired' } until the checkout is added.
export async function beginTokenRefillPurchase(packKey = 'basic') {
  const pack = REFILL_PACKS[packKey];
  if (!pack) return { ok: false, error: 'unknown_pack' };
  if (!pack.stripePriceId) return { ok: false, error: 'refill_not_wired', pack };
  // TODO(stripe): const url = await createRefillCheckout(getStoredVaultToken(), pack.stripePriceId);
  //               window.location.href = url;  // → Stripe → webhook → bbf_credit_blueprint_tokens
  return { ok: false, error: 'refill_not_wired', pack };
}
