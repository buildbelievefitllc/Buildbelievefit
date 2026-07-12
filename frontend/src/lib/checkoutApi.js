// src/lib/checkoutApi.js
// ─────────────────────────────────────────────────────────────────────────────
// SCREENING-GATED checkout. The public funnel never links to a raw Stripe Payment
// Link anymore — the Pathfinder success card calls this to mint a Checkout Session
// via the bbf-create-checkout edge function, which REFUSES (403 screening_required)
// unless a completed Pathfinder PAR-Q / medical screening is already on file for the
// email. So a checkout URL cannot exist without screening (CEO liability mandate).
//
// Contract (verified against supabase/functions/bbf-create-checkout/index.ts):
//   POST {FUNCTIONS_BASE}/bbf-create-checkout
//   body: { email (required), price_id (required, allowlisted) }
//   200 → { ok:true, url }   · redirect the browser to `url`
//   400 invalid_email | invalid_price | invalid_json
//   403 origin_not_allowed | screening_required
//   429 rate_limited · 502 checkout_create_failed · 503 config_missing

import { FUNCTIONS_BASE } from './supabaseClient.js';

function checkoutErrorMessage(status, slug) {
  if (slug === 'screening_required') return 'Complete your readiness screening before checkout.';
  if (slug === 'invalid_session') return 'Your session expired — please sign in again to upgrade.';
  if (slug === 'invalid_email') return 'That email looks invalid — please check it.';
  if (slug === 'origin_not_allowed') return 'This site is not yet authorized for checkout (CORS).';
  if (status === 429 || slug === 'rate_limited') return 'Too many attempts — wait a minute and retry.';
  if (status === 503) return 'Checkout is temporarily unavailable — please try again shortly.';
  return `Could not open secure checkout (${slug || `status ${status}`}). Please try again.`;
}

// Shared POST → the gated edge function. `payload` carries price_id + an identity:
// `email` for the public funnel (post-screening prospect) or `vault_token` for an
// authenticated in-vault upgrade. Returns the hosted Stripe checkout URL, or throws.
async function mintCheckout(payload) {
  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // content-type only (CORS allowlist)
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Network error — could not reach secure checkout. Check your connection and retry.');
  }
  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }
  if (!res.ok || !body?.ok || !body?.url) {
    // `.code` carries the raw slug (e.g. 'screening_required') alongside the
    // human `.message`, so a caller can branch on the failure reason — e.g.
    // TierSelectionPitch's fast-track path offers a re-screen CTA specifically
    // when a Screening Complete flag turns out to be stale/expired server-side.
    // Purely additive: existing callers reading only `.message` are unaffected.
    const err = new Error(checkoutErrorMessage(res.status, body?.error));
    err.code = body?.error || null;
    err.status = res.status;
    throw err;
  }
  return body.url;
}

// PUBLIC FUNNEL — post-screening prospect (identity = email).
export async function createCheckoutSession(email, priceId) {
  return mintCheckout({ email, price_id: priceId });
}

// IN-VAULT UPGRADE — authenticated existing client (identity = server-revocable
// vault_token; a provisioned account is itself proof of original screening).
export async function createUpgradeCheckout(vaultToken, priceId) {
  return mintCheckout({ vault_token: vaultToken, price_id: priceId });
}
