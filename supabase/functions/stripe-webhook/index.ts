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
//   (* auto-injected). Trilingual welcome templates (optional — inline HTML
//   fallback if unset): BREVO_WELCOME_TEMPLATE_EN / _ES / _PT (Brevo template
//   ids). Locale comes from bbf_users.preferred_locale (Stripe metadata fallback).
//   Deploy with --no-verify-jwt (Stripe sends a Stripe-Signature header, not a
//   Supabase JWT; we verify it ourselves).
// ═══════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Canonical pricing slugs (marketing matrix 2026-06) UNION the 7 legacy
// slugs. The legacy set is retained while the monolith storefront is still
// live (it sends legacy slugs); strip it once the React storefront cuts over.
// Keep in sync with bbf_tiers + the bbf_admin_set_tier allowlist.
const ALLOWED_TIERS = [
  // 13 canonical
  'catalyst','momentum','autonomous',
  'fuel_foundation','fuel_performance','fuel_sovereign',
  'rising_athlete',
  'kickstart_6wk_3x','kickstart_6wk_4x',
  'transformation_8wk_3x','transformation_8wk_4x',
  'sovereign_12wk_3x','sovereign_12wk_4x',
  // 7 legacy (monolith storefront — keep until retired)
  'lite','gateway','architect','sovereign','youth_athlete','nutrition_essentials','nutrition_platinum',
  // Vanguard Blueprint Override micro-sub tiers (2026-07-19)
  'blueprint_basic','blueprint_pro',
];

// Live Stripe Payment Link price IDs → canonical tier slugs. The 4-tab Revenue
// Matrix (fitness / nutrition / youth / hybrid) checks out via static
// buy.stripe.com Payment Links that carry NO metadata.tier, so the SKU is
// resolved from the purchased price. Keep in sync with
// frontend/src/lib/pricingMatrix.js (acct_1TLzQCQ4j3uHTi7P, provisioned 2026-06-02).
const PRICE_TO_TIER = {
  // Online Fitness · recurring monthly
  'price_1TdtVCQ4j3uHTi7PEjvMihnk': 'catalyst',         // BBF Catalyst · $9.99
  'price_1TdtVDQ4j3uHTi7Pb2hGyXBi': 'momentum',         // BBF Momentum · $19.99
  'price_1TdtVDQ4j3uHTi7PP2uWTj0y': 'autonomous',       // BBF Autonomous · $49.99
  // Online Nutrition (Fuel) · recurring monthly
  'price_1TdtVEQ4j3uHTi7PQ0fOArfI': 'fuel_foundation',  // Fuel Foundation · $7.99
  'price_1TdtVEQ4j3uHTi7PEvGYoQkW': 'fuel_performance', // Fuel Performance · $14.99
  'price_1TdtVFQ4j3uHTi7PZ65aKtTI': 'fuel_sovereign',   // Fuel Sovereign · $29.99
  // Youth Athlete · recurring monthly
  'price_1TdtVFQ4j3uHTi7Ponk5039p': 'rising_athlete',   // BBF Rising Athlete · $14.99
  // Hybrid Protocols · one-time (3× / 4× weekly)
  'price_1TdtVGQ4j3uHTi7P51mzlaCT': 'kickstart_6wk_3x',      // Kickstart 6wk · 3× · $399
  'price_1TdtVGQ4j3uHTi7P5AZSEOoS': 'kickstart_6wk_4x',      // Kickstart 6wk · 4× · $499
  'price_1TdtVHQ4j3uHTi7PMh786BoK': 'transformation_8wk_3x', // Transformation 8wk · 3× · $499
  'price_1TdtVHQ4j3uHTi7PhOfSjE61': 'transformation_8wk_4x', // Transformation 8wk · 4× · $649
  'price_1TdtVIQ4j3uHTi7POHmPRFGn': 'sovereign_12wk_3x',     // Sovereign 12wk · 3× · $699
  'price_1TdtVIQ4j3uHTi7PYVF5s0dq': 'sovereign_12wk_4x',     // Sovereign 12wk · 4× · $899
  // Vanguard Blueprint Override · recurring monthly (2026-07-19)
  'price_1Tv2eWQ4j3uHTi7PZ1XeaN0Q': 'blueprint_basic',       // Basic Blueprint · $2.99
  'price_1Tv2flQ4j3uHTi7PtOF9vEnL': 'blueprint_pro',         // Pro Blueprint · $4.99
};
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// S-5b · CSPRNG PIN + weak-pattern rejection (was non-CSPRNG Math.random()).
function generatePin() {
  const WEAK = /^(\d)\1{5}$|^(?:012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210)$|^(19|20)\d{4}$/;
  const buf = new Uint32Array(1); let pin;
  do { crypto.getRandomValues(buf); pin = String(100000 + (buf[0] % 900000)); } while (WEAK.test(pin));
  return pin;
}
function jsonResponse(body, status=200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
function escapeHtml(input) { return String(input).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// Normalize any locale hint → one of BBF's three. Mirrors _shared/locale.ts
// localeCode(); inlined so this payment-critical webhook stays a single source
// file (no cross-function bundling on the fulfillment path).
function normLocale(input) {
  const t = String(input ?? '').trim().toLowerCase();
  if (t === 'es' || t.startsWith('es-') || t.startsWith('es_') || t.startsWith('span') || t.startsWith('esp')) return 'es';
  if (t === 'pt' || t.startsWith('pt-') || t.startsWith('pt_') || t.startsWith('port') || t.startsWith('por') || t.includes('brasil') || t.includes('brazil') || t === 'br') return 'pt';
  return 'en';
}

// ── Phase 2 safety net — durable record of a FAILED welcome dispatch ──────────
// The PIN is generated in-memory and stored only hashed, so a lost welcome email
// strands a PAID customer with no way to learn their credentials (Stripe already
// got its 200; we never retry the email). We persist a recoverable row in
// bbf_email_events (event_type='welcome_send_failed', payload.status='failed' + a
// SECURE single-use resend token, stored ONLY as a SHA-256 hash) so the
// bbf-resend-welcome admin/cron worker can reissue a fresh PIN and resend. Purely
// additive + best-effort: it never throws and runs AFTER the committed fulfillment,
// so it can never affect tiering/provisioning.
async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function recordWelcomeFailure(supabase, { email, username, tier, locale, sessionId, newUser, reason }) {
  try {
    const raw = new Uint8Array(24);
    crypto.getRandomValues(raw);
    const resendToken = Array.from(raw).map((b) => b.toString(16).padStart(2, '0')).join('');
    const resendTokenSha256 = await sha256Hex(resendToken);
    const { error } = await supabase.from('bbf_email_events').insert({
      event_type: 'welcome_send_failed',
      email,
      message_id: sessionId,
      payload: {
        status: 'failed',
        kind: 'welcome',
        username: username ?? null,
        tier: tier ?? null,
        locale: locale ?? null,
        new_user: !!newUser,
        reason: reason ?? 'brevo_send_failed',
        attempts: 1,
        failed_at: new Date().toISOString(),
        // Secure single-use resend token — only the HASH is persisted (never the
        // raw value). Enables an idempotent, audit-safe recovery handle.
        resend_token_sha256: resendTokenSha256,
        resend_token_ref: resendToken.slice(0, 8),
      },
    });
    if (error) console.error('[stripe-webhook] recordWelcomeFailure insert failed:', error.message);
    else console.warn(`[stripe-webhook] WELCOME FAILURE recorded (recoverable) · user=${username} session=${sessionId} reason=${reason}`);
  } catch (e) {
    console.error('[stripe-webhook] recordWelcomeFailure threw:', e.message);
  }
}

// ─── Onboarding DISPATCH GATE (blueprint §3.2) ───────────────────────────────
// After fulfillment commits, warm the Hub via bbf-cold-start-orchestrator and gate
// the credential email on its verdict:
//   cold_start_ready              → dispatch now
//   cold_start_degraded           → ONE heal cycle (idempotent re-run), then dispatch
//                                   REGARDLESS — Layer-2 config defaults carry the UI,
//                                   so a paid user with a PIN always has a populated
//                                   (fallback) dashboard.
//   orchestrator failure/unknown  → the gate FAILED ENTIRELY: return dispatch:false so
//                                   the caller enqueues a recoverable welcome_send_failed
//                                   row for bbf-resend-welcome instead of sending now.
// NEVER throws — fulfillment already committed; this only decides dispatch-vs-enqueue.
async function runColdStartGate(supabaseUrl, params) {
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';
  const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
  if (!ADMIN_TOKEN && !CRON_SECRET) {
    console.error('[stripe-webhook] CRITICAL: neither BBF_COACH_AGENT_TOKEN nor CRON_SECRET is set — the dispatch gate is un-invokable; deferring dispatch to the retry worker.');
    return { state: 'gate_unconfigured', dispatch: false, reason: 'no_secret' };
  }
  const url = `${supabaseUrl}/functions/v1/bbf-cold-start-orchestrator`;
  const headers = { 'Content-Type': 'application/json' };
  if (ADMIN_TOKEN) headers['x-bbf-admin-token'] = ADMIN_TOKEN; else headers['x-cron-secret'] = CRON_SECRET;
  const invoke = async (source) => {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...params, source }) });
    const resBody = await r.json().catch(() => null);
    return { httpOk: r.ok, status: r.status, body: resBody };
  };
  try {
    const first = await invoke('stripe_webhook');
    if (!first.httpOk || !first.body?.ok) {
      console.error(`[stripe-webhook] cold-start gate failed entirely (status=${first.status}); enqueueing for the retry worker.`);
      return { state: first.body?.state ?? 'gate_failed', dispatch: false, reason: `orchestrator_${first.status}` };
    }
    if (first.body.state === 'cold_start_ready') {
      return { state: 'cold_start_ready', dispatch: true };
    }
    if (first.body.state === 'cold_start_degraded') {
      // ONE heal cycle first (idempotent cascade re-run), then dispatch regardless.
      let healed = 'cold_start_degraded';
      try {
        const second = await invoke('stripe_webhook_heal');
        if (second.httpOk && second.body?.state) healed = second.body.state;
      } catch (_e) { /* heal is best-effort; the sweeper will retry every 10 min */ }
      console.warn(`[stripe-webhook] cold-start degraded → post-heal=${healed}; dispatching regardless (Layer-2 defaults carry the UI).`);
      return { state: healed, dispatch: true, degraded: true };
    }
    // Any other/unknown state → treat as a hard gate failure (do not dispatch).
    return { state: first.body.state ?? 'unknown', dispatch: false, reason: 'unknown_state' };
  } catch (e) {
    console.error('[stripe-webhook] cold-start gate threw; enqueueing for the retry worker:', e.message);
    return { state: 'gate_error', dispatch: false, reason: e.message };
  }
}

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

  if (!email) return jsonResponse({ ok: false, error: 'missing_email' }, 400);

  // ─── Tier resolution (4-tab Revenue Matrix aware) ───
  // Priority: explicit metadata.tier / client_reference_id (legacy monolith
  // storefront) → the purchased Stripe price ID mapped to its canonical SKU
  // (the live Payment Links carry no tier metadata, so this is how new-matrix
  // payments are classified) → gateway fallback. Every resolved slug is in the
  // DB allowlist (bbf_admin_set_tier), so fulfillment never raises invalid_tier.
  let tier = '';
  let tierSource = 'none';
  if (metaTier && ALLOWED_TIERS.includes(metaTier)) {
    tier = metaTier; tierSource = 'metadata.tier';
  } else if (refTier && ALLOWED_TIERS.includes(refTier)) {
    tier = refTier; tierSource = 'client_reference_id';
  } else {
    // checkout.session.completed does not embed line items — fetch them and map
    // the purchased price → tier slug.
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
      for (const li of (lineItems?.data || [])) {
        const pid = li?.price?.id || '';
        if (pid && PRICE_TO_TIER[pid]) { tier = PRICE_TO_TIER[pid]; tierSource = `price:${pid}`; break; }
      }
    } catch (err) {
      console.error(`[stripe-webhook] listLineItems failed (session=${session.id}): ${err.message}`);
    }
  }

  if (tier) {
    console.log(`[stripe-webhook] tier resolved from ${tierSource}: ${tier}`);
  } else {
    console.warn(`[stripe-webhook] HIGH-PRIORITY: session ${session.id} has no resolvable tier (meta='${metaTier}' ref='${refTier}'). Defaulting to gateway.`);
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

  // ─── ACK STRIPE NOW · PROVISION IN THE BACKGROUND (EdgeRuntime.waitUntil) ───
  // Fulfillment is committed — the only fact Stripe needs. We ACK 2xx immediately and
  // run the cold-start cascade + gated dispatch in the BACKGROUND so the webhook can
  // NEVER time out while provisioning (a timeout would make Stripe retry into the
  // replay path and skip dispatch). Every post-commit step below is best-effort,
  // idempotent, and queue-recoverable (blueprint §0.2.3 / §1.3.4).
  const postCommit = (async () => {
  // ─── Closed-loop conversion capture (Brief 5 · best-effort, non-blocking) ───
  // Tags the conversion to a marketing avatar (Stripe metadata.avatar, else a
  // tier heuristic) for the monetization engine. Wrapped so a capture failure
  // can NEVER affect fulfillment — that already committed atomically above.
  try {
    const avatarRaw = (session.metadata?.avatar || '').trim();
    const { error: capErr } = await supabase.rpc('bbf_capture_conversion', {
      p_event_id: event.id,
      p_session_id: session.id,
      p_user_id: txn?.user_id ?? null,
      p_email: email,
      p_tier: tier,
      p_avatar_raw: avatarRaw,
      p_amount_cents: typeof session.amount_total === 'number' ? session.amount_total : null,
      p_currency: session.currency ?? null,
      p_new_user: newlyProvisioned,
    });
    if (capErr) console.error('[stripe-webhook] conversion capture error (non-fatal):', capErr.message);
  } catch (err) {
    console.error('[stripe-webhook] conversion capture threw (non-fatal):', err.message);
  }

  // ─── DISPATCH GATE (Onboarding State Machine · blueprint §3.2) ───
  // The credential email carries the PIN and must NOT precede a warm Hub ("No Empty
  // Dashboards", §0.3). For a brand-new buyer we run the cold-start cascade + gate
  // FIRST; only a ready/degraded verdict authorizes the send. A gate that fails
  // entirely defers to the retry worker (enqueued below — no dispatch now). The
  // atomic fulfillment already committed above, so this can never 5xx the webhook.
  // Existing-user "updated" emails carry no credentials, so they are never gated.
  let coldStartState = 'not_run';
  let dispatchGated = false;
  if (newlyProvisioned) {
    const gate = await runColdStartGate(SUPABASE_URL, {
      user_id: txn?.user_id ?? null, checkout_session_id: session.id, email, tier,
    });
    coldStartState = gate.state;
    dispatchGated = !gate.dispatch;
    console.log(`[stripe-webhook] dispatch gate → state=${coldStartState} dispatch=${gate.dispatch} reason=${gate.reason ?? 'n/a'}`);
  }
  const shouldDispatch = !dispatchGated; // non-new "updated" emails always dispatch

  // ─── Welcome / update email (Brevo; non-fatal — fulfillment already committed) ───
  const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
  const BREVO_FROM_EMAIL = Deno.env.get('BREVO_FROM_EMAIL') || 'buildbelievefitllc@buildbelievefit.fitness';
  const BREVO_FROM_NAME = Deno.env.get('BREVO_FROM_NAME') || 'Build Believe Fit';

  // Did the welcome actually go out? A silent Brevo failure (or a missing key)
  // would strand a paid customer without credentials — tracked so the safety net
  // below can persist a recoverable failure row.
  let welcomeEmailOk = false;
  let emailLocale = 'en';

  if (shouldDispatch && BREVO_API_KEY) {
    try {
      // ── Trilingual template selection ──
      // Source of truth is the athlete's bbf_users.preferred_locale; Stripe
      // checkout metadata is the fallback for a brand-new buyer whose freshly
      // provisioned row still holds the 'en' default. normLocale() normalizes
      // any of these to one of 'en' | 'es' | 'pt' (defaulting to 'en').
      let dbLocale = null;
      try {
        const { data: locRow } = await supabase
          .from('bbf_users').select('preferred_locale').eq('uid', username).maybeSingle();
        dbLocale = locRow?.preferred_locale ?? null;
      } catch (e) {
        console.warn('[stripe-webhook] preferred_locale lookup failed (defaulting to en):', e.message);
      }
      const lang = normLocale(
        dbLocale
        || session.metadata?.preferred_locale
        || session.metadata?.locale
        || session.metadata?.language,
      );
      emailLocale = lang;

      const TEMPLATE_BY_LANG = {
        en: Deno.env.get('BREVO_WELCOME_TEMPLATE_EN'),
        es: Deno.env.get('BREVO_WELCOME_TEMPLATE_ES'),
        pt: Deno.env.get('BREVO_WELCOME_TEMPLATE_PT'),
      };
      const rawTemplate = TEMPLATE_BY_LANG[lang] || TEMPLATE_BY_LANG.en;
      const templateId = rawTemplate ? Number(rawTemplate) : null;
      const firstName = (fullName.split(/\s+/)[0] || fullName).trim();

      // Common envelope. The PIN is passed ONLY via template params / inline
      // body below — never in tags, never logged.
      const base = {
        sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
        to: [{ email, name: fullName }],
        tags: ['stripe-webhook', `tier:${tier}`, `locale:${lang}`, newlyProvisioned ? 'welcome' : 'update'],
      };

      let payload;
      if (newlyProvisioned && templateId && Number.isFinite(templateId)) {
        // Migration target — Brevo-managed trilingual transactional template.
        payload = {
          ...base,
          templateId,
          params: { FIRSTNAME: firstName, USERNAME: username, PIN: pin, TIER: tier, LANGUAGE: lang },
        };
      } else {
        // Fallback — inline HTML. Keeps the pipeline live if the template ids
        // aren't configured yet, and serves the non-new-user "updated" email.
        const subject = newlyProvisioned
          ? 'Welcome to Build Believe Fit - Your Vault Credentials'
          : 'Build Believe Fit - Your subscription is updated';
        const htmlContent = newlyProvisioned
          ? `<p>Welcome, ${escapeHtml(fullName)}.</p><p>Your username is <b>${escapeHtml(username)}</b> and your PIN is <b>${pin}</b>.</p><p>Log in at <a href="https://buildbelievefit.fitness/bbf-app.html">the Vault</a>.</p><p>Tier: <b>${escapeHtml(tier)}</b>.</p>`
          : `<p>${escapeHtml(fullName)}, your subscription is now active at the <b>${escapeHtml(tier)}</b> tier.</p><p>Log in at <a href="https://buildbelievefit.fitness/bbf-app.html">the Vault</a> with your existing credentials.</p>`;
        payload = { ...base, subject, htmlContent };
      }

      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        console.error(`[stripe-webhook] Brevo send failed: status=${r.status} body=${txt.slice(0, 300)}`);
      } else {
        welcomeEmailOk = true;
        console.log(`[stripe-webhook] welcome email sent · mode=${payload.templateId ? 'template:' + payload.templateId : 'inline'} · locale=${lang} · new_user=${newlyProvisioned}`);
      }
    } catch (err) { console.error('[stripe-webhook] Brevo fetch threw:', err.message); }
  } else if (dispatchGated) {
    console.warn(`[stripe-webhook] welcome dispatch WITHHELD by cold-start gate (state=${coldStartState}); enqueueing for the retry worker.`);
  } else {
    console.warn('[stripe-webhook] BREVO_API_KEY not set; welcome email skipped');
  }

  // SAFETY NET (Phase 2 · flight-recorder + recovery) — if a brand-new buyer's
  // welcome did NOT go out — because the dispatch gate WITHHELD it (cold start not
  // ready) OR Brevo failed/was unconfigured — persist a recoverable welcome_send_failed
  // row so bbf-resend-welcome re-issues a fresh PIN and delivers once the cascade is
  // warm (the sweeper heals it in parallel). Best-effort, AFTER the atomic fulfillment
  // commit → it can never affect tiering/provisioning. NEW users only (an "updated"
  // email carries no credentials). This is the ONE enqueue point (no double-record).
  if (!welcomeEmailOk && newlyProvisioned) {
    const reason = dispatchGated
      ? `cold_start_gate:${coldStartState}`
      : (BREVO_API_KEY ? 'brevo_send_failed' : 'brevo_key_missing');
    await recordWelcomeFailure(supabase, {
      email, username, tier, locale: emailLocale, sessionId: session.id, newUser: newlyProvisioned, reason,
    });
  }

    console.log(`[stripe-webhook] post-commit complete · user=${username} new=${newlyProvisioned} cold_start=${coldStartState} dispatched=${welcomeEmailOk} gated=${dispatchGated}`);
  })();

  // Hand the post-commit work to the runtime and ACK Stripe immediately, so
  // provisioning never blocks (or times out) the webhook response. EdgeRuntime.
  // waitUntil keeps the worker alive until the background promise settles.
  const bg = postCommit.catch((e) => console.error('[stripe-webhook] background task error:', e?.message ?? e));
  try {
    // @ts-ignore EdgeRuntime is a Supabase Edge runtime global (absent from the DOM lib)
    EdgeRuntime.waitUntil(bg);
  } catch (_e) {
    await bg; // defensive fallback for a runtime without waitUntil (never in prod)
  }
  return jsonResponse({ ok: true, event_id: event.id, session_id: session.id, username, tier, new_user: newlyProvisioned, provisioning: 'background' }, 200);
});
