// supabase/functions/bbf-studio-asset-upload/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// SOVEREIGN STUDIO · USER-ASSET UPLOAD (cross-device durability)
// ───────────────────────────────────────────────────────────────────────────
// Mints a one-shot SIGNED upload URL so the Studio browser can PUT a user-uploaded
// voiceover (an ElevenLabs / Sovereign Studio render) straight into the PUBLIC
// `studio-audio-vault` bucket — the SAME bucket the generated voices live in — and
// get back a durable public URL. That URL then rides the reel's voUrl on ANY
// device, exactly like a generated voice, instead of a device-local blob.
//
// Deliberately small + self-contained: no model-router / ElevenLabs / Anthropic
// deps, so it deploys cleanly and can never disturb the live voiceover-generation
// function. Same admin perimeter as the rest of the Command Center — a valid admin
// vault/session token, or the server-to-server shared secret. verify_jwt:false (the
// body/header carries the session token; we validate it ourselves).
//
// Secrets (Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BBF_COACH_AGENT_TOKEN (opt).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const FN = 'bbf-studio-asset-upload';
const BUCKET = 'studio-audio-vault';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-bbf-session-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// ── admin gate (identical to bbf-studio-voiceover) ──────────────────────────
async function uidFromToken(url: string, key: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/_bbf_uid_from_vault_token`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify({ p_session_token: token }) });
    if (!r.ok) return null;
    const v = await r.json().catch(() => null);
    return (typeof v === 'string' && v) ? v : (Array.isArray(v) && v.length ? String(v[0]) : null);
  } catch { return null; }
}
async function isGodModeUser(url: string, key: string, userId: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_users?id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&select=uid,role,access_status&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return false;
    const rows = await r.json().catch(() => null);
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u || String(u.access_status || '') === 'locked') return false;
    const role = String(u.role || '').toLowerCase();
    return role === 'admin' || role === 'trainer' || role === 'coach' || String(u.uid || '').toLowerCase() === 'akeem';
  } catch { return false; }
}
async function isAuthorized(req: Request, payload: any, url: string, key: string): Promise<boolean> {
  const shared = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';
  const adminHdr = req.headers.get('x-bbf-admin-token') || '';
  if (shared && adminHdr && adminHdr === shared) return true; // server-to-server
  const token = String(payload?.vault_token || req.headers.get('x-bbf-vault-token') || req.headers.get('x-bbf-session-token') || '').trim();
  if (!token) return false;
  const uid = await uidFromToken(url, key, token);
  if (!uid) return false;
  return isGodModeUser(url, key, uid);
}

// ── storage (service role · PUBLIC bucket) ──────────────────────────────────
function publicObjectUrl(url: string, path: string): string {
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}
async function ensureBucket(url: string, key: string): Promise<void> {
  try {
    const r = await fetch(`${url}/storage/v1/bucket`, {
      method: 'POST', headers: pgHeaders(key),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
    if (!r.ok && r.status !== 409) {
      const t = (await r.text().catch(() => '')).toLowerCase();
      if (!t.includes('already exists') && !t.includes('duplicate')) console.warn(`[${FN}] ensureBucket ${r.status}: ${t.slice(0, 160)}`);
    }
  } catch (e) { console.warn(`[${FN}] ensureBucket error:`, String((e as Error)?.message ?? e)); }
}
async function mintSignedUpload(url: string, key: string, path: string): Promise<string> {
  // Auth-only headers (NO Content-Type) — the create-signed-upload route is a
  // bodyless POST and rejects an empty application/json body (Fastify 400).
  const r = await fetch(`${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`sign_${r.status}:${(await r.text().catch(() => '')).slice(0, 200)}`);
  const j = await r.json().catch(() => null) as { url?: string } | null;
  const raw = String(j?.url ?? '');
  if (!raw) throw new Error('sign_no_url');
  return /^https?:\/\//.test(raw)
    ? raw
    : raw.startsWith('/storage/v1')
      ? `${url}${raw}`
      : `${url}/storage/v1${raw.startsWith('/') ? raw : '/' + raw}`;
}

// Allowed uploaded-voiceover containers → the extension stored in the bucket. Kept
// tight so the signed-upload slot can't be used to stash arbitrary blobs.
const VO_UPLOAD_EXT: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/wave': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac',
  'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/flac': 'flac',
};

// ── handler ─────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'backend_unconfigured', detail: 'Storage/identity not configured.' }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  if (!(await isAuthorized(req, payload, SUPABASE_URL, SERVICE_KEY))) {
    return jsonResponse({ error: 'not_admin', detail: 'Studio asset upload is restricted to the administrative tier.' }, 401);
  }

  const action = String(payload?.action || 'upload_voiceover');
  if (action !== 'upload_voiceover') return jsonResponse({ error: 'unknown_action', detail: `Unsupported action "${action}".` }, 400);

  const contentType = String(payload?.content_type || '').toLowerCase().split(';')[0].trim();
  const ext = VO_UPLOAD_EXT[contentType];
  if (!ext) return jsonResponse({ error: 'unsupported_audio', detail: `Unsupported audio type "${contentType || 'unknown'}". Use MP3, WAV, M4A, AAC, OGG, or FLAC.` }, 400);

  const path = `user-uploads/${crypto.randomUUID()}.${ext}`;
  await ensureBucket(SUPABASE_URL, SERVICE_KEY);
  try {
    const uploadUrl = await mintSignedUpload(SUPABASE_URL, SERVICE_KEY, path);
    console.log(`[${FN}] signed voiceover upload path=${path} type=${contentType}`);
    return jsonResponse({ ok: true, uploadUrl, publicUrl: publicObjectUrl(SUPABASE_URL, path), path, contentType });
  } catch (e) {
    console.error(`[${FN}] sign failed:`, String((e as Error)?.message ?? e));
    return jsonResponse({ error: 'sign_failed', detail: 'Could not open a secure upload slot — please retry.' }, 502);
  }
});
