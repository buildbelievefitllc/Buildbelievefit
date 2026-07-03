// ═══════════════════════════════════════════════════════════════════════════
// _shared/studio-io.ts — Studio V4 REST / auth / storage primitives (service role)
// ───────────────────────────────────────────────────────────────────────────
// Shared I/O for bbf-studio-batch-compiler + bbf-studio-directed-delivery, mirroring
// the bbf-studio-queue conventions: raw PostgREST + Storage via the service role
// (never shipped to the browser), admin-session OR shared-secret auth, and signed
// upload/download URLs for the PRIVATE directed-v1 bucket. Service role bypasses RLS.
// ═══════════════════════════════════════════════════════════════════════════

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-session-token',
};
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
export const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
export const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pgHeaders(): HeadersInit {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' };
}
export async function pgGet(path: string): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: pgHeaders() });
  if (!res.ok) throw new Error(`pg_get_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}
export async function pgRpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: pgHeaders(), body: JSON.stringify(args) });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc_${res.status}:${text.slice(0, 200)}`);
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}
// Idempotent insert/upsert. onConflict + ignoreDuplicates → ON CONFLICT (col) DO NOTHING.
export async function pgUpsert(table: string, rows: Record<string, unknown>[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }): Promise<unknown> {
  const q = opts?.onConflict ? `?on_conflict=${encodeURIComponent(opts.onConflict)}` : '';
  const resolution = opts?.ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${q}`, {
    method: 'POST',
    headers: { ...pgHeaders(), Prefer: `${resolution},return=representation` },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert_${res.status}:${(await res.text()).slice(0, 240)}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j) ? j : null;
}
export async function pgPatch(table: string, filter: string, patch: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: { ...pgHeaders(), Prefer: 'return=representation' }, body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json().catch(() => null);
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function uidFromSession(session: string): Promise<string | null> {
  if (!session) return null;
  try {
    const r = await pgRpc('_bbf_uid_from_vault_token', { p_session_token: session });
    const id = typeof r === 'string' ? r : (Array.isArray(r) && r.length ? r[0] : null);
    if (id) return String(id);
  } catch (_) { /* fall through */ }
  try {
    const rows = await pgGet(`bbf_vault_sessions?select=user_id&token=eq.${encodeURIComponent(session)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`) as Array<{ user_id?: string }>;
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return row?.user_id ? String(row.user_id) : null;
  } catch (_) { return null; }
}
export async function userRole(userId: string): Promise<{ uid: string | null; role: string | null } | null> {
  try {
    const rows = await pgGet(`bbf_users?select=uid,role&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`) as Array<{ uid?: string; role?: string }>;
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    return u ? { uid: u.uid ?? null, role: u.role ?? null } : null;
  } catch (_) { return null; }
}
// Admin gate (mirrors bbf-studio-queue): shared secret OR an admin/trainer/akeem session.
// Returns the admin userId (for created_by) or null when unauthorized.
export async function authorizeAdmin(req: Request): Promise<{ ok: boolean; userId: string | null }> {
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token && token === ADMIN_TOKEN) return { ok: true, userId: null };
  const session = req.headers.get('x-bbf-session-token') ?? '';
  const userId = await uidFromSession(session);
  if (!userId) return { ok: false, userId: null };
  const u = await userRole(userId);
  const role = String(u?.role ?? '').toLowerCase(), uname = String(u?.uid ?? '').toLowerCase();
  return { ok: role === 'admin' || role === 'trainer' || uname === 'akeem', userId };
}

// ── Storage (private directed-v1 bucket) ─────────────────────────────────────
function absStorage(raw: string): string {
  if (/^https?:\/\//.test(raw)) return raw;
  if (raw.startsWith('/storage/v1')) return `${SUPABASE_URL}${raw}`;
  return `${SUPABASE_URL}/storage/v1${raw.startsWith('/') ? raw : '/' + raw}`;
}
export async function mintSignedUpload(bucket: string, path: string): Promise<{ uploadUrl: string; token: string }> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}`, {
    method: 'POST', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!r.ok) throw new Error(`sign_upload_${r.status}:${(await r.text()).slice(0, 200)}`);
  const j = await r.json().catch(() => null) as { url?: string } | null;
  const uploadUrl = absStorage(String(j?.url ?? ''));
  if (!uploadUrl) throw new Error('sign_upload_no_url');
  let token = ''; try { token = new URL(uploadUrl).searchParams.get('token') ?? ''; } catch (_) { /* optional */ }
  return { uploadUrl, token };
}
// Short-lived signed READ URL for the PRIVATE bucket (the only path an athlete gets).
export async function mintSignedDownload(bucket: string, path: string, expiresIn: number): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST', headers: pgHeaders(), body: JSON.stringify({ expiresIn }),
  });
  if (!r.ok) throw new Error(`sign_download_${r.status}:${(await r.text()).slice(0, 200)}`);
  const j = await r.json().catch(() => null) as { signedURL?: string; signedUrl?: string } | null;
  const raw = String(j?.signedURL ?? j?.signedUrl ?? '');
  if (!raw) throw new Error('sign_download_no_url');
  return absStorage(raw);
}
// Existence gate for a PRIVATE object (authenticated HEAD; service role).
export async function assetExistsPrivate(bucket: string, path: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${path}`, {
      method: 'HEAD', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    return r.ok;
  } catch (_) { return false; }
}
