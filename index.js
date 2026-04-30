// ═══════════════════════════════════════════════════════════════
// BBF VAULT — Supabase → Anthropic Engine (V9 — Closed Loop)
// Build Believe Fit LLC | Central Automation Brain
// V9 adds Phase 3: persist generated Markdown back into the
// bbf_active_clients row's workout_plan / meal_plan columns so the
// loop closes from intake → generation → storage → app display.
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

// ───────────────────────────────────────────────────────────────
// Environment validation
// ───────────────────────────────────────────────────────────────
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ANTHROPIC_API_KEY,
  PORT = 3000,
} = process.env;

const REQUIRED_ENV = {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ANTHROPIC_API_KEY,
};

const missingEnv = Object.entries(REQUIRED_ENV)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingEnv.length) {
  console.error('[BBF VAULT] Missing required environment variables:', missingEnv.join(', '));
  console.error('[BBF VAULT] Copy .env.example to .env and populate it before launching.');
}

// ───────────────────────────────────────────────────────────────
// Service clients
// ───────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

// ───────────────────────────────────────────────────────────────
// System prompts (DO NOT MODIFY — locked by directive)
//
// Phase 5 update: prompts now require strict JSON output matching the
// legacy WP / MP data shapes in bbf-data.js so the existing polished
// RW() / RN() render functions can display cloud-generated plans
// identically to legacy seeded plans (Ana, Jacky, etc.).
// ───────────────────────────────────────────────────────────────
const SYSTEM_PROMPT_HYPERTROPHY =
  'You are an elite, clinical AI Fitness Architect for Build Believe Fit LLC. ' +
  'Generate a 7-day periodized hypertrophy and prehab training protocol. ' +
  'CRITICAL OUTPUT REQUIREMENT: Respond ONLY with a valid JSON array. ' +
  'No preamble, no commentary, no Markdown code fences. The response must ' +
  'parse cleanly with JSON.parse(). ' +
  'Schema: an array of exactly 7 day objects. Each day object has: ' +
  '{"day": "Monday"|"Tuesday"|"Wednesday"|"Thursday"|"Friday"|"Saturday"|"Sunday", ' +
  '"focus": short descriptor like "Arms & Back" or "Glutes" or "Rest", ' +
  '"exercises": array of exercise objects, ' +
  '"isRest": optional boolean, true for rest days (with empty exercises array), ' +
  '"restNote": optional string with recovery guidance for rest days}. ' +
  'Each exercise object has: ' +
  '{"name": e.g. "Biceps Curls", ' +
  '"equipment": e.g. "Dumbbells or Cable", ' +
  '"sets": integer number of sets, ' +
  '"reps": string like "10-12" or "8-10 per leg", ' +
  '"notes": short clinical cue, e.g. "Control the eccentric — slow on the way down"}. ' +
  'Rules: ' +
  '1. All primary hypertrophy lifts mathematically bound to 85% of 1RM working load. ' +
  '2. Focus strictly on hypertrophy and body composition. ' +
  '3. If the clinical history indicates joint issues, prescribe 2-3 specific pre-habilitation movements as the first exercises of relevant days. ' +
  '4. Use deadpan, authoritative, clinical language in the notes field. ' +
  '5. Output exactly 7 day objects. Include 1-2 rest days with empty exercises arrays.';

const SYSTEM_PROMPT_NUTRITION =
  'You are an elite Clinical Nutritionist for Build Believe Fit LLC. ' +
  'Generate a precise 7-day nutritional blueprint. ' +
  'CRITICAL OUTPUT REQUIREMENT: Respond ONLY with a valid JSON object. ' +
  'No preamble, no commentary, no Markdown code fences. The response must ' +
  'parse cleanly with JSON.parse(). ' +
  'Schema: ' +
  '{"name": client first name (string), ' +
  '"cal": calorie target string like "~2,800 cal/day", ' +
  '"goal": one-line tagline like "Lean & Energized" or "High-Protein Recomposition", ' +
  '"days": array of exactly 7 day objects}. ' +
  'Each day object has: ' +
  '{"day": "Day 1" through "Day 7", ' +
  '"meals": array of meal objects}. ' +
  'Each meal object has: ' +
  '{"m": meal label like "Breakfast", "Lunch", "Snack", "Dinner", "Snack 2", ' +
  '"i": food description with macros in parentheses, e.g. "5 oz Chicken, 1/2 cup Brown Rice (~385 cal/40g P)"}. ' +
  'Rules: ' +
  '1. Schedule meals around a sustainable 12/12 intermittent fasting window (8 AM to 8 PM). ' +
  '2. Use clean whole foods (chicken breast, steak, jasmine rice, sweet potatoes, broccoli, asparagus). ' +
  '3. Calculate estimated TDEE, subtract a safe clinical deficit for fat loss while maintaining hypertrophy, output the calorie target in the "cal" field and macros per meal in the "i" field. ' +
  '4. Output exactly 7 day objects.';

// JSON validation helper — strips optional Markdown code fences and
// confirms the output parses. Returns the cleaned JSON string on success,
// or null if the response can't be parsed (caller logs and falls back).
function validateJsonResponse(rawText, label) {
  if (typeof rawText !== 'string') return null;
  let text = rawText.trim();
  // Strip ```json or ``` fences if Anthropic wrapped despite instructions
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  try {
    JSON.parse(text);
    return text;
  } catch (err) {
    console.warn(`[BBF VAULT] ${label} JSON parse failed:`, err.message);
    console.warn(`[BBF VAULT] ${label} raw (first 200 chars):`, text.slice(0, 200));
    return null;
  }
}

// ───────────────────────────────────────────────────────────────
// Payload normalizer — accepts a flat client JSON body.
// ───────────────────────────────────────────────────────────────
function normalizeClientPayload(body) {
  const b = body || {};
  return {
    client_name: String(b.client_name || 'Unknown Client'),
    vault_email: String(b.vault_email || ''),
    age: b.age != null ? String(b.age) : '',
    height_weight: String(b.height_weight || ''),
    clinical_history: String(b.clinical_history || ''),
    training_protocol: String(b.training_protocol || ''),
    liability_cleared: b.liability_cleared !== undefined ? Boolean(b.liability_cleared) : true,
  };
}

// ───────────────────────────────────────────────────────────────
// PHASE 1 — Catch & Store (Supabase upsert)
// ───────────────────────────────────────────────────────────────
async function upsertActiveClient(payload) {
  const ageNumeric = Number.isFinite(Number(payload.age)) ? Number(payload.age) : null;

  const row = {
    client_name: payload.client_name,
    vault_email: payload.vault_email,
    age: ageNumeric,
    height_weight: payload.height_weight,
    clinical_history: payload.clinical_history,
    training_protocol: payload.training_protocol,
    liability_cleared: payload.liability_cleared,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('bbf_active_clients')
    .upsert(row, { onConflict: 'vault_email' })
    .select()
    .single();

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  return data;
}

// ───────────────────────────────────────────────────────────────
// PHASE 2 — Anthropic generation engine (parallel)
// ───────────────────────────────────────────────────────────────
async function generateHypertrophyBlueprint(payload) {
  const userMessage = [
    `Client Age: ${payload.age || 'N/A'}`,
    `Clinical History: ${payload.clinical_history || 'None reported'}`,
    `Current Training Protocol: ${payload.training_protocol || 'None reported'}`,
    '',
    'Generate the periodized hypertrophy and prehab training protocol now.',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT_HYPERTROPHY,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

async function generateFuelMatrix(payload) {
  const userMessage = [
    `Client Age: ${payload.age || 'N/A'}`,
    `Height & Weight: ${payload.height_weight || 'N/A'}`,
    '',
    'Generate the Sovereign Fuel Matrix nutritional blueprint now.',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT_NUTRITION,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// ───────────────────────────────────────────────────────────────
// Express server
// ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS — allow the Pathfinder form on buildbelievefit.fitness to POST
// directly to /process. Uses an explicit allowlist rather than '*' so
// random sites can't trigger Anthropic generation against this engine.
const ALLOWED_ORIGINS = new Set([
  'https://buildbelievefit.fitness',
  'https://www.buildbelievefit.fitness',
  'https://buildbelievefitllc.github.io',
]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bbf-vault-engine', model: ANTHROPIC_MODEL });
});

app.post('/process', async (req, res) => {
  const startedAt = Date.now();
  const payload = normalizeClientPayload(req.body);

  if (!payload.vault_email) {
    console.error('[BBF VAULT] Missing vault_email — aborting pipeline.');
    return res.status(400).json({ ok: false, error: 'vault_email is required' });
  }

  console.log('[BBF VAULT] Inbound client payload:', {
    client_name: payload.client_name,
    vault_email: payload.vault_email,
    liability_cleared: payload.liability_cleared,
  });

  // Phase 1 — Supabase upsert
  let supabaseRow = null;
  try {
    supabaseRow = await upsertActiveClient(payload);
    console.log('[BBF VAULT] Phase 1 complete — Supabase row upserted for', payload.vault_email);
  } catch (err) {
    console.error('[BBF VAULT] Phase 1 (Supabase) failed:', err);
    return res.status(500).json({ ok: false, phase: 'supabase', error: err.message });
  }

  // Phase 2 — parallel Anthropic generation
  let hypertrophyMarkdown = '';
  let fuelMarkdown = '';
  try {
    [hypertrophyMarkdown, fuelMarkdown] = await Promise.all([
      generateHypertrophyBlueprint(payload),
      generateFuelMatrix(payload),
    ]);
    console.log('[BBF VAULT] Phase 2 complete — Anthropic generation finished.');

    // Phase 5: Anthropic now outputs JSON in the legacy WP/MP shapes.
    // Validate parses cleanly; if so, replace the local strings with the
    // cleaned JSON (fences stripped). If validation fails, persist the
    // raw text — the frontend has a Markdown fallback for backward compat.
    const cleanedWorkout = validateJsonResponse(hypertrophyMarkdown, 'workout_plan');
    const cleanedMeal    = validateJsonResponse(fuelMarkdown,        'meal_plan');
    if (cleanedWorkout) hypertrophyMarkdown = cleanedWorkout;
    if (cleanedMeal)    fuelMarkdown        = cleanedMeal;
  } catch (err) {
    console.error('[BBF VAULT] Phase 2 (Anthropic) failed:', err);
    return res.status(502).json({ ok: false, phase: 'anthropic', error: err.message });
  }

  // Phase 3 — closed-loop persistence: write generated Markdown back to
  // the bbf_active_clients row so bbf-app.html can read it on next login.
  // Non-fatal: writeback failure logs loudly but does not fail the request.
  // The caller still receives the Markdown in the response so downstream
  // automation (Zapier, email) can use it even if persistence hiccups.
  let plansPersisted = false;
  let plansGeneratedAt = null;
  try {
    if (supabaseRow && supabaseRow.id) {
      plansGeneratedAt = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('bbf_active_clients')
        .update({
          workout_plan: hypertrophyMarkdown,
          meal_plan: fuelMarkdown,
          plans_generated_at: plansGeneratedAt,
        })
        .eq('id', supabaseRow.id);
      if (updateErr) throw new Error(updateErr.message);
      plansPersisted = true;
      console.log(
        `[BBF VAULT] Phase 3 complete — plans persisted to bbf_active_clients id=${supabaseRow.id}`
      );
    }
  } catch (err) {
    console.error('[BBF VAULT] Phase 3 (writeback) failed (non-fatal):', err.message);
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[BBF VAULT] Pipeline complete in ${elapsedMs}ms for ${payload.vault_email}`);

  return res.status(200).json({
    ok: true,
    elapsed_ms: elapsedMs,
    supabase_id: supabaseRow ? supabaseRow.id || null : null,
    plans_persisted: plansPersisted,
    plans_generated_at: plansGeneratedAt,
    hypertrophy_markdown: hypertrophyMarkdown,
    fuel_markdown: fuelMarkdown,
  });
});

// ───────────────────────────────────────────────────────────────
// /provision — Phase 4 Step E
// Called by Zapier after Stripe payment success. Generates a 6-digit PIN,
// invokes the SECURITY DEFINER RPC bbf_provision_client_pin which
// generates a unique username (firstname_bbf), bcrypts the PIN, and
// inserts the bbf_users row linked to the matching bbf_active_clients
// row by vault_email. Returns plaintext credentials in the response so
// Zapier can pass them to Brevo for the welcome email.
//
// Auth: requires X-BBF-Token header matching the BBF_PROVISION_TOKEN env
// var. This shared secret prevents random origins from triggering
// account creation. Missing or mismatched token → 401.
//
// Idempotency: if a bbf_users row already exists for the email, the RPC
// returns ok:false reason='already_provisioned'. We surface that as 409
// so Zapier can branch (e.g., re-send the existing creds via password
// reset flow, or just skip silently).
// ───────────────────────────────────────────────────────────────
app.post('/provision', async (req, res) => {
  const expectedToken = process.env.BBF_PROVISION_TOKEN;
  const sentToken = req.headers['x-bbf-token'];
  if (!expectedToken) {
    console.error('[BBF VAULT] /provision called but BBF_PROVISION_TOKEN env var is not set.');
    return res.status(503).json({ ok: false, error: 'provisioning_not_configured' });
  }
  if (sentToken !== expectedToken) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const body = req.body || {};
  const customerEmail = String(body.customer_email || body.email || '').trim().toLowerCase();
  const customerName  = String(body.customer_name || body.full_name || body.name || '').trim();
  const tier          = body.tier || null;

  if (!customerEmail) {
    return res.status(400).json({ ok: false, error: 'customer_email is required' });
  }

  // Generate 6-digit PIN (cryptographically random, range 100000-999999)
  const pin = String(100000 + Math.floor(Math.random() * 900000));

  console.log('[BBF VAULT] /provision request for', customerEmail, 'tier=', tier);

  try {
    const { data, error } = await supabase.rpc('bbf_provision_client_pin', {
      p_vault_email: customerEmail,
      p_pin: pin,
      p_full_name: customerName || 'BBF Client',
    });
    if (error) throw new Error(error.message);
    if (!data || !data.ok) {
      console.warn('[BBF VAULT] /provision RPC returned not-ok:', data);
      const status = data && data.reason === 'already_provisioned' ? 409 : 422;
      return res.status(status).json({ ok: false, ...data });
    }

    console.log(`[BBF VAULT] /provision success — ${customerEmail} → ${data.username}`);
    return res.status(200).json({
      ok: true,
      username: data.username,
      pin: pin,
      email: customerEmail,
      tier: tier,
      app_url: 'https://buildbelievefit.fitness/bbf-app.html',
    });
  } catch (err) {
    console.error('[BBF VAULT] /provision failed:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Global fallthrough error handler
app.use((err, req, res, next) => {
  console.error('[BBF VAULT] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[BBF VAULT] Engine server listening on port ${PORT}`);
  console.log(`[BBF VAULT] Process endpoint: POST /process`);
});

module.exports = app;
