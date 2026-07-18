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

// ── Transient-drop hardening for the one-shot signed PUT ─────────────────────
// Mobile sockets routinely drop mid-upload. A dropped/aborted fetch REJECTS
// (TypeError / AbortError) with NO HTTP response — cleanly distinguishable from
// an explicit server status. We retry ONLY those network-level failures, up to
// 3 times with 1s→2s→4s exponential backoff, then surface `upload_0`.
//
// An explicit server status (413/500/401/…) is NEVER retried: it fails closed
// and bubbles up as `upload_<code>`, so a decisive rejection can't be masked and
// a genuine 413 (asset too large) surfaces immediately. The PUT targets an
// idempotent upsert (x-upsert:true), so replaying the SAME blob + headers is
// safe and cannot double-submit.
const MAX_UPLOAD_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function putSignedAssetWithBackoff(uploadUrl, headers, blob) {
  for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt += 1) {
    try {
      const ur = await fetch(uploadUrl, { method: 'PUT', headers, body: blob });
      if (!ur.ok) throw new Error(`upload_${ur.status}`); // explicit server status → fail closed
      return ur;
    } catch (e) {
      // A carried `upload_<code>` slug is a decisive server status — never retry it.
      if (typeof e?.message === 'string' && /^upload_\d+$/.test(e.message)) throw e;
      // Transient network failure (dropped socket / TypeError / abort).
      if (attempt >= MAX_UPLOAD_RETRIES) throw new Error('upload_0', { cause: e }); // retries exhausted
      await sleep(2 ** attempt * 1000); // back off 1s → 2s → 4s, then replay the same blob
    }
  }
  throw new Error('upload_0'); // unreachable — the loop returns or throws
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

  // 2) upload the baked asset to the one-shot signed URL — retried with
  //    exponential backoff against transient mobile socket drops. Explicit
  //    server statuses (413/…) still fail closed; the idempotent upsert makes
  //    a replayed PUT safe (no double-submit).
  await putSignedAssetWithBackoff(
    sj.uploadUrl,
    {
      'Content-Type': sj.contentType || blob.type || 'application/octet-stream',
      'x-upsert': 'true',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    blob,
  );

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

// Retry a FAILED job — flips it back to queued; now:true re-fires the distributor
// immediately. Safe against double-posting: the distributors replay the row's
// post_refs, so channels that already confirmed 200 are skipped and only the
// missing ones fire. Returns { status: 'queued'|'posting'|'posted'|'failed', … }.
export async function retryPost({ kind, id, now = true }) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('no_admin_session');
  const r = await fetch(QUEUE_FN, { method: 'POST', headers: qHeaders(token), body: JSON.stringify({ action: 'retry', kind, id, now }) });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok === false) throw new Error((j && j.error) || `retry_${r.status}`);
  return j;
}

// Cancel a still-QUEUED job — removes the row and its uploaded asset before the
// drip picks it up. Rows already posting/posted are past the point of recall.
export async function cancelPost({ kind, id }) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('no_admin_session');
  const r = await fetch(QUEUE_FN, { method: 'POST', headers: qHeaders(token), body: JSON.stringify({ action: 'cancel', kind, id }) });
  if (r.status === 401 || r.status === 403) throw new Error('not_admin');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok === false) throw new Error((j && j.error) || `cancel_${r.status}`);
  return j;
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
