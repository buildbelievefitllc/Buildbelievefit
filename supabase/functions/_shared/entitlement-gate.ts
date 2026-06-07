// supabase/functions/_shared/entitlement-gate.ts
// ═══════════════════════════════════════════════════════════════════════════
// SERVER-SIDE ENTITLEMENT GATE — the FAIL-CLOSED backend authority.
// ───────────────────────────────────────────────────────────────────────────
// The absolute single source of truth for WHICH tier unlocks WHICH backend
// feature. This is the server mirror of frontend/src/lib/entitlements.js — but
// where the frontend FAILS OPEN (a cosmetic upsell funnel that must never
// padlock a paying customer on a network blip), this module FAILS CLOSED:
//
//   no vault session · invalid/expired token · locked account · empty tier ·
//   a tier not in the canonical map · an infra error  =>  DENY.
//
// Cosmetic UI locks are trivially bypassable (devtools / a raw fetch with the
// public anon key). THIS protects the paid LLM compute behind the endpoint.
//
// IDENTITY is resolved SERVER-SIDE from the 24h vault bearer token
// (bbf_vault_sessions) via the established _bbf_uid_from_vault_token RPC. The
// caller-supplied `uid` is NEVER trusted for authorization.
//
// GOD MODE bypass (mirrors the monolith Iron-Vault bouncer + entitlements.js):
//   role ∈ {admin, trainer, coach} · uid === 'akeem' · active trial → full access.
//
// Zero imports (global fetch only) so it INLINES cleanly into the single-file
// edge-deploy bundles. Source of truth stays the multi-file repo on main.
// ═══════════════════════════════════════════════════════════════════════════

export const GROUP = {
  FITNESS_BASE: 'fitnessbase', // entry Online Fitness (Catalyst) — Prehab padlocked
  FITNESS_PRO:  'fitnesspro',  // Momentum / Autonomous — Prehab unlocked
  NUTRITION:    'nutrition',   // Online Nutrition (Fuel)
  YOUTH:        'youth',       // Youth Athlete → Sports Hub
  ALL:          'allaccess',   // Hybrid protocols + admins + active trial — God Mode
  NONE:         'none',        // no active subscription — everything sellable locked
} as const;
export type Group = typeof GROUP[keyof typeof GROUP];

// Canonical 13 + 7 legacy → access group. PORTED VERBATIM from
// frontend/src/lib/entitlements.js TIER_TO_GROUP. These two maps MUST stay in
// lockstep — adding a SKU to bbf_tiers means adding it HERE and in the frontend.
export const TIER_TO_GROUP: Record<string, Group> = {
  // ── Canonical · Online Fitness (BASE = entry; PRO = mid/top → adds Prehab) ──
  catalyst:   GROUP.FITNESS_BASE,
  momentum:   GROUP.FITNESS_PRO,
  autonomous: GROUP.FITNESS_PRO,
  // ── Canonical · Online Nutrition ──
  fuel_foundation:  GROUP.NUTRITION,
  fuel_performance: GROUP.NUTRITION,
  fuel_sovereign:   GROUP.NUTRITION,
  // ── Canonical · Youth Athlete ──
  rising_athlete:   GROUP.YOUTH,
  // ── Canonical · Hybrid Protocols (6 SKUs) — God Mode ──
  kickstart_6wk_3x:      GROUP.ALL,
  kickstart_6wk_4x:      GROUP.ALL,
  transformation_8wk_3x: GROUP.ALL,
  transformation_8wk_4x: GROUP.ALL,
  sovereign_12wk_3x:     GROUP.ALL,
  sovereign_12wk_4x:     GROUP.ALL,
  // ── Legacy storefront slugs → closest modern group (grandfathered) ──
  lite:      GROUP.FITNESS_BASE,
  gateway:   GROUP.FITNESS_PRO,
  architect: GROUP.FITNESS_PRO,
  sovereign: GROUP.ALL,
  youth_athlete:        GROUP.YOUTH,
  nutrition_essentials: GROUP.NUTRITION,
  nutrition_platinum:   GROUP.NUTRITION,
};

// Feature key → the groups that unlock it. Mirrors frontend TAB_ACCESS but
// FEATURE-grained so a single tab can host several independently-gated tools.
export const FEATURE_ACCESS: Record<string, Group[]> = {
  cardio:           [GROUP.FITNESS_BASE, GROUP.FITNESS_PRO, GROUP.ALL],
  prehab:           [GROUP.FITNESS_PRO, GROUP.ALL],
  nutrition_macros: [GROUP.NUTRITION, GROUP.ALL],
  nutrition_image:  [GROUP.NUTRITION, GROUP.ALL],
  kinematics:       [GROUP.YOUTH, GROUP.ALL],
  comlink:          [GROUP.FITNESS_BASE, GROUP.FITNESS_PRO, GROUP.YOUTH, GROUP.ALL],
};

export interface EntitlementContext {
  user_id:  string;       // bbf_users.id (uuid) — server-authoritative
  uid:      string | null;// bbf_users.uid (slug)
  tier:     string | null;
  group:    Group;
  role:     string | null;
  god_mode: boolean;
}

export interface GateDenial {
  status: number;   // 401 (no/invalid session) · 403 (locked / not entitled) · 503 (infra)
  error:  string;   // machine slug
  detail: string;   // human detail
}

function pgHeaders(serviceKey: string): HeadersInit {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
}

// Resolve user_id from the vault bearer token (the established SECURITY DEFINER
// RPC). Returns null on any miss — expired/invalid/deleted. Locked accounts have
// their session rows deleted by the kill switch, so they never resolve here.
async function uidFromVaultToken(supabaseUrl: string, serviceKey: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/_bbf_uid_from_vault_token`, {
      method: 'POST', headers: pgHeaders(serviceKey),
      body: JSON.stringify({ p_session_token: token }),
    });
    if (!r.ok) return null;
    const v = await r.json().catch(() => null);          // scalar RPC → uuid string or null
    return (typeof v === 'string' && v) ? v : null;
  } catch { return null; }
}

async function readUserRow(supabaseUrl: string, serviceKey: string, userId: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/bbf_users?id=eq.${encodeURIComponent(userId)}&deleted_at=is.null` +
      `&select=uid,subscription_tier,trial_expires_at,access_status,role&limit=1`,
      { headers: pgHeaders(serviceKey) },
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}

function isGodModeRole(role: string | null, uid: string | null): boolean {
  const r = String(role || '').toLowerCase();
  if (r === 'admin' || r === 'trainer' || r === 'coach') return true;
  if (String(uid || '').toLowerCase() === 'akeem') return true; // CEO — always God Mode
  return false;
}

function trialActive(trialExpiresAt: unknown): boolean {
  if (typeof trialExpiresAt !== 'string' || !trialExpiresAt) return false;
  const t = Date.parse(trialExpiresAt);
  return Number.isFinite(t) && t > Date.now();
}

// Resolve the caller's entitlement context. FAIL-CLOSED: returns a GateDenial on
// any failure to POSITIVELY establish identity + a mapped, unlocked entitlement.
export async function resolveEntitlement(opts: {
  supabaseUrl?: string; serviceKey?: string; vaultToken?: string | null;
}): Promise<EntitlementContext | GateDenial> {
  const { supabaseUrl, serviceKey } = opts;
  const token = String(opts.vaultToken || '').trim();

  if (!supabaseUrl || !serviceKey) {
    return { status: 503, error: 'entitlement_check_unavailable', detail: 'Gate cannot reach the identity store.' };
  }
  if (!token) {
    return { status: 401, error: 'missing_session', detail: 'A vault session token is required.' };
  }

  const userId = await uidFromVaultToken(supabaseUrl, serviceKey, token);
  if (!userId) {
    return { status: 401, error: 'invalid_session', detail: 'Vault session is invalid or expired.' };
  }

  const row = await readUserRow(supabaseUrl, serviceKey, userId);
  if (!row) {
    return { status: 401, error: 'invalid_session', detail: 'No active account for this session.' };
  }
  if (String(row.access_status || '') === 'locked') {
    return { status: 403, error: 'account_locked', detail: 'This account is locked.' };
  }

  const uid  = (row.uid ?? null) as string | null;
  const role = (row.role ?? null) as string | null;
  const tier = (row.subscription_tier ?? null) as string | null;

  // GOD MODE — admins / coach / akeem / active trial → full access.
  if (isGodModeRole(role, uid) || trialActive(row.trial_expires_at)) {
    return { user_id: userId, uid, tier, role, group: GROUP.ALL, god_mode: true };
  }

  // FAIL-CLOSED on an empty/unmapped tier (the inverse of the frontend's
  // fail-open). Every real SKU is in TIER_TO_GROUP; an unknown one is denied.
  const slug  = String(tier || '').trim().toLowerCase();
  const group = slug ? TIER_TO_GROUP[slug] : undefined;
  if (!group) {
    return { status: 403, error: 'tier_not_entitled', detail: `No entitlement mapping for tier "${slug || '(none)'}".` };
  }

  return { user_id: userId, uid, tier, role, group, god_mode: false };
}

function isDenial(x: EntitlementContext | GateDenial): x is GateDenial {
  return !('user_id' in x);
}

// Resolve + check one feature in a single call. The caller renders the denial
// with its OWN CORS/jsonResponse helper:
//
//   const gate = await requireEntitlement({ supabaseUrl, serviceKey, vaultToken, feature: 'cardio' });
//   if (!gate.ok) return jsonResponse({ error: gate.denial.error, detail: gate.denial.detail }, gate.denial.status);
//   const uid = gate.ctx.uid;   // server-authoritative identity
//
export async function requireEntitlement(opts: {
  supabaseUrl?: string; serviceKey?: string; vaultToken?: string | null; feature: string;
}): Promise<{ ok: true; ctx: EntitlementContext } | { ok: false; denial: GateDenial }> {
  const res = await resolveEntitlement(opts);
  if (isDenial(res)) return { ok: false, denial: res };

  const allowed = FEATURE_ACCESS[opts.feature];
  if (!allowed) {
    // Unknown feature key = developer error → FAIL CLOSED rather than wave it through.
    return { ok: false, denial: { status: 403, error: 'tier_not_entitled', detail: `Unknown feature "${opts.feature}".` } };
  }
  if (res.god_mode || allowed.includes(res.group)) {
    return { ok: true, ctx: res };
  }
  return {
    ok: false,
    denial: { status: 403, error: 'tier_not_entitled', detail: `Tier "${res.tier || '(none)'}" does not unlock "${opts.feature}".` },
  };
}
