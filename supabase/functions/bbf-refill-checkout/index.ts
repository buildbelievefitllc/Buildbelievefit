// ═══════════════════════════════════════════════════════════════
// bbf-refill-checkout — Blueprint token-refill Stripe Checkout minting
// ═══════════════════════════════════════════════════════════════
// One-time micro-transaction to top up a Blueprint client's monthly generation
// tokens (on TOP of their tier allotment). IN-VAULT ONLY: the caller proves identity
// with their server-revocable vault_token (a provisioned bbf_users row is itself
// proof of original screening — no PAR-Q re-check, mirroring bbf-create-checkout's
// vault path). The SERVER, never the client, authorizes payment.
//
// Body:  { vault_token, pack: 'basic' | 'pro' }
// Packs mirror REFILL_PACKS in frontend/src/lib/blueprintTokensApi.js — $1.99 basic
// / $0.99 pro. The pro pack is DISCOUNTED, so it is restricted to blueprint_pro
// accounts (a basic user can't buy the cheaper pro token). Price IDs come from env
// so the seam is ready before the Stripe products exist.
//
// The minted session carries metadata { bbf_purchase_type:'blueprint_refill',
// user_id, pack, tokens } — the existing stripe-webhook reads that and credits via
// bbf_credit_blueprint_tokens_for_event (idempotent, service-role).
//
// Env: STRIPE_API_KEY, STRIPE_PRICE_REFILL_BASIC, STRIPE_PRICE_REFILL_PRO,
//   SUPABASE_URL*, SUPABASE_SERVICE_ROLE_KEY* (* auto-injected).
// Deploy with verify_jwt = false (auth is the custom vault-token check below).
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

// pack → { tokens, env price var, tiers allowed to buy it }.
const PACKS: Record<string, { tokens: number; priceEnv: string; tiers: string[] }> = {
  basic: { tokens: 1, priceEnv: 'STRIPE_PRICE_REFILL_BASIC', tiers: ['blueprint', 'blueprint_basic'] },
  pro:   { tokens: 1, priceEnv: 'STRIPE_PRICE_REFILL_PRO',   tiers: ['blueprint_pro'] },
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
  if (origin && !ALLOWED_ORIGINS.has(origin)) return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin);

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

  const packKey = String(body?.pack ?? '').trim().toLowerCase();
  const pack = PACKS[packKey];
  if (!pack) return jsonResponse({ ok: false, error: 'invalid_pack' }, 400, origin);

  const vaultToken = String(body?.vault_token ?? body?.vaultToken ?? '').trim();
  if (!vaultToken) return jsonResponse({ ok: false, error: 'missing_session' }, 401, origin);

  const priceId = String(Deno.env.get(pack.priceEnv) ?? '').trim();
  if (!priceId) return jsonResponse({ ok: false, error: 'refill_not_configured', detail: `${pack.priceEnv} is not set` }, 503, origin);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Identity resolved SERVER-SIDE from the vault token (a client uid is never trusted).
  const { data: uid, error: uidErr } = await supabase.rpc('_bbf_uid_from_vault_token', { p_session_token: vaultToken });
  if (uidErr || typeof uid !== 'string' || !uid) return jsonResponse({ ok: false, error: 'invalid_session' }, 401, origin);

  const { data: urows, error: uErr } = await supabase
    .from('bbf_users').select('email,subscription_tier').eq('id', uid).is('deleted_at', null).limit(1);
  const found = Array.isArray(urows) ? urows[0] : null;
  if (uErr || !found?.email) return jsonResponse({ ok: false, error: 'invalid_session' }, 401, origin);

  // Pack must match the caller's tier — blocks a basic user buying the cheaper pro token.
  const tier = String(found.subscription_tier ?? '').trim().toLowerCase();
  if (!pack.tiers.includes(tier)) {
    return jsonResponse({ ok: false, error: 'pack_tier_mismatch', detail: `tier "${tier || '(none)'}" cannot buy the ${packKey} pack` }, 403, origin);
  }

  const email = String(found.email).trim().toLowerCase();
  const stripe = new Stripe(STRIPE_API_KEY, { apiVersion: '2024-11-20.acacia' });
  const base = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',                       // one-time top-up, not a subscription
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      metadata: {
        bbf_purchase_type: 'blueprint_refill',
        user_id: uid,
        pack: packKey,
        tokens: String(pack.tokens),
      },
      success_url: `${base}/?refill=success`,
      cancel_url: `${base}/?refill=cancelled`,
    });
    console.log(`[bbf-refill-checkout] session minted · ${packKey} · ${email}`);
    return jsonResponse({ ok: true, url: session.url }, 200, origin);
  } catch (e) {
    console.error('[bbf-refill-checkout] stripe session create failed:', e instanceof Error ? e.message : String(e));
    return jsonResponse({ ok: false, error: 'checkout_create_failed' }, 502, origin);
  }
});
