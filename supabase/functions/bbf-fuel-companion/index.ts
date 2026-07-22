// supabase/functions/bbf-fuel-companion/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// FUEL COMPANION — meal-photo macro vision, wired to the fasting window and
// the athlete's somatic readiness. The client-side mirror of the Kinematic
// Form HUD, pointed at the plate.
//
//   POST { uid, session_token, image_base64, mime_type?, fasting?:{pace, eat,
//          in_window, window_label}, readiness_score?, note?, locale? }
//
//   1. Session-token auth (the vault session model — user resolved from the
//      token, never trusted from the caller).
//   2. Sonnet vision (meal_vision_macro · §4) estimates the meal + macros,
//      COACHED IN CONTEXT: the athlete's eating-window state and today's
//      readiness score shape the coaching_note ("window closes in 2h — this
//      protein-forward plate is exactly right on a 58-readiness day").
//   3. DETERMINISTIC validation disposes: macros clamped to sane meal ranges;
//      kcal recomputed from 4P+4C+9F when the model's kcal drifts >25% (the
//      native math is authoritative — CALCULATOR-OFF-LLM).
//   4. Numeric/text row persists to bbf_meal_snaps (photo is EPHEMERAL — same
//      privacy contract as the Form Ledger; no media ever stored). The client
//      then confirms into the normal meal log if desired.
//
// FAILURE POSTURE: errors return a safe { ok:false, reason } — the Nutrition
// tab stays functional; the snap is an upgrade, never a dependency.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { routeAndLog } from '../_shared/model-router.ts';
import { checkSpendGate, spendLimitResponse } from '../_shared/spend-gate.ts';
import { logLlmCall } from '../_shared/llm-telemetry.ts';
import { localeDirective, localeCode } from '../_shared/locale.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    meal_name: { type: 'string', description: 'Short name for the plate, e.g. "Grilled chicken, rice & broccoli"' },
    kcal: { type: 'integer', description: 'Estimated total calories' },
    protein_g: { type: 'integer' },
    carbs_g: { type: 'integer' },
    fat_g: { type: 'integer' },
    confidence: { type: 'number', description: '0-1 — how confident the estimate is given image quality and portion ambiguity' },
    coaching_note: { type: 'string', description: 'One or two sentences coaching this plate against the athlete\'s fasting window + readiness context. Direct, encouraging.' },
  },
  required: ['meal_name', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence', 'coaching_note'],
} as const;

const SYSTEM_PROMPT = [
  'You are the nutrition coach inside Build Believe Fit analyzing a single photo of a meal an athlete is about to eat.',
  'Estimate the plate: name it, estimate total kcal and macro grams (protein/carbs/fat) for the visible portion, and rate your confidence 0-1 (lower for ambiguous portions, mixed dishes, poor lighting).',
  'You also receive the athlete\'s CONTEXT: their intermittent-fasting window state (in/out of the eating window, pace) and today\'s readiness score (0-100).',
  'coaching_note rules:',
  '- Coach THIS plate against THAT context. In-window + low readiness → favor protein and recovery framing. Out of window → acknowledge it plainly (no shaming) and note when the window opens.',
  '- Never invent foods not visible. If the image is unclear or shows no food: confidence 0, macros 0, coaching_note explains how to re-shoot.',
  '- Direct, warm, 1-2 sentences. No AI mentions, no lectures.',
].join('\n');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_API_KEY) return jsonResponse({ ok: false, error: 'backend_unconfigured' }, 503);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const uid = String(payload?.uid ?? '');
  const sessionToken = String(payload?.session_token ?? '');
  if (!sessionToken) return jsonResponse({ ok: false, error: 'invalid_session' }, 401);

  // Vault session auth — user resolved FROM the token, never the caller.
  const { data: srow } = await supabase
    .from('bbf_vault_sessions').select('user_id')
    .eq('token', sessionToken).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
  if (!srow?.user_id) return jsonResponse({ ok: false, error: 'invalid_session' }, 401);
  const userId = srow.user_id as string;

  const rawB64 = String(payload?.image_base64 ?? '');
  if (!rawB64) return jsonResponse({ ok: false, error: 'missing_image' }, 400);
  const m = /^data:[^;]+;base64,(.+)$/.exec(rawB64);
  const imageB64 = m ? m[1] : rawB64;
  if (imageB64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3)) {
    return jsonResponse({ ok: false, error: 'image_too_large' }, 400);
  }
  const mime = /^image\/(jpeg|jpg|png|webp)$/i.test(String(payload?.mime_type ?? ''))
    ? String(payload.mime_type).toLowerCase().replace('image/jpg', 'image/jpeg') : 'image/jpeg';

  const gate = await checkSpendGate(SUPABASE_URL, SERVICE_KEY);
  if (gate.stopped) return spendLimitResponse(gate);

  const locale = localeCode(payload?.locale ?? payload?.lang);
  const fasting = payload?.fasting ?? null;
  const readinessScore = Number.isFinite(Number(payload?.readiness_score)) ? Math.round(Number(payload.readiness_score)) : null;
  const contextLines = [
    fasting ? `Fasting context: pace=${fasting.pace ?? '—'} · ${fasting.in_window === false ? 'OUTSIDE the eating window' : fasting.in_window === true ? 'inside the eating window' : 'window state unknown'}${fasting.window_label ? ` · ${fasting.window_label}` : ''}` : 'Fasting context: not using time-restricted feeding.',
    readinessScore != null ? `Today's readiness score: ${readinessScore}/100.` : 'Readiness: not logged today.',
    payload?.note ? `Athlete note: ${String(payload.note).slice(0, 200)}` : '',
  ].filter(Boolean).join('\n');

  const model = routeAndLog('bbf-fuel-companion', 'meal_vision_macro', { vision: true });
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: MEAL_SCHEMA } },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: localeDirective(locale, 'the coaching_note and meal_name') },
      ],
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: imageB64 } },
          { type: 'text', text: `${contextLines}\n\nEstimate this meal and coach it. Return the JSON now.` },
        ],
      }],
    }),
  });
  const latencyMs = Date.now() - t0;
  let body: any = null;
  try { body = await res.json(); } catch { /* handled below */ }

  let parsed: any = null;
  if (res.ok) {
    for (const block of (body?.content ?? [])) {
      if (block?.type === 'text' && typeof block.text === 'string') {
        try { parsed = JSON.parse(block.text); } catch { parsed = null; }
        break;
      }
    }
  }
  const ok = !!(parsed && Number.isFinite(Number(parsed.kcal)));

  await logLlmCall(supabase, {
    agent: 'bbf-fuel-companion', model, ok,
    latencyMs, inputTokens: body?.usage?.input_tokens ?? null, outputTokens: body?.usage?.output_tokens ?? null,
    finishReason: res.ok ? (body?.stop_reason ?? null) : null,
    error: ok ? null : (res.ok ? 'parse_failed' : `anthropic_${res.status}`), promptName: 'meal_vision_macro',
  });
  if (!ok) return jsonResponse({ ok: false, error: 'vision_failed' }, 502);

  // ── Deterministic disposal — clamp macros, recompute drifting kcal ─────────
  const clampInt = (v: unknown, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
  const protein = clampInt(parsed.protein_g, 0, 300);
  const carbs = clampInt(parsed.carbs_g, 0, 500);
  const fat = clampInt(parsed.fat_g, 0, 250);
  let kcal = clampInt(parsed.kcal, 0, 4000);
  const kcalFromMacros = protein * 4 + carbs * 4 + fat * 9;
  if (kcalFromMacros > 0 && Math.abs(kcal - kcalFromMacros) / kcalFromMacros > 0.25) {
    kcal = Math.min(4000, kcalFromMacros); // native math is authoritative
  }
  const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
  const mealName = String(parsed.meal_name ?? 'Meal').slice(0, 160);
  const note = String(parsed.coaching_note ?? '').slice(0, 500);

  // Numeric/text row only — the photo never persists (privacy parity with the
  // Form Ledger). Best-effort: a ledger miss never blocks the estimate.
  try {
    await supabase.from('bbf_meal_snaps').insert({
      user_id: userId,
      uid_slug: uid.toLowerCase().slice(0, 80) || 'unknown',
      meal_name: mealName, kcal, protein_g: protein, carbs_g: carbs, fat_g: fat,
      confidence, coaching_note: note,
      in_eating_window: fasting?.in_window ?? null,
      readiness_score: readinessScore,
      locale, model,
    });
  } catch (e) {
    console.warn(`[bbf-fuel-companion] snap log failed (non-fatal): ${(e as Error).message}`);
  }

  return jsonResponse({
    ok: true, meal_name: mealName,
    macros: { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat },
    confidence, coaching_note: note, locale, model,
  });
});
