// src/pages/Login.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — The Login Gate. Styled, functional, brutalist.
//
// Auth model mirrors the live monolith: username + 6-digit numeric PIN verified
// by the bbf_verify_user_pin RPC (via AuthContext.signInWithPin). Inline error
// + lockout-countdown surfacing; on success the router's ProtectedRoute lets the
// user through to the MasterLayout shell.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { signInWithPin } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'error'|'info', text }
  const [lockRemaining, setLockRemaining] = useState(0);
  const lockTimer = useRef(null);

  useEffect(() => () => clearInterval(lockTimer.current), []);

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
    if (busy || lockRemaining > 0) return;

    setBusy(true);
    setMsg({ kind: 'info', text: 'Authenticating via Sovereign Layer…' });

    const result = await signInWithPin(username, pin);

    if (result.ok) {
      navigate('/', { replace: true });
      return;
    }

    setBusy(false);
    if (result.reason === 'lockout' && result.retryAfter > 0) {
      startLockout(result.retryAfter);
    }
    setMsg({ kind: 'error', text: result.message || 'Incorrect username or PIN.' });
  }

  const lockText =
    lockRemaining > 0
      ? `Locked. Try again in ${Math.floor(lockRemaining / 60)}m ${(lockRemaining % 60)
          .toString()
          .padStart(2, '0')}s`
      : null;

  return (
    <div style={styles.screen}>
      <div style={styles.top}>
        <div style={styles.logo}>
          BUILD BELIEVE <span style={{ color: 'var(--yel)' }}>FIT</span>
        </div>
        <div style={styles.sub}>Sovereign Access</div>
      </div>

      <form style={styles.box} onSubmit={handleSubmit} noValidate>
        <div>
          <label className="bbf-label" htmlFor="bbf-username">Username</label>
          <input
            id="bbf-username"
            className="bbf-input"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="username"
            value={username}
            disabled={busy || lockRemaining > 0}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label className="bbf-label" htmlFor="bbf-pin">6-digit PIN</label>
          <input
            id="bbf-pin"
            className="bbf-input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            placeholder="enter PIN"
            value={pin}
            disabled={busy || lockRemaining > 0}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <button
          className="bbf-btn"
          style={{ marginTop: '1.4rem' }}
          type="submit"
          disabled={busy || lockRemaining > 0}
        >
          {busy ? 'Signing in…' : 'Sign In →'}
        </button>

        <div
          className={`bbf-msg ${msg?.kind === 'error' ? 'bbf-msg--error' : 'bbf-msg--info'}`}
          role="status"
          aria-live="polite"
        >
          {lockText || msg?.text || ''}
        </div>
      </form>
    </div>
  );
}

const styles = {
  screen: {
    minHeight: '100%',
    background: 'var(--blk)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  top: {
    padding: 'calc(var(--st) + 2.5rem) 1.5rem 2rem',
    textAlign: 'center',
    background: 'linear-gradient(180deg, var(--purp), var(--blk))',
  },
  logo: {
    fontFamily: 'var(--hb)',
    fontSize: '2rem',
    fontWeight: 900,
    letterSpacing: '3px',
  },
  sub: {
    fontSize: '.7rem',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.3)',
    marginTop: '.3rem',
  },
  box: { padding: '1.5rem', maxWidth: 420, margin: '0 auto', width: '100%' },
};
