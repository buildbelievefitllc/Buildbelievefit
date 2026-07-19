// src/lib/contentManagerApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Digital Content Manager data layer. The panel ingests the STATIC
// bbf_master_content_engine.json library (no live LLM). This module wires the two
// admin-gated backends that DO run on an explicit operator click:
//
//   1. bbf-studio-voiceover  — the ONLY external API. On "Approve & Synthesize" we
//      send the draft's voiceover_script as `provided_script` (verbatim, no LLM) and
//      get back the baked Coach Akeem MP3 URL (API-margin protection: cache-keyed,
//      never re-billed).
//   2. bbf-content-manager   — persists the finalized, SCHEDULABLE row into
//      bbf_content_manager_queue (approve), feeds the calendar (list), and updates a
//      row's scheduled_at when a block is dragged (reschedule — the drag-drop "RPC").
//
// Auth is the admin's vault SESSION token (validated server-side); no client secret.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

const VOICEOVER_FN = `${FUNCTIONS_BASE}/bbf-studio-voiceover`;
const MANAGER_FN = `${FUNCTIONS_BASE}/bbf-content-manager`;

// Series → calendar color + Akeem voice vibe. Mindset Engine = BBF Purple and
// Form Fix = BBF Gold are LOCKED by the CEO spec; the rest get distinct, on-brand
// accent hues so the monthly grid reads as a rapid visual audit of the mix. The
// vibe drives the ElevenLabs delivery physics per content type.
export const SERIES_META = {
  'Mindset Engine':   { color: '#6a0dad', vibe: 'the_architect' },  // philosophy → Architect
  'Form Fix':         { color: '#f5c800', vibe: 'the_mechanic' },   // biomechanics → Mechanic
  'Prehab Architect': { color: '#4dabf7', vibe: 'the_mechanic' },   // technical prehab → Mechanic
  'Recovery Mode':    { color: '#20c997', vibe: 'the_sanctuary' },  // down-regulate → Sanctuary
  'Fuel Files':       { color: '#fd7e14', vibe: 'real_talk' },      // nutrition → Real Talk
};
const FALLBACK_META = { color: '#8a8f98', vibe: 'the_architect' };
export const seriesMeta = (series) => SERIES_META[series] || FALLBACK_META;

// Pick a legible foreground (near-black or white) for a series-colored chip, by
// perceived luminance — so the dark BBF Purple gets white text while Gold/Orange/
// Teal keep near-black. Threshold tuned so #6a0dad → white, the rest → ink.
export function readableText(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length < 6) return '#0e0a16';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#0e0a16' : '#fff';
}

function headers(token) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...(token ? { 'x-bbf-session-token': token } : {}),
  };
}

function requireToken() {
  const token = getStoredVaultToken();
  if (!token) throw new Error('no_admin_session');
  return token;
}

// Estimate a target duration (s) from the script length so the voiceover pacing
// (~2.5 words/sec, mirrored server-side) lands near the spoken runtime.
function estimateDuration(script) {
  const words = String(script || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.min(180, Math.round(words / 2.5)));
}

const LANG_RE = /^(en|es|pt)$/;
const normLang = (l) => { const v = String(l || 'en').trim().toLowerCase(); return LANG_RE.test(v) ? v : 'en'; };

// STEP 2a — bake the Akeem MP3 from the EXACT script (provided_script → no LLM).
// Returns { url, slug, cached }. Throws a slug Error on failure. `lang` locks the
// voice (and cache key) to the post's EN/ES/PT so pronunciation matches the copy.
export async function synthesizeVoiceover({ script, series, topic, lang }) {
  const token = requireToken();
  const clean = String(script || '').trim();
  if (!clean) throw new Error('empty_script');
  const { vibe } = seriesMeta(series);
  const r = await fetch(VOICEOVER_FN, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      topic: String(topic || series || 'BBF').slice(0, 120),
      series,
      vibe,
      lang: normLang(lang),
      target_duration: estimateDuration(clean),
      provided_script: clean, // voice our words verbatim — the ONLY external API call
    }),
  });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok || !j.url) throw new Error((j && (j.error || j.detail)) || `synth_${r.status}`);
  return { url: j.url, slug: j.slug, cached: !!j.cached };
}

// STEP 2b — persist the finalized, scheduled row. Returns the inserted item.
export async function approveContentItem(payload) {
  const token = requireToken();
  const r = await fetch(MANAGER_FN, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ action: 'approve', ...payload }),
  });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error((j && (j.error || j.detail)) || `approve_${r.status}`);
  return j.item;
}

// Full "Approve & Synthesize" orchestration — bake audio (when the draft carries a
// voiceover script), then queue the row. Outreach posts with no reel_kit skip the
// ElevenLabs call entirely and schedule as text/visual-only (audio stays null).
export async function approveAndSynthesize(draft, { scheduled_at } = {}) {
  const script = String(draft.voiceover_script || '').trim();
  let audio = null;
  if (script) {
    // ── INTELLIGENT ASSET PROTECTION · short-circuit ─────────────────────────
    // If the draft EXPLICITLY declares a pre-baked static asset AND the operator
    // hasn't touched the script, we already own this clip — bypass ElevenLabs
    // entirely (0 credits, no round-trip) and flag it READY. We match on an
    // explicit field ONLY (never a filename guess), so a static file can never
    // mis-bind to the wrong post. Any script edit (`script_dirty`) forces a fresh
    // synth so the spoken audio always matches the copy that shipped.
    const staticUrl = String(draft.static_audio_url || '').trim();
    if (staticUrl && !draft.script_dirty) {
      audio = { url: staticUrl, slug: draft.static_audio_slug || null, cached: true, static: true };
    } else {
      audio = await synthesizeVoiceover({
        script,
        series: draft.series,
        topic: draft.hook || draft.target_angle || draft.series,
        lang: draft.language,
      });
    }
  }
  const item = await approveContentItem({
    series: draft.series,
    target_angle: draft.target_angle,
    hook: draft.hook,
    caption: draft.caption,
    studio_recipe: draft.studio_recipe,
    voiceover_script: script || null,
    cut_sheet: draft.cut_sheet,
    language: draft.language,
    format: draft.format,
    hashtags: draft.hashtags,
    recommended_post_time: draft.recommended_post_time,
    audio_url: audio?.url || null,
    audio_slug: audio?.slug || null,
    scheduled_at,
    source_ref: draft.id,
    // Algorithmic Distribution Engine metadata (additive; forwarded verbatim —
    // the server persists what its schema knows and ignores the rest).
    approval_status: draft.approval_status ?? null,
    algorithmic_target: draft.algorithmic_target ?? null,
    pacing_strategy: draft.pacing_strategy ?? null,
    platform_specifics: draft.platform_specifics ?? null,
  });
  return { item, audio };
}

// Calendar feed — every scheduled row (soonest first).
export async function fetchContentQueue() {
  const token = requireToken();
  const r = await fetch(MANAGER_FN, { method: 'POST', headers: headers(token), body: JSON.stringify({ action: 'list' }) });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error((j && (j.error || j.detail)) || `list_${r.status}`);
  return Array.isArray(j.items) ? j.items : [];
}

// Drag-drop reschedule — update a row's scheduled_at (the calendar "RPC").
export async function rescheduleContentItem({ id, scheduled_at }) {
  const token = requireToken();
  const r = await fetch(MANAGER_FN, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ action: 'reschedule', id, scheduled_at }),
  });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error((j && (j.error || j.detail)) || `reschedule_${r.status}`);
  return j.item;
}
