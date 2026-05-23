// bbf-meal-macros — per-meal macro lookup with cache + Claude Haiku fallback.
// ─────────────────────────────────────────────────────────────────────────
// The static bbf_meals.json catalog misses coach-written meal names. This
// edge fn fills the gap: takes a meal name (+ optional ingredients string),
// looks it up in bbf_meal_macros (server-side cache), and if missing asks
// Claude Haiku 4.5 to estimate the macros. The result is upserted to the
// cache so every subsequent client/device gets it for free.
//
// Request shape:
//   POST /functions/v1/bbf-meal-macros
//   Content-Type: application/json
//   Authorization: Bearer <anon or user jwt>
//   Body:
//   {
//     "name":         "Akeem's Power Oats",   // required
//     "ingredients":  "rolled oats, ...",     // optional
//     "lang":         "en" | "es" | "pt"      // optional, default 'en'
//   }
//
// Response shape (200):
//   {
//     "ok":         true,
//     "kcal":       420,
//     "protein_g":  28,
//     "carbs_g":    52,
//     "fat_g":      12,
//     "confidence": 0.75,
//     "source":     "cache" | "claude_haiku",
//     "name_display": "Akeem's Power Oats"
//   }
//
// Errors return non-2xx { "ok": false, "error": "<slug>", "detail"?: "..." }.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { routeAndLog } from '../_shared/model-router.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── Normalization · MUST match the client side (BBF_MEAL_CATALOG._normalize
//     in bbf-app.html) so cache hits are consistent across boundaries.
function normalize(name: string): string {
  return String(name || '').toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const MODEL      = routeAndLog('bbf-meal-macros', 'meal_macros_lookup');
const MAX_TOKENS = 256;

const SYSTEM_PROMPT = [
  'You are a nutrition database. Given a meal name and optional ingredient string, return the macronutrient breakdown for ONE TYPICAL SERVING as a single JSON object.',
  '',
  'Return ONLY this JSON shape — no prose, no markdown fences, no commentary:',
  '{"kcal": <int>, "protein_g": <int>, "carbs_g": <int>, "fat_g": <int>, "confidence": <0.00-1.00 decimal>}',
  '',
  'Rules:',
  '- Estimate ONE typical home-cooked adult serving, not a restaurant portion.',
  '- For ambiguous names (no ingredients given), lower the confidence accordingly.',
  '- For mixed dishes ("chicken & rice bowl"), assume balanced composition.',
  '- All four macro fields must be non-negative integers. Confidence is a decimal 0.00 to 1.00.',
  '- If the meal is non-food or you cannot estimate, return kcal=0 with confidence=0.0.',
].join('\n');

interface MacroResult {
  kcal:       number;
  protein_g:  number;
  carbs_g:    number;
  fat_g:      number;
  confidence: number;
}

function safeMacroFromText(text: string): MacroResult | null {
  // Locate the first {...} JSON object in the model's reply. Resilient
  // to wrapping prose if the model ignores the "JSON only" instruction.
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (!obj || typeof obj !== 'object') return null;
    const kcal = Number(obj.kcal);
    const p    = Number(obj.protein_g ?? obj.p);
    const c    = Number(obj.carbs_g   ?? obj.c);
    const f    = Number(obj.fat_g     ?? obj.f);
    const conf = Number(obj.confidence ?? 0.70);
    if (![kcal, p, c, f].every((n) => Number.isFinite(n) && n >= 0)) return null;
    return {
      kcal:       Math.round(kcal),
      protein_g:  Math.round(p),
      carbs_g:    Math.round(c),
      fat_g:      Math.round(f),
      confidence: Math.max(0, Math.min(1, conf)),
    };
  } catch (_) { return null; }
}

async function askHaiku(apiKey: string, mealName: string, ingredients?: string): Promise<MacroResult | null> {
  const userMessage = ingredients
    ? `Meal: "${mealName}"\nIngredients: ${ingredients}`
    : `Meal: "${mealName}"`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[bbf-meal-macros] Anthropic status=${res.status} body=${body.slice(0, 400)}`);
    return null;
  }
  const body = await res.json().catch(() => null) as any;
  const text = Array.isArray(body?.content)
    ? body.content.find((b: any) => b && b.type === 'text')?.text || ''
    : '';
  return safeMacroFromText(text);
}

// ─── Handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return json({ ok: false, error: 'invalid_json' }, 400); }

  const rawName     = String(payload?.name || '').trim();
  const ingredients = payload?.ingredients ? String(payload.ingredients).trim() : '';
  const lang        = ['en', 'es', 'pt'].includes(payload?.lang) ? payload.lang : 'en';
  if (!rawName) return json({ ok: false, error: 'name_required' }, 400);

  const nameKey = normalize(rawName);
  if (!nameKey) return json({ ok: false, error: 'name_empty_after_normalize' }, 400);

  // Service-role client · bypasses RLS for both cache reads and writes.
  const supabaseUrl     = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'supabase_env_missing' }, 500);

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. CACHE LOOKUP · cheap, no LLM tokens spent.
  const { data: cached, error: lookupErr } = await sb
    .from('bbf_meal_macros')
    .select('kcal, protein_g, carbs_g, fat_g, confidence, source, name_display')
    .eq('name_normalized', nameKey)
    .maybeSingle();

  if (lookupErr) {
    console.error('[bbf-meal-macros] cache lookup error:', lookupErr);
  }

  if (cached && Number(cached.kcal) > 0) {
    return json({
      ok:           true,
      kcal:         cached.kcal,
      protein_g:    cached.protein_g,
      carbs_g:      cached.carbs_g,
      fat_g:        cached.fat_g,
      confidence:   Number(cached.confidence),
      source:       'cache',
      name_display: cached.name_display || rawName,
    });
  }

  // 2. LLM RESOLUTION · Claude Haiku · only on cache miss.
  if (!anthropicApiKey) return json({ ok: false, error: 'anthropic_key_missing' }, 500);

  const macros = await askHaiku(anthropicApiKey, rawName, ingredients);
  if (!macros) return json({ ok: false, error: 'llm_resolution_failed' }, 502);

  // 3. UPSERT · feed every subsequent client/device for free.
  const { error: upsertErr } = await sb
    .from('bbf_meal_macros')
    .upsert({
      name_normalized: nameKey,
      name_display:    rawName,
      lang:            lang,
      kcal:            macros.kcal,
      protein_g:       macros.protein_g,
      carbs_g:         macros.carbs_g,
      fat_g:           macros.fat_g,
      confidence:      macros.confidence,
      source:          'claude_haiku',
    }, { onConflict: 'name_normalized' });

  if (upsertErr) {
    // Caching failed but we still have a usable answer for THIS request;
    // log and return the values rather than penalizing the user.
    console.error('[bbf-meal-macros] upsert failed:', upsertErr);
  }

  return json({
    ok:           true,
    kcal:         macros.kcal,
    protein_g:    macros.protein_g,
    carbs_g:      macros.carbs_g,
    fat_g:        macros.fat_g,
    confidence:   macros.confidence,
    source:       'claude_haiku',
    name_display: rawName,
  });
});
