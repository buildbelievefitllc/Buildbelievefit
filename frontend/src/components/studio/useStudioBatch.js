// src/components/studio/useStudioBatch.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.3 — Content Studio V4 batch hook (CONTENT_STUDIO_V4 §render pipeline).
//
// Admin-token gated (X-BBF-Admin-Token — the SAME Command-Center pattern the
// Immersion Wrapper uses; bbf-studio-batch-compiler gates on authorizeAdmin).
// Takes an ARRAY of job specs, mints the client UUID PK for each (idempotency:
// the compiler upserts ON CONFLICT (id) DO NOTHING), POSTs the batch, and returns
// the compiled timeline payloads.
//
// @typedef {Object} StudioJobSpec
// @property {string} [id] @property {string} [preset_id] @property {'reel'|'card'|'audio_brief'} [kind]
// @property {'social'|'directed'} [audience] @property {string} [target_athlete_id]
// @property {'en'|'es'|'pt'} [locale] @property {'high'|'mid'|'low'} [device_class]
// @property {'A'|'B'|'C'} [lane] @property {Object<string,number>} [gram_override]
//
// @typedef {Object} CompiledJob  // one entry of the compiler's jobs[]
// @property {string} id @property {string} status @property {string} [kind] @property {string} [locale]
// @property {string} [audience] @property {boolean} [binding_demo] @property {boolean} [binding_override]
// @property {Object} [ladder] @property {string|null} [lane] @property {Object} [timeline] @property {string} [reason]

import { useCallback, useState } from 'react';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../../lib/supabaseClient.js';
import { getCoachAdminToken, hasAdminToken } from '../../lib/adminAuth.js';

function mintId() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch { /* fallthrough */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.floor((performance.now() * 1000) % 16) + Math.floor((Date.now() % 16))) % 16;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Admin-token-gated POST to the batch compiler (rosterApi gateway header pattern).
async function postBatch(jobs) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) { headers.apikey = SUPABASE_ANON_KEY; headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`; }
  const token = getCoachAdminToken();
  if (token) headers['X-BBF-Admin-Token'] = token;
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/bbf-studio-batch-compiler`, { method: 'POST', headers, body: JSON.stringify({ jobs }) });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }
    if (!res.ok) return { ok: false, status: res.status, error: (data && data.error) || 'request_failed' };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 0, error: String((e && e.message) || e) };
  }
}

/**
 * @returns {{ compiling:boolean, error:string|null, results:CompiledJob[], mirrored:number, authed:boolean,
 *            compile:(specs:StudioJobSpec|StudioJobSpec[])=>Promise<Object>, reset:()=>void }}
 */
export function useStudioBatch({ isAdmin = false } = {}) {
  const [state, setState] = useState({ compiling: false, error: null, results: [], mirrored: 0 });

  // Authorized when the session carries the founder/admin role OR a token is hydrated.
  // The founder/admin role alone unlocks the compile utilities (the compiler re-gates
  // server-side); a raw token still works for injected/legacy sessions.
  const authed = isAdmin || hasAdminToken();

  const compile = useCallback(async (specs) => {
    if (!(isAdmin || hasAdminToken())) { setState((s) => ({ ...s, error: 'unauthorized' })); return { ok: false, error: 'unauthorized' }; }
    const list = (Array.isArray(specs) ? specs : [specs]).filter(Boolean);
    if (!list.length) { setState((s) => ({ ...s, error: 'no_jobs' })); return { ok: false, error: 'no_jobs' }; }

    // Normalize each spec to the compiler contract + mint the client UUID PK. Drop
    // empty/undefined keys so the compiler's defaults (is_default preset, etc.) apply.
    const jobs = list.map((j) => {
      const job = { id: j.id || mintId(), kind: j.kind || 'reel' };
      if (j.preset_id) job.preset_id = j.preset_id;
      if (j.audience) job.audience = j.audience;
      if (j.target_athlete_id) job.target_athlete_id = j.target_athlete_id;
      if (j.locale) job.locale = j.locale;
      if (j.device_class) job.device_class = j.device_class;
      if (j.lane) job.lane = j.lane;
      if (j.gram_override && Object.keys(j.gram_override).length) job.gram_override = j.gram_override;
      return job;
    });

    setState((s) => ({ ...s, compiling: true, error: null }));
    const res = await postBatch(jobs);
    if (!res.ok) {
      setState({ compiling: false, error: res.status === 401 ? 'unauthorized' : res.error, results: [], mirrored: 0 });
      return res;
    }
    const jobsOut = Array.isArray(res.data.jobs) ? res.data.jobs : [];
    setState({ compiling: false, error: null, results: jobsOut, mirrored: Number(res.data.mirrored) || 0 });
    return { ok: true, jobs: jobsOut, mirrored: Number(res.data.mirrored) || 0 };
  }, [isAdmin]);

  const reset = useCallback(() => setState({ compiling: false, error: null, results: [], mirrored: 0 }), []);

  return { ...state, compile, reset, authed };
}
