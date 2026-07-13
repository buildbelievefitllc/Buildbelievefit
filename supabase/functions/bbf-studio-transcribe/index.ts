// supabase/functions/bbf-studio-transcribe/index.ts
// ---------------------------------------------------------------------------
// SOVEREIGN STUDIO - CAPTION TRANSCRIPTION (word-level timing)
// ---------------------------------------------------------------------------
// Turns the reel's voice track -- whether it's the AI-generated Akeem clone OR a
// user-uploaded voiceover -- into word-by-word captions. The browser POSTs the
// audio bytes as multipart; we forward them to ElevenLabs Scribe (speech-to-text)
// and return each spoken word with its start/end time. The Studio then renders
// karaoke-style captions synced to playback.
//
// Deliberately small + self-contained (no model-router / storage deps) so it
// deploys cleanly and can never disturb the live voiceover-generation function.
// Same admin perimeter as the rest of the Command Center -- a valid admin
// vault/session token (header or form field), or the server-to-server shared
// secret. verify_jwt:false (we validate the token ourselves).
//
// Secrets (Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY,
// BBF_COACH_AGENT_TOKEN (optional server-to-server gate).
// ---------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const FN = 'bbf-studio-transcribe';
const STT_MODEL = 'scribe_v1'; // ElevenLabs word-timestamped speech-to-text
const MAX_BYTES = 25 * 1024 * 1024; // 25MB -- a spoken reel VO is far under this

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

// -- admin gate (identical to bbf-studio-voiceover / -asset-upload) ----------
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
async function isAuthorized(req: Request, formToken: string, url: string, key: string): Promise<boolean> {
  const shared = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';
  const adminHdr = req.headers.get('x-bbf-admin-token') || '';
  if (shared && adminHdr && adminHdr === shared) return true; // server-to-server
  const token = String(formToken || req.headers.get('x-bbf-vault-token') || req.headers.get('x-bbf-session-token') || '').trim();
  if (!token) return false;
  const uid = await uidFromToken(url, key, token);
  if (!uid) return false;
  return isGodModeUser(url, key, uid);
}

// -- handler -----------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'backend_unconfigured', detail: 'Identity not configured.' }, 503);

  let form: FormData;
  try { form = await req.formData(); } catch { return jsonResponse({ error: 'invalid_form', detail: 'Expected a multipart audio upload.' }, 400); }

  const token = String(form.get('vault_token') || '');
  if (!(await isAuthorized(req, token, SUPABASE_URL, SERVICE_KEY))) {
    return jsonResponse({ error: 'not_admin', detail: 'Studio transcription is restricted to the administrative tier.' }, 401);
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return jsonResponse({ error: 'no_audio', detail: 'Attach the voice audio to caption.' }, 400);
  if (file.size > MAX_BYTES) return jsonResponse({ error: 'audio_too_large', detail: 'That audio is larger than the 25MB caption limit.' }, 413);

  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'stt_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);

  const lang = String(form.get('lang') || '').trim().toLowerCase(); // optional hint (en/es/pt)

  // Forward to ElevenLabs Scribe -> word-timestamped transcript.
  const stt = new FormData();
  stt.append('file', file, file.name || 'voiceover.mp3');
  stt.append('model_id', STT_MODEL);
  if (lang) stt.append('language_code', lang);

  let r: Response;
  try {
    r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST', headers: { 'xi-api-key': ELEVENLABS_API_KEY }, body: stt,
    });
  } catch (e) {
    console.error(`[${FN}] STT network error:`, String((e as Error)?.message ?? e));
    return jsonResponse({ error: 'stt_unreachable', detail: 'Could not reach the transcription service -- please retry.' }, 502);
  }
  if (!r.ok) {
    const t = (await r.text().catch(() => '')).slice(0, 240);
    console.error(`[${FN}] STT ${r.status}: ${t}`);
    return jsonResponse({ error: 'stt_failed', detail: `Transcription failed (${r.status}).` }, 502);
  }

  const j = await r.json().catch(() => null) as { text?: string; words?: Array<{ text?: string; start?: number; end?: number; type?: string }> } | null;
  const rawWords = Array.isArray(j?.words) ? j!.words : [];
  // Keep only spoken words (drop 'spacing'/'audio_event' tokens) with real timing.
  const words = rawWords
    .filter((w) => (w?.type ?? 'word') === 'word' && typeof w?.text === 'string' && w.text.trim() && Number.isFinite(w?.start) && Number.isFinite(w?.end))
    .map((w) => ({ text: String(w.text).trim(), start: Number(w.start), end: Number(w.end) }));

  console.log(`[${FN}] transcribed bytes=${file.size} words=${words.length}`);
  return jsonResponse({ ok: true, text: String(j?.text || ''), words });
});
