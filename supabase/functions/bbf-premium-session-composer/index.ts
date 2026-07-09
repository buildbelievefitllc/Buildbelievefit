// supabase/functions/bbf-premium-session-composer/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// bbf-premium-session-composer — PRODUCT 1 · THE BIOMETRIC NARRATION & MUSIC
// ENGINE (blueprint c509f26 §2). Compiles an athlete's daily programming into a
// timed PLAY CONTRACT: Coach Akeem narrating every block over an ElevenLabs
// Music v2 bed whose sections land on the work/rest seams, plus pre-baked
// biometric inflection cues the CLIENT injects when live HR crosses the band.
//
// PIPELINE (cache-first at every layer — Zero-API-Bloat):
//   1. GATE   requireEntitlement('premium_audio') — fail-closed, Apex band.
//   2. PLAN   body.plan (client's parsed programming) or the server copy in
//             bbf_active_clients.workout_plan; normalized into timed blocks.
//   3. CACHE  bbf_premium_session_tracks (user, day, locale) + readiness guard
//             → hit returns instantly (re-signed URLs, zero paid API work).
//   4. METER  bbf_voice_session_precheck BEFORE any paid work (house ledger).
//   5. SCRIPT Claude (router: premium_session_script → SONNET) fills the slot
//             list WE computed; deterministic trilingual templates back-fill.
//   6. VOICE  per-segment sha256 dedupe vs bbf_premium_audio_fragments — only
//             misses are synthesized (Akeem clone, multilingual_v2), chunk-safe.
//   7. MUSIC  bbf_music_beds by plan SHAPE signature — one bed per session
//             archetype amortizes across the roster; miss → POST /v1/music.
//   8. SIGN   manifest paths → short-TTL signed URLs (PRIVATE bucket — paid
//             content never rides a public URL).
//
// EXTRA MODES:
//   · { action:'resign', paths:[…] }         — vault token + gate; refresh URLs.
//   · { action:'bake_inflections' }          — x-bbf-admin-token perimeter; bakes
//     the fixed trilingual inflection variant library ONCE (deterministic curated
//     scripts — zero LLM; shared by every subscriber forever).
//
// The server NEVER concatenates audio bytes (stitch-router doctrine) — the client
// mixes the voice timeline over the bed and splices inflection cues at seams.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';
import { requireEntitlement } from '../_shared/entitlement-gate.ts';
import { localeCode } from '../_shared/locale.ts';
import {
  VOICE_DNA, BBF_VOICE_SETTINGS, BBF_VOICE_MODEL,
  vocalStateDirective, formatForState, isHeavyLiftMovement, heavyLiftDirective,
} from '../_shared/bbf-voice-engine.ts';
import { renderForModel, voiceTagDirective } from '../_shared/bbf-voice-tags.ts';
import {
  buildMusicPlan, planShapeString, readinessZone,
  type SessionBlock, type SessionCategory, type ReadinessZone,
} from '../_shared/music-plan-builder.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const FN = 'bbf-premium-session-composer';
const BUCKET = 'bbf_premium_audio_vault';
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const SIGN_TTL_S = 12 * 3600;          // 12h signed-URL TTL (blueprint §2.6)
const SEGMENT_MAX_CHARS = 2500;        // ElevenLabs single-call ceiling (house limit)
const SYNTH_CONCURRENCY = 4;           // parallel TTS pool (bake fn uses ≤6)
const SPEECH_MS_PER_CHAR = 65;         // ~2.5 words/sec ≈ 15.4 chars/s (studio-voiceover pacing)
const DEFAULT_REST_S = 90;
const WORK_S_PER_REP = 4;              // controlled-tempo estimate per rep

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
function utcToday(): string { return new Date().toISOString().slice(0, 10); }
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function callRpc(url: string, key: string, fn: string, args: Record<string, unknown>): Promise<any> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify(args) });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}

// ── PLAN NORMALIZATION ─────────────────────────────────────────────────────────
interface PlanExercise { exercise: string; sets: number; reps: string; rest_s: number; heavy: boolean }

function parseRestSeconds(raw: unknown): number {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return DEFAULT_REST_S;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(min|m\b)?/);
  if (!m) return DEFAULT_REST_S;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_REST_S;
  const secs = m[2] ? n * 60 : n;
  return Math.max(20, Math.min(360, Math.round(secs)));
}
function repsUpperBound(raw: unknown): number {
  const nums = String(raw ?? '').match(/\d+/g);
  if (!nums || !nums.length) return 10;
  const n = Math.max(...nums.map(Number).filter(Number.isFinite));
  return Math.max(3, Math.min(30, n || 10));
}

// Today's day from a parsed workout-plan array (mirrors prescribedTopSetLoad's
// weekday-match → first-trainable-day selection in frontend/src/lib/vaultApi.js).
function pickToday(plan: unknown): Record<string, any> | null {
  if (!Array.isArray(plan) || !plan.length) return null;
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const hasWork = (d: any) => Array.isArray(d?.exercises) && d.exercises.length > 0 && !d?.isRest;
  return plan.find((d: any) => String(d?.day || '').trim().toLowerCase() === weekday && hasWork(d))
    ?? plan.find(hasWork) ?? null;
}
function normalizeExercises(day: Record<string, any> | null): PlanExercise[] {
  const list = Array.isArray(day?.exercises) ? day!.exercises : [];
  return list.slice(0, 8).map((ex: any) => {
    const name = String(ex?.name ?? ex?.exercise ?? 'the movement').slice(0, 80);
    return {
      exercise: name,
      sets: Math.max(1, Math.min(8, num(ex?.sets) ?? 3)),
      reps: String(ex?.reps ?? '8-10').slice(0, 20),
      rest_s: parseRestSeconds(ex?.rest ?? ex?.rest_s ?? ex?.rest_seconds),
      heavy: isHeavyLiftMovement(name),
    };
  }).filter((e: PlanExercise) => e.exercise);
}
function categoryFor(day: Record<string, any> | null): SessionCategory {
  const f = String(day?.focus ?? '').toLowerCase();
  if (/cardio|conditioning|zone/.test(f)) return 'cardio';
  if (/recovery|mobility|prehab/.test(f)) return 'recovery';
  if (/strength|power|max/.test(f)) return 'strength';
  return 'hypertrophy';
}

// ── TIMELINE — blocks, seams, HR bands ─────────────────────────────────────────
const WARMUP_MS = 60_000;
const COOLDOWN_MS = 45_000;

interface TimelineSlot { slot: string; state: 'architect' | 'floor_coach' | 'sanctuary'; start_ms: number; budget_s: number; exercise?: string; heavy?: boolean }
interface ManifestBlock {
  id: string; exercise: string; sets: number; reps: string; rest_target_s: number;
  hr_band: { floor: number; ceiling: number }; work_window_ms: [number, number];
}

// Age-tempered HR band per category × readiness zone (blueprint §2.5.2). HRmax by
// the 220-age convention; the red zone pulls the ceiling in 5%.
function hrBandFor(category: SessionCategory, zone: ReadinessZone, age: number): { floor: number; ceiling: number } {
  const hrMax = 220 - Math.max(14, Math.min(80, age));
  const pct: Record<SessionCategory, [number, number]> = {
    strength: [0.55, 0.80], hypertrophy: [0.60, 0.84], cardio: [0.65, 0.88], recovery: [0.45, 0.65],
  };
  const [lo, hi] = pct[category] ?? pct.hypertrophy;
  const ceilingPct = zone === 'red' ? hi - 0.05 : hi;
  return { floor: Math.round(hrMax * lo), ceiling: Math.round(hrMax * ceilingPct) };
}

function buildTimeline(exercises: PlanExercise[], category: SessionCategory, zone: ReadinessZone, age: number) {
  const slots: TimelineSlot[] = [];
  const blocks: ManifestBlock[] = [];
  const musicBlocks: SessionBlock[] = [];
  let t = 0;

  slots.push({ slot: 'W0_INTRO', state: 'architect', start_ms: 0, budget_s: 22 });
  musicBlocks.push({ kind: 'warmup', duration_ms: WARMUP_MS });
  t = WARMUP_MS;

  exercises.forEach((ex, bi) => {
    const b = bi + 1;
    const workMs = Math.max(25, repsUpperBound(ex.reps) * WORK_S_PER_REP) * 1000;
    const blockStart = t;
    slots.push({ slot: `B${b}_SETUP`, state: 'floor_coach', start_ms: t, budget_s: 12, exercise: ex.exercise, heavy: ex.heavy });
    for (let s = 1; s <= ex.sets; s += 1) {
      slots.push({ slot: `B${b}_S${s}_CALL`, state: 'floor_coach', start_ms: t, budget_s: 8, exercise: ex.exercise, heavy: ex.heavy });
      musicBlocks.push({ kind: 'work', duration_ms: workMs });
      t += workMs;
      // Rest cue undershoots the rest target by ≥6s so the countdown plus a
      // potential inflection injection always fits inside the window (§2.3).
      slots.push({ slot: `B${b}_S${s}_REST`, state: 'floor_coach', start_ms: t, budget_s: Math.min(14, Math.max(6, ex.rest_s - 6)), exercise: ex.exercise });
      musicBlocks.push({ kind: 'rest', duration_ms: ex.rest_s * 1000 });
      t += ex.rest_s * 1000;
    }
    blocks.push({
      id: `B${b}`, exercise: ex.exercise, sets: ex.sets, reps: ex.reps, rest_target_s: ex.rest_s,
      hr_band: hrBandFor(category, zone, age), work_window_ms: [blockStart, t],
    });
  });

  slots.push({ slot: 'W9_COOLDOWN', state: 'sanctuary', start_ms: t, budget_s: 28 });
  musicBlocks.push({ kind: 'cooldown', duration_ms: COOLDOWN_MS });
  t += COOLDOWN_MS;

  return { slots, blocks, musicBlocks, total_ms: t };
}

// ── SCRIPT — Claude fills the slot list; deterministic templates back-fill ─────
const LOCALE_NAME: Record<string, string> = { en: 'English', es: 'Spanish (neutral Latin-American)', pt: 'Brazilian Portuguese' };

const FALLBACK: Record<string, Record<string, (ctx: { exercise?: string; reps?: string }) => string>> = {
  en: {
    W0_INTRO: () => 'Welcome to the floor. Today is already won in your mind... now the body follows. Breathe deep, lock in, and move with intent.',
    SETUP: (c) => `Next station: ${c.exercise}. Set your stance, own the setup. Quality before load.`,
    CALL: (c) => `Go. ${c.reps ? `Target ${c.reps} clean reps.` : 'Clean reps only.'} Control down, drive up.`,
    REST: () => 'Rest. Shake it loose, breathe through the nose. Next set is the one that counts.',
    W9_COOLDOWN: () => 'Work is done. <break time="2.0s"/> Slow the breath. <break time="2.0s"/> You showed up, you executed. Carry that with you.',
  },
  es: {
    W0_INTRO: () => 'Bienvenido al piso. Hoy ya se gano en tu mente... ahora el cuerpo sigue. Respira profundo y muevete con intencion.',
    SETUP: (c) => `Siguiente estacion: ${c.exercise}. Ajusta tu postura, domina la preparacion. Calidad antes que carga.`,
    CALL: (c) => `Vamos. ${c.reps ? `Meta: ${c.reps} repeticiones limpias.` : 'Solo repeticiones limpias.'} Controla la bajada, empuja con fuerza.`,
    REST: () => 'Descansa. Suelta el cuerpo, respira por la nariz. La proxima serie es la que cuenta.',
    W9_COOLDOWN: () => 'El trabajo esta hecho. <break time="2.0s"/> Baja la respiracion. <break time="2.0s"/> Llegaste y ejecutaste. Llevate eso contigo.',
  },
  pt: {
    W0_INTRO: () => 'Bem-vindo ao treino. Hoje ja foi vencido na sua mente... agora o corpo segue. Respire fundo e se mova com intencao.',
    SETUP: (c) => `Proxima estacao: ${c.exercise}. Ajuste a postura, domine a preparacao. Qualidade antes de carga.`,
    CALL: (c) => `Vai. ${c.reps ? `Meta: ${c.reps} repeticoes limpas.` : 'So repeticoes limpas.'} Controle na descida, força na subida.`,
    REST: () => 'Descansa. Solta o corpo, respira pelo nariz. A proxima serie e a que conta.',
    W9_COOLDOWN: () => 'O trabalho esta feito. <break time="2.0s"/> Desacelera a respiracao. <break time="2.0s"/> Voce apareceu e executou. Leva isso com voce.',
  },
};
function fallbackTextFor(slot: TimelineSlot, locale: string): string {
  const dict = FALLBACK[locale] ?? FALLBACK.en;
  if (slot.slot === 'W0_INTRO') return dict.W0_INTRO({});
  if (slot.slot === 'W9_COOLDOWN') return dict.W9_COOLDOWN({});
  if (/_SETUP$/.test(slot.slot)) return dict.SETUP({ exercise: slot.exercise });
  if (/_CALL$/.test(slot.slot)) return dict.CALL({ exercise: slot.exercise, reps: undefined });
  return dict.REST({});
}

async function writeSessionScript(
  apiKey: string, locale: string, slots: TimelineSlot[], exercises: PlanExercise[], zone: ReadinessZone,
): Promise<Record<string, string>> {
  const model = routeAndLog(FN, 'premium_session_script'); // → SONNET
  const heavy = exercises.some((e) => e.heavy);
  const system =
    `${VOICE_DNA}\n\n` +
    `You are scripting a PREMIUM GUIDED WORKOUT AUDIO SESSION, one short spoken segment per timeline slot. ` +
    `Speak directly to the athlete in ${LOCALE_NAME[locale] ?? 'English'}, second person. Each segment must fit its ` +
    `budget_s seconds at a deliberate ~2.5 words/second — NEVER exceed the budget. Readiness zone today: ${zone} ` +
    `(green = push, yellow = steady, red = dial intensity down and protect the athlete). ` +
    `Segments are STANDALONE audio cues — no numbering, no markdown, no lists, no quotes, no emojis.\n\n` +
    `${vocalStateDirective('floor_coach')}\n\n${vocalStateDirective('architect')}\n\n${vocalStateDirective('sanctuary')}\n` +
    `Apply the state named on each slot (W0_INTRO=architect, B*=floor_coach, W9_COOLDOWN=sanctuary).\n\n` +
    (heavy ? `${heavyLiftDirective()}\nApply it to slots marked heavy=true.\n\n` : '') +
    `${voiceTagDirective()}\n\n` +
    `Return STRICT JSON ONLY — one object mapping every slot id to its segment text: {"W0_INTRO":"...", ...}. ` +
    `No wrapper, no commentary, no markdown fences.`;
  const user = JSON.stringify({
    locale,
    exercises: exercises.map((e) => ({ exercise: e.exercise, sets: e.sets, reps: e.reps, rest_s: e.rest_s, heavy: e.heavy })),
    slots: slots.map((s) => ({ slot: s.slot, state: s.state, budget_s: s.budget_s, exercise: s.exercise ?? null, heavy: !!s.heavy })),
  });
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 3000, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) { console.error(`[${FN}] anthropic ${res.status}`); return {}; }
    const j = await res.json().catch(() => null);
    const text = Array.isArray(j?.content) ? j.content.find((b: any) => b?.type === 'text')?.text : null;
    if (!text) return {};
    const raw = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string' && v.trim()) out[k] = v.trim();
      return out;
    }
    return {};
  } catch (e) {
    console.error(`[${FN}] script write failed:`, (e as Error).message);
    return {};
  }
}

// ── ELEVENLABS SYNTH + STORAGE ─────────────────────────────────────────────────
async function synthesize(apiKey: string, text: string, timeoutMs = 30_000): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${AKEEM_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: text.slice(0, SEGMENT_MAX_CHARS), model_id: BBF_VOICE_MODEL, voice_settings: BBF_VOICE_SETTINGS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) { console.error(`[${FN}] tts ${res.status}`); return null; }
    return await res.arrayBuffer();
  } catch (e) {
    console.error(`[${FN}] tts failed:`, (e as Error).message);
    return null;
  } finally { clearTimeout(timeout); }
}
async function composeMusic(apiKey: string, plan: ReturnType<typeof buildMusicPlan>): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ music_length_ms: plan.music_length_ms, composition_plan: plan.composition_plan }),
      signal: controller.signal,
    });
    if (!res.ok) { console.error(`[${FN}] music ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`); return null; }
    return await res.arrayBuffer();
  } catch (e) {
    console.error(`[${FN}] music failed:`, (e as Error).message);
    return null;
  } finally { clearTimeout(timeout); }
}
async function vaultPut(url: string, key: string, path: string, bytes: ArrayBuffer): Promise<boolean> {
  try {
    const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000, immutable' },
      body: bytes,
    });
    return r.ok;
  } catch { return false; }
}
async function signPath(url: string, key: string, path: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${path}`, {
      method: 'POST', headers: pgHeaders(key), body: JSON.stringify({ expiresIn: SIGN_TTL_S }),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j?.signedURL ? `${url}/storage/v1${j.signedURL}` : null;
  } catch { return null; }
}
async function signAll(url: string, key: string, paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all([...new Set(paths)].map(async (p) => {
    const s = await signPath(url, key, p);
    if (s) out[p] = s;
  }));
  return out;
}

// ── FRAGMENT CACHE (content-hash dedupe → credit preservation) ─────────────────
async function fragmentByHash(url: string, key: string, sha: string, locale: string): Promise<{ storage_path: string; duration_ms: number | null } | null> {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_premium_audio_fragments?script_sha256=eq.${sha}&locale=eq.${locale}&status=eq.active&select=storage_path,duration_ms&limit=1`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}
async function insertFragment(url: string, key: string, row: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${url}/rest/v1/bbf_premium_audio_fragments?on_conflict=script_sha256,locale`, {
      method: 'POST',
      headers: { ...pgHeaders(key), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
  } catch { /* best-effort */ }
}

interface ResolvedSegment { slot: string; path: string; duration_ms: number; chars_synthesized: number }

// Resolve every slot's audio: hash → cache hit (free) or synthesize + upload +
// register. A small worker pool bounds concurrency; per-segment failures degrade
// that slot to device-TTS on the client (never a hard error).
async function resolveSegments(opts: {
  url: string; key: string; eleven: string; locale: string;
  slots: TimelineSlot[]; texts: Record<string, string>;
}): Promise<{ segments: ResolvedSegment[]; failed: string[] }> {
  const { url, key, eleven, locale, slots, texts } = opts;
  const segments: ResolvedSegment[] = [];
  const failed: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < slots.length) {
      const slot = slots[cursor];
      cursor += 1;
      const raw = texts[slot.slot] || fallbackTextFor(slot, locale);
      const rendered = renderForModel(formatForState(raw, slot.state), BBF_VOICE_MODEL);
      if (!rendered) { failed.push(slot.slot); continue; }
      const sha = await sha256hex(`${AKEEM_VOICE_ID}|${BBF_VOICE_MODEL}|${locale}|${rendered}`);
      const hit = await fragmentByHash(url, key, sha, locale);
      const estMs = Math.round(rendered.length * SPEECH_MS_PER_CHAR);
      if (hit) {
        segments.push({ slot: slot.slot, path: hit.storage_path, duration_ms: hit.duration_ms ?? estMs, chars_synthesized: 0 });
        continue;
      }
      const buf = await synthesize(eleven, rendered);
      if (!buf) { failed.push(slot.slot); continue; }
      const path = `seg/${sha}.mp3`;
      if (!(await vaultPut(url, key, path, buf))) { failed.push(slot.slot); continue; }
      await insertFragment(url, key, {
        kind: 'segment', variant_key: slot.slot, locale, script_text: rendered, script_sha256: sha,
        model_id: BBF_VOICE_MODEL, voice_id: AKEEM_VOICE_ID, storage_path: path, duration_ms: estMs, status: 'active',
      });
      segments.push({ slot: slot.slot, path, duration_ms: estMs, chars_synthesized: rendered.length });
    }
  }
  await Promise.all(Array.from({ length: SYNTH_CONCURRENCY }, worker));
  const order = new Map(slots.map((s, i) => [s.slot, i]));
  segments.sort((a, b) => (order.get(a.slot) ?? 0) - (order.get(b.slot) ?? 0));
  return { segments, failed };
}

// ── INFLECTION LIBRARY (pre-baked, shared, deterministic scripts — zero LLM) ───
const INFLECTION_SCRIPTS: Record<string, Record<string, string>> = {
  en: {
    INF_HR_LOW: 'Heart rate says you have more in the tank. Pick the pace up — this set is not a stroll. Show me intent.',
    INF_HR_HIGH: 'Hold up. Let that heart rate settle. Ten more seconds of air... then we go again, controlled.',
    INF_ON_TARGET: 'Right in the pocket. That is the zone — keep this exact rhythm.',
  },
  es: {
    INF_HR_LOW: 'Tu ritmo cardiaco dice que tienes mas en el tanque. Sube el paso — esta serie no es un paseo. Muestrame intencion.',
    INF_HR_HIGH: 'Espera. Deja que el corazon se calme. Diez segundos mas de aire... y volvemos, con control.',
    INF_ON_TARGET: 'Justo en la zona. Ese es el ritmo — mantenlo exacto.',
  },
  pt: {
    INF_HR_LOW: 'Seu batimento diz que ainda tem mais no tanque. Aumenta o ritmo — essa serie nao e passeio. Me mostra intencao.',
    INF_HR_HIGH: 'Calma. Deixa o coracao assentar. Mais dez segundos de ar... e voltamos, com controle.',
    INF_ON_TARGET: 'Na zona exata. Esse e o ritmo — segura ele.',
  },
};
const INFLECTION_KEYS = ['INF_HR_LOW', 'INF_HR_HIGH', 'INF_ON_TARGET'];

async function readInflections(url: string, key: string, locale: string): Promise<Record<string, { path: string; duration_ms: number }>> {
  const out: Record<string, { path: string; duration_ms: number }> = {};
  try {
    const keys = INFLECTION_KEYS.map((k) => `"${k}"`).join(',');
    const r = await fetch(
      `${url}/rest/v1/bbf_premium_audio_fragments?kind=eq.inflection&locale=eq.${locale}&variant_key=in.(${keys})&status=eq.active&select=variant_key,storage_path,duration_ms`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return out;
    const rows: any[] = await r.json().catch(() => []);
    for (const row of rows) out[row.variant_key] = { path: row.storage_path, duration_ms: row.duration_ms ?? 8000 };
  } catch { /* inflections are an enhancement layer — absent = client disables */ }
  return out;
}
async function bakeInflections(url: string, key: string, eleven: string): Promise<{ baked: number; skipped: number; failed: number }> {
  let baked = 0, skipped = 0, failed = 0;
  for (const locale of ['en', 'es', 'pt']) {
    for (const vk of INFLECTION_KEYS) {
      const rendered = renderForModel(formatForState(INFLECTION_SCRIPTS[locale][vk], 'floor_coach'), BBF_VOICE_MODEL);
      const sha = await sha256hex(`${AKEEM_VOICE_ID}|${BBF_VOICE_MODEL}|${locale}|${rendered}`);
      if (await fragmentByHash(url, key, sha, locale)) { skipped += 1; continue; }
      const buf = await synthesize(eleven, rendered);
      if (!buf) { failed += 1; continue; }
      const path = `inf/${vk}-${locale}.mp3`;
      if (!(await vaultPut(url, key, path, buf))) { failed += 1; continue; }
      await insertFragment(url, key, {
        kind: 'inflection', variant_key: vk, locale, script_text: rendered, script_sha256: sha,
        model_id: BBF_VOICE_MODEL, voice_id: AKEEM_VOICE_ID, storage_path: path,
        duration_ms: Math.round(rendered.length * SPEECH_MS_PER_CHAR), status: 'active',
      });
      baked += 1;
    }
  }
  return { baked, skipped, failed };
}

// ── MUSIC BED (shape-signature cache — the margin engine) ──────────────────────
async function resolveMusicBed(opts: {
  url: string; key: string; eleven: string;
  musicBlocks: SessionBlock[]; category: SessionCategory; zone: ReadinessZone;
}): Promise<{ signature: string; path: string | null; duration_ms: number; loopable: boolean }> {
  const { url, key, eleven, musicBlocks, category, zone } = opts;
  const signature = await sha256hex(planShapeString(musicBlocks, category, zone));
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_music_beds?plan_signature=eq.${signature}&select=storage_path,duration_ms,loopable&limit=1`,
      { headers: pgHeaders(key) },
    );
    if (r.ok) {
      const rows: any[] = await r.json().catch(() => []);
      if (rows[0]) {
        // hit_count is observability for the amortization thesis — best-effort.
        fetch(`${url}/rest/v1/rpc/bbf_touch_music_bed`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify({ p_signature: signature }) }).catch(() => {});
        return { signature, path: rows[0].storage_path, duration_ms: rows[0].duration_ms, loopable: !!rows[0].loopable };
      }
    }
  } catch { /* fall through to generate */ }

  const plan = buildMusicPlan(musicBlocks, category, zone);
  const buf = await composeMusic(eleven, plan);
  if (!buf) return { signature, path: null, duration_ms: 0, loopable: false }; // voice-only manifest still ships
  const path = `beds/${signature}.mp3`;
  if (!(await vaultPut(url, key, path, buf))) return { signature, path: null, duration_ms: 0, loopable: false };
  try {
    await fetch(`${url}/rest/v1/bbf_music_beds?on_conflict=plan_signature`, {
      method: 'POST',
      headers: { ...pgHeaders(key), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        plan_signature: signature, composition_plan: plan, storage_path: path,
        duration_ms: plan.music_length_ms, loopable: plan.loopable,
      }),
    });
  } catch { /* best-effort registration */ }
  return { signature, path, duration_ms: plan.music_length_ms, loopable: plan.loopable };
}

// ── TRACK CACHE ────────────────────────────────────────────────────────────────
async function readTrack(url: string, key: string, userId: string, day: string, locale: string, currentScore: number | null): Promise<Record<string, any> | null> {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_premium_session_tracks?user_id=eq.${encodeURIComponent(userId)}&session_day=eq.${day}&locale=eq.${locale}&status=eq.ready&select=manifest,readiness_score,total_duration_ms&limit=1`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows: any[] = await r.json().catch(() => []);
    const row = rows[0];
    if (!row?.manifest) return null;
    // Stale-cache guard (bbf_sovereign_audio pattern): a later check-in that moved
    // the readiness score re-composes rather than serving yesterday's energy.
    const cachedScore = num(row.readiness_score);
    if (currentScore !== null && cachedScore !== null && currentScore !== cachedScore) return null;
    return row;
  } catch { return null; }
}
async function writeTrack(url: string, key: string, row: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${url}/rest/v1/bbf_premium_session_tracks?on_conflict=user_id,session_day,locale`, {
      method: 'POST',
      headers: { ...pgHeaders(key), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
    // 14-day manifest prune (blueprint §4) — fragments/beds persist, contracts don't.
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    await fetch(`${url}/rest/v1/bbf_premium_session_tracks?user_id=eq.${encodeURIComponent(String(row.user_id))}&session_day=lt.${cutoff}`, {
      method: 'DELETE', headers: { ...pgHeaders(key), Prefer: 'return=minimal' },
    });
  } catch (e) { console.warn(`[${FN}] track write failed:`, (e as Error).message); }
}
async function fetchTodayScore(url: string, key: string, userId: string): Promise<number | null> {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_daily_protocols?athlete_id=eq.${encodeURIComponent(userId)}&date=eq.${utcToday()}&select=readiness_score&limit=1`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows: any[] = await r.json().catch(() => []);
    return rows[0] ? num(rows[0].readiness_score) : null;
  } catch { return null; }
}
async function fetchServerPlan(url: string, key: string, userId: string): Promise<unknown | null> {
  try {
    const u = await fetch(`${url}/rest/v1/bbf_users?id=eq.${encodeURIComponent(userId)}&select=email&limit=1`, { headers: pgHeaders(key) });
    const uRows: any[] = u.ok ? await u.json().catch(() => []) : [];
    const email = uRows[0]?.email;
    if (!email) return null;
    const r = await fetch(
      `${url}/rest/v1/bbf_active_clients?vault_email=eq.${encodeURIComponent(email)}&select=workout_plan&limit=1`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows: any[] = await r.json().catch(() => []);
    const raw = String(rows[0]?.workout_plan ?? '').trim();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  } catch { return null; }
}

// Attach signed URLs to a stored (path-only) manifest.
async function signManifest(url: string, key: string, manifest: Record<string, any>): Promise<Record<string, any>> {
  const paths: string[] = [];
  for (const seg of manifest.timeline ?? []) if (seg.path) paths.push(seg.path);
  if (manifest.music?.path) paths.push(manifest.music.path);
  for (const inf of Object.values(manifest.inflections?.variants ?? {})) if ((inf as any)?.path) paths.push((inf as any).path);
  const signed = await signAll(url, key, paths);
  const withUrl = (o: any) => (o?.path && signed[o.path]) ? { ...o, url: signed[o.path] } : o;
  return {
    ...manifest,
    timeline: (manifest.timeline ?? []).map(withUrl),
    music: manifest.music ? withUrl(manifest.music) : null,
    inflections: manifest.inflections
      ? { ...manifest.inflections, variants: Object.fromEntries(Object.entries(manifest.inflections.variants ?? {}).map(([k, v]) => [k, withUrl(v)])) }
      : null,
    signed_ttl_s: SIGN_TTL_S,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  const AGENT_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  const locale = localeCode(payload?.locale ?? payload?.lang);
  const action = String(payload?.action || '').trim();

  // ═══ MODE · bake_inflections (admin perimeter, one-shot shared library) ═══════
  if (action === 'bake_inflections') {
    const sent = req.headers.get('x-bbf-admin-token');
    if (!AGENT_TOKEN || sent !== AGENT_TOKEN) return jsonResponse({ error: 'unauthorized' }, 401);
    if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured' }, 503);
    const res = await bakeInflections(SUPABASE_URL, SERVICE_KEY, ELEVENLABS_API_KEY);
    console.log(`[${FN}] bake_inflections baked=${res.baked} skipped=${res.skipped} failed=${res.failed}`);
    return jsonResponse({ ok: res.failed === 0, ...res });
  }

  // Everything below is athlete-facing → the fail-closed Apex gate.
  const vaultToken = payload?.vault_token ?? req.headers.get('x-bbf-vault-token');
  const gate = await requireEntitlement({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, vaultToken, feature: 'premium_audio' });
  if (!gate.ok) return jsonResponse({ error: gate.denial.error, detail: gate.denial.detail }, gate.denial.status);
  const userId = gate.ctx.user_id;
  const uid = gate.ctx.uid;

  // ═══ MODE · resign (signed-URL refresh for a live player — free) ══════════════
  if (action === 'resign') {
    const paths = (Array.isArray(payload?.paths) ? payload.paths : [])
      .map((p: unknown) => String(p || '').trim())
      .filter((p: string) => p && !p.includes('..')).slice(0, 200);
    if (!paths.length) return jsonResponse({ error: 'missing_paths' }, 400);
    return jsonResponse({ ok: true, urls: await signAll(SUPABASE_URL, SERVICE_KEY, paths), signed_ttl_s: SIGN_TTL_S });
  }

  // ═══ MODE · compose (default) ═════════════════════════════════════════════════
  const today = utcToday();
  const todayScore = await fetchTodayScore(SUPABASE_URL, SERVICE_KEY, userId);

  // CACHE-READ FIRST — a ready track for today at this score is free.
  const cached = await readTrack(SUPABASE_URL, SERVICE_KEY, userId, today, locale, todayScore);
  if (cached) {
    console.log(`[${FN}] track HIT uid=${uid} locale=${locale}`);
    return jsonResponse({ ok: true, cached: true, track: await signManifest(SUPABASE_URL, SERVICE_KEY, cached.manifest) });
  }

  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);

  // METER before any paid work (shared live-voice ledger — house RPCs).
  const pre = await callRpc(SUPABASE_URL, SERVICE_KEY, 'bbf_voice_session_precheck', { p_user_id: userId });
  if (!pre || pre.ok !== true) {
    const reason = String(pre?.reason || 'not_entitled');
    return jsonResponse(
      { error: reason, detail: reason === 'quota_exhausted' ? 'Monthly voice quota reached.' : 'Voice metering rejected the session.' },
      reason === 'quota_exhausted' ? 429 : 403,
    );
  }

  // PLAN — the client's parsed programming, else the server copy.
  const planRaw = Array.isArray(payload?.plan) ? payload.plan : await fetchServerPlan(SUPABASE_URL, SERVICE_KEY, userId);
  const day = pickToday(planRaw);
  const exercises = normalizeExercises(day);
  if (!exercises.length) return jsonResponse({ error: 'no_program', detail: 'No trainable programming found for today.' }, 404);
  const category = categoryFor(day);
  const zone = readinessZone(todayScore);
  const age = Math.max(14, Math.min(80, num(payload?.age) ?? 32));

  const { slots, blocks, musicBlocks, total_ms } = buildTimeline(exercises, category, zone, age);

  // SCRIPT → VOICE → MUSIC (music runs concurrently with the voice pool).
  const texts = ANTHROPIC_API_KEY
    ? await writeSessionScript(ANTHROPIC_API_KEY, locale, slots, exercises, zone)
    : {};
  const [voice, bed] = await Promise.all([
    resolveSegments({ url: SUPABASE_URL, key: SERVICE_KEY, eleven: ELEVENLABS_API_KEY, locale, slots, texts }),
    resolveMusicBed({ url: SUPABASE_URL, key: SERVICE_KEY, eleven: ELEVENLABS_API_KEY, musicBlocks, category, zone }),
  ]);

  const inflections = await readInflections(SUPABASE_URL, SERVICE_KEY, locale);
  const slotStart = new Map(slots.map((s) => [s.slot, s.start_ms]));
  const manifest = {
    day: today, locale, category, zone, plan_signature: bed.signature,
    total_duration_ms: total_ms,
    music: bed.path ? {
      path: bed.path, duration_ms: bed.duration_ms, loop: bed.loopable,
      crossfade_ms: bed.loopable ? 4000 : 0,
      duck_db: -12, duck_attack_ms: 250, duck_release_ms: 900,
    } : null,
    timeline: voice.segments.map((s) => ({
      slot: s.slot, path: s.path, start_ms: slotStart.get(s.slot) ?? 0,
      duration_ms: s.duration_ms, gap_after_ms: 400,
    })),
    degraded_slots: voice.failed, // client falls back to device TTS for these
    blocks,
    inflections: Object.keys(inflections).length ? {
      variants: inflections,
      policy: { hysteresis_s: 10, cooldown_s: 60, inject_at: 'seam_only' },
    } : null,
  };

  await writeTrack(SUPABASE_URL, SERVICE_KEY, {
    user_id: userId, session_day: today, locale, plan_signature: bed.signature,
    manifest, readiness_score: todayScore, total_duration_ms: total_ms, status: 'ready',
  });

  // Commit metering for the characters ACTUALLY synthesized (cache hits are free).
  const charsSynth = voice.segments.reduce((a, s) => a + s.chars_synthesized, 0);
  if (uid && charsSynth > 0) await callRpc(SUPABASE_URL, SERVICE_KEY, 'bbf_voice_session_commit', { p_uid: uid, p_tokens: charsSynth });

  console.log(`[${FN}] composed uid=${uid} locale=${locale} slots=${voice.segments.length} synth_chars=${charsSynth} bed=${bed.path ? 'ready' : 'none'} degraded=${voice.failed.length}`);
  return jsonResponse({ ok: true, cached: false, track: await signManifest(SUPABASE_URL, SERVICE_KEY, manifest) });
});
