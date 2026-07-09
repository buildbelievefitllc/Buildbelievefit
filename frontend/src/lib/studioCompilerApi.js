// src/lib/studioCompilerApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Studio V4 Ad Compiler — client for the bbf-studio-compiler edge function.
// Mirrors studioQueueApi.js's auth (the admin's vault SESSION token; no client
// secret) and error contract (throws a slug Error the caller humanizes).
//
// The actual MP4 encode happens in THIS browser (SovereignFoundry + the overlay
// canvas) — these calls are the surrounding state machine: create the job →
// sign an upload URL → PUT the finished blob → complete (or fail) the job.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

const COMPILER_FN = `${FUNCTIONS_BASE}/bbf-studio-compiler`;

function headers(token) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...(token ? { 'x-bbf-session-token': token } : {}),
  };
}

async function call(action, payload = {}) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('no_admin_session');
  const r = await fetch(COMPILER_FN, { method: 'POST', headers: headers(token), body: JSON.stringify({ action, ...payload }) });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || `${action}_${r.status}`);
  return j;
}

// { background_video_url, audio_track_url, hook_text?, sub_line_text?,
//   hook_font?, hook_font_size?, text_layout? } → { id, spec }
export function createCompileJob(payload) {
  return call('create', payload);
}

// { id } → { uploadUrl, bucket, path, contentType }
export function signCompileUpload(id) {
  return call('sign', { id });
}

// Uploads the rendered MP4 blob to the signed URL minted by signCompileUpload.
export async function uploadCompiledAsset(uploadUrl, blob) {
  const r = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: blob,
  });
  if (!r.ok) throw new Error(`upload_${r.status}`);
}

// { id, duration_sec? } → { output_url, duration_sec }
export function completeCompileJob(id, durationSec) {
  return call('complete', { id, duration_sec: durationSec });
}

// { id, error } — never silent; every render failure lands here.
export function failCompileJob(id, error) {
  return call('fail', { id, error: String(error || 'unknown').slice(0, 500) }).catch(() => null); // best-effort — a failed fail-report must never mask the original error
}

// { id } → { job }
export function getCompileJob(id) {
  return call('get', { id });
}

// { limit? } → { jobs }
export function listCompileJobs(limit = 25) {
  return call('list', { limit });
}
