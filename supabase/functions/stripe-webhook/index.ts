// ═══════════════════════════════════════════════════════════════
// stripe-webhook — Stripe checkout fulfillment + provisioning
// ═══════════════════════════════════════════════════════════════
// Receives Stripe `checkout.session.completed`, verifies the signature,
// then runs the ENTIRE fulfillment write-path as ONE atomic DB
// transaction via the bbf_stripe_fulfillment_transaction RPC
// (active_clients insert → provision → set tier → idempotency ledger).
// If any step fails the RPC rolls back and we return 5xx so Stripe
// retries — no split-brain / stranded-payment state.
//
// IDEMPOTENCY lives in the RPC: a replay returns { replay: true } and
// performs no writes. The ledger row is written only on full success.
//
// ── Env vars ── STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET, BREVO_API_KEY,
//   BREVO_FROM_EMAIL?, BREVO_FROM_NAME?, SUPABASE_URL*, SUPABASE_SERVICE_ROLE_KEY*
//   (* auto-injected). Deploy with --no-verify-jwt (Stripe sends a
//   Stripe-Signature header, not a Supabase JWT; we verify it ourselves).
// ═══════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const ALLOWED_TIERS = ['lite','gateway','architect','sovereign','youth_athlete','nutrition_essentials','nutrition_platinum'];
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

function generatePin() { return String(100000 + Math.floor(Math.random()*900000)); }
function jsonResponse(body, status=200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
function escapeHtml(input) { return String(input).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  const STRIPE_API_KEY = Deno.env.get('STRIPE_API_KEY');
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!STRIPE_API_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  }

  const stripe = new Stripe(STRIPE_API_KEY, { apiVersion: '2024-11-20.acacia' });
  const signature = req.headers.get('stripe-signature');
  if (!signature) return jsonResponse({ ok: false, error: 'missing_signature' }, 400);
  const rawBody = await req.text();
  let event;
  try { event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET); }
  catch (err) { return jsonResponse({ ok: false, error: 'bad_signature' }, 400); }

  if (event.type !== 'checkout.session.completed') {
    return jsonResponse({ ok: true, ignored: event.type }, 200);
  }

  const session = event.data.object;
  const email = session.customer_details?.email?.toLowerCase().trim() || '';
  const fullName = session.customer_details?.name?.trim() || 'BBF Client';
  const metaTier = (session.metadata?.tier || '').trim();
  const refTier  = (session.client_reference_id || '').trim();
  const rawTier  = metaTier || refTier;
  const tierSource = metaTier ? 'metadata.tier' : (refTier ? 'client_reference_id' : 'none');

  if (!email) return jsonResponse({ ok: false, error: 'missing_email' }, 400);

  let tier;
  if (rawTier && ALLOWED_TIERS.includes(rawTier)) {
    tier = rawTier;
    console.log(`[stripe-webhook] tier resolved from ${tierSource}: ${tier}`);
  } else {
    console.warn(`[stripe-webhook] HIGH-PRIORITY: session ${session.id} has no resolvable tier. Defaulting to gateway.`);
    tier = 'gateway';
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ─── ATOMIC FULFILLMENT (single transactional RPC) ───
  // active_clients insert → provision → set tier → ledger write, all-or-
  // nothing. The pin is generated here (so we can show it in the welcome
  // email) and passed in for the provision step.
  const pin = generatePin();
  const { data: txn, error: txnErr } = await supabase.rpc('bbf_stripe_fulfillment_transaction', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_session_id: session.id,
    p_email: email,
    p_full_name: fullName,
    p_tier: tier,
    p_pin: pin,
  });

  if (txnErr) {
    // The transaction rolled back — return 5xx so Stripe retries. No
    // stranded state: nothing was committed.
    console.error(`[stripe-webhook] fulfillment transaction failed (session=${session.id}):`, txnErr.message);
    return jsonResponse({ ok: false, error: 'fulfillment_failed', detail: txnErr.message }, 500);
  }
  if (txn?.replay) {
    console.log(`[stripe-webhook] replay skipped event_id=${event.id}`);
    return jsonResponse({ ok: true, replay: true, event_id: event.id }, 200);
  }
  const username = txn?.username;
  if (!username) {
    console.error('[stripe-webhook] fulfillment returned no username:', txn);
    return jsonResponse({ ok: false, error: 'no_username', detail: txn }, 500);
  }
  const newlyProvisioned = txn?.new_user === true;

  // ─── Welcome / update email (Brevo; non-fatal — fulfillment already committed) ───
  const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
  const BREVO_FROM_EMAIL = Deno.env.get('BREVO_FROM_EMAIL') || 'buildbelievefitllc@buildbelievefit.fitness';
  const BREVO_FROM_NAME = Deno.env.get('BREVO_FROM_NAME') || 'Build Believe Fit';

  if (BREVO_API_KEY) {
    try {
      const subject = newlyProvisioned ? 'Welcome to Build Believe Fit - Your Vault Credentials' : 'Build Believe Fit - Your subscription is updated';
      const htmlContent = newlyProvisioned
        ? `<p>Welcome, ${escapeHtml(fullName)}.</p><p>Your username is <b>${escapeHtml(username)}</b> and your PIN is <b>${pin}</b>.</p><p>Log in at <a href="https://buildbelievefit.fitness/bbf-app.html">the Vault</a>.</p><p>Tier: <b>${escapeHtml(tier)}</b>.</p>`
        : `<p>${escapeHtml(fullName)}, your subscription is now active at the <b>${escapeHtml(tier)}</b> tier.</p><p>Log in at <a href="https://buildbelievefit.fitness/bbf-app.html">the Vault</a> with your existing credentials.</p>`;
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
          to: [{ email, name: fullName }],
          subject, htmlContent,
          tags: ['stripe-webhook', `tier:${tier}`, newlyProvisioned ? 'welcome' : 'update'],
        }),
      });
    } catch (err) { console.error('[stripe-webhook] Brevo fetch threw:', err.message); }
  }

  return jsonResponse({ ok: true, event_id: event.id, session_id: session.id, username, tier, new_user: newlyProvisioned }, 200);
});
