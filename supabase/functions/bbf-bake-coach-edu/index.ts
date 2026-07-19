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

// Optional server-side publish target. When a bake is invoked with { upload:true },
// the synthesized MP3 is pushed into this PUBLIC storage bucket (bytes never leave
// Supabase) and the caller gets a stable public URL back — used for the trilingual
// landing clips whose bytes can't be pulled into an egress-restricted CI sandbox.
const AUDIO_BUCKET = 'coach-audio';

// ── The 9 CEO-approved scripts. EN verbatim; ES/PT = native, colloquial essence ──
// Generator orientation clips (3 states × 3 locales = 9 clips):
//   gen-available — client, token unused: full orientation + limit + reason
//   gen-spent     — client, token used: commit message, route to Program
//   gen-unlimited — admin/CEO: authoring-mode briefing
const SCRIPTS: Record<string, Record<string, string>> = {
  'gen-available': {
    en: "Welcome to the Vault Roster Engine — your personal program design studio. You have full access. Here you dial in your training with eight precision parameters: training priority, athletic gender focus, experience level, equipment availability, weekly frequency, workout pace, splits architecture, and intensifier technique. Or activate one of my three Signature Chamber Splits — Arnold Era Classic, FST-7 Fascia Expand, or Elite NASM Clinical — loaded directly from my golden-era protocols. You get one blueprint per month. That limit is intentional. A program works when you work it. Your job is to execute what you generate, not keep redesigning. Build it, commit to it, dominate it. See you next month with a new base to build from.",
    es: "Bienvenido al Motor de Roster del Cofre — tu estudio personal de diseño de programas. Tienes acceso completo. Aquí ajustas tu entrenamiento con ocho parámetros de precisión: prioridad de entrenamiento, enfoque de género atlético, nivel de experiencia, disponibilidad de equipo, frecuencia semanal, ritmo de entrenamiento, arquitectura de splits y técnica intensificadora. O activa uno de mis tres Splits de Cámara Insignia — cargados directamente desde mis protocolos de la era dorada. Tienes un plan por mes. Ese límite es intencional. Un programa funciona cuando tú lo ejecutas. Tu trabajo es hacer lo que generas, no seguir rediseñando. Constrúyelo, comprométete con él, domínalo. Nos vemos el próximo mes con una nueva base.",
    pt: "Bem-vindo ao Motor de Roster do Cofre — seu estúdio pessoal de design de programas. Você tem acesso completo. Aqui você ajusta seu treino com oito parâmetros de precisão: prioridade de treino, foco de gênero atlético, nível de experiência, disponibilidade de equipamento, frequência semanal, ritmo de treino, arquitetura de splits e técnica intensificadora. Ou ative um dos meus três Splits de Câmara Assinatura — carregados diretamente dos meus protocolos da era de ouro. Você tem um plano por mês. Esse limite é intencional. Um programa funciona quando você o executa. Seu trabalho é executar o que você gera, não ficar redesenhando. Construa, comprometa-se, domine. Nos vemos no próximo mês com uma nova base.",
  },
  'gen-spent': {
    en: "You've generated your blueprint for this month — now execute it. The one-blueprint-per-month discipline is not a restriction, it's the protocol. Programs produce results through consistent repetition, not constant redesign. Your program is live in your Program tab. Go run it. Come back next month with a new base to build from.",
    es: "Has generado tu plan este mes — ahora ejecútalo. La disciplina de un plan por mes no es una restricción, es el protocolo. Los programas producen resultados a través de la repetición constante, no del rediseño continuo. Tu programa está activo en tu pestaña de Programa. Ve a ejecutarlo. Vuelve el próximo mes con una nueva base.",
    pt: "Você gerou seu plano este mês — agora execute. A disciplina de um plano por mês não é uma restrição, é o protocolo. Programas produzem resultados através de repetição consistente, não de redesenho constante. Seu programa está ativo na aba Programa. Vá executá-lo. Volte no próximo mês com uma nova base.",
  },
  'gen-unlimited': {
    en: "Vault Roster Engine — authoring mode. Unlimited access. Design blueprints, activate any of the three Signature Chamber Splits — Arnold Era Classic, FST-7 Fascia Expand, or Elite NASM Clinical — reshuffle at will, and push blueprints directly to your athlete roster from the Deployment Bay below.",
    es: "Motor de Roster del Cofre — modo de autoría. Acceso ilimitado. Diseña planes, activa cualquiera de los tres Splits de Cámara Insignia — Arnold Era Classic, FST-7 Fascia Expand o Elite NASM Clinical — rebaraja a voluntad y envía planes directamente al roster de tus atletas desde la Bahía de Despliegue.",
    pt: "Motor de Roster do Cofre — modo de autoria. Acesso ilimitado. Crie planos, ative qualquer um dos três Splits de Câmara Assinatura — Arnold Era Classic, FST-7 Fascia Expand ou Elite NASM Clinical — reembaralhe à vontade e envie planos diretamente ao roster dos seus atletas pela Baía de Implantação.",
  },
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
  // Landing-page education clip — GLP-1 / peptide weight-loss + lean-mass defense.
  // Trilingual (CEO-approved 2026-07-19). ES/PT are NATIVE, colloquial renditions
  // in Coach Akeem's register — not literal translations — so eleven_multilingual_v2
  // keeps the authentic pocket.
  'glp1-overview': {
    en: "Look, let's talk straight about what's actually happening when you utilize a GLP-1 protocol or modern peptides for weight loss. The scale drops, and it drops fast. But if you aren't engaging in heavy, structured resistance training and tracking precision macro metrics, a massive chunk of that weight loss isn't coming from fat—it's coming directly from your skeletal muscle tissue. When you lose muscle, you systematically down-regulate your metabolism. You aren't just shrinking fat cells; you're burning up the engine that keeps your body lean, strong, and athletic over the long haul. Build Believe Fit isn't just an app—it's an engineering system built to protect your lean mass while your body shifts. The medication clears the runway, but training builds the structure. Let's build it right.",
    es: "Mira, hablemos claro sobre lo que de verdad pasa cuando usas un protocolo GLP-1 o péptidos modernos para bajar de peso. La báscula baja, y baja rápido. Pero si no estás haciendo entrenamiento de fuerza pesado y estructurado, y midiendo tus macros con precisión, una gran parte de ese peso que pierdes no viene de la grasa—viene directo de tu tejido muscular. Cuando pierdes músculo, vas apagando tu metabolismo poco a poco. No estás solo encogiendo células de grasa; estás quemando el motor que mantiene tu cuerpo definido, fuerte y atlético a largo plazo. Build Believe Fit no es solo una app—es un sistema de ingeniería creado para proteger tu masa muscular mientras tu cuerpo cambia. El medicamento despeja la pista, pero el entrenamiento construye la estructura. Vamos a construirlo bien.",
    pt: "Olha, vamos falar reto sobre o que realmente acontece quando você usa um protocolo GLP-1 ou peptídeos modernos pra emagrecer. A balança desce, e desce rápido. Mas se você não está fazendo treino de força pesado e estruturado, e acompanhando seus macros com precisão, uma parte enorme desse peso que você perde não vem da gordura—vem direto do seu tecido muscular. Quando você perde músculo, você vai desligando o seu metabolismo aos poucos. Você não está só encolhendo células de gordura; você está queimando o motor que mantém o seu corpo definido, forte e atlético no longo prazo. Build Believe Fit não é só um app—é um sistema de engenharia feito pra proteger a sua massa magra enquanto o seu corpo muda. O remédio abre a pista, mas o treino constrói a estrutura. Bora construir do jeito certo.",
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

// Ensure the public audio bucket exists, then upsert the MP3. Returns the public URL.
// All server-side (service key) — no client ever writes here.
async function publishToStorage(url: string, key: string, path: string, bytes: Uint8Array): Promise<string> {
  // Idempotent bucket create (409/400 "already exists" is fine).
  await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: AUDIO_BUCKET, name: AUDIO_BUCKET, public: true }),
  }).catch(() => {});
  // Upsert the object.
  const put = await fetch(`${url}/storage/v1/object/${AUDIO_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: bytes,
  });
  if (!put.ok) throw new Error(`storage_put_${put.status}:${(await put.text().catch(() => '')).slice(0, 120)}`);
  return `${url}/storage/v1/object/public/${AUDIO_BUCKET}/${path}`;
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

    // Optional server-side publish (bytes never leave Supabase). When set, the caller
    // gets a public_url instead of carrying ~1MB of base64 back over the wire.
    if (payload?.upload) {
      const path = String(payload?.storage_path || `${module}/${module}.${locale}.mp3`);
      const public_url = await publishToStorage(SUPABASE_URL, SERVICE_KEY, path, buf);
      console.log(`[bbf-bake-coach-edu] baked+published module=${module} locale=${locale} bytes=${buf.length} url=${public_url}`);
      return jsonResponse({ ok: true, module, locale, output_format: outputFormat, bytes: buf.length, public_url });
    }

    const audio_b64 = bytesToB64(buf);
    console.log(`[bbf-bake-coach-edu] baked module=${module} locale=${locale} fmt=${outputFormat} bytes=${buf.length}`);
    return jsonResponse({ ok: true, module, locale, output_format: outputFormat, bytes: buf.length, audio_b64 });
  } catch (e) {
    const err = e as Error;
    return jsonResponse({ error: err.name === 'AbortError' ? 'timeout_45000ms' : err.message }, 502);
  } finally { clearTimeout(timeout); }
});
