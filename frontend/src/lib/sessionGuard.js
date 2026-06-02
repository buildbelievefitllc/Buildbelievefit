// src/lib/sessionGuard.js
// ─────────────────────────────────────────────────────────────────────────────
// Kill-switch enforcement (client side). The CEO's Access Control "Lock Account"
// revokes an athlete's vault_token server-side (bbf_admin_set_access_status deletes
// their bbf_vault_sessions rows). That alone breaks the next token-gated WRITE, but
// a logged-in athlete sitting idle in the Vault would not notice until they tried to
// sync. This guard closes that gap: a light heartbeat polls a read-only RPC that
// reports whether the held bearer token is still live AND the account is not locked.
// On revocation it calls signOut() — which clears the session and lets the route
// guard (App.VaultRoute) bounce the athlete to the public /login screen.
//
// FAIL-SAFE: a transport error (offline, or the RPC not yet deployed) is treated as
// "still valid" — we NEVER sign a user out on a network blip or a pre-deploy 404.
// Only an explicit { ok:false } from the server ejects them.
//
// Cost: one tiny RPC on mount, on tab-focus, and every HEARTBEAT_MS. Admins are
// skipped entirely (akeem can never be locked, and the Command Center is a separate
// surface). The 122-bit token means the RPC needs no rate-limit of its own.

import { useEffect, useRef } from 'react';
import { supabase } from './supabaseClient.js';
import { useAuth, getStoredVaultToken } from '../context/AuthContext.jsx';

const HEARTBEAT_MS = 60_000;

// Resolve token liveness. Returns the server envelope { ok, error? } on a real
// answer, or { ok:true } on any transport failure so callers never eject on a blip.
export async function validateVaultSession(uid, token) {
  if (!token) return { ok: false, error: 'invalid_session' };
  const { data, error } = await supabase.rpc('bbf_validate_vault_session', {
    p_uid: String(uid || '').trim().toLowerCase(),
    p_session_token: token,
  });
  if (error) return { ok: true, soft: true }; // network / not-yet-deployed → don't eject
  return data || { ok: false, error: 'invalid_session' };
}

// Mount this inside the authenticated athlete shell (ClientVault). It owns the
// heartbeat lifecycle and triggers a single signOut() the moment access is revoked.
export function useVaultSessionGuard() {
  const { user, isAdmin, signOut } = useAuth();
  const uid = user?.username || user?.id || '';
  const ejected = useRef(false);

  useEffect(() => {
    // Admins (akeem / coach) are never lockable — no heartbeat for the Command side.
    if (isAdmin || !uid) return undefined;
    let cancelled = false;

    const check = async () => {
      if (cancelled || ejected.current) return;
      const token = getStoredVaultToken();
      if (!token) return; // no bearer token yet — the sync paths already handle this
      const res = await validateVaultSession(uid, token);
      if (cancelled || ejected.current) return;
      if (res && res.ok === false) {
        ejected.current = true; // sign out exactly once; do not loop
        signOut();
      }
    };

    check();
    const timer = setInterval(check, HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid, isAdmin, signOut]);
}
