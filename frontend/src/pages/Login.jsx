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
import { useLang } from '../context/LangContext.jsx';
import { homePathForUser } from '../lib/sportsRoster.js';
import { supabase } from '../lib/supabaseClient.js';
import { isNativePlatform } from '../native/platform.js';
import { GuideLauncher } from '../components/BbfMediaPortal.jsx';
import './login.css';

const NATIVE = isNativePlatform();

export default function Login() {
  const { signInWithPin, bridgeSupabaseSession, user, loading } = useAuth();
  const { lang, setLang } = useLang();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'error'|'info', text }
  const [lockRemaining, setLockRemaining] = useState(0);
  const [appleBusy, setAppleBusy] = useState(false);
  const lockTimer = useRef(null);

  // Forgot-PIN panel — collapsed by default; opened from the link under the
  // form. Self-service only: the backend (bbf-forgot-pin) verifies uid+email
  // match an active account before reissuing anything, and always replies with
  // the same generic message so this UI can never reveal whether an account
  // or email exists.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState(null);

  useEffect(() => () => clearInterval(lockTimer.current), []);

  // Apple Sign-In return leg (native only): `detectSessionInUrl` on the shared
  // Supabase client already parses the OAuth redirect, so a returning GoTrue
  // session just needs bridging into the app's own bbf_users-keyed session (see
  // AuthContext.bridgeSupabaseSession). Runs once on mount — a fresh native boot
  // that isn't returning from Apple simply finds no session and no-ops.
  useEffect(() => {
    if (!NATIVE) return undefined;
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const authUser = data?.session?.user;
      if (!authUser || cancelled) return;
      setAppleBusy(true);
      const result = await bridgeSupabaseSession(authUser);
      if (cancelled) return;
      setAppleBusy(false);
      if (result.ok) {
        navigate(result.home || '/vault', { replace: true });
      } else {
        setMsg({ kind: 'error', text: result.message || 'Sign in with Apple could not be completed.' });
      }
    });
    return () => { cancelled = true; };
  }, [bridgeSupabaseSession, navigate]);

  async function handleAppleSignIn() {
    if (appleBusy || busy) return;
    setAppleBusy(true);
    setMsg({ kind: 'info', text: 'Opening Sign in with Apple…' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/login` },
    });
    // On success the WebView navigates away to Apple's auth page — nothing left
    // to do here. Only surface a message if the redirect itself failed to start.
    if (error) {
      setAppleBusy(false);
      setMsg({ kind: 'error', text: error.message || 'Sign in with Apple failed to start.' });
    }
  }

  // PWA route isolation: /login is the installed app's start_url. If a session
  // already exists (returning client launching the installed app), send them
  // straight to their home with REPLACE so /login is never left in the standalone
  // history stack — the back button then natively closes the app. The Routing Fork
  // (homePathForUser) sends a flagged sports athlete to The Sports Hub and everyone
  // else to the Vault, so a returning youth athlete also bypasses the adult Vault.
  useEffect(() => {
    if (!loading && user) navigate(homePathForUser(user), { replace: true });
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
      // Phase A — hydrate the UI language from the DB record (returned by the PIN
      // RPC), so the Vault opens in the language the client applied in regardless
      // of this device's prior toggle / cleared cache. setLang also re-persists it
      // to localStorage for the rest of the session.
      if (result.lang) setLang(result.lang);
      // The Routing Fork: signInWithPin resolves the home path from the freshly
      // built session (sports athlete → The Sports Hub, else the Vault), so we
      // navigate deterministically without waiting on the context to re-render.
      navigate(result.home || '/vault', { replace: true });
      return;
    }

    setBusy(false);
    if (result.reason === 'lockout' && result.retryAfter > 0) {
      startLockout(result.retryAfter);
    }
    setMsg({ kind: 'error', text: result.message || 'Incorrect username or PIN.' });
  }

  function openForgot() {
    setForgotMsg(null);
    setForgotEmail('');
    setForgotOpen(true);
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    if (forgotBusy) return;

    const u = username.trim();
    const em = forgotEmail.trim();
    if (!u || !em) {
      setForgotMsg({ kind: 'error', text: 'Enter your username above, then your email here.' });
      return;
    }

    setForgotBusy(true);
    setForgotMsg({ kind: 'info', text: 'Checking…' });

    const { data, error } = await supabase.functions.invoke('bbf-forgot-pin', {
      body: { username: u, email: em, locale: lang },
    });

    setForgotBusy(false);

    if (error || !data?.ok) {
      // 429 (rate_limited) also lands here — same wording either way so the
      // response never hints at whether the account/email matched.
      setForgotMsg({ kind: 'error', text: 'Too many attempts. Try again later, or ask your coach.' });
      return;
    }
    setForgotMsg({ kind: 'info', text: data.message || "If that account exists, we've sent a new PIN to the email on file." });
  }

  // While resolving an existing session (or redirecting an authed user away),
  // show a minimal boot state instead of flashing the sign-in form. Also covers
  // the Apple Sign-In return leg while it bridges the GoTrue session.
  if (loading || user || appleBusy) {
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
        {/* System guide — Today's Protocol Overview (welcome tour). */}
        <GuideLauncher module="intro" testId="login-guide" />
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
          {!forgotOpen ? (
            <button
              type="button"
              className="lg-forgot-link"
              disabled={busy}
              onClick={openForgot}
              data-testid="forgot-pin-link"
            >
              Forgot PIN?
            </button>
          ) : null}
        </div>

        <button className="lg-btn" type="submit" disabled={disabled}>
          {busy ? (
            <><span className="lg-spinner" aria-hidden="true" /> Signing in…</>
          ) : (
            'Sign In →'
          )}
        </button>

        {NATIVE ? (
          <>
            <div className="lg-divider" role="separator" aria-label="or">
              <span>or</span>
            </div>
            <button
              type="button"
              className="lg-apple-btn"
              disabled={disabled}
              onClick={handleAppleSignIn}
              data-testid="apple-signin-cta"
            >
              <AppleGlyph /> Sign in with Apple
            </button>
          </>
        ) : null}

        <div
          className={`lg-msg ${msg?.kind === 'error' ? 'is-error' : 'is-info'}`}
          role="status"
          aria-live="polite"
        >
          {lockText || msg?.text || ''}
        </div>
      </form>

      {forgotOpen ? (
        <form className="lg-card lg-forgot-card" onSubmit={handleForgotSubmit} noValidate>
          <div className="lg-forgot-title">Reset your PIN</div>
          <div className="lg-forgot-sub">
            Enter the email on file for <b>{username.trim() || 'your username'}</b> and we'll send a new PIN.
          </div>
          <div className="lg-field">
            <label className="lg-label" htmlFor="bbf-forgot-email">Email on file</label>
            <input
              id="bbf-forgot-email"
              className="lg-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={forgotEmail}
              disabled={forgotBusy}
              onChange={(e) => setForgotEmail(e.target.value)}
            />
          </div>
          <button className="lg-btn" type="submit" disabled={forgotBusy}>
            {forgotBusy ? (<><span className="lg-spinner" aria-hidden="true" /> Sending…</>) : 'Send New PIN'}
          </button>
          <button
            type="button"
            className="lg-forgot-cancel"
            disabled={forgotBusy}
            onClick={() => setForgotOpen(false)}
          >
            Cancel
          </button>
          <div
            className={`lg-msg ${forgotMsg?.kind === 'error' ? 'is-error' : 'is-info'}`}
            role="status"
            aria-live="polite"
          >
            {forgotMsg?.text || ''}
          </div>
        </form>
      ) : null}

      {NATIVE ? (
        // Apple anti-steering guardrail (guideline 3.1.3): pure text, no link/tap
        // target — account provisioning happens on the web, never inside the app.
        <p className="lg-native-notice" data-testid="native-access-notice">
          BBF Lab is a private coaching platform. Access must be secured via
          buildbelievefit.fitness prior to login.
        </p>
      ) : null}
    </div>
  );
}

function AppleGlyph() {
  return (
    <svg className="lg-apple-glyph" viewBox="0 0 384 512" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 8 184.8 8 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 37.3 59 128.8 107.2 127.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-84 102.6-121.4-65.2-30.7-65.7-90-65.7-91.8zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </svg>
  );
}
