// src/lib/studioQueueApi.js
// ─────────────────────────────────────────────────────────────────────────────
// FRONT 5 — Sovereign Studio auto-post + queue-monitor data layer. Ports the V3
// "Queue this post / Post now" pipeline to React and adds a queue listing for the
// monitor. Talks to the admin-gated bbf-studio-queue Edge Function:
//   sign  → mint a one-shot signed upload URL (server generates id + path)
//   PUT   → upload the baked asset directly to Storage
//   confirm (+now) → server HEADs the asset, writes the queued row, and — when
//                    now:true — fires the matching distributor (image→cards,
//                    video→reel) to publish to IG/FB immediately.
//   list  → recent jobs across both batch tables (for the monitor).
// Auth is the admin's vault SESSION token (validated server-side); no client secret.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

const QUEUE_FN = `${FUNCTIONS_BASE}/bbf-studio-queue`;

function qHeaders(token) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...(token ? { 'x-bbf-session-token': token } : {}),
  };
}

// kind: 'image' | 'video'; fields: { headline, body, eye_label, cta, caption,
// color_palette, platform_target }; getBlob: async () => Blob; now: publish-now.
// Returns { status: 'queued' | 'posting' | 'posted', id, async? }. Throws a
// slug Error on failure (the caller humanizes it).
export async function queuePost({ kind, fields = {}, getBlob, now = false }) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('no_admin_session');

  const blob = await getBlob();
  if (!blob || !blob.size) throw new Error('empty_asset');

  // 1) sign — server generates the id + path
  const sr = await fetch(QUEUE_FN, { method: 'POST', headers: qHeaders(token), body: JSON.stringify({ action: 'sign', kind }) });
  if (sr.status === 401 || sr.status === 403) throw new Error('not_admin');
  const sj = await sr.json().catch(() => null);
  if (!sr.ok || !sj || !sj.ok || !sj.uploadUrl) throw new Error((sj && sj.error) || `sign_${sr.status}`);

  // 2) upload the baked asset to the one-shot signed URL
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

  // 3) confirm (+now) — server verifies, writes the row, optionally distributes
  const cr = await fetch(QUEUE_FN, {
    method: 'POST',
    headers: qHeaders(token),
    body: JSON.stringify({ action: 'confirm', id: sj.id, kind, now: !!now, ...fields }),
  });
  const cj = await cr.json().catch(() => null);

  if (now) {
    if (cj && cj.status === 'posting' && cj.async) return { status: 'posting', id: sj.id, async: true };
    if (cj && cj.status === 'posted') return { status: 'posted', id: sj.id };
    throw new Error((cj && cj.error) || `post_${cr.status}`);
  }
  if (!cr.ok || !cj || !cj.ok) throw new Error((cj && cj.error) || `queue_${cr.status}`);
  return { status: 'queued', id: sj.id };
}

// Poll a backgrounded POST NOW (reel transcode) until posted/failed.
// Returns 'posted' | 'failed' | 'timeout'. ~3.5 min budget @ 5s.
export async function pollPostStatus({ kind, id }) {
  const token = getStoredVaultToken();
  const deadline = Date.now() + 210000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const r = await fetch(QUEUE_FN, { method: 'POST', headers: qHeaders(token), body: JSON.stringify({ action: 'poststatus', id, kind }) });
      const j = await r.json().catch(() => null);
      if (j && j.ok) {
        if (j.status === 'posted') return 'posted';
        if (j.status === 'failed') return 'failed';
      }
    } catch { /* transient — keep polling */ }
  }
  return 'timeout';
}

// Recent jobs across both batch tables → { ok, jobs:[{id,kind,status,headline,…}], counts }.
export async function fetchQueue({ limit = 25 } = {}) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('no_admin_session');
  const r = await fetch(QUEUE_FN, { method: 'POST', headers: qHeaders(token), body: JSON.stringify({ action: 'list', limit }) });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || `list_${r.status}`);
  return j;
}
