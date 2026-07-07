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
// accent hues so the monthly grid reads as a rapid visual audit of the mix.
export const SERIES_META = {
  'Mindset Engine': { color: '#6a0dad', vibe: 'the_architect' },
  'Form Fix':       { color: '#f5c800', vibe: 'the_mechanic' },
  'Fuel Protocol':  { color: '#12b886', vibe: 'real_talk' },
  'Recovery Lab':   { color: '#4dabf7', vibe: 'the_sanctuary' },
};
const FALLBACK_META = { color: '#8a8f98', vibe: 'the_architect' };
export const seriesMeta = (series) => SERIES_META[series] || FALLBACK_META;

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

// STEP 2a — bake the Akeem MP3 from the EXACT script (provided_script → no LLM).
// Returns { url, slug, cached }. Throws a slug Error on failure.
export async function synthesizeVoiceover({ script, series, topic }) {
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
      lang: 'en',
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

// Full "Approve & Synthesize" orchestration — bake audio, then queue the row.
export async function approveAndSynthesize(draft, { scheduled_at } = {}) {
  const audio = await synthesizeVoiceover({
    script: draft.voiceover_script,
    series: draft.series,
    topic: draft.hook || draft.target_angle || draft.series,
  });
  const item = await approveContentItem({
    series: draft.series,
    target_angle: draft.target_angle,
    hook: draft.hook,
    caption: draft.caption,
    studio_recipe: draft.studio_recipe,
    voiceover_script: draft.voiceover_script,
    audio_url: audio.url,
    audio_slug: audio.slug,
    scheduled_at,
    source_ref: draft.id,
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
