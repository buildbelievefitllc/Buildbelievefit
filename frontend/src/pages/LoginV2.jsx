// src/pages/LoginV2.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21 (STAGED) — Supabase Auth front door (parallel build).
//
// ⚠️ NOT WIRED TO THE ROUTER. App.jsx still routes the live PIN gate (Login.jsx +
// bbf_verify_user_pin) on /login. This component is isolated staging for the
// auth pivot: it ships to main inert (nothing imports it into a route), so the
// production deploy is unaffected. It goes live only when App.jsx is repointed —
// the cutover step, gated on Terminal 5 provisioning auth.users + RLS.
//
// What it does:
//   1. Authenticates with the official Supabase Auth SDK
//      (supabase.auth.signInWithPassword — email + password).
//   2. IDENTITY BRIDGE — on success, resolves the legacy username slug from the
//      authenticated auth.uid() by querying bbf_users, so the existing
//      slug-keyed data APIs (bbf_get_profile_metrics, bbf_get_last_weights,
//      personaResolver, …) keep working unchanged.
//   3. Holds the session + bridged slug in local state. The JWT itself is
//      persisted by the shared supabase client (persistSession:true) and is
//      attached automatically to every subsequent PostgREST/RPC call, which is
//      what satisfies Terminal 5's auth.uid()-based RLS — no client reconfig.
//
// Styling reuses the scoped .lg-* premium gate styles (login.css).

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import './login.css';

// The bbf_users column that maps to the GoTrue user id. Terminal 5's migration
// OWNS this mapping: if it links the legacy row via a dedicated column (e.g.
// `auth_id`) rather than reusing the PK, flip BRIDGE_COL to match. The CEO's plan
// is auth.uid() == bbf_users.id, so we default to the primary key.
const BRIDGE_COL = 'id';

export default function LoginV2() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind:'error'|'info', text }
  const [identity, setIdentity] = useState(null); // { userId, slug, name, role, hasToken }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return; // double-submit guard

    const em = email.trim();
    if (!em || !password) {
      setMsg({ kind: 'error', text: 'Enter your email and password.' });
      return;
    }

    setBusy(true);
    setMsg({ kind: 'info', text: 'Authenticating via Supabase Auth…' });

    // 1 · Official Supabase Auth sign-in.
    const { data, error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) {
      setBusy(false);
      setMsg({ kind: 'error', text: error.message || 'Sign-in failed — check your credentials.' });
      return;
    }

    const user = data?.user;
    const hasToken = !!data?.session?.access_token; // JWT also auto-persisted by the client

    // 2 · Identity bridge — resolve the legacy slug from auth.uid().
    let row;
    try {
      const q = await supabase
        .from('bbf_users')
        .select('uid,name,role')
        .eq(BRIDGE_COL, user.id)
        .maybeSingle();
      if (q.error) throw q.error;
      row = q.data;
    } catch (err) {
      setBusy(false);
      setIdentity({ userId: user.id, slug: null, name: user.email, role: null, hasToken });
      setMsg({
        kind: 'error',
        text: `Signed in, but the identity bridge failed — ${err.message || 'no linked bbf_users row'}. Expected once Terminal 5's migration + RLS land.`,
      });
      return;
    }

    setBusy(false);
    if (!row?.uid) {
      setIdentity({ userId: user.id, slug: null, name: user.email, role: null, hasToken });
      setMsg({ kind: 'error', text: 'Signed in, but no legacy profile is linked to this account yet.' });
      return;
    }

    // 3 · Store the bridged identity in client state. The legacy slug-keyed APIs
    // consume `slug`; the JWT rides on the client automatically for RLS.
    setIdentity({ userId: user.id, slug: row.uid, name: row.name || row.uid, role: row.role || null, hasToken });
    setMsg({ kind: 'info', text: `Authenticated · bridged to legacy profile @${row.uid}.` });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIdentity(null);
    setEmail('');
    setPassword('');
    setMsg({ kind: 'info', text: 'Signed out.' });
  }

  return (
    <div className="lg-screen">
      <div className="lg-top">
        <div className="lg-logo">BUILD BELIEVE <b>FIT</b></div>
        <div className="lg-sub">Sovereign Access · v2</div>
      </div>

      {identity ? (
        <div className="lg-card" aria-live="polite">
          <div className="lg-field">
            <span className="lg-label">Authenticated</span>
            <div style={{ fontFamily: 'var(--bd)', fontWeight: 700, color: 'var(--wht)', fontSize: '1.05rem' }}>
              {identity.name}{identity.slug ? <> · <span style={{ color: 'var(--yel)' }}>@{identity.slug}</span></> : null}
            </div>
          </div>
          <div className="lg-field" style={{ fontFamily: 'var(--bd)', fontSize: '.85rem', color: 'var(--mut)', fontWeight: 600 }}>
            <div>Role: {identity.role || '—'}</div>
            <div>auth.uid(): {identity.userId}</div>
            <div>Session JWT: {identity.hasToken ? 'captured ✓ (persisted on the client)' : 'none'}</div>
            <div>Legacy slug bridged: {identity.slug ? `@${identity.slug} ✓` : 'not linked'}</div>
          </div>
          <button type="button" className="lg-btn" onClick={signOut}>Sign Out</button>
          <div className={`lg-msg ${msg?.kind === 'error' ? 'is-error' : 'is-info'}`} role="status" aria-live="polite">
            {msg?.text || ''}
          </div>
        </div>
      ) : (
        <form className="lg-card" onSubmit={handleSubmit} noValidate>
          <div className="lg-field">
            <label className="lg-label" htmlFor="v2-email">Email</label>
            <input
              id="v2-email"
              className="lg-input"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="lg-field">
            <label className="lg-label" htmlFor="v2-password">Password</label>
            <input
              id="v2-password"
              className="lg-input"
              type="password"
              autoComplete="current-password"
              placeholder="enter password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="lg-btn" type="submit" disabled={busy}>
            {busy ? (<><span className="lg-spinner" aria-hidden="true" /> Signing in…</>) : 'Sign In →'}
          </button>

          <div className={`lg-msg ${msg?.kind === 'error' ? 'is-error' : 'is-info'}`} role="status" aria-live="polite">
            {msg?.text || ''}
          </div>
        </form>
      )}
    </div>
  );
}
