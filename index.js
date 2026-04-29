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
// ───────────────────────────────────────────────────────────────
const SYSTEM_PROMPT_HYPERTROPHY =
  'You are an elite, clinical AI Fitness Architect for Build Believe Fit LLC. Generate a highly structured, periodized hypertrophy and prehab training protocol in strict Markdown. Rules: 1. All primary hypertrophy lifts must be calculated around an 85% 1RM working load. 2. Focus strictly on hypertrophy and body composition. 3. If the clinical history indicates joint issues, prescribe 2-3 specific pre-habilitation movements prior to working sets. 4. Use deadpan, authoritative, clinical language.';

const SYSTEM_PROMPT_NUTRITION =
  'You are an elite Clinical Nutritionist for Build Believe Fit LLC. Generate a precise nutritional blueprint in strict Markdown. Rules: 1. Program meals entirely around a sustainable 12/12 intermittent fasting schedule (8:00 AM to 8:00 PM). 2. Construct meal plans utilizing clean whole foods (chicken breast, steak, jasmine rice, sweet potatoes, broccoli, asparagus). 3. Calculate estimated TDEE, subtract a safe clinical deficit for fat loss while maintaining hypertrophy, and output exact macro targets. 4. Present the output in a Markdown table showing the exact time of consumption, food source, and macro breakdown.';

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
