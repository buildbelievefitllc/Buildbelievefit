// src/pages/Login.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — The Login Gate. Phase 20.4 — premium visual reconstruction.
//
// Auth model mirrors the live monolith: username + 6-digit numeric PIN verified
// by the bbf_verify_user_pin RPC (via AuthContext.signInWithPin). Inline error +
// lockout-countdown surfacing; on success the router lets the user through.
//
// Styling is scoped in login.css (.lg-*) — deep-purple field, stark white ink,
// gold-gradient CTA. The sign-in button is disabled + shows a spinner while a
// request is in flight (double-click guarded both visually and in handleSubmit),
// with clean error / info messaging. No global bbf-* primitives are touched.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './login.css';

export default function Login() {
  const { signInWithPin, user, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'error'|'info', text }
  const [lockRemaining, setLockRemaining] = useState(0);
  const lockTimer = useRef(null);

  useEffect(() => () => clearInterval(lockTimer.current), []);

  // PWA route isolation: /login is the installed app's start_url. If a session
  // already exists (returning client launching the installed app), send them
  // straight to the Vault with REPLACE so /login is never left in the standalone
  // history stack — the back button then natively closes the app. ("/" is now the
  // public landing, so we target /vault explicitly, not the root.)
  useEffect(() => {
    if (!loading && user) navigate('/vault', { replace: true });
  }, [loading, user, navigate]);

  function startLockout(seconds) {
    setLockRemaining(seconds);
    clearInterval(lockTimer.current);
    lockTimer.current = setInterval(() => {
      setLockRemaining((r) => {
        if (r <= 1) {
          clearInterval(lockTimer.current);
          setMsg(null);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Double-submit guard: ignore while a request is in flight or during lockout.
    if (busy || lockRemaining > 0) return;

    setBusy(true);
    setMsg({ kind: 'info', text: 'Authenticating via Sovereign Layer…' });

    const result = await signInWithPin(username, pin);

    if (result.ok) {
      navigate('/vault', { replace: true });
      return;
    }

    setBusy(false);
    if (result.reason === 'lockout' && result.retryAfter > 0) {
      startLockout(result.retryAfter);
    }
    setMsg({ kind: 'error', text: result.message || 'Incorrect username or PIN.' });
  }

  // While resolving an existing session (or redirecting an authed user away),
  // show a minimal boot state instead of flashing the sign-in form.
  if (loading || user) {
    return (
      <div className="lg-screen">
        <div className="lg-top">
          <div className="lg-logo">BUILD BELIEVE <b>FIT</b></div>
          <div className="lg-sub">Entering the Vault…</div>
        </div>
      </div>
    );
  }

  const locked = lockRemaining > 0;
  const disabled = busy || locked;
  const lockText = locked
    ? `Locked. Try again in ${Math.floor(lockRemaining / 60)}m ${(lockRemaining % 60)
        .toString()
        .padStart(2, '0')}s`
    : null;

  return (
    <div className="lg-screen">
      <div className="lg-top">
        <div className="lg-logo">BUILD BELIEVE <b>FIT</b></div>
        <div className="lg-sub">Sovereign Access</div>
      </div>

      <form className="lg-card" onSubmit={handleSubmit} noValidate>
        <div className="lg-field">
          <label className="lg-label" htmlFor="bbf-username">Username</label>
          <input
            id="bbf-username"
            className="lg-input"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="username"
            value={username}
            disabled={disabled}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="lg-field">
          <label className="lg-label" htmlFor="bbf-pin">6-digit PIN</label>
          <input
            id="bbf-pin"
            className="lg-input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            placeholder="enter PIN"
            value={pin}
            disabled={disabled}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <button className="lg-btn" type="submit" disabled={disabled}>
          {busy ? (
            <><span className="lg-spinner" aria-hidden="true" /> Signing in…</>
          ) : (
            'Sign In →'
          )}
        </button>

        <div
          className={`lg-msg ${msg?.kind === 'error' ? 'is-error' : 'is-info'}`}
          role="status"
          aria-live="polite"
        >
          {lockText || msg?.text || ''}
        </div>
      </form>
    </div>
  );
}
