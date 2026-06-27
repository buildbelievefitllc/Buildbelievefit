// supabase/functions/bbf-weekly-brief-scenario-engine/index.ts
// WEEKLY BRIEF — the coach's Monday voice memo. Deterministic scenario engine
// (SAFETY -> COMPLIANCE -> PROGRESSION -> NEUTRAL) renders a spoken script from
// the athlete's week telemetry, voices it through the BBF Lab Voice Engine
// (en -> 'BBF Coach Akeem') in the ARCHITECT vocal state, and returns it audio-first.
//
// Audio is uploaded to the PRIVATE bbf-coach-audio bucket; the response carries a
// freshly SIGNED url. FAIL-CLOSED gate on the paid voice_coach feature. Persists to
// bbf_weekly_briefs (one row per user . ISO year+week). Returns rendered_script.
//
// Returns JSON: { user_id, scenario, substatus, audio_url, rendered_script,
// locked_in, timestamp }. GET only (+ OPTIONS preflight).

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-bbf-locale, x-client-info',
};
function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY') || '';
const AUDIO_BUCKET = 'bbf-coach-audio';
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

const GROUP = { BASELINE: 'baseline', AUTONOMOUS: 'autonomous', APEX: 'apex', YOUTH: 'youth', ALL: 'allaccess' } as const;
type Group = typeof GROUP[keyof typeof GROUP];
const TIER_TO_GROUP: Record<string, Group> = {
  catalyst: GROUP.BASELINE, momentum: GROUP.BASELINE, fuel_foundation: GROUP.BASELINE,
  autonomous: GROUP.AUTONOMOUS, fuel_performance: GROUP.AUTONOMOUS,
  fuel_sovereign: GROUP.APEX, kickstart_6wk_3x: GROUP.APEX, kickstart_6wk_4x: GROUP.APEX,
  transformation_8wk_3x: GROUP.APEX, transformation_8wk_4x: GROUP.APEX,
  sovereign_12wk_3x: GROUP.APEX, sovereign_12wk_4x: GROUP.APEX,
  rising_athlete: GROUP.YOUTH,
  lite: GROUP.BASELINE, gateway: GROUP.AUTONOMOUS, architect: GROUP.AUTONOMOUS, sovereign: GROUP.APEX,
  youth_athlete: GROUP.YOUTH, nutrition_essentials: GROUP.BASELINE, nutrition_platinum: GROUP.APEX,
};
const AUTO_BAND: Group[] = [GROUP.AUTONOMOUS, GROUP.APEX, GROUP.ALL];
const FEATURE_ACCESS: Record<string, Group[]> = { voice_coach: AUTO_BAND };

type Gate = { ok: true; user_id: string } | { ok: false; status: number; error: string; detail: string };
async function requireVoiceCoach(supa: ReturnType<typeof createClient>, token: string): Promise<Gate> {
  const tok = String(token || '').trim();
  if (!tok) return { ok: false, status: 401, error: 'missing_session', detail: 'A vault session token is required.' };
  const { data: uid } = await supa.rpc('_bbf_uid_from_vault_token', { p_session_token: tok });
  const userId = typeof uid === 'string' && uid ? uid : null;
  if (!userId) return { ok: false, status: 401, error: 'invalid_session', detail: 'Vault session is invalid or expired.' };
  const { data: rows } = await supa
    .from('bbf_users')
    .select('uid, subscription_tier, trial_expires_at, access_status, role')
    .eq('id', userId).is('deleted_at', null).limit(1);
  const row = Array.isArray(rows) && rows.length ? rows[0] as Record<string, unknown> : null;
  if (!row) return { ok: false, status: 401, error: 'invalid_session', detail: 'No active account for this session.' };
  if (String(row.access_status || '') === 'locked') return { ok: false, status: 403, error: 'account_locked', detail: 'This account is locked.' };
  const role = String(row.role || '').toLowerCase();
  const uidSlug = String(row.uid || '').toLowerCase();
  const godMode = role === 'admin' || role === 'trainer' || role === 'coach' || uidSlug === 'akeem';
  const trialMs = Date.parse(String(row.trial_expires_at || ''));
  const trialActive = Number.isFinite(trialMs) && trialMs > Date.now();
  if (godMode || trialActive) return { ok: true, user_id: userId };
  const slug = String(row.subscription_tier || '').trim().toLowerCase();
  const group = slug ? TIER_TO_GROUP[slug] : undefined;
  if (group && FEATURE_ACCESS.voice_coach.includes(group)) return { ok: true, user_id: userId };
  return { ok: false, status: 403, error: 'tier_not_entitled', detail: `Tier "${row.subscription_tier || '(none)'}" does not unlock the Weekly Brief.` };
}

interface UserWeekData {
  user_id: string; sessions_logged: number; unique_days: number; avg_rpe: number;
  readiness_logs: number; app_open_days: number; max_weight_this_week: number; max_weight_last_week: number;
  plateau_lift?: string; plateau_weight?: number; plateau_weeks?: number;
  progression_lift?: string; progression_weight?: number; pr_amount?: number; rep_delta?: number;
}
interface ScenarioResult { scenario: string; substatus: string; locked_in: boolean; rendered_script: string; }

// Trilingual coach scripts. ONE voice, three languages: eleven_multilingual_v2
// voices ES/PT natively in Coach Akeem's clone, so the spoken brief and the on-
// screen transcript BOTH match the athlete's chosen language. EN is the original
// wording; ES/PT are rendered in the natural, colloquial coaching pocket (not
// literal translations). Placeholders ({plateau_lift}, {deload_weight}, …) are
// language-neutral and filled identically in every locale.
type Locale = 'en' | 'es' | 'pt';
const scripts: Record<string, Record<Locale, string>> = {
  PLATEAU_WITH_HIGH_RPE: {
    en: `Hey, so your {plateau_lift} has been stuck at {plateau_weight} for three weeks. And I'm seeing your RPE, you're grinding hard every rep. That tells me you're fatigued deep down, not just tired. Here's what we're doing: we're backing off to {deload_weight} this week. Lower weight, higher reps, but the goal isn't ego, it's recovery. Let the nervous system reset. I need you fresh so we can come back stronger. This is the smart move, not the easy move. Trust me on this.`,
    es: `Oye, tu {plateau_lift} lleva tres semanas estancado en {plateau_weight}. Y veo tu RPE, estás peleando cada repetición. Eso me dice que estás fatigado a fondo, no solo cansado. Esto es lo que vamos a hacer: bajamos a {deload_weight} esta semana. Menos peso, más repeticiones, pero la meta no es el ego, es la recuperación. Deja que el sistema nervioso se reinicie. Te necesito fresco para volver más fuerte. Esta es la jugada inteligente, no la fácil. Confía en mí.`,
    pt: `Ô, o seu {plateau_lift} tá travado em {plateau_weight} faz três semanas. E eu tô vendo o seu RPE, você tá brigando em cada repetição. Isso me diz que você tá fatigado lá no fundo, não só cansado. É o seguinte que a gente vai fazer: a gente baixa pra {deload_weight} essa semana. Menos peso, mais repetições, mas a meta não é o ego, é a recuperação. Deixa o sistema nervoso resetar. Eu preciso de você descansado pra voltar mais forte. Essa é a jogada inteligente, não a fácil. Confia em mim.`,
  },
  COMPLIANCE_NO_LOGS: {
    en: `Look, I see you hit the program this week. That's the work. But I'm not seeing the data, weight, reps, RPE. And here's the thing: I can't coach what I can't see. Every number you log is a data point. It tells me if you're getting stronger, if you're recovering, where you're breaking down. Without it, I'm flying blind. So let's make a deal: this week, every set, three pieces. Weight, reps, how hard it felt. That's it. Thirty seconds per set. Can you do that? Because I'm ready to coach you, but I need you to meet me halfway.`,
    es: `Mira, veo que le diste al programa esta semana. Ese es el trabajo. Pero no veo los datos: peso, repeticiones, RPE. Y la cosa es esta: no puedo entrenar lo que no puedo ver. Cada número que registras es un dato. Me dice si te estás poniendo más fuerte, si te recuperas, dónde te quiebras. Sin eso, voy a ciegas. Hagamos un trato: esta semana, cada serie, tres cosas. Peso, repeticiones, qué tan duro se sintió. Eso es todo. Treinta segundos por serie. ¿Puedes con eso? Porque estoy listo para entrenarte, pero necesito que pongas de tu parte.`,
    pt: `Olha, eu vejo que você cumpriu o programa essa semana. Isso é o trabalho. Mas eu não tô vendo os dados: peso, repetições, RPE. E é o seguinte: eu não consigo treinar o que eu não consigo ver. Cada número que você registra é um dado. Me diz se você tá ficando mais forte, se tá recuperando, onde você tá quebrando. Sem isso, eu tô voando às cegas. Então vamos fazer um trato: essa semana, cada série, três coisas. Peso, repetições, o quão pesado foi. Só isso. Trinta segundos por série. Consegue? Porque eu tô pronto pra te treinar, mas eu preciso que você faça a sua parte.`,
  },
  COMPLIANCE_NO_READINESS: {
    en: `You're logging sets, I see that. Solid. But I'm not seeing sleep or soreness data. That's the second half of the picture. Sleep, soreness, how you feel, that's how I know if you're ready to go hard or if you need a deload. This week, after every session, thirty seconds: open the app, tell me how many hours you slept, how sore you are one to ten. That's it. I can't build the right plan without knowing how you're recovering. Let's go.`,
    es: `Estás registrando las series, lo veo. Bien. Pero no veo datos de sueño ni de dolor muscular. Esa es la otra mitad del cuadro. El sueño, el dolor, cómo te sientes, así sé si estás listo para ir con todo o si necesitas una descarga. Esta semana, después de cada sesión, treinta segundos: abre la app, dime cuántas horas dormiste, qué tan adolorido estás del uno al diez. Eso es todo. No puedo armar el plan correcto sin saber cómo te recuperas. Vamos.`,
    pt: `Você tá registrando as séries, eu vejo isso. Firmeza. Mas eu não tô vendo dados de sono nem de dor muscular. Essa é a outra metade do quadro. O sono, a dor, como você se sente, é assim que eu sei se você tá pronto pra ir com tudo ou se precisa de uma descarga. Essa semana, depois de cada sessão, trinta segundos: abre o app, me diz quantas horas você dormiu, o quão dolorido você tá de um a dez. Só isso. Eu não consigo montar o plano certo sem saber como você tá recuperando. Bora.`,
  },
  COMPLIANCE_LOW_ENGAGEMENT: {
    en: `I see the sets you logged. But the app sees you only a couple times this week. And here's what I'm telling you: the app is where I live. Between the sets, the readiness checks, the briefs I'm dropping, that's the coaching. This week, open the app every day. Even if you're not training, check your brief, see your program, get your head right. Make it a daily habit. Because I'm in there, and I'm waiting to coach you.`,
    es: `Veo las series que registraste. Pero la app solo te ve un par de veces esta semana. Y esto es lo que te digo: la app es donde yo vivo. Entre las series, los chequeos de preparación, los resúmenes que te dejo, ahí está el coaching. Esta semana, abre la app todos los días. Aunque no entrenes, revisa tu resumen, mira tu programa, pon la cabeza en su lugar. Hazlo un hábito diario. Porque yo estoy ahí dentro, esperando para entrenarte.`,
    pt: `Eu vejo as séries que você registrou. Mas o app só te vê umas duas vezes essa semana. E é isso que eu te digo: o app é onde eu moro. Entre as séries, os check-ins de prontidão, os resumos que eu deixo, é ali que tá o coaching. Essa semana, abre o app todo dia. Mesmo que você não treine, vê o seu resumo, olha o seu programa, ajeita a cabeça. Faz disso um hábito diário. Porque eu tô lá dentro, esperando pra te treinar.`,
  },
  PROGRESSION_NEW_MAX: {
    en: `{progression_lift} went up {pr_amount} pounds. That's a win. Clean. But here's what I'm watching: your speed on the way up is slowing. You're muscling it instead of staying tight. This week, same weight as last week's max, but we're dialing in quality. Explosive lockout, controlled descent, pause at the bottom. We're not chasing a new number this week, we're refining the engine. Quality weight beats sloppy heavy every time.`,
    es: `Tu {progression_lift} subió {pr_amount} libras. Eso es una victoria. Limpia. Pero esto es lo que estoy observando: tu velocidad en la subida está bajando. Lo estás forzando a fuerza bruta en vez de mantenerte firme. Esta semana, el mismo peso que tu máximo de la semana pasada, pero afinamos la calidad. Bloqueo explosivo, descenso controlado, pausa abajo. Esta semana no perseguimos un número nuevo, refinamos el motor. El peso de calidad le gana al peso sucio siempre.`,
    pt: `Seu {progression_lift} subiu {pr_amount} libras. Isso é uma vitória. Limpa. Mas é isso que eu tô observando: a sua velocidade na subida tá caindo. Você tá forçando na marra em vez de manter a firmeza. Essa semana, o mesmo peso do seu máximo da semana passada, mas a gente afina a qualidade. Travamento explosivo, descida controlada, pausa embaixo. Essa semana a gente não persegue número novo, a gente refina o motor. Peso de qualidade ganha de peso desleixado toda vez.`,
  },
  PROGRESSION_REP_MAX: {
    en: `{progression_lift} at {progression_weight} for {rep_delta} more reps. That's real progression. But I'm seeing the same thing: speed's dropping. This week, we dial the reps back by a couple, lock in explosive reps, controlled negatives. We're not grinding, we're moving with intent. You're strong. Now let's make sure the bar knows it.`,
    es: `Tu {progression_lift} a {progression_weight} por {rep_delta} repeticiones más. Eso es progresión real. Pero veo lo mismo: la velocidad está bajando. Esta semana, recortamos un par de repeticiones, fijamos repeticiones explosivas, negativas controladas. No estamos peleando, nos movemos con intención. Eres fuerte. Ahora que la barra se entere.`,
    pt: `Seu {progression_lift} em {progression_weight} por mais {rep_delta} repetições. Isso é progressão de verdade. Mas eu vejo a mesma coisa: a velocidade tá caindo. Essa semana, a gente corta um par de repetições, trava repetições explosivas, negativas controladas. A gente não tá brigando, a gente se move com intenção. Você é forte. Agora deixa a barra saber disso.`,
  },
  PROGRESSION_FORM_FLAG: {
    en: `You got a new max on {progression_lift}, {pr_amount} pounds up. That's a win. But your RPE is climbing and I'm seeing some form breakdown on the heavy sets. So here's the deal: we keep this weight for one more week, lock in the movement, then we reassess. You're strong enough to move the weight. Now I need you to move it right. Form first, then load. This week: same top weight, perfect reps only.`,
    es: `Conseguiste un nuevo máximo en tu {progression_lift}, {pr_amount} libras más. Eso es una victoria. Pero tu RPE está subiendo y veo que la técnica se rompe en las series pesadas. Así que el trato es este: mantenemos este peso una semana más, fijamos el movimiento, y luego reevaluamos. Tienes la fuerza para mover el peso. Ahora necesito que lo muevas bien. Primero la técnica, después la carga. Esta semana: el mismo peso tope, solo repeticiones perfectas.`,
    pt: `Você bateu um novo máximo no seu {progression_lift}, {pr_amount} libras a mais. Isso é uma vitória. Mas o seu RPE tá subindo e eu vejo a técnica quebrando nas séries pesadas. Então o trato é o seguinte: a gente mantém esse peso por mais uma semana, trava o movimento, e depois reavalia. Você tem força pra mover o peso. Agora eu preciso que você mova certo. Primeiro a técnica, depois a carga. Essa semana: o mesmo peso máximo, só repetições perfeitas.`,
  },
  NEUTRAL: {
    en: `You logged solid this week, sessions in, readiness data coming in. This week, same plan. Stay consistent. You're building the habit, and the numbers follow. Keep showing up.`,
    es: `Registraste bien esta semana, las sesiones hechas, los datos de preparación entrando. Esta semana, el mismo plan. Mantén la constancia. Estás construyendo el hábito, y los números siguen. Sigue presentándote.`,
    pt: `Você registrou direitinho essa semana, as sessões feitas, os dados de prontidão chegando. Essa semana, o mesmo plano. Mantém a constância. Você tá construindo o hábito, e os números vêm atrás. Continua aparecendo.`,
  },
};

function localeCode(input?: string | null): Locale {
  const tkn = String(input ?? '').trim().toLowerCase();
  if (tkn.startsWith('es')) return 'es';
  if (tkn.startsWith('pt') || tkn.includes('braz') || tkn.includes('bras')) return 'pt';
  return 'en';
}

// ARCHITECT vocal-state guard (BBF Lab Voice Engine): exclamation marks spike volume
// artificially on the clone — strip them so emphasis comes from the comma/ellipsis cadence.
function architectFormat(s: string): string { return s.replace(/!+/g, '.').replace(/  +/g, ' ').trim(); }

function renderScript(substatus: string, data: UserWeekData, locale: Locale): string {
  const template = scripts[substatus] || scripts.NEUTRAL;
  const deloadWeight = Math.round((data.plateau_weight || 0) * 0.9);
  const filled = (template[locale] || template.en)
    .replace(/{plateau_lift}/g, data.plateau_lift || 'your main lift')
    .replace(/{plateau_weight}/g, String(data.plateau_weight || ''))
    .replace(/{deload_weight}/g, String(deloadWeight))
    .replace(/{progression_lift}/g, data.progression_lift || 'your main lift')
    .replace(/{progression_weight}/g, String(data.progression_weight || ''))
    .replace(/{pr_amount}/g, String(data.pr_amount || ''))
    .replace(/{rep_delta}/g, String(data.rep_delta || ''));
  return architectFormat(filled);
}

function detectScenario(data: UserWeekData, locale: Locale): ScenarioResult {
  if (data.avg_rpe > 8 && data.plateau_weeks && data.plateau_weeks >= 3) {
    return { scenario: 'PLATEAU_WITH_HIGH_RPE', substatus: 'PLATEAU_WITH_HIGH_RPE', locked_in: false, rendered_script: renderScript('PLATEAU_WITH_HIGH_RPE', data, locale) };
  }
  if (data.sessions_logged < 3 || data.readiness_logs === 0) {
    let substatus = 'COMPLIANCE_NO_LOGS';
    if (data.sessions_logged >= 2 && data.readiness_logs === 0) substatus = 'COMPLIANCE_NO_READINESS';
    if (data.app_open_days < 3 && data.sessions_logged > 0) substatus = 'COMPLIANCE_LOW_ENGAGEMENT';
    return { scenario: 'COMPLIANCE', substatus, locked_in: false, rendered_script: renderScript(substatus, data, locale) };
  }
  const locked_in = data.app_open_days >= 5 && data.readiness_logs >= 4 && data.sessions_logged >= 3;
  if (locked_in && data.max_weight_this_week > data.max_weight_last_week) {
    const substatus = data.avg_rpe > 7.5 ? 'PROGRESSION_FORM_FLAG' : 'PROGRESSION_NEW_MAX';
    return { scenario: 'PROGRESSION', substatus, locked_in: true, rendered_script: renderScript(substatus, data, locale) };
  }
  if (locked_in && data.rep_delta && data.rep_delta > 0) {
    return { scenario: 'PROGRESSION', substatus: 'PROGRESSION_REP_MAX', locked_in: true, rendered_script: renderScript('PROGRESSION_REP_MAX', data, locale) };
  }
  return { scenario: 'NEUTRAL', substatus: 'NEUTRAL', locked_in: true, rendered_script: renderScript('NEUTRAL', data, locale) };
}

const BRIEF_VOICE_NAME = 'BBF Coach Akeem';
// CEO hotfix — LOCKED to the BBF Coach Akeem clone (ONE voice, all locales; multilingual_v2
// voices ES/PT natively). No /v1/voices lookup, no candidates[0] fallback to a stray voice.
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
// BBF Lab Voice Engine — EXACT payload (Part 2). stability 0.35 frees the soulful
// fluctuations; similarity 0.85 locks Akeem's cords; style 0.15 amplifies emotion;
// speaker_boost on. No speed — Architect tempo comes from comma/ellipsis cadence.
const VOICE_SETTINGS = { stability: 0.35, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true };

let _voice: { voice_id: string; name: string } | null = null;
// LOCKED to the BBF Coach Akeem clone for every brief, every locale — no ElevenLabs
// /v1/voices lookup, no name matching, no candidates[0] fallback. (_apiKey kept for
// call-site signature parity; intentionally unused now.)
async function resolveBriefVoice(_apiKey: string): Promise<{ voice_id: string; name: string } | null> {
  if (_voice) return _voice;
  _voice = { voice_id: AKEEM_VOICE_ID, name: BRIEF_VOICE_NAME };
  return _voice;
}

async function synthesize(apiKey: string, voiceId: string, text: string): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: text.slice(0, 2500), model_id: 'eleven_multilingual_v2', voice_settings: VOICE_SETTINGS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) { console.error(`[weekly-brief] tts ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`); return null; }
    return await res.arrayBuffer();
  } catch (e) { console.error('[weekly-brief] synth failed:', (e as Error).message); return null; }
  finally { clearTimeout(timeout); }
}

function isoYearWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_unavailable', detail: 'Server identity store is unreachable.' }, 503);

  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const token = req.headers.get('x-bbf-vault-token') || url.searchParams.get('vault_token') || '';
  // Locale drives BOTH the rendered transcript and the spoken (Akeem) audio. The
  // cache is keyed per-locale (column + storage path), so EN/ES/PT each persist
  // their own brief for the week instead of colliding on the first one generated.
  const locale = localeCode(url.searchParams.get('locale') || req.headers.get('x-bbf-locale'));

  const gate = await requireVoiceCoach(supa, token);
  if (!gate.ok) return jsonResponse({ error: gate.error, detail: gate.detail }, gate.status);
  const userId = gate.user_id;

  const { year, week } = isoYearWeek(new Date());

  try {
    const { data: rows } = await supa
      .from('bbf_weekly_briefs')
      .select('scenario, substatus, locked_in, audio_path, rendered_script, created_at')
      .eq('user_id', userId).eq('year', year).eq('week_of_year', week).eq('locale', locale).limit(1);
    const hit = Array.isArray(rows) && rows.length ? rows[0] as Record<string, unknown> : null;
    if (hit) {
      let audioUrl: string | null = null;
      if (hit.audio_path) {
        const { data: signed } = await supa.storage.from(AUDIO_BUCKET).createSignedUrl(String(hit.audio_path), SIGNED_URL_TTL);
        audioUrl = signed?.signedUrl || null;
      }
      console.log(`[weekly-brief] cache HIT user=${userId} ${year}w${week} locale=${locale}`);
      return jsonResponse({
        user_id: userId, scenario: hit.scenario, substatus: hit.substatus,
        audio_url: audioUrl, rendered_script: hit.rendered_script || '',
        locked_in: hit.locked_in === true, timestamp: hit.created_at,
      }, 200, { 'X-BBF-Cache': 'hit' });
    }
  } catch (e) { console.warn('[weekly-brief] cache read failed:', (e as Error).message); }

  const { data: weekRows, error: weekErr } = await supa.rpc('get_user_week_data', { p_user_id: userId });
  if (weekErr) { console.error('[weekly-brief] week-data rpc error:', weekErr.message); return jsonResponse({ error: 'week_data_failed', detail: 'Could not read your training week.' }, 502); }
  const weekData: UserWeekData = (Array.isArray(weekRows) ? weekRows[0] : weekRows) || {
    user_id: userId, sessions_logged: 0, unique_days: 0, avg_rpe: 0, readiness_logs: 0,
    app_open_days: 0, max_weight_this_week: 0, max_weight_last_week: 0,
  };
  const scenario = detectScenario(weekData, locale);

  let audioPath: string | null = null;
  let audioUrl: string | null = null;
  let voiceMeta: { voice_id: string; name: string } | null = null;
  if (ELEVENLABS_API_KEY) {
    voiceMeta = await resolveBriefVoice(ELEVENLABS_API_KEY);
    if (voiceMeta) {
      const buf = await synthesize(ELEVENLABS_API_KEY, voiceMeta.voice_id, scenario.rendered_script);
      if (buf) {
        const path = `${userId}/${year}-w${week}-${locale}-${scenario.substatus}.mp3`;
        const { error: upErr } = await supa.storage.from(AUDIO_BUCKET)
          .upload(path, new Uint8Array(buf), { contentType: 'audio/mpeg', upsert: true });
        if (upErr) { console.error('[weekly-brief] upload failed:', upErr.message); }
        else {
          audioPath = path;
          const { data: signed } = await supa.storage.from(AUDIO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
          audioUrl = signed?.signedUrl || null;
        }
      }
    }
  }

  const { error: insErr } = await supa.from('bbf_weekly_briefs').insert({
    user_id: userId, year, week_of_year: week, locale,
    scenario: scenario.scenario, substatus: scenario.substatus, locked_in: scenario.locked_in,
    audio_path: audioPath, rendered_script: scenario.rendered_script,
    voice_id: voiceMeta?.voice_id || null, voice_name: voiceMeta?.name || null,
  });
  if (insErr && !String(insErr.message || '').toLowerCase().includes('duplicate')) {
    console.warn('[weekly-brief] persist failed:', insErr.message);
  }

  return jsonResponse({
    user_id: userId, scenario: scenario.scenario, substatus: scenario.substatus,
    audio_url: audioUrl, rendered_script: scenario.rendered_script,
    locked_in: scenario.locked_in, timestamp: new Date().toISOString(),
  }, 200, { 'X-BBF-Cache': 'miss', 'X-BBF-Voice': voiceMeta?.name || '', 'X-BBF-State': 'architect', 'X-BBF-Locale': locale });
});
