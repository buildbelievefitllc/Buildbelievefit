// ═══════════════════════════════════════════════════════════════
// bbf-create-checkout — SCREENING-GATED Stripe Checkout Session minting
// ═══════════════════════════════════════════════════════════════
// The CEO liability mandate: "make sure EVERYONE is getting screened." This is the
// server-authoritative guarantee + the SINGLE way to reach Stripe. The site no
// longer exposes raw buy.stripe.com Payment Links anywhere.
//
// Two authenticated callers:
//   • PUBLIC FUNNEL (prospect) — body { email, price_id }. Refused (403
//     screening_required) unless a completed Pathfinder PAR-Q / medical screening
//     exists in bbf_active_clients for the email (staged by bbf-lead-capture).
//   • IN-VAULT UPGRADE (existing client) — body { vault_token, price_id }. The token
//     resolves SERVER-SIDE to a provisioned bbf_users row (which is itself proof the
//     client was screened at original onboarding); we mint with that account's email.
//
// Either way the SERVER, not the client, authorizes payment. Gates: origin allowlist
// · per-IP rate limit · the identity/screening check. Tier is resolved server-side
// from an allowlisted price; the webhook maps the purchased price back to the SKU.
//
// Env: STRIPE_API_KEY, SUPABASE_URL*, SUPABASE_SERVICE_ROLE_KEY* (* auto-injected).
// Deploy with verify_jwt = false (public funnel endpoint; auth is custom, above).
// ═══════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const ALLOWED_ORIGINS = new Set([
  'https://buildbelievefit.fitness',
  'https://www.buildbelievefit.fitness',
  'https://buildbelievefitllc.github.io',
]);
const DEFAULT_ORIGIN = 'https://buildbelievefit.fitness';

// Allowlisted price → { canonical tier slug, checkout mode }. Mirrors the
// stripe-webhook PRICE_TO_TIER map + frontend/src/lib/pricingMatrix.js. Recurring
// tiers are 'subscription'; one-time Hybrid protocols are 'payment'. A price NOT in
// this map is rejected (no arbitrary line items).
const PRICE_INFO: Record<string, { tier: string; mode: 'subscription' | 'payment' }> = {
  'price_1TdtVCQ4j3uHTi7PEjvMihnk': { tier: 'catalyst', mode: 'subscription' },
  'price_1TdtVDQ4j3uHTi7Pb2hGyXBi': { tier: 'momentum', mode: 'subscription' },
  'price_1TdtVDQ4j3uHTi7PP2uWTj0y': { tier: 'autonomous', mode: 'subscription' },
  'price_1TdtVEQ4j3uHTi7PQ0fOArfI': { tier: 'fuel_foundation', mode: 'subscription' },
  'price_1TdtVEQ4j3uHTi7PEvGYoQkW': { tier: 'fuel_performance', mode: 'subscription' },
  'price_1TdtVFQ4j3uHTi7PZ65aKtTI': { tier: 'fuel_sovereign', mode: 'subscription' },
  'price_1TdtVFQ4j3uHTi7Ponk5039p': { tier: 'rising_athlete', mode: 'subscription' },
  'price_1TdtVGQ4j3uHTi7P51mzlaCT': { tier: 'kickstart_6wk_3x', mode: 'payment' },
  'price_1TdtVGQ4j3uHTi7P5AZSEOoS': { tier: 'kickstart_6wk_4x', mode: 'payment' },
  'price_1TdtVHQ4j3uHTi7PMh786BoK': { tier: 'transformation_8wk_3x', mode: 'payment' },
  'price_1TdtVHQ4j3uHTi7PhOfSjE61': { tier: 'transformation_8wk_4x', mode: 'payment' },
  'price_1TdtVIQ4j3uHTi7POHmPRFGn': { tier: 'sovereign_12wk_3x', mode: 'payment' },
  'price_1TdtVIQ4j3uHTi7PYVF5s0dq': { tier: 'sovereign_12wk_4x', mode: 'payment' },
};

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 8;
const _rateBuckets = new Map<string, number[]>();
function rateLimitOk(ip: string) {
  const now = Date.now();
  let arr = _rateBuckets.get(ip) || [];
  arr = arr.filter((t) => t > now - RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { _rateBuckets.set(ip, arr); return false; }
  arr.push(now);
  _rateBuckets.set(ip, arr);
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : DEFAULT_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}
function jsonResponse(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, origin);

  // Origin allowlist — refuse off-allowlist callers before any work.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin);
  }

  const STRIPE_API_KEY = Deno.env.get('STRIPE_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!STRIPE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: 'config_missing' }, 503, origin);
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (!rateLimitOk(ip)) return jsonResponse({ ok: false, error: 'rate_limited' }, 429, origin);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400, origin); }

  const priceId = String(body?.price_id ?? body?.priceId ?? '').trim();
  const info = PRICE_INFO[priceId];
  if (!info) return jsonResponse({ ok: false, error: 'invalid_price' }, 400, origin);

  const vaultToken = String(body?.vault_token ?? body?.vaultToken ?? '').trim();
  let email = String(body?.email ?? '').trim().toLowerCase();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── IDENTITY + SCREENING GATE ──
  if (vaultToken) {
    // IN-VAULT UPGRADE: resolve the server-revocable token → a provisioned account.
    // A real bbf_users row is itself proof the client was screened at onboarding,
    // so no active_clients re-check is needed; mint with that account's email.
    const { data: uid, error: uidErr } = await supabase.rpc('_bbf_uid_from_vault_token', { p_session_token: vaultToken });
    if (uidErr || typeof uid !== 'string' || !uid) {
      return jsonResponse({ ok: false, error: 'invalid_session' }, 401, origin);
    }
    const { data: urows, error: uErr } = await supabase
      .from('bbf_users').select('email').eq('id', uid).is('deleted_at', null).limit(1);
    const found = Array.isArray(urows) ? urows[0] : null;
    if (uErr || !found?.email) {
      return jsonResponse({ ok: false, error: 'invalid_session' }, 401, origin);
    }
    email = String(found.email).trim().toLowerCase();
  } else {
    // PUBLIC FUNNEL: a completed Pathfinder screening MUST be on file for the email.
    // bbf-lead-capture stages every submission into bbf_active_clients (lowercase
    // vault_email). No row → never screened → no checkout session is minted.
    if (!email || !EMAIL_RE.test(email)) return jsonResponse({ ok: false, error: 'invalid_email' }, 400, origin);
    const { data: screened, error: selErr } = await supabase
      .from('bbf_active_clients').select('id').eq('vault_email', email).limit(1);
    if (selErr) {
      console.error('[bbf-create-checkout] screening lookup failed:', selErr.message);
      return jsonResponse({ ok: false, error: 'screening_lookup_failed' }, 503, origin);
    }
    if (!Array.isArray(screened) || screened.length === 0) {
      console.warn(`[bbf-create-checkout] BLOCKED — no screening on file for ${email}`);
      return jsonResponse({ ok: false, error: 'screening_required' }, 403, origin);
    }
  }

  if (!email || !EMAIL_RE.test(email)) return jsonResponse({ ok: false, error: 'invalid_email' }, 400, origin);

  // ── Mint the gated Checkout Session ──
  const stripe = new Stripe(STRIPE_API_KEY, { apiVersion: '2024-11-20.acacia' });
  const base = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: info.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      allow_promotion_codes: true,
      metadata: { tier: info.tier, screened: 'true', bbf_checkout: vaultToken ? 'gated_vault' : 'gated_funnel' },
      success_url: `${base}/?checkout=success`,
      cancel_url: `${base}/?checkout=cancelled`,
    });
    console.log(`[bbf-create-checkout] session minted · ${info.tier} · ${email} · ${vaultToken ? 'vault' : 'funnel'}`);
    return jsonResponse({ ok: true, url: session.url }, 200, origin);
  } catch (e) {
    console.error('[bbf-create-checkout] stripe session create failed:', e instanceof Error ? e.message : String(e));
    return jsonResponse({ ok: false, error: 'checkout_create_failed' }, 502, origin);
  }
});
