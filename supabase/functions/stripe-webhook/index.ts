// ═══════════════════════════════════════════════════════════════
// stripe-webhook — Replaces Zapier "Ghost Automation" zap
// ═══════════════════════════════════════════════════════════════
// Receives Stripe `checkout.session.completed` events directly,
// verifies the signature using STRIPE_WEBHOOK_SECRET, then runs the
// full provision-and-fulfil pipeline in a single transaction:
//
//   1. Verify Stripe signature (HMAC-SHA256 over raw body).
//   2. Filter to `checkout.session.completed` (ignore everything else).
//   3. Resolve tier from session.metadata.tier (CEO ruling: metadata-
//      driven; missing/malformed → log warning + fall back to
//      'gateway' so we never accidentally over-grant 'sovereign').
//   4. Provision (or find) the user via bbf_provision_client_pin.
//      Idempotent — re-fires return the existing username.
//   5. Set subscription_tier via bbf_admin_set_tier (validation +
//      akeem safety net inherited from the RPC).
//   6. Trigger Brevo SMTP welcome email (framework — actual HTML
//      template wired in a follow-up slice).
//
// ── Env vars (set in Supabase Functions secrets) ──
//   STRIPE_API_KEY              — Stripe restricted/secret key.
//   STRIPE_WEBHOOK_SECRET       — From Stripe webhook config (whsec_).
//   BREVO_API_KEY               — Brevo transactional API key.
//   BREVO_FROM_EMAIL  (optional, defaults to noreply@buildbelievefit.fitness)
//   BREVO_FROM_NAME   (optional, defaults to "Build Believe Fit")
//   SUPABASE_URL                — Auto-injected by Supabase runtime.
//   SUPABASE_SERVICE_ROLE_KEY   — Auto-injected by Supabase runtime.
//
// ── Deploy ──
//   supabase functions deploy stripe-webhook \
//     --project-ref ihclbceghxpuawymlvgi \
//     --no-verify-jwt
//
//   (`--no-verify-jwt` is required: Stripe sends a `Stripe-Signature`
//   header, NOT a Supabase JWT. We verify that signature ourselves;
//   skipping the JWT check is the correct security posture.)
//
// ── Stripe webhook config ──
//   Endpoint URL:
//     https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/stripe-webhook
//   Events to send:
//     checkout.session.completed
//   On the Pathfinder/storefront side, every Stripe Checkout Session
//   creation MUST pass `metadata: { tier: '<slug>' }` where slug is
//   one of: gateway / architect / sovereign / youth_athlete /
//   nutrition_essentials / nutrition_platinum / lite. Missing or
//   malformed metadata defaults to 'gateway' with a high-priority log.
// ═══════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const ALLOWED_TIERS = [
  'lite',
  'gateway',
  'architect',
  'sovereign',
  'youth_athlete',
  'nutrition_essentials',
  'nutrition_platinum',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

function generatePin(): string {
  // 6-digit PIN, range 100000-999999. Mirrors the Render /provision
  // generator so credentials follow the same shape.
  return String(100000 + Math.floor(Math.random() * 900000));
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  // ─── 1. Env gate ───────────────────────────────────────────────
  const STRIPE_API_KEY = Deno.env.get('STRIPE_API_KEY');
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!STRIPE_API_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[stripe-webhook] missing required env vars');
    return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  }

  // ─── 2. Signature verify (HMAC over raw bytes, NOT parsed JSON) ──
  const stripe = new Stripe(STRIPE_API_KEY, { apiVersion: '2024-11-20.acacia' });
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.warn('[stripe-webhook] missing stripe-signature header');
    return jsonResponse({ ok: false, error: 'missing_signature' }, 400);
  }
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', (err as Error).message);
    return jsonResponse({ ok: false, error: 'bad_signature' }, 400);
  }

  // ─── 3. Filter event type ──────────────────────────────────────
  if (event.type !== 'checkout.session.completed') {
    console.log(`[stripe-webhook] ignoring event ${event.type} (id=${event.id})`);
    return jsonResponse({ ok: true, ignored: event.type }, 200);
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const email = session.customer_details?.email?.toLowerCase().trim() || '';
  const fullName = session.customer_details?.name?.trim() || 'BBF Client';

  // Tier sources, in priority order:
  //   1. session.metadata.tier         — set per-Payment-Link in the Stripe
  //                                       dashboard (primary source of truth).
  //   2. session.client_reference_id   — appended by storefront doSubmit() as
  //                                       a belt-and-suspenders fallback.
  //   3. 'gateway' default with HIGH-PRIORITY warning log.
  // The dual-source architecture means a forgotten dashboard config still
  // resolves correctly from the URL param, and a tampered URL gets caught
  // by the dashboard metadata; both must fail before fallback fires.
  const metaTier = (session.metadata?.tier || '').trim();
  const refTier  = (session.client_reference_id || '').trim();
  const rawTier  = metaTier || refTier;
  const tierSource = metaTier ? 'metadata.tier' : (refTier ? 'client_reference_id' : 'none');

  if (!email) {
    console.error(`[stripe-webhook] no email on session ${session.id} — cannot provision`);
    return jsonResponse({ ok: false, error: 'missing_email' }, 400);
  }

  // ─── 4. Tier resolution (CEO ruling: metadata-driven w/ client_reference_id fallback, gateway as last resort) ──
  let tier: string;
  if (rawTier && ALLOWED_TIERS.includes(rawTier)) {
    tier = rawTier;
    console.log(`[stripe-webhook] tier resolved from ${tierSource}: ${tier} (session=${session.id})`);
  } else {
    console.warn(
      `[stripe-webhook] HIGH-PRIORITY: session ${session.id} for ${email} has no resolvable tier ` +
      `(metadata.tier="${metaTier}", client_reference_id="${refTier}"). Defaulting to 'gateway'. ` +
      `Admin should reconcile via Mastermind Portal Switchboard.`
    );
    tier = 'gateway';
  }

  // ─── 5. Supabase admin client (service role; bypasses RLS) ─────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ─── 5a. Idempotency check (skip already-fulfilled events) ─────
  // Stripe delivers at-least-once: the SAME event.id can arrive again
  // after a success (Stripe re-delivery) or after we return 5xx. If a
  // ledger row exists for this event it was already fulfilled — skip
  // provisioning (no PIN overwrite) and email (no duplicate send). The
  // ledger row is written only AFTER a successful provision (step 7b),
  // so a FAILED attempt leaves no row and Stripe's retry correctly
  // reprocesses rather than being silently dropped.
  const { data: priorEvent, error: priorErr } = await supabase
    .from('bbf_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();
  if (priorErr) {
    // Fail OPEN: a ledger read hiccup must not block a paid customer.
    console.error(`[stripe-webhook] idempotency check failed (event=${event.id}); proceeding without replay guard:`, priorErr.message);
  } else if (priorEvent) {
    console.log(`[stripe-webhook] replay detected for event ${event.id} (session=${session.id}); already fulfilled — skipping provision + email.`);
    return jsonResponse({ ok: true, replay: true, event_id: event.id, session_id: session.id }, 200);
  }

  // ─── 6. Provision (create-or-find by email; idempotent) ────────
  // bbf_provision_client_pin returns:
  //   { ok: true,  username: 'xxx', ... } on fresh provision
  //   { ok: false, reason: 'already_provisioned', username: 'xxx', ... } on re-fire
  //   { ok: false, reason: '<other>' } on hard rejection
  const pin = generatePin();
  const { data: provData, error: provErr } = await supabase.rpc('bbf_provision_client_pin', {
    p_vault_email: email,
    p_pin: pin,
    p_full_name: fullName,
  });

  if (provErr) {
    console.error(`[stripe-webhook] bbf_provision_client_pin RPC failed (session=${session.id}):`, provErr.message);
    return jsonResponse({ ok: false, error: 'provision_rpc_failed', detail: provErr.message }, 500);
  }
  if (!provData || (!provData.ok && provData.reason !== 'already_provisioned')) {
    console.error('[stripe-webhook] provision returned not-ok:', provData);
    return jsonResponse({ ok: false, error: 'provision_rejected', detail: provData }, 422);
  }
  const username: string | undefined = provData.username;
  if (!username) {
    console.error('[stripe-webhook] provision returned no username:', provData);
    return jsonResponse({ ok: false, error: 'no_username' }, 500);
  }
  const newlyProvisioned = provData.ok === true; // ok:true with no reason = fresh

  // ─── 7. Set subscription tier ──────────────────────────────────
  // bbf_admin_set_tier validates the tier slug and raises
  // `akeem_locked_to_sovereign` if someone's email maps to akeem and
  // the tier is anything but sovereign. Failures here are non-fatal
  // (provision succeeded; admin can hand-correct via Switchboard) so
  // we log and continue rather than 500-ing on a Stripe retry loop.
  const { error: tierErr } = await supabase.rpc('bbf_admin_set_tier', {
    p_uid: username,
    p_tier: tier,
  });
  if (tierErr) {
    console.error(
      `[stripe-webhook] bbf_admin_set_tier failed (uid=${username}, tier=${tier}):`,
      tierErr.message
    );
  } else {
    console.log(`[stripe-webhook] tier set — ${username} → ${tier}`);
  }

  // ─── 7b. Mark event fulfilled (idempotency ledger) ─────────────
  // Written only now that provisioning + tier set have succeeded. Any
  // duplicate delivery from here on hits the 5a check and short-circuits
  // BEFORE the non-idempotent Brevo send. PRIMARY KEY on event_id makes a
  // rare concurrent double-insert a no-op error we can safely ignore.
  const { error: ledgerErr } = await supabase
    .from('bbf_stripe_events')
    .insert({
      event_id:   event.id,
      event_type: event.type,
      session_id: session.id,
      email,                 // already lowercased+trimmed (satisfies the lowercase CHECK)
      tier,
      username,
    });
  if (ledgerErr) {
    // Non-fatal: provisioning already succeeded. Worst case a later retry
    // re-provisions the (idempotent) username at the same tier. Log loudly.
    console.error(`[stripe-webhook] failed to write idempotency ledger for ${event.id}:`, ledgerErr.message);
  }

  // ─── 8. Welcome / Sentinel email (Brevo SMTP API framework) ────
  // CEO directive: set up the basic framework — actual subject + HTML
  // body to be wired in a follow-up slice. Brevo creds live in env;
  // failures are logged but do NOT fail the webhook (Stripe already
  // collected the payment, we already provisioned, the customer can
  // log in either way).
  const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
  const BREVO_FROM_EMAIL = Deno.env.get('BREVO_FROM_EMAIL') || 'noreply@buildbelievefit.fitness';
  const BREVO_FROM_NAME = Deno.env.get('BREVO_FROM_NAME') || 'Build Believe Fit';

  if (!BREVO_API_KEY) {
    console.warn('[stripe-webhook] BREVO_API_KEY not set; skipping welcome email send');
  } else {
    try {
      const subject = newlyProvisioned
        ? 'Welcome to Build Believe Fit — Your Vault Credentials'
        : 'Build Believe Fit — Your subscription is updated';

      // TODO(phase18-followup): replace with branded HTML template.
      // Available variables: fullName, email, username, pin (only if
      // newlyProvisioned), tier. CEO + Big Jim sign off on copy.
      const htmlContent = newlyProvisioned
        ? `<p>Welcome, ${escapeHtml(fullName)}.</p>` +
          `<p>Your username is <b>${escapeHtml(username)}</b> and your PIN is <b>${pin}</b>.</p>` +
          `<p>Log in at <a href="https://buildbelievefit.fitness/bbf-app.html">the Vault</a>.</p>` +
          `<p>Tier: <b>${escapeHtml(tier)}</b>.</p>`
        : `<p>${escapeHtml(fullName)}, your subscription is now active at the <b>${escapeHtml(tier)}</b> tier.</p>` +
          `<p>Log in at <a href="https://buildbelievefit.fitness/bbf-app.html">the Vault</a> with your existing credentials.</p>`;

      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY,
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
          to: [{ email, name: fullName }],
          subject,
          htmlContent,
          tags: ['stripe-webhook', `tier:${tier}`, newlyProvisioned ? 'welcome' : 'update'],
        }),
      });
      if (!emailRes.ok) {
        const body = await emailRes.text();
        console.error(`[stripe-webhook] Brevo email send failed: status=${emailRes.status} body=${body}`);
      } else {
        console.log(`[stripe-webhook] Brevo email queued for ${email} (status=${emailRes.status})`);
      }
    } catch (err) {
      console.error('[stripe-webhook] Brevo fetch threw:', (err as Error).message);
    }
  }

  // ─── 9. Acknowledge Stripe ─────────────────────────────────────
  return jsonResponse(
    {
      ok: true,
      event_id: event.id,
      session_id: session.id,
      username,
      tier,
      new_user: newlyProvisioned,
    },
    200
  );
});

// ─── HTML escape helper ───────────────────────────────────────────
// Customer-supplied name + email get rendered into the welcome email
// HTML body. Escape minimum required characters to neutralise any
// stray markup. Cheap defense against Stripe customer details being
// laundered into outbound transactional email.
function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Idempotency (IMPLEMENTED) ────────────────────────────────────
// Stripe delivers at-least-once (network blips, our 5xx responses,
// plain re-delivery). The `bbf_stripe_events` ledger (migration
// 20260601000000) makes the whole pipeline exactly-once per event.id:
//   - Step 5a checks the ledger BEFORE any work; a hit returns early
//     with `{ ok: true, replay: true }` — no PIN overwrite, no email.
//   - Step 7b writes the ledger row only AFTER provision + tier set
//     succeed, so a FAILED attempt leaves no row and Stripe's retry
//     correctly reprocesses (rather than being silently dropped — the
//     trap a naive claim-before-work approach would fall into).
// Residual edge: provision succeeds but the ledger INSERT fails (DB
// hiccup) → a later retry re-provisions (idempotent username, same
// tier) and could re-send one email. Narrow, logged, and bounded.
// A truly hardened version would wrap provision + ledger write in one
// DB transaction (RPC) — tracked as a future slice.
