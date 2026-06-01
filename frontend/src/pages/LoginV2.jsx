// src/pages/LoginV2.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21 — Supabase Auth front door (LIVE on /login after the cutover).
//
// Email + password sign-in via AuthContext.signInWithPassword (official GoTrue).
// On success the global AuthContext captures the session + bridges the legacy
// username slug (auth.uid() → bbf_users.uid), and we navigate to '/' where
// RootRoute dispatches by audience (Vault / Command Center). The session JWT is
// persisted by the shared supabase client and rides on all subsequent DB calls
// to satisfy Terminal 5's per-user RLS.
//
// Styling reuses the scoped .lg-* premium gate (login.css). The button is
// disabled + shows a spinner in flight; double-submit is guarded.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './login.css';

export default function LoginV2() {
  const { signInWithPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind:'error'|'info', text }

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

    const result = await signInWithPassword(em, password);
    if (result.ok) {
      navigate('/', { replace: true }); // RootRoute dispatches by audience
      return;
    }

    setBusy(false);
    setMsg({ kind: 'error', text: result.message || 'Sign-in failed — check your credentials.' });
  }

  return (
    <div className="lg-screen">
      <div className="lg-top">
        <div className="lg-logo">BUILD BELIEVE <b>FIT</b></div>
        <div className="lg-sub">Sovereign Access</div>
      </div>

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

        <div
          className={`lg-msg ${msg?.kind === 'error' ? 'is-error' : 'is-info'}`}
          role="status"
          aria-live="polite"
        >
          {msg?.text || ''}
        </div>
      </form>
    </div>
  );
}
