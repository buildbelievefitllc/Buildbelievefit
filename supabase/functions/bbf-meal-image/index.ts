// bbf-meal-image — per-meal photograph generation via Gemini Imagen 3.
// ─────────────────────────────────────────────────────────────────────
// Companion to bbf-meal-macros. Same name_normalized lookup key. Same
// 3-tier cache (localStorage → bbf_meal_macros.image_url → Gemini). Same
// service-role write pattern.
//
// Flow:
//   1. Cache hit → return image_url, done.
//   2. Cache miss → POST to Gemini Imagen 3, get base64 PNG.
//   3. Upload PNG to Storage bucket meal-images/{name_normalized}.png.
//   4. Update bbf_meal_macros.image_url (upsert the row if it doesn't
//      exist · macros come from a different fn but we don't want the
//      image step to fail because macros haven't been generated yet).
//   5. Return the public URL.
//
// Request shape:
//   POST /functions/v1/bbf-meal-image
//   Authorization: Bearer <anon or user jwt>
//   Body:
//   {
//     "name":        "Akeem's Power Oats",  // required
//     "ingredients": "rolled oats, ...",    // optional · sharpens prompt
//   }
//
// Response (200):
//   {
//     "ok":         true,
//     "image_url":  "https://<project>.supabase.co/storage/v1/object/public/meal-images/akeem_s_power_oats.png",
//     "source":     "cache" | "gemini_imagen_3",
//     "name_display": "Akeem's Power Oats"
//   }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// Matches the client + bbf-meal-macros normalization · same key everywhere.
function normalize(name: string): string {
  return String(name || '').toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Filesystem-safe filename keyed by the normalized name. PNG extension
// fixed because Imagen 3 returns PNG.
function filenameFor(nameKey: string): string {
  return nameKey.replace(/\s+/g, '_').slice(0, 120) + '.png';
}

const IMAGEN_MODEL    = 'imagen-3.0-generate-002';
const IMAGEN_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`;

function buildPrompt(name: string, ingredients?: string): string {
  // Consistent visual language across every meal · square top-down
  // restaurant-style food photograph, plain background, no people, no
  // text, soft natural lighting. Ingredients (when present) sharpen the
  // composition without changing the framing.
  const ingHint = ingredients
    ? ` Ingredients visible: ${ingredients}.`
    : '';
  return (
    `A photorealistic top-down food photograph of "${name}". ` +
    `Plated on a plain white ceramic plate, neutral light wooden table, ` +
    `soft natural lighting, gentle shadows, restaurant-style presentation. ` +
    `Square frame, centered composition, no people, no text, no logos, no utensils.` +
    ingHint
  );
}

interface ImagenResult {
  base64:    string;
  mimeType:  string;
}

async function callImagen(apiKey: string, prompt: string): Promise<ImagenResult | null> {
  // Imagen 3 predict endpoint · returns base64-encoded image bytes.
  const url = `${IMAGEN_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount:    1,
      aspectRatio:    '1:1',
      personGeneration: 'dont_allow',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`[bbf-meal-image] Imagen status=${res.status} body=${errBody.slice(0, 400)}`);
    return null;
  }
  const payload = await res.json().catch(() => null) as any;
  const pred = payload?.predictions?.[0];
  // Imagen 3 returns { bytesBase64Encoded, mimeType: "image/png" } per prediction.
  const b64 = pred?.bytesBase64Encoded || pred?.bytes_base64_encoded;
  if (!b64) {
    console.error('[bbf-meal-image] Imagen returned no bytes:', JSON.stringify(payload).slice(0, 400));
    return null;
  }
  return { base64: b64, mimeType: pred?.mimeType || 'image/png' };
}

function base64ToBytes(b64: string): Uint8Array {
  // Deno standard atob path · returns binary string we re-encode to Uint8Array.
  const bin = atob(b64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
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
  if (!rawName) return json({ ok: false, error: 'name_required' }, 400);

  const nameKey = normalize(rawName);
  if (!nameKey) return json({ ok: false, error: 'name_empty_after_normalize' }, 400);

  const supabaseUrl    = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiApiKey   = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'supabase_env_missing' }, 500);

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. CACHE LOOKUP · zero generation cost on a hit.
  const { data: cached } = await sb
    .from('bbf_meal_macros')
    .select('image_url, name_display')
    .eq('name_normalized', nameKey)
    .maybeSingle();

  if (cached?.image_url) {
    return json({
      ok:           true,
      image_url:    cached.image_url,
      source:       'cache',
      name_display: cached.name_display || rawName,
    });
  }

  // 2. GENERATE · Imagen 3 via Gemini API.
  if (!geminiApiKey) return json({ ok: false, error: 'gemini_key_missing' }, 500);

  const prompt = buildPrompt(rawName, ingredients);
  const img    = await callImagen(geminiApiKey, prompt);
  if (!img) return json({ ok: false, error: 'imagen_generation_failed' }, 502);

  // 3. UPLOAD · public storage so <img> tags work with no auth header.
  const file = filenameFor(nameKey);
  const bytes = base64ToBytes(img.base64);
  const { error: uploadErr } = await sb.storage
    .from('meal-images')
    .upload(file, bytes, {
      contentType: img.mimeType,
      upsert:      true,
    });
  if (uploadErr) {
    console.error('[bbf-meal-image] storage upload failed:', uploadErr);
    return json({ ok: false, error: 'storage_upload_failed', detail: uploadErr.message }, 500);
  }

  const { data: pub } = sb.storage.from('meal-images').getPublicUrl(file);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) return json({ ok: false, error: 'no_public_url' }, 500);

  // 4. PERSIST · upsert into bbf_meal_macros so the URL survives. The
  //    macros side may insert the row first or this side may insert it
  //    first; the macros side fills macro columns, this side fills the
  //    image columns, both upsert by name_normalized.
  //    On upsert from this side we provide safe default macros (zeros)
  //    only if the row didn't exist yet; the macros fn will overwrite
  //    them next time it runs for this meal name.
  const { error: upsertErr } = await sb
    .from('bbf_meal_macros')
    .upsert({
      name_normalized:    nameKey,
      name_display:       rawName,
      kcal:               cached ? undefined : 0,
      protein_g:          cached ? undefined : 0,
      carbs_g:            cached ? undefined : 0,
      fat_g:              cached ? undefined : 0,
      confidence:         cached ? undefined : 0.0,
      source:             cached ? undefined : 'image_only',
      image_url:          publicUrl,
      image_generated_at: new Date().toISOString(),
      image_prompt_used:  prompt,
    }, { onConflict: 'name_normalized', ignoreDuplicates: false });

  if (upsertErr) {
    console.error('[bbf-meal-image] upsert failed:', upsertErr);
    // The image IS uploaded and publicly accessible · don't penalize the
    // caller for the cache write failure.
  }

  return json({
    ok:           true,
    image_url:    publicUrl,
    source:       'gemini_imagen_3',
    name_display: rawName,
  });
});
