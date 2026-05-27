// bbf-meal-image — per-meal photograph generation via Gemini Imagen 4.
// MODEL BUMP 2026-05-27 · imagen-3.0-generate-002 → imagen-4.0-generate-001 ·
// Imagen 3 was fully sunset on v1beta predict (404 NOT_FOUND). Imagen 4 GA
// is the closest replacement · Imagen 4 Fast and Ultra also available.
//
// GET ?list-models=1            — dumps Google models registered for this key
// GET ?list-models=1&filter=predict  — filter to image-generation predict models
// GET ?list-models=1&filter=bidi     — filter to Gemini Live bidiGenerateContent models
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function normalize(name: string): string {
  return String(name || '').toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function filenameFor(nameKey: string): string {
  return nameKey.replace(/\s+/g, '_').slice(0, 120) + '.png';
}

const IMAGEN_MODEL    = 'imagen-4.0-generate-001';
const IMAGEN_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`;

function buildPrompt(name: string, ingredients?: string): string {
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

async function callImagen(apiKey: string, prompt: string): Promise<ImagenResult | { error: { status: number; body: string } }> {
  const url = `${IMAGEN_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  const body = {
    instances: [{ prompt }],
    parameters: { sampleCount: 1, aspectRatio: '1:1', personGeneration: 'dont_allow' },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`[bbf-meal-image] Imagen status=${res.status} body=${errBody.slice(0, 400)}`);
    return { error: { status: res.status, body: errBody.slice(0, 600) } };
  }
  const payload = await res.json().catch(() => null) as any;
  const pred = payload?.predictions?.[0];
  const b64 = pred?.bytesBase64Encoded || pred?.bytes_base64_encoded;
  if (!b64) {
    const dump = JSON.stringify(payload).slice(0, 400);
    console.error('[bbf-meal-image] Imagen returned no bytes:', dump);
    return { error: { status: 200, body: 'no_bytes:' + dump } };
  }
  return { base64: b64, mimeType: pred?.mimeType || 'image/png' };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('list-models') === '1') {
      const key = Deno.env.get('GEMINI_API_KEY');
      if (!key) return json({ ok: false, error: 'gemini_key_missing' }, 500);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`);
      const text = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch (_) {}
      const all = Array.isArray(parsed?.models) ? parsed.models : [];
      const filter = url.searchParams.get('filter') || '';
      const filtered = all.filter((m: any) => {
        const n = String(m?.name || '').toLowerCase();
        const methods: string[] = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
        if (filter === 'predict') return n.includes('imagen') || methods.includes('predict');
        if (filter === 'bidi')    return methods.includes('bidiGenerateContent');
        if (filter === 'native-audio') return n.includes('native-audio');
        return true;
      }).map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        version: m.version,
        supportedGenerationMethods: m.supportedGenerationMethods,
      }));
      return json({
        ok: true,
        google_status: r.status,
        total_models: all.length,
        filter_applied: filter || '(none)',
        models: filtered,
      });
    }
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

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

  const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: cached } = await sb
    .from('bbf_meal_macros').select('image_url, name_display')
    .eq('name_normalized', nameKey).maybeSingle();

  if (cached?.image_url) {
    return json({ ok: true, image_url: cached.image_url, source: 'cache', name_display: cached.name_display || rawName });
  }

  if (!geminiApiKey) return json({ ok: false, error: 'gemini_key_missing' }, 500);

  const prompt = buildPrompt(rawName, ingredients);
  const img    = await callImagen(geminiApiKey, prompt);
  if ('error' in img) {
    return json({ ok: false, error: 'imagen_generation_failed', upstream_status: img.error.status, upstream_body: img.error.body }, 502);
  }

  const file = filenameFor(nameKey);
  const bytes = base64ToBytes(img.base64);
  const { error: uploadErr } = await sb.storage.from('meal-images').upload(file, bytes, { contentType: img.mimeType, upsert: true });
  if (uploadErr) {
    console.error('[bbf-meal-image] storage upload failed:', uploadErr);
    return json({ ok: false, error: 'storage_upload_failed', detail: uploadErr.message }, 500);
  }
  const { data: pub } = sb.storage.from('meal-images').getPublicUrl(file);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) return json({ ok: false, error: 'no_public_url' }, 500);

  const { error: upsertErr } = await sb.from('bbf_meal_macros').upsert({
    name_normalized: nameKey, name_display: rawName,
    kcal: cached ? undefined : 0, protein_g: cached ? undefined : 0, carbs_g: cached ? undefined : 0, fat_g: cached ? undefined : 0,
    confidence: cached ? undefined : 0.0, source: cached ? undefined : 'image_only',
    image_url: publicUrl, image_generated_at: new Date().toISOString(), image_prompt_used: prompt,
  }, { onConflict: 'name_normalized', ignoreDuplicates: false });
  if (upsertErr) console.error('[bbf-meal-image] upsert failed:', upsertErr);

  return json({ ok: true, image_url: publicUrl, source: 'gemini_imagen_4', name_display: rawName });
});
