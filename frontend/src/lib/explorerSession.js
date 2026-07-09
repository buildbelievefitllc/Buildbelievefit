// src/lib/explorerSession.js
// ─────────────────────────────────────────────────────────────────────────────
// EXPLORER MODE — the temporary guest-token routing framework (conversion
// funnel upgrade). The moment an anonymous visitor submits their details to a
// frontend calculator, a guest envelope is minted into localStorage under
// `bbf.explorer.token.v1` (house key convention: bbf.<domain>.vN). The token is
// a CLIENT-SIDE identity only — it unlocks nothing on the server. It carries
// the visitor's own calculated numbers into the read-only /explore sandbox so
// the platform can demonstrate value with THEIR data, then routes the upgrade
// ask through the existing /select-tier → /pathfinder application funnel.
//
// Deliberately parallel to (never inside) the real auth envelope
// (bbf.session.v1, AuthContext) — a guest must never satisfy VaultRoute's
// `user` check or reach any token-gated RPC. 7-day expiry; a stale envelope
// reads as absent.

const KEY = 'bbf.explorer.token.v1';
const TTL_MS = 7 * 86400000;

function safeStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
function uuid() {
  try { return crypto.randomUUID(); } catch {
    return `xp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

// Mint (or re-mint) the guest session. `profile` = the calculator inputs
// ({ age, sex, weight_lbs, height_ft, height_in, activity_factor }), `targets`
// = the computed numbers ({ tdee_maintenance, tdee_target, macro_p/c/f, goal }).
export function startExplorerSession({ source, profile = {}, targets = {} } = {}) {
  const ls = safeStorage();
  const envelope = {
    token: uuid(),
    source: source || 'calculator',
    createdAt: Date.now(),
    profile,
    targets,
  };
  try { ls?.setItem(KEY, JSON.stringify(envelope)); } catch { /* private mode — session lives for the tab only */ }
  return envelope;
}

export function readExplorerSession() {
  const ls = safeStorage();
  try {
    const raw = ls?.getItem(KEY);
    if (!raw) return null;
    const env = JSON.parse(raw);
    if (!env?.token || !Number.isFinite(env.createdAt)) return null;
    if (Date.now() - env.createdAt > TTL_MS) { ls?.removeItem(KEY); return null; }
    return env;
  } catch { return null; }
}

export function hasExplorerSession() {
  return !!readExplorerSession();
}

export function clearExplorerSession() {
  try { safeStorage()?.removeItem(KEY); } catch { /* noop */ }
}

// Merge fresher calculator numbers into an existing envelope (a returning
// visitor recalculating keeps ONE session, not a stack of them).
export function updateExplorerTargets(targets = {}, profile = {}) {
  const env = readExplorerSession();
  if (!env) return null;
  const next = { ...env, targets: { ...env.targets, ...targets }, profile: { ...env.profile, ...profile } };
  try { safeStorage()?.setItem(KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}
