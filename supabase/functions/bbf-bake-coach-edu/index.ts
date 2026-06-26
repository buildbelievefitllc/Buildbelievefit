// supabase/functions/bbf-bake-coach-edu/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// FRONT 4 — ONE-SHOT "Breaking the Loop" coach-education audio BAKER.
// ───────────────────────────────────────────────────────────────────────────
// Synthesizes the 9 FIXED educational clips (primer/flush/fuel × en/es/pt) in
// Coach Akeem's cloned voice via ElevenLabs eleven_multilingual_v2, and returns
// the MP3 as base64. NO Claude — the scripts are fixed + CEO-approved, so there is
// no per-request generation cost beyond this one-time bake. Driven once via pg_net;
// dormant (or deleted) thereafter → ZERO recurring API cost (assets go repo-static).
//
// Vocal direction: smooth, rhythmic, soulful, grounded, authoritative. BBF_VOICE_SETTINGS
// (stability 0.35 removes the robotic governor) + eleven_multilingual_v2 keep the
// authentic pocket in EN/ES/PT — the ES/PT scripts are NATIVE, colloquial renditions
// (not literal translations) so the model never stiffens the delivery.
//
// Gated by a shared secret (bbf_app_config.coach_edu_bake_secret). verify_jwt:false.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-bake-secret',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Coach Akeem's Professional Voice Clone + the BBF Lab voice physics (CLAUDE.md §4).
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const BBF_VOICE_SETTINGS = { stability: 0.35, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true };
const VOICE_MODEL = 'eleven_multilingual_v2';

// ── The 9 CEO-approved scripts. EN verbatim; ES/PT = native, colloquial essence ──
const SCRIPTS: Record<string, Record<string, string>> = {
  primer: {
    en: "We don't go in cold. You aren't just warming up muscles right now; you are waking up your central nervous system. When you step up to pull that trap-bar or load the pulldown, your brain needs to communicate with those muscle fibers instantly. We lubricate the joints to prevent injury, and we signal the body that it's time to work. Prime the engine now, so you don't stall on the floor. Let's get it.",
    es: "No entramos en frío. Ahora mismo no estás solo calentando los músculos; estás despertando tu sistema nervioso central. Cuando te acercas a jalar esa trap-bar o a cargar el pulldown, tu cerebro necesita comunicarse con esas fibras al instante. Lubricamos las articulaciones para prevenir lesiones, y le avisamos al cuerpo que es hora de trabajar. Prepara el motor ahora, para que no te quedes varado en el piso. Vamos con todo.",
    pt: "A gente não entra frio. Agora você não está só aquecendo o músculo; você está acordando o seu sistema nervoso central. Quando você chega pra puxar aquela trap-bar ou carregar o pulldown, seu cérebro precisa falar com aquelas fibras na hora. A gente lubrifica as articulações pra prevenir lesão, e avisa o corpo que é hora de trabalhar. Prepara o motor agora, pra você não travar na hora H. Bora.",
  },
  flush: {
    en: "The iron just broke your tissue down. Now, we accelerate the rebuild. This cardio isn't a punishment; it is the flush. We are pushing oxygenated blood into the damaged muscle fibers, clearing out the lactic acid, and forcing your nervous system to down-regulate. This is exactly how you recover faster and come back stronger. Choose your engine, dial in the time, and let's flush the system.",
    es: "El hierro acaba de romper tu tejido. Ahora aceleramos la reconstrucción. Este cardio no es un castigo; es el drenaje. Estamos empujando sangre oxigenada hacia las fibras dañadas, sacando el ácido láctico, y obligando a tu sistema nervioso a bajar las revoluciones. Así es exactamente como te recuperas más rápido y vuelves más fuerte. Elige tu máquina, ajusta el tiempo, y vamos a drenar el sistema.",
    pt: "O ferro acabou de quebrar o seu tecido. Agora a gente acelera a reconstrução. Esse cardio não é castigo; é o dreno. A gente está empurrando sangue oxigenado pra dentro das fibras danificadas, limpando o ácido lático, e forçando o seu sistema nervoso a desacelerar. É exatamente assim que você se recupera mais rápido e volta mais forte. Escolhe sua máquina, ajusta o tempo, e bora drenar o sistema.",
  },
  fuel: {
    en: "You cannot out-train a broken fuel protocol. Your Total Daily Energy Expenditure dictates your ceiling; your macros dictate your body composition. The protein you eat is the literal building block for the tissue you just tore down on the floor. Whether you are fasting or eating around the clock, if you miss these targets, the physical work means nothing. Respect the data. Hit your macros, stay within the boundaries, and give your body the exact material it needs to break the loop.",
    es: "No puedes compensar con entrenamiento un protocolo de comida roto. Tu Gasto Energético Diario Total marca tu techo; tus macros marcan tu composición corporal. La proteína que comes es el bloque de construcción literal del tejido que acabas de romper en el piso. Ya sea que estés en ayuno o comiendo a toda hora, si fallas estos números, el trabajo físico no significa nada. Respeta los datos. Cumple tus macros, mantente dentro de los límites, y dale a tu cuerpo el material exacto que necesita para romper el ciclo.",
    pt: "Você não consegue compensar no treino uma alimentação quebrada. Seu Gasto Energético Diário Total define o seu teto; seus macros definem a sua composição corporal. A proteína que você come é o bloco de construção literal do tecido que você acabou de romper no treino. Seja em jejum ou comendo o dia inteiro, se você erra esses números, o trabalho físico não significa nada. Respeita os dados. Bate seus macros, fica dentro dos limites, e dá pro seu corpo o material exato que ele precisa pra quebrar o ciclo.",
  },
};

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function readSecret(url: string, key: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_app_config?key=eq.coach_edu_bake_secret&select=value&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? String(rows[0].value || '') : null;
  } catch { return null; }
}
function bytesToB64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  return btoa(bin);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  // Shared-secret gate (prevents random callers from burning ElevenLabs spend).
  const cfgSecret = await readSecret(SUPABASE_URL, SERVICE_KEY);
  if (!cfgSecret) return jsonResponse({ error: 'config_missing_secret' }, 503);
  if (req.headers.get('x-bbf-bake-secret') !== cfgSecret) return jsonResponse({ error: 'unauthorized' }, 401);

  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured' }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  const module = String(payload?.module || '').trim();
  const locale = String(payload?.locale || '').trim();
  // mp3_44100_128 (full quality, matches the Sovereign Briefing) unless overridden.
  const outputFormat = String(payload?.output_format || 'mp3_44100_128');
  const text = SCRIPTS[module]?.[locale];
  if (!text) return jsonResponse({ error: 'unknown_module_or_locale', detail: `module=${module} locale=${locale}` }, 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(AKEEM_VOICE_ID)}?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: VOICE_MODEL, voice_settings: BBF_VOICE_SETTINGS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      return jsonResponse({ error: 'tts_failed', status: res.status, detail }, 502);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const audio_b64 = bytesToB64(buf);
    console.log(`[bbf-bake-coach-edu] baked module=${module} locale=${locale} fmt=${outputFormat} bytes=${buf.length}`);
    return jsonResponse({ ok: true, module, locale, output_format: outputFormat, bytes: buf.length, audio_b64 });
  } catch (e) {
    const err = e as Error;
    return jsonResponse({ error: err.name === 'AbortError' ? 'timeout_45000ms' : err.message }, 502);
  } finally { clearTimeout(timeout); }
});
