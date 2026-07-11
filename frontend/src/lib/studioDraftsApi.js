// src/lib/studioDraftsApi.js
// ─────────────────────────────────────────────────────────────────────────────
// VAULT EXPORT HISTORY — data layer for the Studio V4 draft vault. Every finished
// client-side export (reel MP4 / card JPEG) is pushed to the PRIVATE
// studio-drafts-v1 bucket so a phone-side download failure (the S25 Ultra field
// failure) never loses a render: render on the phone, retrieve on the laptop.
// Talks to the admin-gated bbf-studio-drafts Edge Function:
//   sign     → mint a one-shot signed upload URL (server generates id + path)
//   PUT      → upload the baked blob directly to Storage
//   confirm  → server HEADs the private object and writes the ledger row
//   list     → recent drafts (the HISTORY tab)
//   download → short-lived signed URL (Content-Disposition: attachment)
//   delete   → remove blob + row
// Auth is the admin's vault SESSION token (validated server-side); no client secret.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';
import { isMobileish } from './exportDelivery.js';

const DRAFTS_FN = `${FUNCTIONS_BASE}/bbf-studio-drafts`;

function dHeaders(token) {
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
  const r = await fetch(DRAFTS_FN, {
    method: 'POST',
    headers: dHeaders(token),
    body: JSON.stringify({ action, ...payload }),
  });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || `${action}_${r.status}`);
  return j;
}

// Persist a finished export to the vault. kind: 'image' | 'video'; blob is the
// baked asset; meta carries { file_name, mode, caption, duration_sec, frames }.
// Returns { id }. Throws a slug Error on failure (callers treat it best-effort —
// the local download path must never be blocked by a vault hiccup).
export async function saveDraft({ kind, blob, meta = {} }) {
  if (!blob || !blob.size) throw new Error('empty_asset');

  // 1) sign — server generates the id + private-bucket path
  const sj = await call('sign', { kind });
  if (!sj.uploadUrl) throw new Error('sign_no_url');

  // 2) upload the blob to the one-shot signed URL
  const ur = await fetch(sj.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': sj.contentType || blob.type || 'application/octet-stream',
      'x-upsert': 'true',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: blob,
  });
  if (!ur.ok) throw new Error(`upload_${ur.status}`);

  // 3) confirm — server verifies the object landed and writes the ledger row
  await call('confirm', {
    id: sj.id,
    kind,
    file_name: meta.file_name || null,
    mode: meta.mode || null,
    caption: meta.caption || null,
    duration_sec: meta.duration_sec ?? null,
    frames: meta.frames ?? null,
    source_device: isMobileish() ? 'mobile' : 'desktop',
  });
  return { id: sj.id };
}

// Recent drafts for the HISTORY tab → { drafts: [{ id, kind, file_name, bytes, … }] }.
export async function listDrafts({ limit = 50 } = {}) {
  return call('list', { limit });
}

// Short-lived signed download URL → { url, file_name, content_type }.
export async function getDraftDownloadUrl(id) {
  return call('download', { id });
}

// Permanently remove a draft (blob + ledger row).
export async function deleteDraft(id) {
  return call('delete', { id });
}

// Promote a stored draft into the auto-post pipeline — SERVER-SIDE copy + queued
// batch row (the device never re-uploads anything). now:true fires the distributor
// immediately: images return a synchronous verdict; videos return status 'posting'
// with a queue_id to poll via studioQueueApi.pollPostStatus.
export async function promoteDraft({ id, now = false }) {
  return call('promote', { id, now });
}
