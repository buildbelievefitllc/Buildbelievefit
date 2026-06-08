// bbf-simulate-fulfillment — ADMIN-ONLY internal fulfillment test pipe
// ═══════════════════════════════════════════════════════════════════════════
// Runs the EXACT same atomic write-path as stripe-webhook
// (public.bbf_stripe_fulfillment_transaction) against a DUMMY payload, then
// dispatches the same Brevo welcome email and self-verifies login hydration via
// public.bbf_verify_user_pin. This lets an admin exercise the onboarding plumbing
// — Stage 2 (stage plans) → Stage 4 (atomic tiering + PIN provisioning + Brevo) →
// Stage 5 (hydration) — WITHOUT a real card and WITHOUT a signed Stripe event
// (i.e. without the STRIPE_WEBHOOK_SECRET we correctly cannot forge). Stage 3
// (signature verification) is intentionally bypassed — that IS the purpose.
//
// ⚠️ SECURITY — this PROVISIONS A PAID TIER WITHOUT PAYMENT. Two fail-closed gates:
//   1. Header `X-BBF-Admin-Token` === env BBF_COACH_AGENT_TOKEN  (same gate as
//      bbf-admin-roster — the admin token never touches the browser bundle).
//   2. env BBF_SIM_FULFILLMENT_ENABLED === 'true'  (DISARMED by default; arm only
//      for a test window via `supabase secrets set`, then unset). Simulated events
//      are written with a clearly-marked `evt_sim_*` / `cs_test_sim_*` id so the
//      ledger rows are trivial to identify and purge.
// Deploy with --no-verify-jwt (the admin token is the gate, not a Supabase JWT).
//
// POST body (all optional):
//   { email?, full_name?, tier?, locale?, send_email?, seed_plans?,
//     workout_plan?, meal_plan?, tdee_target?, macro_p?, macro_c?, macro_f? }
// Defaults: email=test@buildbelievefit.fitness, tier=catalyst, send_email=true,
//   seed_plans=true. Re-runs on the SAME email are idempotent by design (RPC replay
//   guard + 'already_provisioned'); use a +tag email (test+001@…) for a fresh user.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Mirror of stripe-webhook's allowlist — keep in sync with that function + the
// bbf_admin_set_tier allowlist so a simulated fulfillment can never raise
// invalid_tier on a slug the real webhook would have accepted.
const ALLOWED_TIERS = new Set([
  'catalyst', 'momentum', 'autonomous',
  'fuel_foundation', 'fuel_performance', 'fuel_sovereign',
  'rising_athlete',
  'kickstart_6wk_3x', 'kickstart_6wk_4x',
  'transformation_8wk_3x', 'transformation_8wk_4x',
  'sovereign_12wk_3x', 'sovereign_12wk_4x',
  'lite', 'gateway', 'architect', 'sovereign', 'youth_athlete',
  'nutrition_essentials', 'nutrition_platinum',
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-bbf-admin-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function escapeHtml(input: unknown): string {
  return String(input ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function normLocale(input: unknown): 'en' | 'es' | 'pt' {
  const t = String(input ?? '').trim().toLowerCase();
  if (t === 'es' || t.startsWith('es') || t.startsWith('span')) return 'es';
  if (t === 'pt' || t.startsWith('pt') || t.startsWith('por') || t.includes('bras') || t.includes('braz') || t === 'br') return 'pt';
  return 'en';
}
function generatePin(): string { return String(100000 + Math.floor(Math.random() * 900000)); }

// Compact sample plans so Stage-5 hydration has something to return. Mirrors the
// shape the in-vault generator / admin roster store (JSON text in the plan columns).
const SAMPLE_WORKOUT = JSON.stringify({
  source: 'simulated', split: 'Upper / Lower', weeks: 4,
  days: [
    { day: 'Mon', focus: 'Upper', exercises: [{ name: 'Bench Press', sets: 4, reps: '6-8' }, { name: 'Barbell Row', sets: 4, reps: '8-10' }] },
    { day: 'Tue', focus: 'Lower', exercises: [{ name: 'Back Squat', sets: 5, reps: '5' }, { name: 'Romanian Deadlift', sets: 3, reps: '8' }] },
  ],
});
const SAMPLE_MEAL = JSON.stringify({
  source: 'simulated', tdee: 2400,
  meals: [{ name: 'Breakfast', kcal: 600 }, { name: 'Lunch', kcal: 800 }, { name: 'Dinner', kcal: 700 }, { name: 'Snack', kcal: 300 }],
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  // ── Gate 1: arm-flag (disarmed by default — this bypasses payment) ──
  if (Deno.env.get('BBF_SIM_FULFILLMENT_ENABLED') !== 'true') {
    return jsonResponse({ ok: false, error: 'disabled', detail: 'Set BBF_SIM_FULFILLMENT_ENABLED=true to arm this test pipe, then unset it after testing.' }, 403);
  }
  // ── Gate 2: admin token (same shared secret as bbf-admin-roster) ──
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const presented = req.headers.get('x-bbf-admin-token') ?? '';
  if (!ADMIN_TOKEN || presented.length === 0 || presented !== ADMIN_TOKEN) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults below */ }

  const email = String(body.email ?? 'test@buildbelievefit.fitness').trim().toLowerCase();
  const fullName = String(body.full_name ?? 'BBF Test Client').trim() || 'BBF Test Client';
  const tier = String(body.tier ?? 'catalyst').trim();
  const locale = normLocale(body.locale);
  const sendEmail = body.send_email !== false;            // default true
  const seedPlans = body.seed_plans !== false;            // default true
  if (!email.includes('@')) return jsonResponse({ ok: false, error: 'invalid_email' }, 400);
  if (!ALLOWED_TIERS.has(tier)) return jsonResponse({ ok: false, error: 'invalid_tier', detail: tier }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const report: Record<string, unknown> = { simulated: true, email, tier, locale };

  // ── STAGE 2 — seed plan payloads + macros into bbf_active_clients (pre-fulfillment).
  // Upsert by vault_email (select → update | insert), matching the fulfillment RPC's
  // existence check so the row we seed here is the one fulfillment links to.
  if (seedPlans) {
    try {
      const num = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : d; };
      const patch: Record<string, unknown> = {
        client_name: fullName, client_email: email, vault_email: email,
        onboarding_status: 'Pending',
        workout_plan: typeof body.workout_plan === 'string' ? body.workout_plan : SAMPLE_WORKOUT,
        meal_plan: typeof body.meal_plan === 'string' ? body.meal_plan : SAMPLE_MEAL,
        plans_generated_at: new Date().toISOString(),
        tdee_target: num(body.tdee_target, 2400),
        macro_p: num(body.macro_p, 180), macro_c: num(body.macro_c, 240), macro_f: num(body.macro_f, 70),
      };
      const { data: existing, error: selErr } = await supabase
        .from('bbf_active_clients').select('id').eq('vault_email', email).maybeSingle();
      if (selErr) throw new Error(selErr.message);
      if (existing?.id) {
        const { error } = await supabase.from('bbf_active_clients').update(patch).eq('id', existing.id);
        if (error) throw new Error(error.message);
        report.stage2_staging = { ok: true, mode: 'update', plans_staged: true };
      } else {
        const { error } = await supabase.from('bbf_active_clients').insert({ spectrum_tier: tier, liability_cleared: true, ...patch });
        if (error) throw new Error(error.message);
        report.stage2_staging = { ok: true, mode: 'insert', plans_staged: true };
      }
    } catch (e) {
      report.stage2_staging = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    report.stage2_staging = { ok: true, mode: 'skipped' };
  }
  report.stage3_trigger = { ok: true, note: 'Stripe signature verification intentionally bypassed (admin test pipe)' };

  // ── STAGE 4 — the EXACT atomic fulfillment RPC the webhook calls ──
  const pin = generatePin();
  const eventId = `evt_sim_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const sessionId = `cs_test_sim_${Date.now()}`;
  const { data: txn, error: txnErr } = await supabase.rpc('bbf_stripe_fulfillment_transaction', {
    p_event_id: eventId, p_event_type: 'checkout.session.completed', p_session_id: sessionId,
    p_email: email, p_full_name: fullName, p_tier: tier, p_pin: pin,
  });
  if (txnErr) {
    report.stage4_fulfillment = { ok: false, error: txnErr.message };
    return jsonResponse({ ok: false, ...report }, 500);
  }
  const username: string | undefined = txn?.username;
  const newUser = txn?.new_user === true;
  report.stage4_fulfillment = { ok: true, replay: txn?.replay === true, username, new_user: newUser, tier };

  // ── STAGE 4b — Brevo welcome email (same template/inline logic as the webhook) ──
  let emailSent = false;
  const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
  if (sendEmail && BREVO_API_KEY && username) {
    try {
      const fromEmail = Deno.env.get('BREVO_FROM_EMAIL') || 'buildbelievefitllc@buildbelievefit.fitness';
      const fromName = Deno.env.get('BREVO_FROM_NAME') || 'Build Believe Fit';
      const tpl = { en: Deno.env.get('BREVO_WELCOME_TEMPLATE_EN'), es: Deno.env.get('BREVO_WELCOME_TEMPLATE_ES'), pt: Deno.env.get('BREVO_WELCOME_TEMPLATE_PT') }[locale]
        || Deno.env.get('BREVO_WELCOME_TEMPLATE_EN');
      const templateId = tpl ? Number(tpl) : null;
      const firstName = (fullName.split(/\s+/)[0] || fullName).trim();
      const base = { sender: { name: fromName, email: fromEmail }, to: [{ email, name: fullName }], tags: ['sim-fulfillment', `tier:${tier}`, `locale:${locale}`, newUser ? 'welcome' : 'update'] };
      const payload = (newUser && templateId && Number.isFinite(templateId))
        ? { ...base, templateId, params: { FIRSTNAME: firstName, USERNAME: username, PIN: pin, TIER: tier, LANGUAGE: locale } }
        : { ...base, subject: '[SIMULATED] Build Believe Fit — Your Vault Credentials', htmlContent: `<p>Welcome, ${escapeHtml(fullName)}.</p><p>Username <b>${escapeHtml(username)}</b> · PIN <b>${pin}</b> · Tier <b>${escapeHtml(tier)}</b>.</p><p>(This is a simulated fulfillment test.)</p>` };
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      emailSent = r.ok;
      if (!r.ok) report.stage4_email_error = `brevo_status_${r.status}`;
    } catch (e) { report.stage4_email_error = e instanceof Error ? e.message : String(e); }
  }
  report.stage4_email = { ok: emailSent, sent: emailSent, skipped: !sendEmail || !BREVO_API_KEY };

  // ── STAGE 5 — login hydration self-check via the same RPC the app calls ──
  if (username) {
    try {
      const { data: hydr, error: hydrErr } = await supabase.rpc('bbf_verify_user_pin', { uid: username, pin_attempt: pin });
      if (hydrErr) {
        report.stage5_hydration = { ok: false, error: hydrErr.message };
      } else {
        const row = Array.isArray(hydr) ? hydr[0] : hydr;
        const wp = row?.workout_plan ?? row?.plans?.workout_plan ?? null;
        const mp = row?.meal_plan ?? row?.plans?.meal_plan ?? null;
        report.stage5_hydration = {
          ok: !!row,
          login_verified: !!row,
          has_workout_plan: !!wp,
          has_meal_plan: !!mp,
          plans_generated_at: row?.plans_generated_at ?? null,
        };
      }
    } catch (e) {
      report.stage5_hydration = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // PIN is returned ONLY to the authenticated admin caller (the point of the pipe).
  return jsonResponse({ ok: true, pin, event_id: eventId, ...report });
});
