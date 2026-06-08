// bbf-lead-capture - Phase 19. Replaces Zapier + Formspree.
// Receives Pathfinder + Nutrition Lite form submissions, writes to
// bbf_leads, fires Brevo admin notification, fires Brevo welcome
// email to lite-tier leads.
//
// Phase 6 (Turnstile armor) — every payload now carries a Turnstile
// invisible-mode token in `turnstile_token`. We POST it to Cloudflare's
// siteverify endpoint with the server-side secret. If verification
// fails we 403 the request and never touch bbf_leads or Brevo. The
// secret is read from the TURNSTILE_SECRET_KEY env var (set via
// `supabase secrets set TURNSTILE_SECRET_KEY=...`); it is NEVER
// hardcoded in source.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const ALLOWED_ORIGINS = new Set([
  'https://buildbelievefit.fitness',
  'https://www.buildbelievefit.fitness',
  'https://buildbelievefitllc.github.io',
]);

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 5;
const _rateBuckets = new Map();

function rateLimitOk(ip) {
  const now = Date.now();
  let arr = _rateBuckets.get(ip) || [];
  arr = arr.filter((t) => t > now - RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { _rateBuckets.set(ip, arr); return false; }
  arr.push(now);
  _rateBuckets.set(ip, arr);
  return true;
}

function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://buildbelievefit.fitness',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

// Phase 6 — Cloudflare Turnstile siteverify. Returns { ok, codes } where
// `ok` is true iff Cloudflare reports success. Network errors / non-2xx
// from Cloudflare fail-closed (treated as invalid) per the CEO directive
// to "reject botnet spam".
async function verifyTurnstile(secret, token, ip) {
  if (!token) return { ok: false, codes: ['missing-input-response'] };
  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) {
      console.warn(`[bbf-lead-capture] turnstile siteverify non-2xx: status=${r.status}`);
      return { ok: false, codes: ['siteverify-http-' + r.status] };
    }
    const j = await r.json();
    if (j && j.success === true) return { ok: true, codes: [] };
    return { ok: false, codes: (j && j['error-codes']) || ['unknown'] };
  } catch (e) {
    console.error(`[bbf-lead-capture] turnstile siteverify threw:`, e instanceof Error ? e.message : String(e));
    return { ok: false, codes: ['siteverify-network-error'] };
  }
}

function buildAdminEmailHtml(source, email, fullName, tier, phone, payload) {
  const tierLabel = tier ? escapeHtml(tier) : '(none)';
  const phoneLabel = phone ? escapeHtml(phone) : '(no phone)';
  const sourceLabel = escapeHtml(source);
  const payloadJson = escapeHtml(JSON.stringify(payload, null, 2));
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">
    <h2 style="color:#6a0dad;margin-bottom:4px">New BBF Lead - ${sourceLabel}</h2>
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse;margin:12px 0">
      <tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f8f8f8"><b>Email</b></td><td style="padding:6px 12px;border:1px solid #ddd">${escapeHtml(email)}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f8f8f8"><b>Name</b></td><td style="padding:6px 12px;border:1px solid #ddd">${escapeHtml(fullName || '(unknown)')}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f8f8f8"><b>Phone</b></td><td style="padding:6px 12px;border:1px solid #ddd">${phoneLabel}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f8f8f8"><b>Tier</b></td><td style="padding:6px 12px;border:1px solid #ddd">${tierLabel}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f8f8f8"><b>Source</b></td><td style="padding:6px 12px;border:1px solid #ddd">${sourceLabel}</td></tr>
    </table>
    <details style="font-family:monospace;font-size:11px;color:#666">
      <summary style="cursor:pointer;font-family:Arial,sans-serif;font-size:12px;color:#444">Full payload</summary>
      <pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto">${payloadJson}</pre>
    </details>
  </div>`;
}

function buildLiteWelcomeEmailHtml(fullName, payload) {
  const name = escapeHtml(fullName || 'there');
  const tdee = escapeHtml(payload?.tdee_target ?? '');
  const p = escapeHtml(payload?.macro_p ?? '');
  const c = escapeHtml(payload?.macro_c ?? '');
  const f = escapeHtml(payload?.macro_f ?? '');
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
    <h2 style="color:#6a0dad">Hi ${name} - your BBF Nutrition Snapshot</h2>
    <p style="font-size:14px;line-height:1.5">Thanks for grabbing your free TDEE + macros from Build Believe Fit. Here is your snapshot:</p>
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse;margin:12px 0;width:100%">
      <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f8f8f8"><b>Daily TDEE Target</b></td><td style="padding:8px 12px;border:1px solid #ddd">${tdee} kcal</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f8f8f8"><b>Protein</b></td><td style="padding:8px 12px;border:1px solid #ddd">${p} g</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f8f8f8"><b>Carbs</b></td><td style="padding:8px 12px;border:1px solid #ddd">${c} g</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f8f8f8"><b>Fats</b></td><td style="padding:8px 12px;border:1px solid #ddd">${f} g</td></tr>
    </table>
    <p style="font-size:14px;line-height:1.5">When you are ready for the full Nutrition Essentials tier ($67/mo) - personalized meal plans aligned with your training and metabolic profile - <a href="https://buildbelievefit.fitness/#nutrition">apply here</a>.</p>
    <p style="font-size:12px;color:#666;margin-top:24px">- The Build Believe Fit Team</p>
  </div>`;
}

async function fireBrevoEmail(apiKey, fromName, fromEmail, toEmail, toName, subject, htmlContent, tags) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: toEmail, name: toName || toEmail }],
      subject,
      htmlContent,
      tags,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    console.error(`[bbf-lead-capture] Brevo send failed: status=${r.status} body=${txt.slice(0,300)}`);
    return { ok: false, status: r.status };
  }
  return { ok: true, status: r.status };
}

// ── Stage the prospect into bbf_active_clients (pre-checkout) ──────────────────
// Closes the Stage-2 staging gap: the Pathfinder intake now writes the prospect's
// profile + macros + any generated plan JSON into public.bbf_active_clients (keyed
// by vault_email), so the post-payment fulfillment RPC (which skips its own insert
// when a row already exists for the email) links to a row that ALREADY carries the
// plans — and login hydration (bbf_verify_user_pin) returns them. Upsert by
// vault_email via select → update | insert (no unique constraint needed, mirroring
// bbf_stripe_fulfillment_transaction's existence check). Emails are pre-lowercased
// by the caller (bbf_active_clients enforces a lowercase CHECK). Only keys we
// actually have are set, so we never null out a column a later admin write filled.
async function stageActiveClient(supabase, { email, fullName, phone, tier, payload }) {
  const p = payload || {};
  const toInt = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };
  const toJsonText = (v) => { if (v === null || v === undefined) return null; if (typeof v === 'string') return v.trim() ? v : null; try { return JSON.stringify(v); } catch { return null; } };

  const workoutPlan = toJsonText(p.workout_plan ?? p.workoutPlan ?? null);
  const mealPlan    = toJsonText(p.meal_plan ?? p.mealPlan ?? null);
  const plansStaged = !!(workoutPlan || mealPlan);

  const clinicalBits = [
    p.injuries ? `Injuries: ${p.injuries}` : null,
    p.medical_conditions ? `Conditions: ${p.medical_conditions}` : null,
    p.medications ? `Medications: ${p.medications}` : null,
    Array.isArray(p.parq_flags) && p.parq_flags.length ? `PAR-Q: ${p.parq_flags.join(', ')}` : null,
  ].filter(Boolean);
  const trainingBits = [
    p.primary_goal ? `Goal: ${p.primary_goal}` : null,
    p.experience ? `Experience: ${p.experience}` : null,
  ].filter(Boolean);

  const patch = { client_name: fullName || email, client_email: email, vault_email: email, onboarding_status: 'Pending' };
  if (phone) patch.client_phone = String(phone);
  if (clinicalBits.length) patch.clinical_history = clinicalBits.join(' · ');
  if (trainingBits.length) patch.training_protocol = trainingBits.join(' · ');
  if (toInt(p.age) !== null) patch.age = toInt(p.age);
  if (p.height_weight) patch.height_weight = String(p.height_weight);
  if (p.dietary_profile) patch.dietary_profile = String(p.dietary_profile);
  if (p.allergens !== undefined) patch.allergens = p.allergens;
  if (p.food_likes !== undefined) patch.food_likes = p.food_likes;
  if (p.food_dislikes !== undefined) patch.food_dislikes = p.food_dislikes;
  if (toInt(p.tdee_target) !== null) patch.tdee_target = toInt(p.tdee_target);
  if (toInt(p.macro_p) !== null) patch.macro_p = toInt(p.macro_p);
  if (toInt(p.macro_c) !== null) patch.macro_c = toInt(p.macro_c);
  if (toInt(p.macro_f) !== null) patch.macro_f = toInt(p.macro_f);
  if (workoutPlan) patch.workout_plan = workoutPlan;
  if (mealPlan) patch.meal_plan = mealPlan;
  if (plansStaged) patch.plans_generated_at = new Date().toISOString();

  const { data: existing, error: selErr } = await supabase
    .from('bbf_active_clients').select('id').eq('vault_email', email).maybeSingle();
  if (selErr) return { ok: false, mode: 'noop', plans_staged: plansStaged, error: selErr.message };
  if (existing?.id) {
    const { error } = await supabase.from('bbf_active_clients').update(patch).eq('id', existing.id);
    if (error) return { ok: false, mode: 'update', plans_staged: plansStaged, error: error.message };
    return { ok: true, mode: 'update', plans_staged: plansStaged };
  }
  const { error } = await supabase.from('bbf_active_clients').insert({ spectrum_tier: tier || 'prospect', liability_cleared: true, ...patch });
  if (error) return { ok: false, mode: 'insert', plans_staged: plansStaged, error: error.message };
  return { ok: true, mode: 'insert', plans_staged: plansStaged };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, origin);

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    console.warn(`[bbf-lead-capture] origin rejected: ${origin}`);
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimitOk(ip)) {
    return jsonResponse({ ok: false, error: 'rate_limited' }, 429, origin);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
  const BREVO_FROM_EMAIL = Deno.env.get('BREVO_FROM_EMAIL') || 'buildbelievefitllc@buildbelievefit.fitness';
  const BREVO_FROM_NAME = Deno.env.get('BREVO_FROM_NAME') || 'Build Believe Fit';
  const ADMIN_TO = Deno.env.get('ADMIN_LEAD_NOTIFY_EMAIL') || 'buildbelievefitllc@buildbelievefit.fitness';
  // Phase 6 — Turnstile secret. Set via:
  //   supabase secrets set TURNSTILE_SECRET_KEY=... --project-ref ihclbceghxpuawymlvgi
  const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: 'config_missing' }, 503, origin);
  }
  if (!TURNSTILE_SECRET) {
    console.error('[bbf-lead-capture] TURNSTILE_SECRET_KEY not set — refusing to accept lead. Set the secret via supabase secrets set.');
    return jsonResponse({ ok: false, error: 'config_missing_turnstile' }, 503, origin);
  }

  let payload;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ ok: false, error: 'invalid_json' }, 400, origin); }

  const source = String(payload?.source || '').trim().toLowerCase().replace(/\s+/g, '_');
  const email  = String(payload?.email || '').trim().toLowerCase();
  const fullName = String(payload?.full_name || payload?.name || '').trim();
  const phone  = String(payload?.phone || '').trim();
  const tier   = String(payload?.tier || '').trim();
  if (!source || !email) return jsonResponse({ ok: false, error: 'missing_source_or_email' }, 400, origin);
  if (!email.includes('@')) return jsonResponse({ ok: false, error: 'invalid_email' }, 400, origin);

  // Phase 6 — Turnstile gate. Token comes from the invisible-mode widget
  // in the storefront (index.html). On verification failure: 403 and
  // bail BEFORE touching bbf_leads or Brevo so botnet spam costs us
  // nothing downstream.
  const turnstileToken = String(payload?.turnstile_token || '').trim();
  const verify = await verifyTurnstile(TURNSTILE_SECRET, turnstileToken, ip);
  if (!verify.ok) {
    console.warn(`[bbf-lead-capture] turnstile verification failed: ip=${ip} source=${source} codes=${(verify.codes || []).join(',')}`);
    return jsonResponse({ ok: false, error: 'turnstile_failed', codes: verify.codes || [] }, 403, origin);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Strip the token from the stored payload — no value keeping a spent
  // single-use credential at rest in bbf_leads.
  const persistPayload = { ...payload };
  delete persistPayload.turnstile_token;

  // 1. Persist lead
  const { data: leadRow, error: leadErr } = await supabase
    .from('bbf_leads')
    .insert({
      source,
      email,
      full_name: fullName || null,
      phone: phone || null,
      tier: tier || null,
      payload: persistPayload,
    })
    .select('id')
    .single();
  if (leadErr) {
    console.error(`[bbf-lead-capture] bbf_leads insert failed:`, leadErr.message);
    return jsonResponse({ ok: false, error: 'lead_insert_failed', detail: leadErr.message }, 500, origin);
  }
  console.log(`[bbf-lead-capture] lead stored id=${leadRow.id} source=${source} email=${email}`);

  // 1.5 Stage the prospect into bbf_active_clients (pre-checkout). Best-effort:
  // a staging miss must NEVER drop the captured lead (already persisted above).
  let staged = { ok: false, mode: 'noop', plans_staged: false };
  if (source === 'pathfinder') {
    try {
      staged = await stageActiveClient(supabase, { email, fullName, phone, tier, payload: persistPayload });
      if (staged.ok) console.log(`[bbf-lead-capture] staged active_client email=${email} mode=${staged.mode} plans=${staged.plans_staged}`);
      else console.error(`[bbf-lead-capture] active_clients staging failed:`, staged.error);
    } catch (e) {
      console.error(`[bbf-lead-capture] active_clients staging threw:`, e instanceof Error ? e.message : String(e));
    }
  }

  // 2. Fire Brevo admin notification (always)
  let adminEmailOk = false;
  if (BREVO_API_KEY) {
    try {
      const adminSubject = `[BBF Lead] ${source}: ${email}`;
      const adminHtml = buildAdminEmailHtml(source, email, fullName, tier, phone, persistPayload);
      const r = await fireBrevoEmail(BREVO_API_KEY, BREVO_FROM_NAME, BREVO_FROM_EMAIL, ADMIN_TO, 'BBF Admin', adminSubject, adminHtml, ['bbf-lead-capture', `source:${source}`, 'admin-notify']);
      adminEmailOk = r.ok;
    } catch (e) {
      console.error(`[bbf-lead-capture] admin email threw:`, e instanceof Error ? e.message : String(e));
    }
  } else {
    console.warn(`[bbf-lead-capture] BREVO_API_KEY not set; admin notification skipped`);
  }

  // 3. For nutrition_lite leads: also fire welcome email to the lead with TDEE/macros
  let liteWelcomeOk = false;
  if (BREVO_API_KEY && source === 'nutrition_lite') {
    try {
      const welcomeHtml = buildLiteWelcomeEmailHtml(fullName, persistPayload);
      const r = await fireBrevoEmail(BREVO_API_KEY, BREVO_FROM_NAME, BREVO_FROM_EMAIL, email, fullName || email, 'Your free BBF Nutrition Snapshot - TDEE + Macros', welcomeHtml, ['bbf-lead-capture', `source:${source}`, 'lite-welcome']);
      liteWelcomeOk = r.ok;
    } catch (e) {
      console.error(`[bbf-lead-capture] lite welcome email threw:`, e instanceof Error ? e.message : String(e));
    }
  }

  return jsonResponse({
    ok: true,
    lead_id: leadRow.id,
    source,
    staged: staged.ok,
    staged_mode: staged.mode,
    plans_staged: staged.plans_staged,
    admin_notified: adminEmailOk,
    lite_welcome_sent: liteWelcomeOk,
  }, 200, origin);
});
