// bbf-agentic-rpe-voice-explanation — RPE education audio (ElevenLabs TTS + daily caching)
// ─────────────────────────────────────────────────────────────────────────────────────────
// Generates trilingual RPE (Rate of Perceived Exertion) education audio via ElevenLabs.
// Caches one audio per language per day in bbf_rpe_audio + Supabase Storage (`bbf-education`).
// Voiced by the BBF Coach Akeem Professional Voice Clone (trilingual) on the natural
// multilingual_v2 model + the R2 "let the clone breathe" settings.
//
// Request:
//   POST /functions/v1/bbf-agentic-rpe-voice-explanation
//   { "language": "en|es|pt" }
//
// Response (200 OK · success):
//   { ok: true, audio_url: "https://...", duration_seconds: 180, language: "en", timestamp: "2026-06-20T00:00:00Z" }
//
// Response (200 OK · failure):
//   { ok: false, error: "<slug>", detail?: "..." }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// RPE explanation text, translated for each language
const RPE_TEXT = {
  en: `RPE stands for Rate of Perceived Exertion. It's how hard a set felt to YOU, not how much weight is on the bar.

Why does this matter? Because the same weight can feel different on different days. You might crush five reps on Monday, but on Wednesday that same weight might feel heavier because you didn't sleep, or you're sore, or you're stressed. The bar doesn't know that. I do.

RPE tells me the real story. It tells me if you're recovering, if you're ready to go hard, or if you need a deload. It's the missing piece between the numbers on the bar and how your body actually feels.

Here's the scale:

One to three: Easy. You could do ten, fifteen more reps. This is a warm-up feeling.

Four to six: Moderate. You could do five to seven more reps in the tank. This is work, but it's not pushing it.

Seven to eight: Hard. One or two reps left. You're grinding, but you know you could squeeze out one or two more.

Nine to ten: Max effort. Nothing left. Zero reps left in the tank. You're done.

Every single set, I want you to log the weight, the reps, and the RPE. That's three pieces of data. Three. That's how I coach you right. Because I'm not guessing. I'm reading your effort.

So from today on, when you log a set, ask yourself: How hard did that actually feel? Not how much weight. How hard. Got it?`,

  es: `RPE significa Tasa de Esfuerzo Percibido. Es lo difícil que se sintió la serie para TI, no cuánto peso hay en la barra.

¿Por qué importa? Porque el mismo peso puede sentirse diferente en diferentes días. Podrías lograr cinco repeticiones el lunes, pero el miércoles ese mismo peso podría sentirse más pesado porque no dormiste bien, estás adolorido o estresado. La barra no lo sabe. Yo sí.

El RPE me cuenta la verdadera historia. Me dice si te estás recuperando, si estás listo para dar todo, o si necesitas una descarga. Es la pieza que falta entre los números en la barra y cómo se siente realmente tu cuerpo.

Aquí está la escala:

Uno a tres: Fácil. Podrías hacer diez, quince repeticiones más. Esto es como un calentamiento.

Cuatro a seis: Moderado. Podrías hacer cinco a siete repeticiones más en el tanque. Esto es trabajo, pero no es empujar.

Siete a ocho: Difícil. Una o dos repeticiones restantes. Estás esforzándote, pero sabes que podrías sacar una o dos más.

Nueve a diez: Máximo esfuerzo. Nada restante. Cero repeticiones en el tanque. Terminaste.

En cada serie, quiero que registres el peso, las repeticiones y el RPE. Son tres datos. Tres. Así es como te entreno bien. Porque no estoy adivinando. Estoy leyendo tu esfuerzo.

Así que de hoy en adelante, cuando registres una serie, pregúntate: ¿Qué tan difícil se sintió realmente? No cuánto peso. Qué tan difícil. ¿Entendido?`,

  pt: `RPE significa Taxa de Esforço Percebido. É o quão difícil a série foi para VOCÊ, não quanto peso está na barra.

Por que isso importa? Porque o mesmo peso pode se sentir diferente em diferentes dias. Você pode fazer cinco repetições com perfeição na segunda, mas na quarta o mesmo peso pode parecer mais pesado porque você não dormiu bem, está dolorido ou estressado. A barra não sabe disso. Eu sei.

O RPE me conta a verdadeira história. Me diz se você está se recuperando, se está pronto para ir com tudo, ou se precisa de uma redução. É a peça que falta entre os números na barra e como seu corpo realmente se sente.

Aqui está a escala:

Um a três: Fácil. Você conseguiria fazer dez, quinze repetições a mais. Isso é um aquecimento.

Quatro a seis: Moderado. Você conseguiria fazer cinco a sete repetições a mais no tanque. Isso é trabalho, mas não é empurrando o limite.

Sete a oito: Difícil. Uma ou duas repetições restantes. Você está se esforçando, mas sabe que conseguiria mais uma ou duas.

Nove a dez: Esforço máximo. Nada restante. Zero repetições no tanque. Você terminou.

A cada série, quero que você registre o peso, as repetições e o RPE. São três dados. Três. É assim que a treino corretamente. Porque não estou adivinhando. Estou lendo seu esforço.

Então, a partir de hoje, quando registrar uma série, pergunte-se: Quão difícil isso realmente se sentiu? Não quanto peso. Quão difícil. Entendido?`,
};

// Architect vocal-state guard: exclamation marks spike volume on the clone — strip them.
function architectFormat(s: string): string { return String(s ?? '').replace(/!+/g, '.').replace(/  +/g, ' ').trim(); }

// BBF Coach Akeem (Professional Voice Clone) — the trilingual clone speaks every locale.
const VOICE_ID_EN = 'ZbKDEqxkr8Ub4psNm5XD';
const VOICE_ID_ES = 'ZbKDEqxkr8Ub4psNm5XD';
const VOICE_ID_PT = 'ZbKDEqxkr8Ub4psNm5XD';

const VOICE_IDS: Record<string, string> = {
  en: VOICE_ID_EN,
  es: VOICE_ID_ES,
  pt: VOICE_ID_PT,
};

// Long-form education monologue (cached daily, not latency-critical) -> richest model.
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
// BBF Lab Voice Engine EXACT payload (Part 2): stability 0.35 frees the soulful
// fluctuations; similarity 0.85 locks Akeem's cords; style 0.15 amplifies emotion;
// speaker_boost on. No speed — Architect tempo comes from comma/ellipsis cadence.
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.85,
  style: 0.15,
  use_speaker_boost: true,
};
const ELEVEN_TIMEOUT_MS = 30000;

// Estimate playback duration from MP3 byte length @ 128 kbps
function estimateDurationMs(bytes: number): number {
  return Math.round((bytes / 16000) * 1000);
}

// Base64 encoder for binary audio payload
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return btoa(binary);
}

// Call ElevenLabs TTS API
async function callElevenLabs(
  voiceId: string,
  text: string,
  modelId: string,
  voiceSettings: Record<string, unknown>,
  apiKey: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ELEVEN_TIMEOUT_MS);

  const requestBody = {
    text,
    model_id: modelId,
    voice_settings: voiceSettings,
  };

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      let errBody: any = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          errBody = await res.text();
        } catch (_) {}
      }
      console.error(`[bbf-agentic-rpe-voice-explanation] ElevenLabs error: status=${res.status} body=${JSON.stringify(errBody).slice(0, 400)}`);
      return { ok: false as const, status: res.status, error: `elevenlabs_${res.status}` };
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    return { ok: true as const, audio: buf };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${ELEVEN_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-rpe-voice-explanation] ElevenLabs fetch failed: ${reason}`);
    return { ok: false as const, error: reason };
  } finally {
    clearTimeout(timeout);
  }
}

// Upload audio to Supabase Storage (x-upsert so a voice/tuning change overwrites the daily file)
async function uploadToStorage(
  audio: Uint8Array,
  language: string,
  supabaseUrl: string,
  supabaseKey: string,
) {
  const filename = `rpe-explanation-${language}.mp3`;
  const path = `bbf-education/${filename}`;
  const url = `${supabaseUrl}/storage/v1/object/bbf-education/${filename}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'audio/mpeg',
        'x-upsert': 'true',
      },
      body: audio,
    });

    if (!res.ok) {
      console.error(`[bbf-agentic-rpe-voice-explanation] Storage upload failed: HTTP ${res.status}`);
      return null;
    }

    // Return public URL
    return `${supabaseUrl}/storage/v1/object/public/${path}`;
  } catch (e) {
    console.error(`[bbf-agentic-rpe-voice-explanation] Storage upload error: ${(e as Error).message}`);
    return null;
  }
}

// Check cache in database
async function checkCache(
  language: string,
  supabaseUrl: string,
  supabaseKey: string,
) {
  const today = new Date().toISOString().split('T')[0];
  const url = `${supabaseUrl}/rest/v1/bbf_rpe_audio?language=eq.${encodeURIComponent(language)}&select=audio_url,duration_seconds,created_at&order=created_at.desc&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (!res.ok) {
      console.error(`[bbf-agentic-rpe-voice-explanation] Cache check failed: HTTP ${res.status}`);
      return null;
    }

    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      const createdDate = new Date(row.created_at).toISOString().split('T')[0];
      if (createdDate === today) {
        return row;
      }
    }
    return null;
  } catch (e) {
    console.error(`[bbf-agentic-rpe-voice-explanation] Cache check error: ${(e as Error).message}`);
    return null;
  }
}

// Store in cache
async function storeInCache(
  language: string,
  audioUrl: string,
  durationSeconds: number,
  supabaseUrl: string,
  supabaseKey: string,
) {
  const url = `${supabaseUrl}/rest/v1/bbf_rpe_audio`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        language,
        audio_url: audioUrl,
        duration_seconds: durationSeconds,
        voice_id: VOICE_IDS[language],
        voice_name: 'BBF Coach Akeem',
      }),
    });

    if (!res.ok) {
      console.error(`[bbf-agentic-rpe-voice-explanation] Cache store failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[bbf-agentic-rpe-voice-explanation] Cache store error: ${(e as Error).message}`);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  let payload: any;
  try {
    payload = await req.json();
  } catch (_) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const { language } = payload || {};
  if (typeof language !== 'string' || !['en', 'es', 'pt'].includes(language)) {
    return jsonResponse({ ok: false, error: 'invalid_language', detail: 'Must be en, es, or pt' }, 400);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[bbf-agentic-rpe-voice-explanation] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env');
    return jsonResponse({ ok: false, error: 'config_missing_supabase' }, 500);
  }

  // 1. Check cache first
  const cached = await checkCache(language, SUPABASE_URL, SUPABASE_KEY);
  if (cached) {
    console.log(`[bbf-agentic-rpe-voice-explanation] cache hit for language=${language}`);
    return jsonResponse({
      ok: true,
      audio_url: cached.audio_url,
      duration_seconds: cached.duration_seconds,
      language,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Synthesize RPE text
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) {
    console.error('[bbf-agentic-rpe-voice-explanation] missing ELEVENLABS_API_KEY env');
    return jsonResponse({ ok: false, error: 'config_missing_elevenlabs' }, 500);
  }

  const text = architectFormat(RPE_TEXT[language as keyof typeof RPE_TEXT]);
  const voiceId = VOICE_IDS[language];

  console.log(`[bbf-agentic-rpe-voice-explanation] synthesizing language=${language}`);
  const ttsResult = await callElevenLabs(voiceId, text, DEFAULT_MODEL_ID, DEFAULT_VOICE_SETTINGS, ELEVENLABS_API_KEY);

  if (!ttsResult.ok) {
    console.error(`[bbf-agentic-rpe-voice-explanation] TTS failed: ${ttsResult.error}`);
    return jsonResponse({ ok: false, error: 'tts_failed', detail: ttsResult.error }, 500);
  }

  // 3. Upload to Supabase Storage
  const audioUrl = await uploadToStorage(ttsResult.audio, language, SUPABASE_URL, SUPABASE_KEY);
  if (!audioUrl) {
    return jsonResponse({ ok: false, error: 'storage_upload_failed' }, 500);
  }

  // 4. Cache in database
  const durationSeconds = Math.floor(estimateDurationMs(ttsResult.audio.length) / 1000);
  await storeInCache(language, audioUrl, durationSeconds, SUPABASE_URL, SUPABASE_KEY);

  console.log(`[bbf-agentic-rpe-voice-explanation] success: language=${language} bytes=${ttsResult.audio.length} duration_seconds=${durationSeconds}`);

  return jsonResponse({
    ok: true,
    audio_url: audioUrl,
    duration_seconds: durationSeconds,
    language,
    timestamp: new Date().toISOString(),
  });
});
