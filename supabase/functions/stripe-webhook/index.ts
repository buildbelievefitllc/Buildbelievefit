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

  // IDEMPOTENCY GATE - Phase 18.1
  const { data: claim, error: claimErr } = await supabase
    .from('bbf_stripe_events')
    .insert({ event_id: event.id, event_type: event.type, session_id: session.id, email, tier })
    .select('event_id')
    .maybeSingle();
  if (claimErr) {
    if (claimErr.code === '23505') {
      console.log(`[stripe-webhook] replay skipped event_id=${event.id}`);
      return jsonResponse({ ok: true, replay: true, event_id: event.id }, 200);
    }
    return jsonResponse({ ok: false, error: 'idempotency_claim_failed', detail: claimErr.message }, 500);
  }
  if (!claim) {
    return jsonResponse({ ok: true, replay: true, event_id: event.id }, 200);
  }

  const { data: existingClient, error: existingErr } = await supabase
    .from('bbf_active_clients').select('id').eq('vault_email', email).limit(1).maybeSingle();
  if (existingErr) return jsonResponse({ ok: false, error: 'active_client_lookup_failed', detail: existingErr.message }, 500);
  if (!existingClient) {
    const { error: insertErr } = await supabase.from('bbf_active_clients').insert({
      client_name: fullName, client_email: email, vault_email: email,
      spectrum_tier: tier, onboarding_status: 'Pending', liability_cleared: true,
    });
    if (insertErr) return jsonResponse({ ok: false, error: 'active_client_insert_failed', detail: insertErr.message }, 500);
  }

  const pin = generatePin();
  const { data: provData, error: provErr } = await supabase.rpc('bbf_provision_client_pin', {
    p_vault_email: email, p_pin: pin, p_full_name: fullName,
  });
  if (provErr) return jsonResponse({ ok: false, error: 'provision_rpc_failed', detail: provErr.message }, 500);
  if (!provData || (!provData.ok && provData.reason !== 'already_provisioned')) {
    return jsonResponse({ ok: false, error: 'provision_rejected', detail: provData }, 422);
  }
  const username = provData.username || provData.existing_uid;
  if (!username) return jsonResponse({ ok: false, error: 'no_username' }, 500);
  const newlyProvisioned = provData.ok === true;

  try { await supabase.from('bbf_stripe_events').update({ username }).eq('event_id', event.id); } catch (_) {}

  const { error: tierErr } = await supabase.rpc('bbf_admin_set_tier', { p_uid: username, p_tier: tier });
  if (tierErr) console.error(`[stripe-webhook] bbf_admin_set_tier failed:`, tierErr.message);

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
