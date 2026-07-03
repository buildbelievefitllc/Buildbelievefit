// ═══════════════════════════════════════════════════════════════════════════
// bbf-studio-directed-delivery — the secure Directed Play delivery router (§4.3)
// ───────────────────────────────────────────────────────────────────────────
// Routes a rendered asset to ONE athlete through the PRIVATE directed-v1 bucket.
// Enforces the privacy boundary: server-generated path (never the public reels
// bucket), locale LOCKED to the athlete's preferred_language, and reads ONLY via
// short-lived signed URLs. Never exposes the service role to the browser.
//
// ACTIONS:
//   sign_upload    (admin) → signed UPLOAD url for a server path in directed-v1
//   confirm_delivery (admin) → verify the asset landed, LOCK locale to the athlete,
//                    write the studio_directed_deliveries ledger row (ON CONFLICT id
//                    DO NOTHING — idempotent), status 'delivered'
//   view           (athlete vault session) → mint a signed READ url for a delivery
//                    the caller OWNS, walk status → viewed (read receipt)
//   list           (admin: all recent · athlete: their own)
//
// AUTH: admin actions = admin session OR shared secret; athlete actions = a valid
// vault session that OWNS the delivery. Service role bypasses RLS + signs URLs.
// TRILINGUAL: locale is never hardcoded — it is read from athlete.preferred_language.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  CORS, jsonResponse, UUID_RE, pgGet, pgUpsert, pgPatch, authorizeAdmin, uidFromSession,
  mintSignedUpload, mintSignedDownload, assetExistsPrivate,
} from '../_shared/studio-io.ts';
import { normLoc } from '../_shared/studio-core.ts';

const BUCKET = 'directed-v1';
const EXT: Record<string, string> = { reel: 'mp4', audio_brief: 'mp3', card: 'png' };
const SIGNED_URL_TTL = 3600; // 1 hour — short-lived read for a private asset

function assetKind(v: unknown): 'reel' | 'audio_brief' | 'card' {
  return v === 'audio_brief' ? 'audio_brief' : v === 'card' ? 'card' : 'reel';
}
function clip(v: unknown, max: number): string | null { const s = (v == null ? '' : String(v)).trim(); return s ? s.slice(0, max) : null; }

// Resolve the athlete profile that OWNS the caller's vault session.
async function athleteFromSession(req: Request): Promise<{ userId: string; profileId: string | null } | null> {
  const userId = await uidFromSession(req.headers.get('x-bbf-session-token') ?? '');
  if (!userId) return null;
  const rows = await pgGet(`athlete_profiles?select=id&user_id=eq.${userId}&order=created_at.asc&limit=1`).catch(() => []) as Array<{ id?: string }>;
  return { userId, profileId: rows?.[0]?.id ? String(rows[0].id) : null };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const action = String(body.action ?? '');

  try {
    // ══ sign_upload (admin) ═══════════════════════════════════════════════
    if (action === 'sign_upload') {
      const admin = await authorizeAdmin(req);
      if (!admin.ok) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
      const kind = assetKind(body.asset_kind);
      const id = crypto.randomUUID();                    // server-minted delivery id
      const path = `${id}.${EXT[kind]}`;                 // server-generated path — caller can't choose
      const { uploadUrl, token } = await mintSignedUpload(BUCKET, path);
      return jsonResponse({ ok: true, id, asset_kind: kind, bucket: BUCKET, path, uploadUrl, token });
    }

    // ══ confirm_delivery (admin) ══════════════════════════════════════════
    if (action === 'confirm_delivery') {
      const admin = await authorizeAdmin(req);
      if (!admin.ok) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
      const id = String(body.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ ok: false, error: 'bad_id' }, 400);
      const kind = assetKind(body.asset_kind);
      const path = `${id}.${EXT[kind]}`;
      const targetAthleteId = String(body.athlete_id ?? '').trim();
      if (!UUID_RE.test(targetAthleteId)) return jsonResponse({ ok: false, error: 'bad_athlete_id' }, 400);

      // Verify the rendered asset actually landed in the private bucket.
      if (!(await assetExistsPrivate(BUCKET, path))) return jsonResponse({ ok: false, error: 'asset_not_found', detail: `${BUCKET}/${path}` }, 409);

      // LOCK locale to the athlete's own language (privacy/localization boundary).
      const prof = await pgGet(`athlete_profiles?select=id,preferred_language&id=eq.${targetAthleteId}&limit=1`).catch(() => []) as Array<{ id?: string; preferred_language?: string }>;
      if (!prof?.[0]?.id) return jsonResponse({ ok: false, error: 'athlete_not_found' }, 404);
      const locale = normLoc(prof[0].preferred_language);

      const row = {
        id, asset_kind: kind, storage_bucket: BUCKET, storage_path: path, athlete_id: targetAthleteId, locale,
        note: clip(body.note, 500), overlay_json: (body.overlay_json as unknown) ?? null,
        status: 'delivered', created_by: admin.userId, created_at: new Date().toISOString(), delivered_at: new Date().toISOString(),
      };
      const ins = await pgUpsert('studio_directed_deliveries', [row], { onConflict: 'id', ignoreDuplicates: true }) as unknown[] | null;
      const created = Array.isArray(ins) && ins.length > 0;
      return jsonResponse({ ok: true, id, athlete_id: targetAthleteId, locale, status: 'delivered', created, idempotent_replay: !created });
    }

    // ══ view (athlete vault session) ══════════════════════════════════════
    if (action === 'view') {
      const ctx = await athleteFromSession(req);
      if (!ctx || !ctx.profileId) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
      const id = String(body.id ?? '');
      if (!UUID_RE.test(id)) return jsonResponse({ ok: false, error: 'bad_id' }, 400);
      // Ownership gate: the delivery MUST belong to this athlete.
      const rows = await pgGet(`studio_directed_deliveries?select=id,athlete_id,storage_bucket,storage_path,locale,status,viewed_at,delivered_at&id=eq.${id}&athlete_id=eq.${ctx.profileId}&limit=1`).catch(() => []) as Array<Record<string, unknown>>;
      const d = rows?.[0];
      if (!d) return jsonResponse({ ok: false, error: 'not_found_or_forbidden' }, 404);
      if (d.status === 'expired') return jsonResponse({ ok: false, error: 'expired' }, 410);

      const signedUrl = await mintSignedDownload(String(d.storage_bucket), String(d.storage_path), SIGNED_URL_TTL);

      // Read receipt: walk queued/delivered → viewed (first view stamps viewed_at).
      const patch: Record<string, unknown> = {};
      if (!d.viewed_at) patch.viewed_at = new Date().toISOString();
      if (d.status !== 'viewed') patch.status = 'viewed';
      if (!d.delivered_at) patch.delivered_at = new Date().toISOString();
      if (Object.keys(patch).length) await pgPatch('studio_directed_deliveries', `id=eq.${id}`, patch).catch(() => null);

      return jsonResponse({ ok: true, id, locale: d.locale, status: 'viewed', signed_url: signedUrl, expires_in: SIGNED_URL_TTL });
    }

    // ══ list ══════════════════════════════════════════════════════════════
    if (action === 'list') {
      const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);
      const admin = await authorizeAdmin(req);
      if (admin.ok) {
        const rows = await pgGet(`studio_directed_deliveries?select=id,asset_kind,athlete_id,locale,status,note,created_at,delivered_at,viewed_at&order=created_at.desc&limit=${limit}`).catch(() => []) as unknown[];
        return jsonResponse({ ok: true, scope: 'admin', deliveries: rows });
      }
      const ctx = await athleteFromSession(req);
      if (!ctx || !ctx.profileId) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
      const rows = await pgGet(`studio_directed_deliveries?select=id,asset_kind,locale,status,note,created_at&athlete_id=eq.${ctx.profileId}&status=in.(queued,delivered,viewed)&order=created_at.desc&limit=${limit}`).catch(() => []) as unknown[];
      return jsonResponse({ ok: true, scope: 'athlete', deliveries: rows });
    }

    return jsonResponse({ ok: false, error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    console.error('[bbf-studio-directed-delivery] fatal:', e instanceof Error ? e.message : String(e));
    return jsonResponse({ ok: false, error: 'delivery_failed', detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
