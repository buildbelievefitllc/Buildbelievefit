// ═══════════════════════════════════════════════════════════════
// BBF VAULT — Supabase → Anthropic Engine (V9 — Closed Loop)
// Build Believe Fit LLC | Central Automation Brain
// V9 adds Phase 3: persist generated Markdown back into the
// bbf_active_clients row's workout_plan / meal_plan columns so the
// loop closes from intake → generation → storage → app display.
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const express = require('express');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const { mintTicket, verifyTicket } = require('./bbf-ws-ticket');

// ───────────────────────────────────────────────────────────────
// Environment validation
// ───────────────────────────────────────────────────────────────
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ANTHROPIC_API_KEY,
  BBF_WS_TICKET_SECRET,
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
// Phase 14 — Culinary Matrix (clinical-grade meal database)
// 40 records × American/Mexican/Brazilian, native macros + dietary
// profiles + allergen-safe tags. Loaded once at module init; passed
// verbatim to the nutrition-only prompt so Anthropic selects from a
// closed universe (no invented food).
// ───────────────────────────────────────────────────────────────
let BBF_MEALS_MATRIX = [];
try {
  BBF_MEALS_MATRIX = require('./bbf_meals.json');
  console.log(`[BBF VAULT] Culinary matrix loaded — ${BBF_MEALS_MATRIX.length} meals`);
} catch (err) {
  console.error('[BBF VAULT] Failed to load bbf_meals.json:', err.message);
  console.error('[BBF VAULT] Nutrition-only generation will fail until the matrix is fixed.');
}

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

// ───────────────────────────────────────────────────────────────
// Phase B2: Youth Athlete prompts (Ages 9-17)
// Clinical liability shield + sport-specific prehab logic.
// JSON schemas mirror the adult prompts so cloud-generated youth plans
// render through the same frontend WP/MP pipeline (RW()/RN()).
// ───────────────────────────────────────────────────────────────
const SYSTEM_PROMPT_YOUTH_HYPERTROPHY =
  'You are the Lead Clinical Sports Scientist for Build Believe Fit (BBF). ' +
  'Generate a structured training blueprint for a Youth Athlete (Ages 9-17), ' +
  'output as Week 1 of a 4-week progressive macrocycle. ' +
  'You MUST adhere to these strict clinical overrides: ' +
  '- Loading: NO heavy 1-RM testing or strict heavy axial loading (e.g. heavy ' +
  'barbell back squats) for ages 8-13. Use bodyweight, med balls, and light ' +
  'bands only. Moderate hypertrophy (65-80%) is ONLY permitted for ages 14+. ' +
  '- Volume: Total weekly training hours must NEVER exceed the chronological ' +
  'age of the athlete in years. Mandate 2 full days off per week. ' +
  '- Sport-Specific Prehab Triggers (infer the sport from the training_protocol ' +
  'field; if multiple sports apply, blend the relevant prehab): ' +
  'Basketball -> glute medius activation to mitigate dynamic knee valgus; ' +
  'Volleyball -> knee stability for force absorption; ' +
  'Soccer -> neuromuscular control, adductor strength, eccentric hamstrings (ACL protection); ' +
  'Baseball -> 90/90 hip mobility flows to protect developing shoulder/elbow from torque; ' +
  'Football -> Fundamental Motor Skills, athletic stance, and deceleration mechanics before high-speed cutting. ' +
  '- Energy Systems: Prioritize neural plasticity, movement quality, and aerobic ' +
  'base over extreme glycolytic conditioning. ' +
  'CRITICAL OUTPUT REQUIREMENT: Respond ONLY with a valid JSON array. ' +
  'No preamble, no commentary, no Markdown code fences. The response must ' +
  'parse cleanly with JSON.parse(). ' +
  'Schema (matches the BBF active clients schema): an array of exactly 7 day objects. ' +
  'Each day object has: ' +
  '{"day": "Monday"|"Tuesday"|"Wednesday"|"Thursday"|"Friday"|"Saturday"|"Sunday", ' +
  '"focus": short descriptor like "Sport Prehab + Aerobic Base" or "Movement Quality" or "Rest", ' +
  '"exercises": array of exercise objects, ' +
  '"isRest": optional boolean, true for rest days (with empty exercises array), ' +
  '"restNote": optional string with recovery guidance for rest days}. ' +
  'Each exercise object has: ' +
  '{"name": e.g. "Glute Bridges" or "Med Ball Slams", ' +
  '"equipment": e.g. "Bodyweight", "Med Ball", or "Light Band" (NEVER heavy barbell for ages 8-13), ' +
  '"sets": integer, ' +
  '"reps": string like "10-12" or "8 per leg", ' +
  '"notes": short clinical cue in deadpan, authoritative language}. ' +
  'Rules: ' +
  '1. Output exactly 7 day objects. MANDATE 2 full rest days with empty exercises arrays and a restNote. ' +
  '2. The first 2-3 exercises of each non-rest day must be sport-specific prehab. ' +
  '3. For ages 8-13: equipment field must ONLY be "Bodyweight", "Med Ball", or "Light Band". ' +
  '4. Estimated weekly working time across all sessions must not exceed the chronological age of the athlete in hours.';

const SYSTEM_PROMPT_YOUTH_NUTRITION =
  'You are the Director of Performance Nutrition for Build Believe Fit (BBF). ' +
  'Generate a 7-day fueling matrix for a Youth Athlete. ' +
  'You MUST adhere to this strict clinical liability shield: ' +
  'HARD EXCLUSIONS (DO NOT DEVIATE): You must categorically refuse to recommend ' +
  'sports supplements or ergogenic aids of any kind, severe caloric deficits or ' +
  'cutting or shredding protocols, high-fat or ketogenic diets (>46% fat), ' +
  'intermittent fasting, or dehydration protocols. ' +
  'Caloric Baselines: Prevent Low Energy Availability (LEA). Account for both ' +
  'performance and the massive biological growth demands of adolescence. Use the ' +
  'Cunningham Equation (RMR = 500 + 22 * LBM in kg) as the baseline if LBM is known; ' +
  'otherwise use age- and weight-appropriate pediatric estimates. When uncertain, err high — NEVER low. ' +
  'Single-Game Fueling (Football, Soccer, Basketball): ' +
  'Pre-game (1-4 hrs before): 1-4 g/kg carbs + 5-10g protein, low fat and low fiber. ' +
  'Intra-game (>60 mins of play): 30-60g carbs per hour. ' +
  'Tournament Fueling (Volleyball, Baseball, multi-bout days): ' +
  'Prioritize immediate glycogen restoration between bouts when recovery window is <24hr. ' +
  '1.0-1.2 g/kg/hr carbs + 20g protein within 30-60 mins post-game. ' +
  'Hydration: 500-600 mL water or sports drink 2-3 hours pre-event; ' +
  '200-300 mL 10-20 mins pre-event; 200-300 mL every 10-20 mins during play. ' +
  'CRITICAL OUTPUT REQUIREMENT: Respond ONLY with a valid JSON object. ' +
  'No preamble, no commentary, no Markdown code fences. The response must ' +
  'parse cleanly with JSON.parse(). ' +
  'Schema (matches the BBF active clients schema): ' +
  '{"name": athlete first name (string), ' +
  '"cal": calorie target string like "~3,200 cal/day", ' +
  '"goal": one-line tagline like "Growth & Performance" or "Tournament Recovery", ' +
  '"days": array of exactly 7 day objects}. ' +
  'Each day object has: ' +
  '{"day": "Day 1" through "Day 7", ' +
  '"meals": array of meal objects}. ' +
  'Each meal object has: ' +
  '{"m": meal label like "Breakfast", "Pre-Practice Snack", "Lunch", "Post-Game Recovery", "Dinner", "Snack 2", ' +
  '"i": food description with macros in parentheses, e.g. "1 cup oatmeal + banana + 2 tbsp peanut butter (~420 cal/15g P)"}. ' +
  'Rules: ' +
  '1. Output exactly 7 day objects. ' +
  '2. Schedule meals across the full waking day. NO fasting windows. ' +
  '3. Use whole foods: lean proteins, whole grains, fruits, vegetables, dairy as appropriate. ' +
  '4. Caloric target must support growth and sport demands.';

// ───────────────────────────────────────────────────────────────
// Phase 14: Nutrition-Only prompt (Essentials / Platinum tiers)
// Closed-universe meal selection from BBF_MEALS_MATRIX. Hard-bound
// macro variance (±5%), dietary-profile filter, allergen exclusion,
// cuisine rotation, calorie-driven meal frequency, and a high-calorie
// latitude clause that authorises serving-size scaling up to 2.0x or
// double meal-slot assignment to hit aggressive TDEE targets.
// JSON output mirrors the adult nutrition schema (legacy MP shape) so
// the existing frontend RN() renders cloud-generated nutrition plans
// through the same pipeline as Architect/Sovereign meal plans.
// ───────────────────────────────────────────────────────────────
const SYSTEM_PROMPT_NUTRITION_ONLY =
  'You are the Director of Performance Nutrition for Build Believe Fit (BBF). ' +
  'Generate a 7-day Rotational Meal Plan based strictly on the user\'s TDEE. ' +
  'CULINARY MATRIX: A JSON array of approved meals is supplied in the user ' +
  'message. You MUST ONLY select meals from this array. Do not invent food. ' +
  'Do not substitute ingredients. Do not propose meals that are not in the ' +
  'matrix. ' +
  'MACRO VARIANCE: The daily total (calories, protein_g, carbs_g, fat_g) MUST ' +
  'hit the user\'s target macros within a +/- 5% variance. Sum the macros from ' +
  'the meals you select to verify before finalising each day. ' +
  'SAFETY FILTER — DIETARY PROFILE: You MUST respect the user\'s dietary ' +
  'profile (Omnivore / Vegetarian / Vegan). A Vegan user can ONLY be served ' +
  'meals whose dietary_profile array contains "Vegan". A Vegetarian user can ' +
  'be served meals tagged "Vegetarian" OR "Vegan". An Omnivore user may be ' +
  'served any meal. ' +
  'SAFETY FILTER — ALLERGENS: You MUST strictly exclude any meal whose ' +
  'restrictions_safe array does NOT cover every allergen the user listed. ' +
  'I.e., for every user_allergen, the meal\'s restrictions_safe MUST contain ' +
  'the matching "<allergen>-Free" tag. If the user lists no allergens, no ' +
  'allergen filtering is required. ' +
  'CUISINE ROTATION: Rotate American / Mexican / Brazilian across the 7 days ' +
  'to prevent diet fatigue. No single cuisine should appear on more than 3 of ' +
  'the 7 days. ' +
  'MEAL FREQUENCY (calorie-driven): If the user\'s daily target is below 1800 ' +
  'kcal, schedule 3 meals per day. Between 1800 and 2400 kcal, schedule 4 ' +
  'meals per day. Above 2400 kcal, schedule 5 meals per day. ' +
  'HIGH-CALORIE LATITUDE: If the user\'s TDEE requires a high caloric intake ' +
  'that cannot be met by standard single servings of the provided meals, you ' +
  'are authorised to dynamically adjust the serving_g (and proportionately ' +
  'scale the macros) up to 2.0x, OR you may assign two breakfast/lunch items ' +
  'in a single day to hit the target. Do not exceed 2.0x scaling. ' +
  'CRITICAL OUTPUT REQUIREMENT: Respond ONLY with a valid JSON object. No ' +
  'preamble, no commentary, no Markdown code fences. The response must parse ' +
  'cleanly with JSON.parse(). ' +
  'Schema (matches the legacy BBF meal plan schema): ' +
  '{"name": client first name (string), ' +
  '"cal": calorie target string like "~2,400 cal/day", ' +
  '"goal": one-line tagline like "Tri-Cuisine Rotational Plan" or "Plant-Based Performance", ' +
  '"days": array of exactly 7 day objects}. ' +
  'Each day object: {"day": "Day 1" through "Day 7", "meals": array of meal objects}. ' +
  'Each meal object: ' +
  '{"m": meal label like "Breakfast", "Lunch", "Dinner" — match the meal_type ' +
  'from the matrix; if you scale a serving, append " (1.5x)" or similar to the label, ' +
  '"i": full meal description with macros in parentheses, e.g. ' +
  '"American Grass-fed Bison & Sweet Potato Hash (450g, ~557 cal/27g P/19g C/42g F)" — ' +
  'pull name.en, serving_g, calories, protein_g, carbs_g, fat_g from the matrix entry, ' +
  'scale them in concert if you applied a serving multiplier}. ' +
  'Output exactly 7 day objects.';

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
    tier: String(b.tier || ''),
    // Phase 14 — nutrition-only fields. Frontend Pathfinder calculates
    // TDEE + macros locally; pass through so the nutrition prompt can
    // hit ±5% variance against real targets instead of re-estimating.
    // dietary_profile + allergens default safely (Omnivore / none) when
    // the form doesn't capture them yet.
    tdee_target: Number(b.tdee_target) || 0,
    macro_p: Number(b.macro_p) || 0,
    macro_c: Number(b.macro_c) || 0,
    macro_f: Number(b.macro_f) || 0,
    dietary_profile: String(b.dietary_profile || 'Omnivore'),
    allergens: Array.isArray(b.allergens) ? b.allergens.map(String) : [],
    liability_cleared: b.liability_cleared !== undefined ? Boolean(b.liability_cleared) : true,
  };
}

// ───────────────────────────────────────────────────────────────
// PHASE 1 — Catch & Store (Supabase upsert)
// ───────────────────────────────────────────────────────────────
async function upsertActiveClient(payload) {
  const ageNumeric = Number.isFinite(Number(payload.age)) ? Number(payload.age) : null;

  // Phase 22 · persist the full Pathfinder intake — dietary + macros.
  // Previously these fields were normalized in normalizeClientPayload()
  // but dropped at the upsert step, which forced downstream prompts +
  // app hydration to re-default to Omnivore/empty. Fixed end-to-end.
  const row = {
    client_name: payload.client_name,
    vault_email: payload.vault_email,
    age: ageNumeric,
    height_weight: payload.height_weight,
    clinical_history: payload.clinical_history,
    training_protocol: payload.training_protocol,
    liability_cleared: payload.liability_cleared,
    dietary_profile: payload.dietary_profile || 'Omnivore',
    allergens:       Array.isArray(payload.allergens)     ? payload.allergens     : [],
    food_likes:      Array.isArray(payload.food_likes)    ? payload.food_likes    : [],
    food_dislikes:   Array.isArray(payload.food_dislikes) ? payload.food_dislikes : [],
    tdee_target:     Number.isFinite(Number(payload.tdee_target)) && Number(payload.tdee_target) > 0 ? Number(payload.tdee_target) : null,
    macro_p:         Number.isFinite(Number(payload.macro_p))     && Number(payload.macro_p)     > 0 ? Number(payload.macro_p)     : null,
    macro_c:         Number.isFinite(Number(payload.macro_c))     && Number(payload.macro_c)     > 0 ? Number(payload.macro_c)     : null,
    macro_f:         Number.isFinite(Number(payload.macro_f))     && Number(payload.macro_f)     > 0 ? Number(payload.macro_f)     : null,
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
  // Phase 22 · pass dietary intake into the adult fuel-matrix prompt
  // verbatim. Previously generateFuelMatrix dropped these fields on the
  // floor — only generateNutritionOnlyBlueprint honored them, leaving
  // adult workout+nutrition tier members with macro generation that
  // ignored their Pathfinder-declared allergens. Closed.
  const dietary  = payload.dietary_profile || 'Omnivore';
  const allergs  = Array.isArray(payload.allergens) && payload.allergens.length
    ? payload.allergens.join(', ') : 'none reported';
  const likes    = Array.isArray(payload.food_likes) && payload.food_likes.length
    ? payload.food_likes.join(', ') : '';
  const dislikes = Array.isArray(payload.food_dislikes) && payload.food_dislikes.length
    ? payload.food_dislikes.join(', ') : '';
  const macroLine = (payload.tdee_target || payload.macro_p)
    ? `Target Daily Calories: ${payload.tdee_target || 'unspecified'} · Macro Targets: ${payload.macro_p || '?'}g P / ${payload.macro_c || '?'}g C / ${payload.macro_f || '?'}g F`
    : '';

  const userMessage = [
    `Client Age: ${payload.age || 'N/A'}`,
    `Height & Weight: ${payload.height_weight || 'N/A'}`,
    `Dietary Profile: ${dietary}`,
    `Allergen Restrictions (strictly avoid): ${allergs}`,
    likes    ? `Bias toward foods they like: ${likes}` : '',
    dislikes ? `Avoid (preference, not allergen): ${dislikes}` : '',
    macroLine,
    '',
    'Generate the Sovereign Fuel Matrix nutritional blueprint now. ' +
    'Every meal MUST respect the Dietary Profile and the Allergen ' +
    'Restrictions above — those are non-negotiable. Bias selections ' +
    'toward declared likes when possible without breaking macros.',
  ].filter(Boolean).join('\n');

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

// Phase B2: Youth Athlete generation pair. Same return shape as the adult
// versions (raw text from Anthropic; JSON-validated upstream). Routed to
// only when payload.tier === 'youth_athlete' in /process Phase 2.
async function generateYouthAthleteBlueprint(payload) {
  const userMessage = [
    `Athlete Age: ${payload.age || 'N/A'}`,
    `Sport / Training Protocol: ${payload.training_protocol || 'General Athletic Development'}`,
    `Clinical History: ${payload.clinical_history || 'None reported'}`,
    'Tier: youth_athlete',
    '',
    'Generate the youth athlete weekly training blueprint now (Week 1 of a 4-week progressive macrocycle).',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT_YOUTH_HYPERTROPHY,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// Phase 14: Nutrition-only generation (Essentials / Platinum). Routed
// to in /process when payload.tier starts with "nutrition_" and isn't
// "nutrition_lite" (which is lead-capture-only and never hits /process).
// Returns the raw Anthropic text; caller validates JSON and persists.
async function generateNutritionOnlyBlueprint(payload) {
  const firstName = (payload.client_name || 'Client').split(' ')[0] || 'Client';
  const tdee = payload.tdee_target;
  const macroP = payload.macro_p;
  const macroC = payload.macro_c;
  const macroF = payload.macro_f;
  const allergensStr = payload.allergens && payload.allergens.length
    ? payload.allergens.join(', ')
    : 'None';

  const userMessage = [
    `Client: ${firstName}`,
    `Age: ${payload.age || 'N/A'}`,
    `Height & Weight: ${payload.height_weight || 'N/A'}`,
    `Tier: ${payload.tier}`,
    '',
    'TARGET MACROS (daily totals — sum of selected meals must land within ±5%):',
    `  Calories: ${tdee || '(not provided — estimate from age/height/weight/activity)'}`,
    `  Protein:  ${macroP || '(not provided — estimate)'} g`,
    `  Carbs:    ${macroC || '(not provided — estimate)'} g`,
    `  Fats:     ${macroF || '(not provided — estimate)'} g`,
    '',
    `DIETARY PROFILE: ${payload.dietary_profile}`,
    `ALLERGENS (user-listed, must avoid): ${allergensStr}`,
    '',
    'CULINARY MATRIX (JSON array — select all meals from this list, do not invent food):',
    JSON.stringify(BBF_MEALS_MATRIX),
    '',
    'Generate the 7-day rotational meal plan now.',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT_NUTRITION_ONLY,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

async function generateYouthFuelMatrix(payload) {
  const userMessage = [
    `Athlete Age: ${payload.age || 'N/A'}`,
    `Height & Weight: ${payload.height_weight || 'N/A'}`,
    `Sport / Training Protocol: ${payload.training_protocol || 'General Athletic Development'}`,
    'Tier: youth_athlete',
    '',
    'Generate the youth athlete fueling matrix now.',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT_YOUTH_NUTRITION,
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
app.use(express.json({ limit: '10mb' }));

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-BBF-Admin-Token');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bbf-vault-engine', model: ANTHROPIC_MODEL });
});

// ───────────────────────────────────────────────────────────────
// Phase 16 — Iron Vault V2: server-enforced Sovereign Trial gate
// ───────────────────────────────────────────────────────────────
// Two HTTP routes + one WS upgrade gate. Source of truth for whether
// a user can open the Live Coach (/ws/phantom-eye) is the bbf_users
// row checked here — the frontend mirrors it for UX but cannot be
// trusted. Auth model is the one-shot signed ticket (CEO ruling
// Option C): no Supabase Auth, no long-lived tokens.
//
// PIN re-verification on these endpoints is deferred to Slice B+1.
// Today an attacker can hit /api/user/start-trial with a stranger's
// uid and burn their free trial slot, or hit /api/auth/ws-ticket
// with a known sovereign uid to open a coach session as them. The
// rate-limit + one-trial-per-uid hard-lock contain the first; the
// second is bounded by the 60s ticket TTL and the lack of any
// user-data leak (the WS only proxies live audio/video — there is
// no read of the impersonated user's Supabase data).
// ───────────────────────────────────────────────────────────────

if (!BBF_WS_TICKET_SECRET) {
  console.warn('[BBF VAULT] BBF_WS_TICKET_SECRET missing — Iron Vault gate will reject every WS upgrade with 401. Set the env var on Render before this slice goes live.');
} else {
  console.log('[BBF VAULT] BBF_WS_TICKET_SECRET present (length=' + BBF_WS_TICKET_SECRET.length + ') — Iron Vault gate armed.');
}

// Per-IP rate limit for /api/user/start-trial. 5 calls per rolling
// hour. In-memory bucket keyed by req.ip; entries pruned lazily.
const _ironVaultStartTrialBuckets = new Map();
const _IRON_VAULT_RATE_WINDOW_MS = 60 * 60 * 1000;
const _IRON_VAULT_RATE_MAX = 5;

function _ironVaultRateLimitOk(ip) {
  const now = Date.now();
  let arr = _ironVaultStartTrialBuckets.get(ip);
  if (!arr) arr = [];
  arr = arr.filter((t) => t > now - _IRON_VAULT_RATE_WINDOW_MS);
  if (arr.length >= _IRON_VAULT_RATE_MAX) {
    _ironVaultStartTrialBuckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  _ironVaultStartTrialBuckets.set(ip, arr);
  if (_ironVaultStartTrialBuckets.size > 1024) {
    for (const [k, v] of _ironVaultStartTrialBuckets) {
      const keep = v.filter((t) => t > now - _IRON_VAULT_RATE_WINDOW_MS);
      if (keep.length === 0) _ironVaultStartTrialBuckets.delete(k);
      else _ironVaultStartTrialBuckets.set(k, keep);
    }
  }
  return true;
}

// Read subscription_tier + trial_expires_at for a given uid via the
// bbf_get_trial_state RPC. Returns null when the user doesn't exist
// or the call fails — caller treats null as "no access".
async function _ironVaultReadTrialState(uid) {
  if (!uid || typeof uid !== 'string') return null;
  try {
    const { data, error } = await supabase.rpc('bbf_get_trial_state', { p_uid: uid });
    if (error) {
      console.warn('[Iron Vault] bbf_get_trial_state error:', error.message || error);
      return null;
    }
    if (Array.isArray(data) && data.length) return data[0];
    if (data && typeof data === 'object') return data;
    return null;
  } catch (e) {
    console.warn('[Iron Vault] bbf_get_trial_state threw:', e && e.message);
    return null;
  }
}

function _ironVaultHasAccess(state) {
  if (!state) return false;
  if (state.subscription_tier === 'sovereign') return true;
  if (state.trial_expires_at && new Date(state.trial_expires_at).getTime() > Date.now()) return true;
  return false;
}

// POST /api/user/start-trial — opt-in 7-day mystery box.
// Body: { uid }. The RPC enforces one-trial-per-uid + non-sovereign;
// this route surfaces those rejections as HTTP status codes.
app.post('/api/user/start-trial', async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!_ironVaultRateLimitOk(ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }
  const uid = req.body && typeof req.body.uid === 'string' ? req.body.uid.trim() : '';
  if (!uid) return res.status(400).json({ ok: false, error: 'missing_uid' });
  try {
    const { data, error } = await supabase.rpc('bbf_start_trial', { p_uid: uid });
    if (error) {
      const msg = error.message || String(error);
      if (msg.indexOf('user_not_found') !== -1)         return res.status(404).json({ ok: false, error: 'user_not_found' });
      if (msg.indexOf('trial_already_consumed') !== -1) return res.status(409).json({ ok: false, error: 'trial_already_consumed' });
      if (msg.indexOf('already_sovereign') !== -1)      return res.status(409).json({ ok: false, error: 'already_sovereign' });
      console.error('[Iron Vault] start_trial unknown error:', msg);
      return res.status(500).json({ ok: false, error: 'rpc_failed' });
    }
    return res.status(200).json({ ok: true, trial_expires_at: data });
  } catch (e) {
    console.error('[Iron Vault] start_trial threw:', e && e.message);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
});

// POST /api/auth/ws-ticket — mint a 60s single-use ticket that the
// frontend appends to the /ws/phantom-eye URL. Body: { uid }. Server
// reads bbf_get_trial_state and only mints when sovereign OR trial is
// still active. Returns 403 with a structured reason otherwise.
app.post('/api/auth/ws-ticket', async (req, res) => {
  if (!BBF_WS_TICKET_SECRET) {
    return res.status(503).json({ ok: false, error: 'ticket_secret_missing' });
  }
  const uid = req.body && typeof req.body.uid === 'string' ? req.body.uid.trim() : '';
  if (!uid) return res.status(400).json({ ok: false, error: 'missing_uid' });
  const state = await _ironVaultReadTrialState(uid);
  if (!state) return res.status(404).json({ ok: false, error: 'user_not_found' });
  if (!_ironVaultHasAccess(state)) {
    const reason = (state.trial_expires_at && new Date(state.trial_expires_at).getTime() <= Date.now())
      ? 'trial_expired'
      : 'no_access';
    return res.status(403).json({ ok: false, error: reason });
  }
  try {
    const { ticket, exp } = mintTicket(uid, BBF_WS_TICKET_SECRET);
    return res.status(200).json({ ok: true, ticket, exp });
  } catch (e) {
    console.error('[Iron Vault] mintTicket threw:', e && e.message);
    return res.status(500).json({ ok: false, error: 'mint_failed' });
  }
});

// ───────────────────────────────────────────────────────────────
// Phase 15 Slice 4 — Wearable API Bridge
// /api/wearable-sync/health-connect
//
// Simulated Samsung Health / Android Health Connect telemetry endpoint.
// Returns a payload modeled strictly after the Android Health Connect
// JSON schema (SleepSessionRecord + HeartRateVariabilityRmssdRecord +
// RestingHeartRateRecord) so the frontend integration is perfectly
// staged for the future native Android wrapper — wrapper drops in,
// schema doesn't move.
//
// Each call randomizes within plausible biological ranges so the dial
// moves on every fetch (live feel during sales pitches). The
// readiness_score (0-100) is computed server-side from the simulated
// signals using a weighted model: sleep duration 25%, sleep efficiency
// (deep+REM share) 20%, HRV deviation from baseline 35%, RHR deviation
// from baseline 20%. Clamped to one decimal place.
//
// Auth: read-only simulated data, no PII, gated by the existing CORS
// allowlist (buildbelievefit.fitness + GitHub Pages preview origin).
// ───────────────────────────────────────────────────────────────
function _wsRandom(min, max) { return min + Math.random() * (max - min); }
function _wsClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function _wsBuildSleepSessionRecord() {
  // Sleep window: ended ~1 hour ago, lasted between 5h45 and 8h30.
  const endTime = new Date(Date.now() - 60 * 60 * 1000);
  const totalMinutes = Math.round(_wsRandom(345, 510));
  const startTime = new Date(endTime.getTime() - totalMinutes * 60 * 1000);

  // Stage distribution (as % of total): typical adult night.
  const awakePct = _wsRandom(0.04, 0.08);
  const lightPct = _wsRandom(0.45, 0.58);
  const deepPct  = _wsRandom(0.13, 0.22);
  const remPct   = 1 - awakePct - lightPct - deepPct;

  // Build chronologically ordered stage segments: awake → light → deep → REM → light.
  const stages = [];
  let cursor = new Date(startTime);
  function pushStage(stage, minutes) {
    if (minutes <= 0) return;
    const segEnd = new Date(cursor.getTime() + minutes * 60 * 1000);
    stages.push({
      startTime: cursor.toISOString(),
      endTime: segEnd.toISOString(),
      stage: stage,
    });
    cursor = segEnd;
  }
  pushStage('AWAKE',          Math.round(totalMinutes * awakePct));
  pushStage('SLEEPING_LIGHT', Math.round(totalMinutes * lightPct * 0.6));
  pushStage('SLEEPING_DEEP',  Math.round(totalMinutes * deepPct));
  pushStage('SLEEPING_REM',   Math.round(totalMinutes * remPct));
  pushStage('SLEEPING_LIGHT', Math.round(totalMinutes * lightPct * 0.4));

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    title: 'Night sleep',
    durationMinutes: totalMinutes,
    stages: stages,
  };
}

function _wsBuildHrvRmssdRecord() {
  // Baseline RMSSD: 35-65 ms. Current sample drifts ±25%.
  const baselineMillis = Math.round(_wsRandom(35, 65) * 10) / 10;
  const samples = [];
  const now = Date.now();
  // 6 samples taken every 30 minutes leading up to now.
  for (let i = 5; i >= 0; i--) {
    const drift = _wsRandom(0.75, 1.25);
    samples.push({
      time: new Date(now - i * 30 * 60 * 1000).toISOString(),
      heartRateVariabilityMillis: Math.round(baselineMillis * drift * 10) / 10,
    });
  }
  return { samples: samples, baselineMillis: baselineMillis };
}

function _wsBuildRhrRecord() {
  // Baseline RHR: 52-72 bpm. Current sample drifts ±15%.
  const baselineBpm = Math.round(_wsRandom(52, 72));
  const samples = [];
  const now = Date.now();
  for (let i = 5; i >= 0; i--) {
    const drift = _wsRandom(0.92, 1.12);
    samples.push({
      time: new Date(now - i * 30 * 60 * 1000).toISOString(),
      beatsPerMinute: Math.round(baselineBpm * drift),
    });
  }
  return { samples: samples, baselineBpm: baselineBpm };
}

function _wsCalculateReadinessScore(sleep, hrv, rhr) {
  // Sleep duration score: 8h target. Linearly scaled from 4h floor.
  const sleepHours = sleep.durationMinutes / 60;
  const sleepDurScore = _wsClamp((sleepHours - 4) * 25, 0, 100);

  // Sleep efficiency: deep + REM as % of total session.
  const deepRemMin = sleep.stages
    .filter((s) => s.stage === 'SLEEPING_DEEP' || s.stage === 'SLEEPING_REM')
    .reduce((acc, s) => acc + (Date.parse(s.endTime) - Date.parse(s.startTime)) / 60000, 0);
  const sleepEffPct = (deepRemMin / sleep.durationMinutes) * 100;
  const sleepEffScore = _wsClamp((sleepEffPct - 15) * (100 / 20), 0, 100);

  // HRV: average of last 3 samples vs baseline. Higher current = better.
  const recentHrv = hrv.samples.slice(-3).reduce((a, b) => a + b.heartRateVariabilityMillis, 0) / 3;
  const hrvRatio = recentHrv / hrv.baselineMillis;
  const hrvScore = _wsClamp((hrvRatio - 0.6) * (100 / 0.4), 0, 100);

  // RHR: average of last 3 samples vs baseline. Lower current = better.
  const recentRhr = rhr.samples.slice(-3).reduce((a, b) => a + b.beatsPerMinute, 0) / 3;
  const rhrRatio = recentRhr / rhr.baselineBpm;
  const rhrScore = _wsClamp((1.15 - rhrRatio) * (100 / 0.15), 0, 100);

  const weighted = sleepDurScore * 0.25 + sleepEffScore * 0.20 + hrvScore * 0.35 + rhrScore * 0.20;
  return Math.round(weighted * 10) / 10;
}

app.get('/api/wearable-sync/health-connect', (req, res) => {
  try {
    const sleepSessionRecord = _wsBuildSleepSessionRecord();
    const heartRateVariabilityRmssdRecord = _wsBuildHrvRmssdRecord();
    const restingHeartRateRecord = _wsBuildRhrRecord();
    const readiness_score = _wsCalculateReadinessScore(
      sleepSessionRecord,
      heartRateVariabilityRmssdRecord,
      restingHeartRateRecord
    );

    return res.status(200).json({
      ok: true,
      provider: 'samsung_health_connect',
      schema_version: 'health-connect/v1',
      generated_at: new Date().toISOString(),
      records: {
        SleepSessionRecord: sleepSessionRecord,
        HeartRateVariabilityRmssdRecord: heartRateVariabilityRmssdRecord,
        RestingHeartRateRecord: restingHeartRateRecord,
      },
      readiness_score: readiness_score,
    });
  } catch (err) {
    console.error('[BBF VAULT] /api/wearable-sync/health-connect failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
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

  // Phase 2 — parallel Anthropic generation (tier-aware tri-fork)
  // Adult (default): hypertrophy + nutrition.
  // Youth (tier === 'youth_athlete'): pediatric hypertrophy + youth nutrition.
  // Nutrition-only (tier startsWith 'nutrition_' && !== 'nutrition_lite'):
  //   meal plan only, no workout — Workouts tab is RBAC-suppressed
  //   client-side via window.BBF_IS_NUTRITION_ONLY.
  // (nutrition_lite never reaches /process — it's lead-capture only.)
  let hypertrophyMarkdown = null;
  let fuelMarkdown = '';
  try {
    const tier = payload.tier || '';
    const isYouth = tier === 'youth_athlete';
    const isNutritionOnly = tier.indexOf('nutrition_') === 0 && tier !== 'nutrition_lite';

    if (isNutritionOnly) {
      console.log(`[BBF VAULT] Tier: ${tier} → NUTRITION-ONLY prompt (workout generation skipped)`);
      fuelMarkdown = await generateNutritionOnlyBlueprint(payload);
      console.log('[BBF VAULT] Phase 2 complete — nutrition-only generation finished.');
      const cleanedMeal = validateJsonResponse(fuelMarkdown, 'meal_plan');
      if (cleanedMeal) fuelMarkdown = cleanedMeal;
    } else {
      console.log(`[BBF VAULT] Tier: ${tier || '(none)'} → ${isYouth ? 'YOUTH' : 'ADULT'} prompts`);
      const blueprintFn = isYouth ? generateYouthAthleteBlueprint : generateHypertrophyBlueprint;
      const fuelFn      = isYouth ? generateYouthFuelMatrix      : generateFuelMatrix;
      [hypertrophyMarkdown, fuelMarkdown] = await Promise.all([
        blueprintFn(payload),
        fuelFn(payload),
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
    }
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
// POST /api/vision-coach — Phase 9 Feature 2: BBF Vision AI Audio Scanner
// ───────────────────────────────────────────────────────────────
// Single-shot Gemini Vision REST call. Receives a Base64-encoded meal
// photo + a hardcoded "Lance" coaching prompt from the BBF Nutrition tab
// (bbf-app.html "Scan Meal" button), forwards to the Gemini 1.5 Flash
// generateContent endpoint, returns the text candidate. The client then
// pipes the text through window.speechSynthesis — Lance "speaks" the
// review out loud rather than rendering it to the DOM.
//
// Lives on this server (not on Supabase Edge Functions) because GEMINI_API_KEY
// is already wired here for the live Phantom Eye WebSocket bridge — single
// key, single source of truth, no extra env-var sprawl.
//
// Origin allowlist + per-IP rate limit (5 calls/minute) guards Gemini spend.
// ───────────────────────────────────────────────────────────────
const VISION_COACH_RATE_WINDOW_MS = 60 * 1000;
const VISION_COACH_RATE_MAX = 5;
const _visionCoachBuckets = new Map();
function _visionCoachRateOk(ip) {
  const now = Date.now();
  let arr = _visionCoachBuckets.get(ip) || [];
  arr = arr.filter(t => t > now - VISION_COACH_RATE_WINDOW_MS);
  if (arr.length >= VISION_COACH_RATE_MAX) { _visionCoachBuckets.set(ip, arr); return false; }
  arr.push(now);
  _visionCoachBuckets.set(ip, arr);
  return true;
}

app.post('/api/vision-coach', async (req, res) => {
  // CORS pre-check — the global middleware already set the headers; if
  // the origin isn't on the allowlist we refuse early so we don't burn
  // Gemini quota on a third-party caller.
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (!_visionCoachRateOk(ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }
  if (!GEMINI_API_KEY) {
    console.warn('[vision-coach] rejected — GEMINI_API_KEY missing');
    return res.status(503).json({ ok: false, error: 'config_missing' });
  }
  const body = req.body || {};
  const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64.trim() : '';
  const mimeType    = typeof body.mime_type === 'string'    ? body.mime_type.trim()    : 'image/jpeg';
  const prompt      = typeof body.prompt === 'string'       ? body.prompt              : '';
  if (!imageBase64 || imageBase64.length < 32) {
    return res.status(400).json({ ok: false, error: 'image_missing' });
  }
  if (!prompt || prompt.length < 10) {
    return res.status(400).json({ ok: false, error: 'prompt_missing' });
  }

  // gemini-1.5-flash: GA vision-capable, fast, low-cost. Same family as
  // the Live model used by the Phantom Eye bridge.
  const model = 'gemini-1.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              model + ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY);
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } }
      ]
    }],
    generationConfig: {
      temperature: 0.55,
      maxOutputTokens: 200
    }
  };

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[vision-coach] gemini fetch threw:', err && err.message);
    return res.status(502).json({ ok: false, error: 'gemini_unreachable' });
  }

  let geminiBody = null;
  try { geminiBody = await upstream.json(); }
  catch (_) { /* non-JSON body */ }

  if (!upstream.ok) {
    const msg = geminiBody?.error?.message || ('gemini ' + upstream.status);
    console.error('[vision-coach] gemini non-2xx:', upstream.status, msg);
    return res.status(502).json({ ok: false, error: 'gemini_error', detail: msg });
  }

  const text = geminiBody?.candidates?.[0]?.content?.parts
    ?.map(p => p?.text || '').join(' ').trim();
  if (!text) {
    console.warn('[vision-coach] gemini returned empty text', JSON.stringify(geminiBody).slice(0, 400));
    return res.status(502).json({ ok: false, error: 'gemini_empty' });
  }

  return res.status(200).json({ ok: true, text });
});

// ───────────────────────────────────────────────────────────────
// POST /api/rotate-nutrition — Phase 10 Scale Engine (AI Nutrition Rotator)
// ───────────────────────────────────────────────────────────────
// Admin-only Gemini call that regenerates a 7-day meal plan in the EXACT
// shape MP[uid] uses on the frontend ({ name, cal, goal, days: [{ day,
// meals: [{ m, i }] }] }). The client (bbf-app.html · BBF_NUTRITION_ROTATOR)
// drops the returned plan into MP[uid] verbatim and PATCHes
// bbf_users.nutrition_plan for persistence — zero RN() rewrite.
//
// Auth:    X-BBF-Admin-Token header must equal env BBF_ADMIN_TOKEN.
//          Same pattern as /provision (which uses BBF_PROVISION_TOKEN).
//          Without this gate any allowed-origin caller could burn Gemini
//          quota on demand; each rotation is ~3–8k tokens.
// Limits:  per-IP 5/min (shared budget defense) + per-UID 2/day (cost
//          containment for the targeted client).
// Schema:  generationConfig.responseMimeType = "application/json" plus a
//          strict responseSchema — Gemini returns parsed-ready JSON, not
//          free-form Markdown.
// ───────────────────────────────────────────────────────────────
const ROTATE_NUTRITION_IP_WINDOW_MS = 60 * 1000;
const ROTATE_NUTRITION_IP_MAX = 5;
const ROTATE_NUTRITION_UID_WINDOW_MS = 24 * 60 * 60 * 1000;
const ROTATE_NUTRITION_UID_MAX = 2;
const _rotateNutritionIpBuckets = new Map();
const _rotateNutritionUidBuckets = new Map();
function _rotateNutritionIpRateOk(ip) {
  const now = Date.now();
  let arr = _rotateNutritionIpBuckets.get(ip) || [];
  arr = arr.filter(t => t > now - ROTATE_NUTRITION_IP_WINDOW_MS);
  if (arr.length >= ROTATE_NUTRITION_IP_MAX) {
    _rotateNutritionIpBuckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  _rotateNutritionIpBuckets.set(ip, arr);
  return true;
}
function _rotateNutritionUidRateOk(uid) {
  const now = Date.now();
  let arr = _rotateNutritionUidBuckets.get(uid) || [];
  arr = arr.filter(t => t > now - ROTATE_NUTRITION_UID_WINDOW_MS);
  if (arr.length >= ROTATE_NUTRITION_UID_MAX) {
    _rotateNutritionUidBuckets.set(uid, arr);
    return false;
  }
  arr.push(now);
  _rotateNutritionUidBuckets.set(uid, arr);
  return true;
}

app.post('/api/rotate-nutrition', async (req, res) => {
  // Origin allowlist — refuse before burning Gemini quota.
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }

  // Admin token gate. Configured via Render env BBF_ADMIN_TOKEN.
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) {
    console.error('[rotate-nutrition] rejected — BBF_ADMIN_TOKEN env var is not set on this instance.');
    return res.status(503).json({ ok: false, error: 'config_missing' });
  }
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) {
    console.warn('[rotate-nutrition] rejected — bad/missing X-BBF-Admin-Token from origin "' + (origin || '') + '"');
    return res.status(401).json({ ok: false, error: 'admin_token_invalid' });
  }

  if (!GEMINI_API_KEY) {
    console.warn('[rotate-nutrition] rejected — GEMINI_API_KEY missing');
    return res.status(503).json({ ok: false, error: 'config_missing' });
  }

  const body = req.body || {};
  const uid          = typeof body.uid === 'string'           ? body.uid.trim()           : '';
  const tdee         = typeof body.tdee === 'string'          ? body.tdee.trim()          : (body.tdee != null ? String(body.tdee) : '');
  const constraints  = typeof body.constraints === 'string'   ? body.constraints.trim()   : '';
  const previousPlan = typeof body.previousPlan === 'string'  ? body.previousPlan.trim()  : '';
  const clientTier   = typeof body.clientTier === 'string'    ? body.clientTier.trim()    : 'gateway';
  const clientName   = typeof body.clientName === 'string'    ? body.clientName.trim()    : '';
  // Phase 22 Sovereign Intake · structured filters · empty/missing all
  // degrade gracefully to legacy behavior (no filtering, free-form Gemini).
  const dietaryProfile = typeof body.dietary_profile === 'string' ? body.dietary_profile.trim() : 'Omnivore';
  const allergens      = Array.isArray(body.allergens)      ? body.allergens.map(s => String(s).trim()).filter(Boolean)      : [];
  const foodLikes      = Array.isArray(body.food_likes)     ? body.food_likes.map(s => String(s).trim()).filter(Boolean)     : [];
  const foodDislikes   = Array.isArray(body.food_dislikes)  ? body.food_dislikes.map(s => String(s).trim()).filter(Boolean)  : [];
  if (!uid)  return res.status(400).json({ ok: false, error: 'uid_missing' });
  if (!tdee) return res.status(400).json({ ok: false, error: 'tdee_missing' });

  // Per-IP rate limit AFTER auth so leaked-token spam still hits the
  // ceiling; per-UID rate limit ALWAYS, even for trusted callers.
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (!_rotateNutritionIpRateOk(ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limited_ip' });
  }
  if (!_rotateNutritionUidRateOk(uid)) {
    return res.status(429).json({ ok: false, error: 'rate_limited_uid' });
  }

  // Phase 22 · Sovereign Library filter. Before Gemini generates anything
  // we pre-filter the 40-meal matrix by dietary_profile + allergens so the
  // model picks from a curated, compliant universe — eliminates the prior
  // hallucination risk where Gemini would invent meals not in our library.
  // Filter logic:
  //   • meal.dietary_profile must include the requested profile
  //   • for each chosen allergen, meal.restrictions_safe must include
  //     the matching "<Allergen>-Free" tag (Tree Nut → "Tree-Nut-Free"
  //     or "Nut-Free" both pass; Coconut → "Coconut-Free")
  function _allergenSafeTags(allergenName) {
    const a = String(allergenName || '').trim();
    if (!a) return [];
    const tags = [];
    tags.push(a + '-Free');
    tags.push(a.replace(/\s+/g, '-') + '-Free');
    tags.push(a.replace(/\s+/g, '') + '-Free');
    if (/^tree[\s-]?nut$/i.test(a)) { tags.push('Tree-Nut-Free'); tags.push('Nut-Free'); }
    if (/^(peanut|nut)$/i.test(a))  { tags.push('Nut-Free'); }
    return Array.from(new Set(tags));
  }
  let mealPool = Array.isArray(BBF_MEALS_MATRIX) ? BBF_MEALS_MATRIX.slice() : [];
  const poolBefore = mealPool.length;
  if (dietaryProfile) {
    const dp = dietaryProfile.toLowerCase();
    mealPool = mealPool.filter(m => Array.isArray(m && m.dietary_profile)
      && m.dietary_profile.some(p => String(p).toLowerCase() === dp));
  }
  if (allergens.length) {
    mealPool = mealPool.filter(m => {
      const safe = Array.isArray(m && m.restrictions_safe) ? m.restrictions_safe.map(t => String(t).toLowerCase()) : [];
      return allergens.every(a => {
        const accepted = _allergenSafeTags(a).map(t => t.toLowerCase());
        return accepted.some(t => safe.indexOf(t) !== -1);
      });
    });
  }
  console.log('[rotate-nutrition] meal-pool filtered · before=' + poolBefore +
              ' · diet=' + dietaryProfile + ' · allergens=[' + allergens.join(',') + ']' +
              ' · after=' + mealPool.length);

  // Compact library card for the prompt — keep it small (Gemini bills by
  // token). Include just what the model needs to pick + portion.
  const libraryCards = mealPool.map(m => ({
    id:       m.id,
    name:     (m.name && (m.name.en || Object.values(m.name)[0])) || m.id,
    type:     m.meal_type,
    cuisine:  m.cuisine,
    cal:      m.calories,
    p:        m.protein_g,
    c:        m.carbs_g,
    f:        m.fat_g,
    serving:  m.serving_g,
    ingredients: (m.core_ingredients || []).slice(0, 8)
  }));

  // Soft-bias likes/dislikes via prompt (not filter) — these are
  // preferences, not hard constraints.
  const likesLine    = foodLikes.length    ? "Bias toward meals featuring: " + foodLikes.join(', ') + ". "    : "";
  const dislikesLine = foodDislikes.length ? "Avoid meals featuring: "      + foodDislikes.join(', ') + ". " : "";

  // Two prompt modes:
  //   A) FILTERED LIBRARY mode (mealPool.length > 0): tell Gemini to ONLY
  //      use meals from libraryCards. Echo back chosen meal IDs.
  //   B) FALLBACK mode (mealPool empty — e.g. legacy client no intake):
  //      generate free-form clean meals respecting only constraints text.
  let prompt;
  if (mealPool.length > 0) {
    prompt =
      "You are Lance, a clinical sports nutritionist. Generate a brand new " +
      "7-day meal plan for a client on the " + clientTier + " tier. " +
      "Target Calories: " + tdee + ". " +
      "Dietary Profile: " + dietaryProfile + ". " +
      "Allergen Restrictions: " + (allergens.length ? allergens.join(', ') : 'none') + ". " +
      likesLine + dislikesLine +
      "Strict Medical Constraints: " + (constraints || 'none stated') + ". " +
      "Previous Plan: " + (previousPlan || 'none provided') + ". " +
      "Do not repeat the exact main dishes from the previous plan. " +
      "\n\nSOVEREIGN MEAL LIBRARY · you MUST select every meal from the " +
      "following pre-filtered library of " + mealPool.length + " compliant meals. " +
      "Do NOT invent meals not in this library. You may adjust portion sizes " +
      "to hit calorie targets, but ingredient composition must match. " +
      "Library JSON:\n" + JSON.stringify(libraryCards) + "\n\n" +
      "Return a single JSON object with: " +
      "'name' (the client's first name — use '" + (clientName || uid) + "'), " +
      "'cal' (a one-line calorie/protein summary, e.g. '~1,652 cal/day · High Protein'), " +
      "'goal' (one short sentence; if medical constraints exist, restate inline), " +
      "'days' (array of exactly 7 day objects, each with 'day' string and 'meals' array, " +
      "each meal having 'm' label and 'i' portioned ingredients with calories+protein), " +
      "and 'meal_ids_used' (an array of the meal IDs from the library you actually used). " +
      "No prose or markdown outside the JSON. ABSOLUTELY honor every constraint above.";
  } else {
    // Fallback — legacy compatibility when filter culls everything (e.g.
    // dietary profile + allergens combo with no library coverage).
    console.warn('[rotate-nutrition] meal-pool empty after filter · falling back to free-form');
    prompt =
      "You are Lance, a clinical sports nutritionist. Generate a brand new " +
      "7-day meal plan for a client on the " + clientTier + " tier. " +
      "Target Calories: " + tdee + ". " +
      "Dietary Profile: " + dietaryProfile + ". " +
      "Allergen Restrictions: " + (allergens.length ? allergens.join(', ') : 'none') + ". " +
      likesLine + dislikesLine +
      "Strict Medical Constraints: " + (constraints || 'none stated') + ". " +
      "Previous Plan: " + (previousPlan || 'none provided') + ". " +
      "Provide high-protein, clean-carb meals respecting every constraint above. " +
      "Return JSON with 'name', 'cal', 'goal', 'days' (7 day objects with 'day' + 'meals' [{m,i}]). " +
      "No prose outside JSON. ABSOLUTELY honor every constraint.";
  }

  const responseSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      cal:  { type: 'string' },
      goal: { type: 'string' },
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day:   { type: 'string' },
            meals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  m: { type: 'string' },
                  i: { type: 'string' }
                },
                required: ['m', 'i']
              }
            }
          },
          required: ['day', 'meals']
        }
      },
      meal_ids_used: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['name', 'cal', 'goal', 'days']
  };

  const model = 'gemini-1.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              model + ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY);
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: responseSchema
    }
  };

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[rotate-nutrition] gemini fetch threw:', err && err.message);
    return res.status(502).json({ ok: false, error: 'gemini_unreachable' });
  }

  let geminiBody = null;
  try { geminiBody = await upstream.json(); }
  catch (_) { /* non-JSON body */ }

  if (!upstream.ok) {
    const msg = geminiBody?.error?.message || ('gemini ' + upstream.status);
    console.error('[rotate-nutrition] gemini non-2xx:', upstream.status, msg);
    return res.status(502).json({ ok: false, error: 'gemini_error', detail: msg });
  }

  const rawText = geminiBody?.candidates?.[0]?.content?.parts
    ?.map(p => p?.text || '').join('').trim();
  if (!rawText) {
    console.warn('[rotate-nutrition] gemini returned empty text', JSON.stringify(geminiBody).slice(0, 400));
    return res.status(502).json({ ok: false, error: 'gemini_empty' });
  }

  let plan;
  try { plan = JSON.parse(rawText); }
  catch (e) {
    console.error('[rotate-nutrition] JSON.parse failed:', e && e.message, '· raw=', rawText.slice(0, 400));
    return res.status(502).json({ ok: false, error: 'gemini_bad_json' });
  }

  // Structural sanity — schema enforcement above is best-effort upstream.
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.days) || plan.days.length === 0) {
    return res.status(502).json({ ok: false, error: 'gemini_plan_shape' });
  }

  // Audit echo · which library meals did Gemini actually use, plus the
  // intake filter that produced the pool. Useful for the admin to verify
  // compliance at a glance and for future spend analytics.
  return res.status(200).json({
    ok:   true,
    plan: plan,
    meta: {
      dietary_profile:    dietaryProfile,
      allergens:          allergens,
      pool_size_before:   poolBefore,
      pool_size_after:    mealPool.length,
      meal_ids_used:      Array.isArray(plan.meal_ids_used) ? plan.meal_ids_used : null,
      fallback_free_form: mealPool.length === 0
    }
  });
});

// ───────────────────────────────────────────────────────────────
// POST /api/diagnose-profile — Phase 22 Sovereign Intake AI Diagnostic
// ───────────────────────────────────────────────────────────────
// Admin-only · accepts 5 plain-English answers about a client's eating
// habits and synthesizes a structured dietary intake:
//   { dietary_profile, allergens[], food_likes[], food_dislikes[], rationale }
// Frontend (BBF_DIETARY.runDiagnose) pre-fills the parent modal with
// the result. Admin reviews + edits before saving — the AI never
// writes to d.u[uid] directly.
//
// Auth      · X-BBF-Admin-Token header (same gate as rotate-nutrition)
// Rate cap  · per-IP 8/min · per-UID 4/day (lighter than rotate-nutrition)
// Model     · gemini-1.5-flash · schema-locked JSON response.
// ───────────────────────────────────────────────────────────────
const DIAGNOSE_IP_WINDOW_MS  = 60 * 1000;
const DIAGNOSE_IP_MAX        = 8;
const DIAGNOSE_UID_WINDOW_MS = 24 * 60 * 60 * 1000;
const DIAGNOSE_UID_MAX       = 4;
const _diagnoseIpBuckets  = new Map();
const _diagnoseUidBuckets = new Map();
function _diagnoseIpRateOk(ip) {
  const now = Date.now();
  let arr = _diagnoseIpBuckets.get(ip) || [];
  arr = arr.filter(t => t > now - DIAGNOSE_IP_WINDOW_MS);
  if (arr.length >= DIAGNOSE_IP_MAX) { _diagnoseIpBuckets.set(ip, arr); return false; }
  arr.push(now); _diagnoseIpBuckets.set(ip, arr); return true;
}
function _diagnoseUidRateOk(uid) {
  const now = Date.now();
  let arr = _diagnoseUidBuckets.get(uid) || [];
  arr = arr.filter(t => t > now - DIAGNOSE_UID_WINDOW_MS);
  if (arr.length >= DIAGNOSE_UID_MAX) { _diagnoseUidBuckets.set(uid, arr); return false; }
  arr.push(now); _diagnoseUidBuckets.set(uid, arr); return true;
}

app.post('/api/diagnose-profile', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) {
    console.error('[diagnose-profile] rejected — BBF_ADMIN_TOKEN env var is not set on this instance.');
    return res.status(503).json({ ok: false, error: 'config_missing' });
  }
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) {
    console.warn('[diagnose-profile] rejected — bad/missing X-BBF-Admin-Token');
    return res.status(401).json({ ok: false, error: 'admin_token_invalid' });
  }
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ ok: false, error: 'config_missing' });
  }

  const body = req.body || {};
  const uid        = typeof body.uid === 'string'        ? body.uid.trim()        : '';
  const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
  const age        = body.age != null ? String(body.age) : '';
  const goal       = typeof body.goal === 'string'       ? body.goal.trim()       : '';
  const ans        = body.answers || {};
  const ate        = typeof ans.ate_yesterday === 'string'     ? ans.ate_yesterday.trim().slice(0, 800)     : '';
  const dislikes   = typeof ans.dislikes_freeform === 'string' ? ans.dislikes_freeform.trim().slice(0, 800) : '';
  const sens       = typeof ans.sensitivities === 'string'     ? ans.sensitivities.trim().slice(0, 800)     : '';
  const culture    = typeof ans.cultural_prefs === 'string'    ? ans.cultural_prefs.trim().slice(0, 600)    : '';
  const energy     = typeof ans.energy_and_goal === 'string'   ? ans.energy_and_goal.trim().slice(0, 800)   : '';
  if (!uid) return res.status(400).json({ ok: false, error: 'uid_missing' });
  if (!ate && !dislikes && !sens && !culture && !energy) {
    return res.status(400).json({ ok: false, error: 'no_answers_provided' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (!_diagnoseIpRateOk(ip))   return res.status(429).json({ ok: false, error: 'rate_limited_ip' });
  if (!_diagnoseUidRateOk(uid)) return res.status(429).json({ ok: false, error: 'rate_limited_uid' });

  // Tight prompt · Gemini synthesizes the five free-form answers into
  // the structured intake the BBF frontend writes to d.u[uid].
  const prompt =
    "You are a clinical sports nutritionist conducting a fast intake. " +
    "From the client's answers below, synthesize a structured dietary " +
    "profile. Be decisive · pick ONE primary dietary_profile (Omnivore, " +
    "Vegetarian, Pescatarian, Vegan, or Keto-Friendly) based on the " +
    "strongest signal in the answers. If signals conflict, default to " +
    "Omnivore. List allergen restrictions only when the client explicitly " +
    "states an allergy OR describes a reaction (bloating, hives, GI " +
    "distress). Suspected sensitivities go into food_dislikes, NOT allergens. " +
    "Use the EXACT allergen names from this list (case-sensitive): " +
    "Gluten, Dairy, Peanut, Tree Nut, Soy, Egg, Shellfish, Fish, Coconut, Sesame. " +
    "Likes + dislikes should be specific ingredients (e.g. 'chicken', " +
    "'cilantro') — not categories. " +
    "\n\nCLIENT CONTEXT: " +
    (clientName ? "Name: " + clientName + ". " : '') +
    (age ? "Age: " + age + ". " : '') +
    (goal ? "Goal: " + goal + ". " : '') +
    "\n\nANSWERS:\n" +
    "1. Ate yesterday: " + (ate || '(no answer)') + "\n" +
    "2. Dislikes/avoids: " + (dislikes || '(no answer)') + "\n" +
    "3. Sensitivities: " + (sens || '(no answer)') + "\n" +
    "4. Cultural/religious: " + (culture || '(no answer)') + "\n" +
    "5. Energy/goal: " + (energy || '(no answer)') + "\n\n" +
    "Return a single JSON object with keys: 'dietary_profile' (string), " +
    "'allergens' (array of strings from the exact list above), " +
    "'food_likes' (array of ingredient strings, max 10), " +
    "'food_dislikes' (array of ingredient strings, max 10), " +
    "'rationale' (one short sentence explaining the profile choice). " +
    "No prose or markdown outside the JSON.";

  const responseSchema = {
    type: 'object',
    properties: {
      dietary_profile: { type: 'string' },
      allergens:       { type: 'array', items: { type: 'string' } },
      food_likes:      { type: 'array', items: { type: 'string' } },
      food_dislikes:   { type: 'array', items: { type: 'string' } },
      rationale:       { type: 'string' }
    },
    required: ['dietary_profile', 'allergens', 'food_likes', 'food_dislikes', 'rationale']
  };

  const model = 'gemini-1.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              model + ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY);
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
      responseSchema: responseSchema
    }
  };

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[diagnose-profile] gemini fetch threw:', err && err.message);
    return res.status(502).json({ ok: false, error: 'gemini_unreachable' });
  }
  let gBody = null;
  try { gBody = await upstream.json(); } catch (_) {}
  if (!upstream.ok) {
    const msg = gBody?.error?.message || ('gemini ' + upstream.status);
    console.error('[diagnose-profile] gemini non-2xx:', upstream.status, msg);
    return res.status(502).json({ ok: false, error: 'gemini_error', detail: msg });
  }
  const rawText = gBody?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('').trim();
  if (!rawText) return res.status(502).json({ ok: false, error: 'gemini_empty' });
  let dx;
  try { dx = JSON.parse(rawText); }
  catch (e) {
    console.error('[diagnose-profile] JSON.parse failed:', e && e.message);
    return res.status(502).json({ ok: false, error: 'gemini_bad_json' });
  }
  if (!dx || typeof dx !== 'object' || !dx.dietary_profile) {
    return res.status(502).json({ ok: false, error: 'gemini_shape' });
  }
  // Allergen sanitization · clamp to known list to keep frontend checkboxes happy.
  const ALLOWED_ALLERGENS = ['Gluten','Dairy','Peanut','Tree Nut','Soy','Egg','Shellfish','Fish','Coconut','Sesame'];
  dx.allergens     = (Array.isArray(dx.allergens)     ? dx.allergens     : []).filter(a => ALLOWED_ALLERGENS.indexOf(a) !== -1);
  dx.food_likes    = (Array.isArray(dx.food_likes)    ? dx.food_likes    : []).slice(0, 10);
  dx.food_dislikes = (Array.isArray(dx.food_dislikes) ? dx.food_dislikes : []).slice(0, 10);
  console.log('[diagnose-profile] uid=' + uid + ' · ' + dx.dietary_profile + ' · ' + dx.allergens.length + ' allergens · ' + dx.food_likes.length + ' likes · ' + dx.food_dislikes.length + ' avoids');

  return res.status(200).json({ ok: true, diagnosis: dx });
});

// ───────────────────────────────────────────────────────────────
// POST /api/leads-list — Phase 22 Sovereign Command Center · admin view of leads
// ───────────────────────────────────────────────────────────────
// Admin-only · returns recent Pathfinder leads with provisioning
// status (cross-referenced against bbf_users by email). Used by the
// "Incoming Leads" panel in the Panopticon tab. RLS is enabled on
// bbf_leads with no anon/auth policies (deny-by-default); this
// endpoint reads via the service role and gates on BBF_ADMIN_TOKEN.
// ───────────────────────────────────────────────────────────────
const LEADS_LIST_IP_WINDOW_MS = 60 * 1000;
const LEADS_LIST_IP_MAX       = 20;
const _leadsListIpBuckets = new Map();
function _leadsListIpRateOk(ip) {
  const now = Date.now();
  let arr = _leadsListIpBuckets.get(ip) || [];
  arr = arr.filter(t => t > now - LEADS_LIST_IP_WINDOW_MS);
  if (arr.length >= LEADS_LIST_IP_MAX) { _leadsListIpBuckets.set(ip, arr); return false; }
  arr.push(now); _leadsListIpBuckets.set(ip, arr); return true;
}

app.post('/api/leads-list', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) {
    console.error('[leads-list] rejected — BBF_ADMIN_TOKEN env var is not set.');
    return res.status(503).json({ ok: false, error: 'config_missing' });
  }
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) {
    return res.status(401).json({ ok: false, error: 'admin_token_invalid' });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (!_leadsListIpRateOk(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  const body  = req.body || {};
  const limit = Math.max(1, Math.min(200, Number(body.limit) || 50));

  try {
    // 1. Fetch leads (most recent first)
    const { data: leads, error: leadsErr } = await supabase
      .from('bbf_leads')
      .select('id, source, email, full_name, phone, tier, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (leadsErr) {
      console.error('[leads-list] bbf_leads query failed:', leadsErr.message);
      return res.status(500).json({ ok: false, error: 'leads_query_failed' });
    }

    // 2. Cross-reference against bbf_users by email so each row can be
    //    flagged as PROVISIONED or PENDING. Single query, hash-join in JS.
    const emails = Array.from(new Set((leads || []).map(l => (l.email || '').toLowerCase()).filter(Boolean)));
    const provisionedSet = new Set();
    if (emails.length) {
      const { data: users, error: usersErr } = await supabase
        .from('bbf_users')
        .select('email')
        .in('email', emails);
      if (usersErr) {
        console.warn('[leads-list] bbf_users cross-reference failed (non-fatal):', usersErr.message);
      } else {
        (users || []).forEach(u => { if (u.email) provisionedSet.add(String(u.email).toLowerCase()); });
      }
    }

    // 3. Decorate each lead with status + extracted intake snapshot
    const decorated = (leads || []).map(l => {
      const p = (l.payload && typeof l.payload === 'object') ? l.payload : {};
      return {
        id:               l.id,
        source:           l.source,
        email:            l.email,
        full_name:        l.full_name,
        phone:            l.phone,
        tier:             l.tier || p.tier || null,
        created_at:       l.created_at,
        provisioned:      provisionedSet.has(String(l.email || '').toLowerCase()),
        dietary_profile:  p.dietary_profile || null,
        allergens:        Array.isArray(p.allergens) ? p.allergens : [],
        age:              p.age || null,
        sex:              p.sex || null,
        height:           p.height || null,
        weight:           p.weight || null,
        primary_goal:     p.primary_goal || null,
        program:          p.program || null,
        health_notes:     p.health_notes || null,
        full_payload:     p,
      };
    });

    return res.status(200).json({
      ok:           true,
      total:        decorated.length,
      provisioned:  decorated.filter(l => l.provisioned).length,
      pending:      decorated.filter(l => !l.provisioned).length,
      leads:        decorated,
    });
  } catch (err) {
    console.error('[leads-list] threw:', err && err.message);
    return res.status(500).json({ ok: false, error: 'unexpected' });
  }
});

// ───────────────────────────────────────────────────────────────
// POST /api/concierge-run-now — admin manual trigger for bbf-lead-concierge
// ───────────────────────────────────────────────────────────────
// Fires the Concierge edge function from the Command Center "Run Now"
// button. Same admin-token gate as /api/rotate-nutrition. Edge function
// enforces its own caps + cooldown so this is safe to spam.
// ───────────────────────────────────────────────────────────────
const CONCIERGE_RUN_IP_WINDOW_MS = 60 * 1000;
const CONCIERGE_RUN_IP_MAX       = 6;
const _conciergeRunIpBuckets = new Map();
function _conciergeRunIpRateOk(ip) {
  const now = Date.now();
  let arr = _conciergeRunIpBuckets.get(ip) || [];
  arr = arr.filter(t => t > now - CONCIERGE_RUN_IP_WINDOW_MS);
  if (arr.length >= CONCIERGE_RUN_IP_MAX) { _conciergeRunIpBuckets.set(ip, arr); return false; }
  arr.push(now); _conciergeRunIpBuckets.set(ip, arr); return true;
}

app.post('/api/concierge-run-now', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) return res.status(503).json({ ok: false, error: 'config_missing' });
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) {
    return res.status(401).json({ ok: false, error: 'admin_token_invalid' });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (!_conciergeRunIpRateOk(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SR_KEY       = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SR_KEY) return res.status(503).json({ ok: false, error: 'supabase_config_missing' });

  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/bbf-lead-concierge', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SR_KEY },
      body:    JSON.stringify({ source: 'manual_admin' }),
    });
    let body = null;
    try { body = await r.json(); } catch (_) {}
    return res.status(200).json({ ok: r.ok && !!(body && body.ok), upstream_status: r.status, result: body });
  } catch (e) {
    console.error('[concierge-run-now] threw:', e && e.message);
    return res.status(502).json({ ok: false, error: 'edge_fn_unreachable', detail: e && e.message });
  }
});

// ───────────────────────────────────────────────────────────────
// POST /api/concierge-log — recent Concierge actions for the Command Center
// ───────────────────────────────────────────────────────────────
app.post('/api/concierge-log', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) return res.status(503).json({ ok: false, error: 'config_missing' });
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) {
    return res.status(401).json({ ok: false, error: 'admin_token_invalid' });
  }

  const body = req.body || {};
  const limit = Math.max(1, Math.min(200, Number(body.limit) || 50));

  try {
    const { data, error } = await supabase
      .from('bbf_lead_actions')
      .select('id, run_id, lead_id, lead_email, action_type, score, priority, template_id, email_subject, email_body_preview, brevo_message_id, error, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[concierge-log] query failed:', error.message);
      return res.status(500).json({ ok: false, error: 'query_failed' });
    }
    // Group by run_id for the UI to render runs as cards
    const runs = {};
    (data || []).forEach(a => {
      if (!runs[a.run_id]) runs[a.run_id] = { run_id: a.run_id, started_at: a.created_at, actions: [], sent: 0, failed: 0, skipped: 0 };
      runs[a.run_id].actions.push(a);
      if (a.action_type === 'email_sent')   runs[a.run_id].sent++;
      if (a.action_type === 'email_failed') runs[a.run_id].failed++;
      if (a.action_type && a.action_type.indexOf('skipped_') === 0) runs[a.run_id].skipped++;
      if (a.created_at < runs[a.run_id].started_at) runs[a.run_id].started_at = a.created_at;
    });
    const runList = Object.values(runs).sort((a, b) => (b.started_at > a.started_at ? 1 : -1));
    return res.status(200).json({ ok: true, total: (data || []).length, runs: runList });
  } catch (err) {
    console.error('[concierge-log] threw:', err && err.message);
    return res.status(500).json({ ok: false, error: 'unexpected' });
  }
});

// ───────────────────────────────────────────────────────────────
// POST /api/admin-upsert-client — admin cloud-sync escape hatch
// ───────────────────────────────────────────────────────────────
// Patches (or creates) a bbf_users row by `uid` text column. The CEO
// uses this from the Command Center to push admin-side edits (dietary
// profile, allergens, food likes/dislikes, macros) that previously
// only lived in localStorage. Closes the gap exposed by the Honor
// smoke test: client profile + dietary intake set on admin device,
// but client logs in on her phone and sees nothing because no cloud
// row existed.
//
// Auth   · X-BBF-Admin-Token (same gate as rotator + concierge)
// Rate   · 30/min IP
// Schema · upserts into bbf_users by uid. Fields beyond the safe-list
//          are silently dropped — caller can't bypass admin scope to
//          write arbitrary columns.
// ───────────────────────────────────────────────────────────────
const ADMIN_UPSERT_IP_WINDOW_MS = 60 * 1000;
const ADMIN_UPSERT_IP_MAX       = 30;
const _adminUpsertIpBuckets = new Map();
function _adminUpsertIpRateOk(ip) {
  const now = Date.now();
  let arr = _adminUpsertIpBuckets.get(ip) || [];
  arr = arr.filter(t => t > now - ADMIN_UPSERT_IP_WINDOW_MS);
  if (arr.length >= ADMIN_UPSERT_IP_MAX) { _adminUpsertIpBuckets.set(ip, arr); return false; }
  arr.push(now); _adminUpsertIpBuckets.set(ip, arr); return true;
}

app.post('/api/admin-upsert-client', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) return res.status(503).json({ ok: false, error: 'config_missing' });
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) {
    return res.status(401).json({ ok: false, error: 'admin_token_invalid' });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (!_adminUpsertIpRateOk(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  const body = req.body || {};
  const uid  = typeof body.uid === 'string' ? body.uid.trim().toLowerCase() : '';
  if (!uid) return res.status(400).json({ ok: false, error: 'uid_required' });
  if (!/^[a-z0-9_]{2,40}$/.test(uid)) return res.status(400).json({ ok: false, error: 'uid_format_invalid' });

  // Safe-list of writable fields · anything else is silently dropped.
  const row = { uid: uid, updated_at: new Date().toISOString() };
  if (typeof body.name === 'string'              && body.name.trim())     row.name              = body.name.trim().slice(0, 120);
  if (typeof body.email === 'string'             && body.email.trim())    row.email             = body.email.trim().toLowerCase().slice(0, 160);
  if (typeof body.role === 'string')                                      row.role              = body.role.slice(0, 24);
  if (typeof body.subscription_tier === 'string')                         row.subscription_tier = body.subscription_tier.slice(0, 40);
  if (typeof body.dietary_profile === 'string'   && body.dietary_profile.trim()) row.dietary_profile = body.dietary_profile.trim().slice(0, 40);
  if (Array.isArray(body.allergens))                                      row.allergens         = body.allergens.map(s => String(s).slice(0, 40)).filter(Boolean).slice(0, 20);
  if (Array.isArray(body.food_likes))                                     row.food_likes        = body.food_likes.map(s => String(s).slice(0, 60)).filter(Boolean).slice(0, 25);
  if (Array.isArray(body.food_dislikes))                                  row.food_dislikes     = body.food_dislikes.map(s => String(s).slice(0, 60)).filter(Boolean).slice(0, 25);
  if (Number.isFinite(Number(body.tdee_target))  && Number(body.tdee_target) > 0) row.tdee_target = Number(body.tdee_target);
  if (Number.isFinite(Number(body.macro_p))      && Number(body.macro_p) > 0)     row.macro_p     = Number(body.macro_p);
  if (Number.isFinite(Number(body.macro_c))      && Number(body.macro_c) > 0)     row.macro_c     = Number(body.macro_c);
  if (Number.isFinite(Number(body.macro_f))      && Number(body.macro_f) > 0)     row.macro_f     = Number(body.macro_f);
  if (body.nutrition_plan && typeof body.nutrition_plan === 'object') {
    row.nutrition_plan = body.nutrition_plan;
    row.nutrition_plan_updated_at = new Date().toISOString();
  }

  try {
    const { data, error } = await supabase
      .from('bbf_users')
      .upsert(row, { onConflict: 'uid' })
      .select('uid, name, email, subscription_tier, dietary_profile, allergens, food_likes, food_dislikes, tdee_target, macro_p, macro_c, macro_f, updated_at')
      .single();
    if (error) {
      console.error('[admin-upsert-client] failed:', error.message);
      return res.status(500).json({ ok: false, error: 'upsert_failed', detail: error.message });
    }
    console.log(`[admin-upsert-client] ok · uid=${uid} · diet=${row.dietary_profile || '(unchanged)'} · allergens=${(row.allergens || []).length}`);
    return res.status(200).json({ ok: true, row: data });
  } catch (err) {
    console.error('[admin-upsert-client] threw:', err && err.message);
    return res.status(500).json({ ok: false, error: 'unexpected' });
  }
});

// ───────────────────────────────────────────────────────────────
// POST /api/admin-check-cloud — quick cloud-status probe for the admin UI
// Returns { ok, exists, row } so the Command Center can render
// SYNCED / LOCAL-ONLY badges per client.
// ───────────────────────────────────────────────────────────────
app.post('/api/admin-check-cloud', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) return res.status(503).json({ ok: false, error: 'config_missing' });
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) {
    return res.status(401).json({ ok: false, error: 'admin_token_invalid' });
  }
  const body = req.body || {};
  const uid  = typeof body.uid === 'string' ? body.uid.trim().toLowerCase() : '';
  if (!uid) return res.status(400).json({ ok: false, error: 'uid_required' });
  try {
    const { data, error } = await supabase
      .from('bbf_users')
      .select('uid, name, email, subscription_tier, dietary_profile, allergens, food_likes, food_dislikes, tdee_target, macro_p, macro_c, macro_f, nutrition_plan, nutrition_plan_updated_at, updated_at')
      .eq('uid', uid)
      .maybeSingle();
    if (error) return res.status(500).json({ ok: false, error: error.message });
    if (data) {
      data.has_meal_plan = !!data.nutrition_plan;
      delete data.nutrition_plan; // keep response small · UI only needs the boolean
    }
    return res.status(200).json({ ok: true, exists: !!data, row: data || null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'unexpected' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PHASE 0 · APPROVAL QUEUE + AGENTIC AUDIT
// ───────────────────────────────────────────────────────────────────────
// All agentic mutations route through bbf_pending_review. Founder
// approves; executor performs the write with explicit DB-success
// confirmation (RETURNING * via Prefer: return=representation). NO
// silent HTTP 200 stubs — execution_success boolean is true ONLY when
// the target write returned the affected row.
//
// Audit ledger · every submit/approve/reject/execute writes to
// bbf_audit_logs with action_type, agent, payload, result, success.
// ═══════════════════════════════════════════════════════════════════════

// Whitelist of tables that proposals can target. Anything else is a hard
// reject — keeps the executor from being abused to write arbitrary rows.
// Each entry maps to the column safe-list it can mutate.
const PROPOSAL_TARGET_WHITELIST = {
  bbf_users: new Set([
    'subscription_tier','baseline_status','cardiac_clearance','block_priority',
    'dietary_profile','allergens','food_likes','food_dislikes',
    'tdee_target','macro_p','macro_c','macro_f',
    'nutrition_plan','nutrition_plan_updated_at',
    'biomechanical_redline','biomechanical_redline_at',
    'cns_friction_score','cns_friction_updated_at',
    'somatic_cognitive_load','somatic_fasting_hours',
    'ghost_intervention_needed','ghost_flagged_at',
    'access_status','auto_lock_enabled','daily_brief'
  ]),
  bbf_active_clients: new Set([
    'dietary_profile','allergens','food_likes','food_dislikes',
    'tdee_target','macro_p','macro_c','macro_f',
    'workout_plan','meal_plan','plans_generated_at',
    'training_protocol','clinical_history'
  ]),
  // Phase 2 · athlete progression target · phase advancements + mesocycle
  // updates flow through the approval queue · never auto-written.
  bbf_athlete_progression: new Set([
    'sport','position','phase','target_phase',
    'protocol_completed','completed_at',
    'mesocycle_started_at','mesocycle_week',
    'phase_history','rpe_avg_last_3','friction_avg_last_3',
    'guardian_consent','guardian_consent_at'
  ]),
};

function _sanitizeProposalDiff(diff) {
  if (!diff || typeof diff !== 'object') return { ok: false, reason: 'diff_missing' };
  const t = diff.target_table;
  const u = diff.target_uid;
  const a = diff.after;
  if (typeof t !== 'string' || !PROPOSAL_TARGET_WHITELIST[t]) {
    return { ok: false, reason: 'target_table_not_whitelisted' };
  }
  if (typeof u !== 'string' || !u.trim()) return { ok: false, reason: 'target_uid_required' };
  if (!a || typeof a !== 'object')         return { ok: false, reason: 'diff_after_required' };
  const allowed = PROPOSAL_TARGET_WHITELIST[t];
  const safe = {};
  let any = false;
  for (const k of Object.keys(a)) {
    if (allowed.has(k)) { safe[k] = a[k]; any = true; }
  }
  if (!any) return { ok: false, reason: 'no_whitelisted_fields_in_diff' };
  return { ok: true, target_table: t, target_uid: u.trim().toLowerCase(), after: safe };
}

async function _writeAuditLog(row) {
  // Best-effort · audit failure must never block the primary action,
  // but it's logged loudly so the gap is visible.
  try {
    const payload = Object.assign({}, row, { created_at: new Date().toISOString() });
    const { error } = await supabase.from('bbf_audit_logs').insert(payload);
    if (error) console.warn('[audit] insert failed (non-fatal):', error.message);
  } catch (e) {
    console.warn('[audit] threw (non-fatal):', e && e.message);
  }
}

// ── POST /api/proposal-submit — any agent (server-side) creates a proposal
app.post('/api/proposal-submit', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }
  // Same admin-token gate so only admin-trusted callers can submit.
  // Future: open a separate AGENT_TOKEN for autonomous agents.
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) return res.status(503).json({ ok: false, error: 'config_missing' });
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) {
    return res.status(401).json({ ok: false, error: 'admin_token_invalid' });
  }

  const body = req.body || {};
  const proposed_by = typeof body.proposed_by === 'string' ? body.proposed_by.trim().slice(0, 80) : '';
  if (!proposed_by) return res.status(400).json({ ok: false, error: 'proposed_by_required' });
  if (typeof body.rationale !== 'string' || !body.rationale.trim()) return res.status(400).json({ ok: false, error: 'rationale_required' });

  // Sanitize diff up-front · reject anything outside the whitelist.
  const diffCheck = _sanitizeProposalDiff(body.diff || {});
  if (!diffCheck.ok) {
    return res.status(400).json({ ok: false, error: 'diff_invalid', reason: diffCheck.reason });
  }
  const safeDiff = {
    target_table: diffCheck.target_table,
    target_uid:   diffCheck.target_uid,
    after:        diffCheck.after,
    before:       (body.diff && body.diff.before) || null,
    fields:       Object.keys(diffCheck.after),
  };

  const row = {
    proposal_type: body.proposal_type || 'custom',
    risk_level:    body.risk_level    || 'medium',
    population:    body.population    || {},
    diff:          safeDiff,
    rationale:     String(body.rationale).slice(0, 2000),
    proposed_by:   proposed_by,
    expires_at:    body.expires_at || null,
    metadata:      body.metadata || {},
  };

  try {
    const { data, error } = await supabase
      .from('bbf_pending_review')
      .insert(row)
      .select()
      .single();
    if (error) {
      console.error('[proposal-submit] insert failed:', error.message);
      return res.status(500).json({ ok: false, error: 'insert_failed', detail: error.message });
    }
    await _writeAuditLog({
      action_type: 'proposal_submit', agent: proposed_by,
      proposal_id: data.id, target_uid: safeDiff.target_uid,
      payload: { proposal_type: row.proposal_type, risk_level: row.risk_level, fields: safeDiff.fields },
      result: { id: data.id }, success: true,
    });
    return res.status(200).json({ ok: true, proposal: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'unexpected', detail: err && err.message });
  }
});

// ── POST /api/proposal-list — admin reads the queue
app.post('/api/proposal-list', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) return res.status(503).json({ ok: false, error: 'config_missing' });
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) return res.status(401).json({ ok: false, error: 'admin_token_invalid' });

  const body = req.body || {};
  const status = typeof body.status === 'string' ? body.status : 'pending';
  const limit  = Math.max(1, Math.min(200, Number(body.limit) || 50));

  try {
    let q = supabase.from('bbf_pending_review').select('*').order('proposed_at', { ascending: false }).limit(limit);
    if (status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, total: (data || []).length, proposals: data || [] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'unexpected' });
  }
});

// ── POST /api/proposal-approve — execute with explicit DB success confirmation
// Per the directive: "upon approval, the payload executes a secure write
// with explicit DB success confirmation. No silent HTTP 200 fallback
// stubs are allowed on the write path."
app.post('/api/proposal-approve', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) return res.status(503).json({ ok: false, error: 'config_missing' });
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) return res.status(401).json({ ok: false, error: 'admin_token_invalid' });

  const body = req.body || {};
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const approver = typeof body.approver === 'string' ? body.approver.trim().slice(0, 80) : 'akeem';
  if (!id) return res.status(400).json({ ok: false, error: 'id_required' });

  // 1. Fetch the proposal · must be pending
  const { data: prop, error: pErr } = await supabase
    .from('bbf_pending_review').select('*').eq('id', id).single();
  if (pErr || !prop) return res.status(404).json({ ok: false, error: 'proposal_not_found' });
  if (prop.status !== 'pending') {
    return res.status(409).json({ ok: false, error: 'proposal_not_pending', current_status: prop.status });
  }

  const diff = prop.diff || {};
  const check = _sanitizeProposalDiff(diff);
  if (!check.ok) {
    await supabase.from('bbf_pending_review').update({
      status: 'execution_failed', approver, decided_at: new Date().toISOString(),
      execution_success: false, execution_error: 'diff_sanitize_failed:' + check.reason,
    }).eq('id', id);
    await _writeAuditLog({
      action_type: 'proposal_approve', agent: 'render_proxy', proposal_id: id,
      target_uid: diff.target_uid || null,
      payload: diff, result: { reason: check.reason }, success: false,
      error_message: 'diff_sanitize_failed:' + check.reason,
    });
    return res.status(400).json({ ok: false, error: 'diff_invalid_at_execute_time', reason: check.reason });
  }

  // 2. Execute the write with Prefer: return=representation. This forces
  // PostgREST to return the affected row(s). If zero rows come back,
  // the write was a silent no-op (no matching row, RLS, etc) — we mark
  // execution_failed loudly. This is the load-bearing safeguard.
  const updatePayload = Object.assign({ updated_at: new Date().toISOString() }, check.after);

  let returnedRows = null;
  let executionError = null;
  try {
    let eq, filterValue;
    if (check.target_table === 'bbf_users') {
      eq = 'uid'; filterValue = check.target_uid;
    } else if (check.target_table === 'bbf_active_clients') {
      eq = 'vault_email'; filterValue = check.target_uid;
    } else if (check.target_table === 'bbf_athlete_progression') {
      // Resolve slug → uuid first since athlete_progression.user_id is a
      // uuid FK to bbf_users.id, not the text slug.
      const userLookup = await supabase
        .from('bbf_users')
        .select('id')
        .eq('uid', check.target_uid)
        .maybeSingle();
      if (userLookup.error || !userLookup.data) {
        executionError = 'user_not_found_for_slug:' + check.target_uid;
      } else {
        eq = 'user_id'; filterValue = userLookup.data.id;
      }
    } else {
      executionError = 'target_table_unhandled:' + check.target_table;
    }

    if (!executionError) {
      const r = await supabase
        .from(check.target_table)
        .update(updatePayload)
        .eq(eq, filterValue)
        .select();
      if (r.error) {
        executionError = r.error.message || 'unknown_error';
      } else {
        returnedRows = Array.isArray(r.data) ? r.data : (r.data ? [r.data] : []);
      }
    }
  } catch (e) {
    executionError = (e && e.message) || 'execute_threw';
  }

  const success = !executionError && Array.isArray(returnedRows) && returnedRows.length > 0;

  // 3. Update the proposal · decided + execution result
  const finalStatus = success ? 'executed' : 'execution_failed';
  const closeError  = executionError || (success ? null : 'write_affected_zero_rows');
  await supabase.from('bbf_pending_review').update({
    status: finalStatus, approver, decided_at: new Date().toISOString(),
    execution_success: !!success,
    execution_result: returnedRows,
    execution_error:  closeError,
  }).eq('id', id);

  // 4. Audit · loudly capture the outcome
  await _writeAuditLog({
    action_type: 'proposal_execute', agent: 'render_proxy', proposal_id: id,
    target_uid: check.target_uid,
    payload: { table: check.target_table, after: check.after },
    result: { rows_affected: (returnedRows || []).length, rows: returnedRows },
    success: !!success, error_message: closeError,
  });

  if (!success) {
    return res.status(500).json({ ok: false, error: 'write_failed', detail: closeError, rows_affected: (returnedRows || []).length });
  }
  return res.status(200).json({ ok: true, status: finalStatus, rows_affected: returnedRows.length, rows: returnedRows });
});

// ── POST /api/proposal-reject — admin declines a proposal
app.post('/api/proposal-reject', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) return res.status(503).json({ ok: false, error: 'config_missing' });
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) return res.status(401).json({ ok: false, error: 'admin_token_invalid' });

  const body = req.body || {};
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const approver = typeof body.approver === 'string' ? body.approver.trim().slice(0, 80) : 'akeem';
  const reason   = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (!id) return res.status(400).json({ ok: false, error: 'id_required' });

  const { data, error } = await supabase
    .from('bbf_pending_review')
    .update({ status: 'rejected', approver, decided_at: new Date().toISOString(), execution_error: reason || null })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single();
  if (error) return res.status(500).json({ ok: false, error: error.message });
  if (!data)  return res.status(409).json({ ok: false, error: 'proposal_not_pending_or_not_found' });

  await _writeAuditLog({
    action_type: 'proposal_reject', agent: 'render_proxy', proposal_id: id,
    target_uid: data.diff && data.diff.target_uid || null,
    payload: { reason }, success: true,
  });
  return res.status(200).json({ ok: true, proposal: data });
});

// ── POST /api/audit-log — generic AI-action audit ingester
// Allows any agentic surface (server or client-side via admin token)
// to append a structured audit record. Useful for vocab-filter
// sanitizations, CNS writes, etc.
app.post('/api/audit-log', async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  const expectedAdminToken = process.env.BBF_ADMIN_TOKEN;
  if (!expectedAdminToken) return res.status(503).json({ ok: false, error: 'config_missing' });
  const provided = req.headers['x-bbf-admin-token'];
  if (!provided || provided !== expectedAdminToken) return res.status(401).json({ ok: false, error: 'admin_token_invalid' });

  const body = req.body || {};
  if (!body.action_type) return res.status(400).json({ ok: false, error: 'action_type_required' });
  await _writeAuditLog({
    action_type:   String(body.action_type).slice(0, 80),
    agent:         body.agent ? String(body.agent).slice(0, 80) : null,
    target_uid:    body.target_uid ? String(body.target_uid).slice(0, 80) : null,
    payload:       body.payload || null,
    result:        body.result || null,
    success:       body.success != null ? !!body.success : null,
    error_message: body.error_message ? String(body.error_message).slice(0, 1000) : null,
  });
  return res.status(200).json({ ok: true });
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

    // Phase 22 · pipeline coherence · pull the dietary intake the
    // Pathfinder collected (stored on bbf_active_clients by /process)
    // and mirror it onto the freshly-provisioned bbf_users row so the
    // client lands in the app with their real preferences, not the
    // Omnivore/empty fallback. Linked by vault_email == client_email.
    // Non-fatal: any error here just logs and continues so Zapier still
    // gets the welcome credentials.
    try {
      const { data: intake, error: intakeErr } = await supabase
        .from('bbf_active_clients')
        .select('dietary_profile, allergens, food_likes, food_dislikes, tdee_target, macro_p, macro_c, macro_f')
        .or(`vault_email.eq.${customerEmail},client_email.eq.${customerEmail}`)
        .maybeSingle();
      if (intakeErr) {
        console.warn('[BBF VAULT] /provision intake lookup failed (non-fatal):', intakeErr.message || intakeErr);
      } else if (intake) {
        const { error: upErr } = await supabase
          .from('bbf_users')
          .update({
            dietary_profile: intake.dietary_profile || 'Omnivore',
            allergens:       Array.isArray(intake.allergens)     ? intake.allergens     : [],
            food_likes:      Array.isArray(intake.food_likes)    ? intake.food_likes    : [],
            food_dislikes:   Array.isArray(intake.food_dislikes) ? intake.food_dislikes : [],
            tdee_target:     intake.tdee_target || null,
            macro_p:         intake.macro_p || null,
            macro_c:         intake.macro_c || null,
            macro_f:         intake.macro_f || null,
            updated_at:      new Date().toISOString(),
          })
          .eq('uid', data.username);
        if (upErr) {
          console.warn('[BBF VAULT] /provision dietary mirror failed (non-fatal):', upErr.message || upErr);
        } else {
          console.log(`[BBF VAULT] /provision dietary mirrored — ${data.username} · ${intake.dietary_profile || 'Omnivore'} · ${(intake.allergens||[]).length} allergens`);
        }
      } else {
        console.log(`[BBF VAULT] /provision · no bbf_active_clients intake row for ${customerEmail} · skipping dietary mirror`);
      }
    } catch (e) {
      console.warn('[BBF VAULT] /provision dietary mirror threw (non-fatal):', e && e.message);
    }

    // Phase 17 — write subscription_tier to the freshly provisioned row
    // via the bbf_admin_set_tier RPC. Re-uses the SECURITY DEFINER
    // validator (allowed-tier list + akeem safety net). Defaults to
    // 'gateway' when the upstream Pathfinder payload didn't carry a
    // tier slug — safer than NULL given the Phase 17 login bouncer
    // blocks NULL accounts. Failure here does not unwind the
    // provision (PIN + row are already created); we log + continue
    // so Zapier still receives credentials. Akeem's Switchboard can
    // hand-correct the tier from Mastermind if this ever drops.
    const tierToWrite = (typeof tier === 'string' && tier.trim()) ? tier.trim() : 'gateway';
    try {
      const { error: tierErr } = await supabase.rpc('bbf_admin_set_tier', {
        p_uid: data.username,
        p_tier: tierToWrite,
      });
      if (tierErr) {
        console.error('[BBF VAULT] /provision tier write failed (non-fatal):', tierErr.message || tierErr);
      } else {
        console.log(`[BBF VAULT] /provision tier set — ${data.username} → ${tierToWrite}`);
      }
    } catch (e) {
      console.error('[BBF VAULT] /provision tier write threw (non-fatal):', e && e.message);
    }

    return res.status(200).json({
      ok: true,
      username: data.username,
      pin: pin,
      email: customerEmail,
      tier: tierToWrite,
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

// ───────────────────────────────────────────────────────────────
// Phase 15 Slice 5 — Phantom Eye Live Coach proxy
//
// WebSocket bridge between bbf-app.html and the Gemini Multimodal
// Live API. Frontend connects to /ws/phantom-eye, sends a single
// 'context' message containing the user's payload (name, TDEE,
// macros, dietary profile, allergens, joint friction). The proxy
// constructs a dynamic systemInstruction casting the AI as the BBF
// Sovereign Coach, opens an outbound WebSocket to Gemini Live,
// forwards bidirectional audio + video traffic.
//
// GEMINI_API_KEY never leaves this server. Origin allowlist gates
// upgrades. If the key is missing, upgrades are rejected with 503.
// ───────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_LIVE_MODEL = 'models/gemini-2.5-flash-native-audio-latest';
// Phase 15 Slice 15 — Gemini Live endpoint reverted to v1alpha and
// the model swapped to the stable 2.5 native-audio string. CEO live-
// fire confirmed Google's routing layer for the 3.1-flash-live-preview
// model is broken on both v1alpha and v1beta; abandoning that string.
// The 2.5-flash-native-audio-latest model is the registered Tier 1
// stable target and is registered for bidiGenerateContent on v1alpha.
const GEMINI_LIVE_URL_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
const PHANTOM_EYE_PROXY_PATH = '/ws/phantom-eye';

// Phase 15 Slice 6 — Bifurcated prompts. The vision-mode prompt
// (Phantom Eye) instructs the model to read the live video feed for
// form audit / food analysis. The voice-mode prompt (Virtual Coach)
// strips every "look at the video" instruction so the model never
// hallucinates seeing things in an audio-only session — and so the
// AI never asks the user to "show" something that can't be sent.
// ─── Scope-locked system prompts · one per BBF feature ───────────────
// Tight per-feature scope cuts token cost (smaller system prompt) AND
// keeps the brand experience disciplined — Gemini refuses out-of-scope
// questions in a single redirect line instead of free-roaming chat.
//
// STRIKE PROTOCOL · every prompt below ends with the same instruction:
// when refusing an out-of-scope question, prepend the EXACT sentinel
// token `[BBF_OFF_TOPIC]` (on its own line) to the reply. The token
// is a machine signal — the frontend strips it before speaking and
// uses it to count strikes. Two strikes within a session and the
// frontend terminates the WebSocket — saves tokens, ends the abuse.
// The model is explicitly told NOT to announce the token verbally.

const STRIKE_INSTRUCTION =
  '\n\nSTRIKE SIGNAL · when (and ONLY when) you are refusing an ' +
  'out-of-scope question, prepend the exact token `[BBF_OFF_TOPIC]` ' +
  'on its own line at the very start of your reply, then a newline, ' +
  'then the spoken refusal text. The token is a machine signal — do ' +
  'NOT speak it aloud, do NOT explain it, do NOT mention it. Never ' +
  'emit the token for in-scope coaching replies — only for refusals.';

const PROMPT_PHANTOM_EYE =
  'You are BBF Phantom Eye — a live form-check coach for Build Believe ' +
  'Fit LLC. Scope: ONLY exercise biomechanics observed in the camera ' +
  'frame (joint angles, hip shift, knee valgus, spine neutrality, bar ' +
  'path, stance, rep tempo, breathing cadence, pain during a movement). ' +
  '\n\nOUT-OF-SCOPE HANDLING: if the user asks something outside live ' +
  'form analysis, tell them plainly what you ARE contexted for — ' +
  'something like: "I\'m only contexted to read your form in real ' +
  'time. I can call out joint angles, bar path, stance, tempo, ' +
  'breathing, and flag anything unsafe as it happens. For nutrition ' +
  'questions, switch to Chef on Call. For programming or rest-day ' +
  'questions, switch to Virtual Coach." Then stop and wait. ' +
  'Do NOT repeat the same wording twice in a row — if they go off-topic ' +
  'again, vary the phrasing and emphasize a different in-scope ' +
  'capability you can help with right now. Never engage the off-topic ' +
  'question itself, but make the redirect feel informative and human, ' +
  'not robotic. ' +
  '\n\nStyle: short, deadpan, clinical sentences. No preamble, no ' +
  'fluff. Address the user by first name when natural. If a movement ' +
  'looks unsafe, call it out and prescribe the correction. If the ' +
  'user has reported joint friction, be vigilant about loading those ' +
  'joints — flag any movement that risks aggravating them.' +
  STRIKE_INSTRUCTION;

const PROMPT_VIRTUAL_COACH =
  'You are BBF Virtual Coach — an audio-only training coach for Build ' +
  'Believe Fit LLC. You have NO video feed; never reference what you ' +
  '"see" or ask the user to show you anything. Scope: ONLY workout ' +
  'coaching (exercise selection, set and rep schemes, tempo cues, ' +
  'breathing, pain or joint friction reports, programming questions, ' +
  'rest intervals, mid-set motivation, technique cues delivered by ' +
  'voice). ' +
  '\n\nOUT-OF-SCOPE HANDLING: if the user asks something outside ' +
  'training, tell them plainly what you ARE contexted for — something ' +
  'like: "I\'m only contexted to coach your training. I can help with ' +
  'exercise selection, set and rep schemes, tempo, breathing, pain or ' +
  'joint reports, rest intervals, and cues between sets. For anything ' +
  'food- or macro-related, switch to Chef on Call." Then stop and ' +
  'wait. Do NOT repeat the same wording twice in a row — if they go ' +
  'off-topic again, vary the phrasing and emphasize a different ' +
  'in-scope capability you can help with right now. Never engage the ' +
  'off-topic question itself, but make the redirect feel informative ' +
  'and human, not robotic. ' +
  '\n\nStyle: short, deadpan, clinical sentences. No preamble, no ' +
  'fluff. Address by first name when natural. For form questions: ' +
  'ask audio-friendly clarifiers (which leg, which side, what feels ' +
  'off, how the bar tracks). For pain or joint friction: never load ' +
  'progression on a flagged joint without explicit user confirmation ' +
  'the pain has cleared.' +
  STRIKE_INSTRUCTION;

const PROMPT_NUTRITION_VISION =
  'You are BBF Food Frame — a live food and meal analyst for Build ' +
  'Believe Fit LLC. Scope: ONLY food visible in the camera frame ' +
  '(ingredient identification, portion estimation, macro breakdown, ' +
  'allergen checks, dietary-profile compliance, cooking-progress ' +
  'feedback). ' +
  '\n\nOUT-OF-SCOPE HANDLING: if the user asks something outside ' +
  'live food analysis, tell them plainly what you ARE contexted for — ' +
  'something like: "I\'m only contexted to read the food in your ' +
  'camera frame. I can identify ingredients, estimate portions, break ' +
  'down macros, flag allergens, and watch your cooking progress. For ' +
  'meal ideas or recipe questions without a camera, switch to Chef ' +
  'on Call. For training, switch to Virtual Coach or Phantom Eye." ' +
  'Then stop and wait. Do NOT repeat the same wording twice in a row ' +
  '— if they go off-topic again, vary the phrasing and emphasize a ' +
  'different in-scope capability you can help with right now. Never ' +
  'engage the off-topic question itself, but make the redirect feel ' +
  'informative and human, not robotic. ' +
  '\n\nStyle: short, deadpan, clinical sentences. No preamble, no ' +
  'fluff. Address by first name when natural. Respect the user\'s ' +
  'dietary profile and allergen restrictions absolutely. If a food ' +
  'violates them, refuse firmly and suggest a compliant swap from ' +
  'common pantry staples. Stay strict on the daily macro and calorie ' +
  'budget — call out portion sizes that blow it.' +
  STRIKE_INSTRUCTION;

const PROMPT_VIRTUAL_CHEF =
  'You are BBF Chef on Call — an audio-only nutrition coach for Build ' +
  'Believe Fit LLC. You have NO video feed; never reference what you ' +
  '"see" or ask the user to show you anything. Scope: ONLY nutrition ' +
  'coaching (meal ideas, recipe suggestions, macro guidance, grocery ' +
  'list questions, prep technique, ingredient swaps, allergy-safe ' +
  'substitutions, meal-timing questions). ' +
  '\n\nOUT-OF-SCOPE HANDLING: if the user asks something outside ' +
  'nutrition, tell them plainly what you ARE contexted for — ' +
  'something like: "I\'m only contexted to coach your nutrition. I ' +
  'can give you meal ideas, recipes, macro and calorie guidance, ' +
  'grocery lists, prep technique, ingredient swaps, and allergy-safe ' +
  'substitutions. For training, switch to Virtual Coach." Then stop ' +
  'and wait. Do NOT repeat the same wording twice in a row — if they ' +
  'go off-topic again, vary the phrasing and emphasize a different ' +
  'in-scope capability you can help with right now. Never engage the ' +
  'off-topic question itself, but make the redirect feel informative ' +
  'and human, not robotic. ' +
  '\n\nStyle: short, deadpan, clinical sentences. No preamble, no ' +
  'fluff. Address by first name when natural. Respect dietary profile ' +
  'and allergens absolutely; suggest compliant swaps when refusing a ' +
  'food. Stay strict on the user\'s daily macro and calorie targets.' +
  STRIKE_INSTRUCTION;

// Feature → (prompt, category) registry. Mirrors public.voices feature
// keys so the same key drives BBF_TTS voice selection AND the system
// prompt. Categories drive which CLIENT CONTEXT fields are emitted
// (fitness skips macros/allergens; nutrition skips friction).
const FEATURE_REGISTRY = {
  phantom_eye:      { prompt: PROMPT_PHANTOM_EYE,      category: 'fitness',   opener: 'Open with a brief greeting using the client\'s first name, then wait for them to move into frame before assessing.' },
  virtual_coach:    { prompt: PROMPT_VIRTUAL_COACH,    category: 'fitness',   opener: 'Open with a brief greeting using the client\'s first name, then ask what they\'re training today.' },
  nutrition_vision: { prompt: PROMPT_NUTRITION_VISION, category: 'nutrition', opener: 'Open with a brief greeting using the client\'s first name, then wait for food to enter frame.' },
  virtual_chef:     { prompt: PROMPT_VIRTUAL_CHEF,     category: 'nutrition', opener: 'Open with a brief greeting using the client\'s first name, then ask what nutrition question they have.' },
};

function buildSystemInstruction(payload, mode, feature) {
  const p = payload || {};
  // Feature-driven dispatch. Falls back to mode-based defaults for any
  // legacy client that didn't send a feature key.
  let entry = feature && FEATURE_REGISTRY[feature];
  if (!entry) {
    entry = (mode === 'voice')
      ? { prompt: PROMPT_VIRTUAL_COACH, category: 'fitness',   opener: 'Open with a brief greeting using the client\'s first name, then ask what they\'re training today.' }
      : { prompt: PROMPT_PHANTOM_EYE,   category: 'fitness',   opener: 'Open with a brief greeting using the client\'s first name, then wait for them to move into frame before assessing.' };
  }

  const lines = [entry.prompt, '', 'CLIENT CONTEXT:'];
  if (p.name)       lines.push('- First name: ' + String(p.name));
  if (p.age)        lines.push('- Age: ' + String(p.age));
  if (p.tier)       lines.push('- BBF Tier: ' + String(p.tier));
  if (p.goal)       lines.push('- Primary goal: ' + String(p.goal));

  if (entry.category === 'fitness') {
    if (p.experience) lines.push('- Training experience: ' + String(p.experience));
    if (Array.isArray(p.friction) && p.friction.length) {
      lines.push('- Reported joint friction: ' + p.friction.join(', ') + ' (be vigilant about loading these joints)');
    }
  } else { // nutrition
    if (p.tdee_target) lines.push('- Daily calorie target: ' + String(p.tdee_target) + ' kcal');
    const macroBits = [];
    if (p.macro_p) macroBits.push(p.macro_p + 'g protein');
    if (p.macro_c) macroBits.push(p.macro_c + 'g carbs');
    if (p.macro_f) macroBits.push(p.macro_f + 'g fat');
    if (macroBits.length)   lines.push('- Daily macro targets: ' + macroBits.join(', '));
    if (p.dietary_profile)  lines.push('- Dietary profile: ' + String(p.dietary_profile) + ' (must respect)');
    if (Array.isArray(p.allergens) && p.allergens.length) {
      lines.push('- Allergen restrictions: ' + p.allergens.join(', ') + ' (strictly avoid)');
    } else {
      lines.push('- Allergen restrictions: none reported');
    }
  }

  lines.push('');
  lines.push(entry.opener);
  return lines.join('\n');
}

function attachPhantomEyeProxy(server) {
  let WS;
  try {
    WS = require('ws');
  } catch (e) {
    console.error('[BBF VAULT] ws package missing — install with `npm install ws`. Phantom Eye proxy disabled.');
    return;
  }
  // Phase 15 Slice 10 — verbose boot diagnostics. Logs the exact env
  // signal the proxy will operate under so the CEO can read at a
  // glance whether Render dropped the key on this deploy or not.
  if (!GEMINI_API_KEY) {
    console.warn('[BBF VAULT] GEMINI_API_KEY missing (length=0) — Phantom Eye proxy will reject upgrades with 503.');
  } else {
    console.log('[BBF VAULT] GEMINI_API_KEY present (length=' + GEMINI_API_KEY.length + ', starts="' + GEMINI_API_KEY.slice(0, 4) + '…") — Phantom Eye proxy ready.');
  }
  console.log('[BBF VAULT] Phantom Eye ALLOWED_ORIGINS:', Array.from(ALLOWED_ORIGINS).join(', '));
  console.log('[BBF VAULT] Phantom Eye GEMINI_LIVE_MODEL=' + GEMINI_LIVE_MODEL);
  console.log('[BBF VAULT] Phantom Eye GEMINI_LIVE_URL_BASE=' + GEMINI_LIVE_URL_BASE);
  const wss = new WS.Server({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let pathname = '/';
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch (_) {}
    const origin = req.headers.origin;
    const ua = req.headers['user-agent'] || '(no-ua)';
    console.log('[Phantom Eye] upgrade attempt · path=' + pathname + ' origin=' + (origin || '(none)') + ' ua=' + ua.slice(0, 80));
    if (pathname !== PHANTOM_EYE_PROXY_PATH) {
      console.warn('[Phantom Eye] upgrade rejected — wrong path:', pathname);
      socket.destroy();
      return;
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      console.warn('[Phantom Eye] upgrade rejected — origin not allowlisted: "' + origin + '" (allowed: ' + Array.from(ALLOWED_ORIGINS).join(', ') + ')');
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    if (!origin) {
      console.warn('[Phantom Eye] upgrade has NO Origin header — allowing through (likely a tool/curl)');
    } else {
      console.log('[Phantom Eye] origin allowlist: PASS · ' + origin);
    }
    // Phase 16 Iron Vault V2 — WS ticket gate. The frontend hits
    // /api/auth/ws-ticket first; that route checks subscription_tier
    // + trial_expires_at against bbf_users and only mints a ticket
    // when the user is sovereign or trial-active. The ticket is HMAC-
    // signed with BBF_WS_TICKET_SECRET, expires in 60s, and is single-
    // use (verifyTicket marks the nonce consumed). No ticket → 401.
    if (!BBF_WS_TICKET_SECRET) {
      console.warn('[Phantom Eye] upgrade rejected — BBF_WS_TICKET_SECRET not set; cannot verify ticket');
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    let ticket = '';
    try {
      const u = new URL(req.url, 'http://localhost');
      ticket = u.searchParams.get('ticket') || '';
    } catch (_) {}
    const v = verifyTicket(ticket, BBF_WS_TICKET_SECRET);
    if (!v.ok) {
      console.warn('[Phantom Eye] upgrade rejected — ticket invalid (' + v.reason + ')');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    console.log('[Phantom Eye] ticket verified · uid=' + v.uid);
    if (!GEMINI_API_KEY) {
      console.warn('[Phantom Eye] upgrade rejected — GEMINI_API_KEY not set on this instance');
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    console.log('[Phantom Eye] upgrade gates: PASS · handshaking');
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      console.log('[Phantom Eye] handshake complete · emitting connection');
      wss.emit('connection', clientWs, req);
    });
  });

  wss.on('connection', (clientWs, req) => {
    const sessionId = Math.random().toString(36).slice(2, 10);
    const log = (...args) => console.log('[Phantom Eye ' + sessionId + ']', ...args);
    log('client connected from', req.headers.origin || '(no-origin)');

    let geminiWs = null;
    let setupSent = false;
    let firstFrameForwarded = false;

    function teardown(reason) {
      log('teardown:', reason);
      try { if (clientWs && clientWs.readyState === WS.OPEN) clientWs.close(1000, reason || 'session-end'); } catch (_) {}
      try { if (geminiWs && geminiWs.readyState === WS.OPEN) geminiWs.close(1000, reason || 'session-end'); } catch (_) {}
    }

    clientWs.on('message', (data) => {
      let parsed = null;
      try {
        const text = (typeof data === 'string') ? data : data.toString('utf8');
        parsed = JSON.parse(text);
      } catch (_) {
        if (geminiWs && geminiWs.readyState === WS.OPEN) {
          try { geminiWs.send(data); } catch (_) {}
        }
        return;
      }

      // First message from client must be the context bootstrap.
      if (parsed && parsed.type === 'context' && !geminiWs) {
        const mode = parsed.mode === 'voice' ? 'voice' : 'vision';
        const feature = typeof parsed.feature === 'string' ? parsed.feature : null;
        log('mode:', mode, '· feature:', feature || '(none·legacy)', '· payload keys:', Object.keys(parsed.payload || {}).join(','));
        const systemInstruction = buildSystemInstruction(parsed.payload || {}, mode, feature);
        const upstreamUrl = GEMINI_LIVE_URL_BASE + '?key=' + encodeURIComponent(GEMINI_API_KEY);
        log('opening Gemini Live upstream · model=' + GEMINI_LIVE_MODEL + ' · url=' + GEMINI_LIVE_URL_BASE + '?key=…' + GEMINI_API_KEY.slice(-4));
        geminiWs = new WS(upstreamUrl);

        geminiWs.on('open', () => {
          log('Gemini upstream OPEN · sending setup · prompt_chars=' + systemInstruction.length);
          // Dual-modality setup. Gemini still emits its native PCM audio
          // (so existing playback works as a fallback) AND we ask it for
          // a synchronized output_audio_transcription so the BBF TTS
          // layer can pipe text to ElevenLabs (Julius / Kelli LaShae)
          // for the actual voice the user hears.
          const setup = {
            setup: {
              model: GEMINI_LIVE_MODEL,
              generationConfig: { responseModalities: ['AUDIO'] },
              outputAudioTranscription: {},
              systemInstruction: { parts: [{ text: systemInstruction }] },
            },
          };
          try { geminiWs.send(JSON.stringify(setup)); log('setup sent · output_audio_transcription=on'); }
          catch (e) { log('setup send failed:', e.message); }
          setupSent = true;
          try { clientWs.send(JSON.stringify({ type: 'ready' })); log('client signalled ready'); }
          catch (e) { log('ready signal failed:', e.message); }
        });

        geminiWs.on('message', (msg) => {
          // Always forward the raw upstream frame so existing audio +
          // serverContent handling on the client keeps working unchanged.
          try { clientWs.send(msg); } catch (e) { log('downstream send failed:', e.message); }

          // ALSO sniff for outputAudioTranscription text deltas and forward
          // them as a tagged side-channel so the BBF TTS gateway can route
          // them through the public.voices table → ElevenLabs API → the
          // configured voice (Julius for fitness · Kelli LaShae for nutrition).
          try {
            const text = (typeof msg === 'string') ? msg : msg.toString('utf8');
            const parsed = JSON.parse(text);
            const sc = parsed && parsed.serverContent;
            if (sc) {
              if (sc.outputTranscription && typeof sc.outputTranscription.text === 'string' && sc.outputTranscription.text) {
                try { clientWs.send(JSON.stringify({ type: 'gemini-text', text: sc.outputTranscription.text })); } catch (_) {}
              }
              if (sc.turnComplete === true) {
                try { clientWs.send(JSON.stringify({ type: 'gemini-turn-complete' })); } catch (_) {}
              }
            }
          } catch (_) { /* binary frame or non-JSON — no transcript to extract */ }
        });

        geminiWs.on('close', (code, reason) => {
          const reasonStr = reason ? reason.toString() : '(empty)';
          log('Gemini upstream CLOSED · code=' + code + ' reason=' + reasonStr);
          try { clientWs.send(JSON.stringify({ type: 'upstream-closed', code: code, reason: reasonStr })); } catch (_) {}
          teardown('upstream-close');
        });

        geminiWs.on('error', (err) => {
          log('Gemini upstream ERROR · name=' + (err && err.name) + ' · message=' + (err && err.message));
          try { clientWs.send(JSON.stringify({ type: 'upstream-error', error: err && err.message })); } catch (_) {}
        });
        return;
      }

      // Streaming frames forwarded straight to Gemini once setup landed.
      if (geminiWs && geminiWs.readyState === WS.OPEN && setupSent) {
        if (!firstFrameForwarded) {
          firstFrameForwarded = true;
          log('first realtime_input frame forwarded');
        }
        try { geminiWs.send(JSON.stringify(parsed)); } catch (e) { log('forward failed:', e.message); }
      }
    });

    clientWs.on('close', (code, reason) => {
      log('client WS closed · code=' + code + ' reason=' + (reason ? reason.toString() : '(empty)'));
      teardown('client-close');
    });
    clientWs.on('error', (err) => { log('client error:', err && err.message); teardown('client-error'); });
  });

  console.log('[BBF VAULT] Phantom Eye proxy attached at ws ' + PHANTOM_EYE_PROXY_PATH);
}

const httpServer = http.createServer(app);
attachPhantomEyeProxy(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[BBF VAULT] Engine server listening on port ${PORT}`);
  console.log(`[BBF VAULT] Process endpoint: POST /process`);
  console.log(`[BBF VAULT] Phantom Eye proxy: ws ${PHANTOM_EYE_PROXY_PATH}`);
});

module.exports = app;
