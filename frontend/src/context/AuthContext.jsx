// src/context/AuthContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21 — Authentication Context, CUT OVER to official Supabase Auth (GoTrue).
//
// Terminal 5 migrated the 7 clients into auth.users and locked the database with
// per-user RLS (auth.uid() = user_id), unifying identity on the PK so that
// auth.users.id == bbf_users.id. This context now wraps the GoTrue session
// instead of the legacy username+PIN RPC.
//
// IDENTITY BRIDGE: on every session it resolves the legacy username *slug* from
// bbf_users by auth.uid() (BRIDGE_COL='id') and exposes it as `user.username`, so
// every existing slug-keyed API (bbf_get_profile_metrics, bbf_get_last_weights,
// personaResolver, the bbf_sets write path, …) keeps working unchanged. The JWT
// is persisted + auto-attached by the shared supabase client, which is what
// satisfies the new RLS on direct reads/writes (this is what fixes the Vault
// write-outage — authenticated bbf_sets inserts now pass auth.uid()=user_id).
//
// Contract preserved for consumers: { session, user, loading, isAdmin, signOut }.
// signInWithPin is replaced by signInWithPassword(email, password).

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { resolveProgramKey } from '../lib/personaResolver.js';

// Terminal 5 unified auth.users.id == bbf_users.id — bridge on the PK.
const BRIDGE_COL = 'id';

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  signInWithPassword: async () => ({ ok: false }),
  signOut: async () => {},
});

// Resolve the legacy bbf_users profile (slug/name/role) for a GoTrue user id.
// The session JWT rides on this PostgREST call, so the new RLS self-select policy
// (auth.uid() = id) returns the caller's own row. Returns null on any failure —
// callers degrade gracefully (slug-keyed RPCs also accept the raw UUID).
async function bridgeProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('bbf_users')
      .select('uid,name,role')
      .eq(BRIDGE_COL, userId)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // bridged { uid, name, role }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // hydrate runs from async callbacks (not the effect body), so no synchronous
    // setState-in-effect — it sets session, bridges the slug, then clears loading.
    async function hydrate(nextSession) {
      if (!active) return;
      setSession(nextSession);
      const u = nextSession?.user;
      const p = u ? await bridgeProfile(u.id) : null;
      if (!active) return;
      setProfile(p);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => hydrate(data?.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => { hydrate(s); });

    return () => { active = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  // email + password → official GoTrue sign-in. onAuthStateChange then populates
  // the session + bridged profile. Returns a normalized result for the Login UI.
  const signInWithPassword = useCallback(async (email, password) => {
    const em = (email || '').trim();
    if (!em || !password) return { ok: false, message: 'Enter your email and password.' };
    const { error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) return { ok: false, message: error.message || 'Sign-in failed — check your credentials.' };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut(); // onAuthStateChange clears session + profile
  }, []);

  // App user: GoTrue UUID + the bridged legacy slug (so slug-keyed APIs keep
  // working) + persona + role. Built from the session even if the bridge is still
  // resolving — the slug-keyed RPCs also accept the UUID, so data still loads.
  const slug = profile?.uid || null;
  const user = session?.user
    ? {
        id: session.user.id,          // GoTrue UUID (== bbf_users.id)
        username: slug,               // legacy slug, bridged from auth.uid()
        email: session.user.email || null,
        name: profile?.name || null,
        role: profile?.role || null,
        programKey: resolveProgramKey(slug, null),
      }
    : null;

  // Admin tier = role admin/trainer, with the `akeem` slug fallback (mirrors the
  // monolith) so the head coach is never locked out of his own console.
  const role = String(user?.role || '').trim().toLowerCase();
  const isAdmin = role === 'admin' || role === 'trainer'
    || String(slug || '').trim().toLowerCase() === 'akeem';

  const value = { session, user, loading, isAdmin, signInWithPassword, signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
