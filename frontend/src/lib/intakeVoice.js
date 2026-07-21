// src/lib/intakeVoice.js
// ─────────────────────────────────────────────────────────────────────────────
// Client engine for the live conversational intake (/assessment).
//
//   • fetchIntakeVoice(key, lang) — resolve Coach Akeem's ElevenLabs MP3 URL for
//     an allowlisted prompt line via the public bbf-intake-voice edge function.
//     In-memory memoized (a line is fetched at most once per session/lang).
//
//   • createListener() — a thin, resilient wrapper over the Web Speech
//     SpeechRecognition API for single-shot spoken answers, with graceful
//     "unsupported" reporting so the UI can fall back to tap/type.
//
//   • parse*() — map a spoken transcript to the SAME canonical answer values the
//     tap wizard produces (focus id, units, ft/in/cm/weight numbers, availability
//     id, injury ids). Trilingual keyword tables (EN/ES/PT). These are best-effort
//     conveniences layered ON TOP of the always-visible tap controls — the visible
//     controls remain the source of truth, so a mis-parse never traps a user.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';

// ── 1 · Akeem voice URL resolver (memoized) ─────────────────────────────────
const _urlCache = new Map(); // `${lang}:${key}` → { url, text }

export async function fetchIntakeVoice(key, lang = 'en') {
  const cacheKey = `${lang}:${key}`;
  if (_urlCache.has(cacheKey)) return _urlCache.get(cacheKey);
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/bbf-intake-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ key, lang }),
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    if (!j || !j.ok || !j.url) return null;
    const out = { url: j.url, text: j.text || '' };
    _urlCache.set(cacheKey, out);
    return out;
  } catch {
    return null;
  }
}

// Kick off the network bake for a line without awaiting it (prefetch the next
// question's audio while the current one is playing).
export function prefetchIntakeVoice(key, lang = 'en') {
  fetchIntakeVoice(key, lang).catch(() => {});
}

// ── 2 · Speech-to-text (single-shot) ────────────────────────────────────────
export function sttSupported() {
  return typeof window !== 'undefined' &&
    (typeof window.SpeechRecognition === 'function' || typeof window.webkitSpeechRecognition === 'function');
}

const STT_LOCALE = { en: 'en-US', es: 'es-ES', pt: 'pt-BR' };

// Returns a handle { start, stop, supported }. `start(cbs)` runs one recognition
// pass; cbs = { onResult(transcript), onEnd(), onError(kind) }.
export function createListener(lang = 'en') {
  const Ctor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  if (!Ctor) return { supported: false, start() {}, stop() {} };

  let rec = null;
  let active = false;

  function stop() {
    active = false;
    if (rec) { try { rec.stop(); } catch { /* ignore */ } rec = null; }
  }

  function start({ onResult, onEnd, onError } = {}) {
    stop();
    try {
      rec = new Ctor();
    } catch {
      if (onError) onError('init');
      return;
    }
    rec.lang = STT_LOCALE[lang] || 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    active = true;

    rec.onresult = (e) => {
      let transcript = '';
      try { transcript = e.results[0][0].transcript || ''; } catch { /* ignore */ }
      if (onResult) onResult(transcript.trim());
    };
    rec.onerror = (e) => { if (onError) onError(e?.error || 'error'); };
    rec.onend = () => { active = false; rec = null; if (onEnd) onEnd(); };

    try { rec.start(); } catch { if (onError) onError('start'); }
  }

  return { supported: true, start, stop, get active() { return active; } };
}

// ── 3 · Natural-language answer parsers (trilingual) ─────────────────────────
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// focus id ← spoken phrase. Order matters: check more-specific intents first.
const FOCUS_MATCHERS = [
  { id: 'recomp', kw: ['recomp', 'recomposition', 'recomposicion', 'recomposicao', 'tone up', 'tonificar', 'tonificado', 'lose fat and build', 'lose fat and gain', 'both', 'ambos', 'ambas', 'os dois', 'lose fat and muscle'] },
  { id: 'fat_loss', kw: ['fat loss', 'lose fat', 'lose weight', 'weight loss', 'burn fat', 'cut', 'cutting', 'slim', 'leaner', 'get lean', 'perder grasa', 'bajar de peso', 'adelgazar', 'quemar grasa', 'perder peso', 'perder gordura', 'emagrecer', 'queimar gordura'] },
  { id: 'lean_muscle', kw: ['muscle', 'build muscle', 'gain muscle', 'bigger', 'mass', 'bulk', 'hypertrophy', 'size', 'musculo', 'ganar musculo', 'masa muscular', 'volumen', 'musculatura', 'ganhar musculo', 'hipertrofia', 'massa muscular'] },
  { id: 'strength', kw: ['strength', 'stronger', 'strong', 'power', 'lift heavy', 'powerlifting', 'fuerza', 'mas fuerte', 'potencia', 'forca', 'mais forte'] },
  { id: 'mobility', kw: ['mobility', 'mobile', 'flexible', 'flexibility', 'joint', 'joints', 'movement', 'pain free', 'movilidad', 'flexibilidad', 'articulacion', 'articulaciones', 'mobilidade', 'flexibilidade', 'articulacao'] },
  { id: 'general', kw: ['general', 'overall', 'health', 'healthy', 'fitness', 'not sure', 'everything', 'salud', 'en general', 'no estoy seguro', 'saude', 'nao sei', 'geral'] },
];
export function parseFocus(transcript) {
  const t = ` ${norm(transcript)} `;
  for (const m of FOCUS_MATCHERS) {
    if (m.kw.some((k) => t.includes(` ${norm(k)} `) || t.includes(norm(k)))) return m.id;
  }
  return null;
}

export function parseUnits(transcript) {
  const t = norm(transcript);
  if (/\b(metric|metrico|centimeter|centimetre|centimetro|kilo|kilogram|kilogramo|quilo|cm|kg)\b/.test(t)) return 'metric';
  if (/\b(imperial|feet|foot|inch|inches|pound|pounds|lb|lbs|pie|pies|pulgada|libra|libras|pe|pes|polegada)\b/.test(t)) return 'imperial';
  return null;
}

// Spoken small-number words → int (EN/ES/PT). Covers 0–99 + "hundred".
const WORDNUM = {
  zero: 0, oh: 0, cero: 0, one: 1, uno: 1, una: 1, um: 1, uma: 1, two: 2, dos: 2, dois: 2, duas: 2,
  three: 3, tres: 3, four: 4, cuatro: 4, quatro: 4, five: 5, cinco: 5, six: 6, seis: 6,
  seven: 7, siete: 7, sete: 7, eight: 8, ocho: 8, oito: 8, nine: 9, nueve: 9, nove: 9,
  ten: 10, diez: 10, dez: 10, eleven: 11, once: 11, onze: 11, twelve: 12, doce: 12, doze: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, veinte: 20, vinte: 20, thirty: 30, treinta: 30, trinta: 30, forty: 40, cuarenta: 40, quarenta: 40,
  fifty: 50, cincuenta: 50, cinquenta: 50, sixty: 60, sesenta: 60, sessenta: 60, seventy: 70, setenta: 70,
  eighty: 80, ochenta: 80, oitenta: 80, ninety: 90, noventa: 90, hundred: 100, cien: 100, ciento: 100, cem: 100, cento: 100,
};

// Pull an ordered list of integers out of a transcript, honoring both digit
// tokens ("175") and spoken words ("one seventy five", "a hundred and seventy").
export function numbersFromText(transcript) {
  const t = norm(transcript);
  const tokens = t.split(' ').filter(Boolean);
  const out = [];
  let acc = null;      // number being assembled from words
  let hundreds = 0;    // pending hundreds bucket

  const flush = () => {
    const total = hundreds + (acc || 0);
    if (hundreds || acc !== null) out.push(total);
    acc = null; hundreds = 0;
  };

  for (const tok of tokens) {
    if (/^\d+$/.test(tok)) {
      // Bare digits — if immediately after a digit, treat as separate numbers.
      flush();
      out.push(parseInt(tok, 10));
      continue;
    }
    if (tok === 'and' || tok === 'y' || tok === 'e') continue; // "a hundred AND ten"
    if (tok === 'a' || tok === 'an') continue;
    if (!(tok in WORDNUM)) { flush(); continue; }
    const val = WORDNUM[tok];
    if (val === 100) {
      hundreds = (acc || 1) * 100;
      acc = null;
    } else if (val >= 20) {
      acc = (acc || 0) + val; // tens
    } else {
      // units / teens — "one seventy five" style: if acc already has tens, add;
      // otherwise this could be a leading digit of a compound ("one" in 1-75).
      if (acc === null) acc = val; else acc += val;
    }
  }
  flush();
  return out;
}

// Height: returns a patch to {units, heightFt, heightIn, heightCm}. Uses the
// current units as a hint but self-corrects on explicit cm/ft/in cues.
export function parseHeight(transcript, currentUnits = 'imperial') {
  const t = norm(transcript);
  const nums = numbersFromText(transcript);
  if (!nums.length) return null;
  const saysCm = /\b(cm|centimeter|centimetre|centimetro|metric|metrico)\b/.test(t);
  const saysImperial = /\b(feet|foot|ft|inch|inches|pie|pies|pulgada|pe|pes|polegada)\b/.test(t);
  const units = saysCm ? 'metric' : saysImperial ? 'imperial' : currentUnits;

  if (units === 'metric') {
    const cm = nums.find((n) => n >= 120 && n <= 230) ?? nums[0];
    return { units, heightCm: String(cm) };
  }
  // imperial — first plausible feet (3–7), then inches (0–11)
  const ft = nums.find((n) => n >= 3 && n <= 7);
  if (ft == null) {
    // a lone big number in imperial mode is probably cm spoken → store as cm
    const big = nums.find((n) => n >= 120 && n <= 230);
    if (big != null) return { units: 'metric', heightCm: String(big) };
    return null;
  }
  const after = nums.slice(nums.indexOf(ft) + 1);
  const inch = after.find((n) => n >= 0 && n <= 11);
  return { units, heightFt: String(ft), heightIn: inch != null ? String(inch) : '0' };
}

// A single weight value (current or target). Picks the most plausible bodyweight.
export function parseWeight(transcript) {
  const nums = numbersFromText(transcript);
  if (!nums.length) return null;
  // Prefer a realistic bodyweight range; else the largest number spoken.
  const plausible = nums.filter((n) => n >= 30 && n <= 500);
  const v = plausible.length ? plausible[plausible.length - 1] : nums[nums.length - 1];
  return v > 0 ? String(v) : null;
}

// Metrics: best-effort single-utterance parse of height + current/target weight.
// Returns a patch to the answers bucket. Height numbers are consumed first so the
// remaining numbers can be read as bodyweights; a "target/goal/aiming" cue routes
// a weight to targetWeight. Anything ambiguous is simply left for the visible
// inputs to capture — this never overwrites a field it can't confidently fill.
export function parseMetrics(transcript, currentUnits = 'imperial') {
  const t = norm(transcript);
  const patch = {};
  const h = parseHeight(transcript, currentUnits);
  if (h) Object.assign(patch, h);
  const units = patch.units || currentUnits;

  // Collect the numbers the height parse already used, to exclude them.
  const used = new Set();
  if (patch.heightFt) used.add(Number(patch.heightFt));
  if (patch.heightIn) used.add(Number(patch.heightIn));
  if (patch.heightCm) used.add(Number(patch.heightCm));

  const nums = numbersFromText(transcript);
  const lo = units === 'metric' ? 30 : 60;
  const hi = units === 'metric' ? 300 : 600;
  const weights = [];
  for (const n of nums) {
    if (used.has(n)) { used.delete(n); continue; } // skip one occurrence of each height number
    if (n >= lo && n <= hi) weights.push(n);
  }
  if (weights.length) {
    const wantsTarget = /\b(target|goal|aiming|aim|want to be|get to|meta|objetivo|llegar|alvo|chegar|quero)\b/.test(t);
    if (weights.length >= 2) {
      patch.weight = String(weights[0]);
      patch.targetWeight = String(weights[1]);
    } else if (wantsTarget) {
      patch.targetWeight = String(weights[0]);
    } else {
      patch.weight = String(weights[0]);
    }
  }
  return Object.keys(patch).length ? patch : null;
}

// Weekly availability id (matches AVAILABILITY_OPTIONS: 2,3,4,5,6plus).
export function parseAvailability(transcript) {
  const t = norm(transcript);
  if (/\b(six|6|seis)\b.*\b(plus|more|or more)\b/.test(t) || /\b(seven|eight|nine|7|8|9|siete|ocho|sete|oito)\b/.test(t) || /\b(every ?day|everyday|todos los dias|todos os dias)\b/.test(t)) return '6plus';
  const nums = numbersFromText(transcript);
  const day = nums.find((n) => n >= 2 && n <= 9);
  if (day == null) return null;
  if (day >= 6) return '6plus';
  return String(day);
}

// Injury ids (matches INJURY_OPTIONS). Multi-select; "none" is exclusive.
const INJURY_MATCHERS = [
  { id: 'none', kw: ['none', 'no injuries', 'no injury', 'nothing', 'im good', 'all good', 'healthy', 'no pain', 'ninguna', 'ninguno', 'nada', 'estoy bien', 'sin lesiones', 'nenhuma', 'nenhum', 'estou bem', 'sem lesao', 'sem lesoes'] },
  { id: 'knee', kw: ['knee', 'knees', 'rodilla', 'rodillas', 'joelho', 'joelhos'] },
  { id: 'shoulder', kw: ['shoulder', 'shoulders', 'rotator cuff', 'hombro', 'hombros', 'ombro', 'ombros'] },
  { id: 'lower_back', kw: ['lower back', 'back', 'lumbar', 'spine', 'espalda', 'espalda baja', 'zona lumbar', 'costas', 'lombar', 'coluna'] },
  { id: 'hip', kw: ['hip', 'hips', 'cadera', 'caderas', 'quadril', 'quadris'] },
  { id: 'ankle', kw: ['ankle', 'ankles', 'tobillo', 'tobillos', 'tornozelo', 'tornozelos'] },
  { id: 'wrist_elbow', kw: ['wrist', 'wrists', 'elbow', 'elbows', 'muneca', 'munecas', 'codo', 'codos', 'pulso', 'punho', 'cotovelo', 'cotovelos'] },
  { id: 'neck', kw: ['neck', 'cervical', 'cuello', 'pescoco'] },
];
export function parseInjuries(transcript) {
  const t = ` ${norm(transcript)} `;
  // "none" wins outright.
  if (INJURY_MATCHERS[0].kw.some((k) => t.includes(` ${norm(k)} `))) return ['none'];
  const found = [];
  for (let i = 1; i < INJURY_MATCHERS.length; i++) {
    const m = INJURY_MATCHERS[i];
    if (m.kw.some((k) => t.includes(norm(k)))) found.push(m.id);
  }
  return found.length ? found : null;
}
