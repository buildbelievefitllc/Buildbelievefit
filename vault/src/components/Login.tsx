// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/Login.tsx
//
// Phase 4.3 Stage 2 · Authentication Gate (step a in PASSOVER §5 ·
// boot directive "Login + PIN entry"). React port of the legacy
// bbf-app.html LOGIN() flow at src/state/bbf-auth-engine.js lines
// 446-590 · calls the typed `verifyUserPin(uid, pin)` RPC exported
// from services/supabaseClient.ts and on success hydrates BOTH the
// module-level current-user tracker AND the localStorage boot sigil
// so the next reload's main.tsx → hydrateSessionFromStorage() finds
// the uid through the sigil-priority path (HydrationSource='sigil').
//
// CONTRACT
//   · onAuthenticated(uid) fires AFTER setCurrentUser + setCurrentUserSigil
//     so the parent (App.tsx) can flip into <VaultShell /> without a
//     fresh hydrate scan.
//   · Lockout state surfaces a numeric retry-after countdown rather
//     than swallowing the failure into a generic error.
//   · Network failure is distinguished from invalid_credentials so
//     the user gets a precise diagnostic.
//   · Submit is debounced via the `submitting` flag · re-clicking
//     while in-flight is a no-op (mirrors selectClient fast path).
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, type CSSProperties, type FormEvent } from 'react';
import {
  verifyUserPin,
  setCurrentUser,
  setCurrentUserSigil,
} from '../services/supabaseClient';

export interface LoginProps {
  onAuthenticated: (uid: string) => void;
}

type LoginError =
  | { kind: 'invalid_input'; message: string }
  | { kind: 'invalid_credentials'; message: string }
  | { kind: 'lockout'; retryAfterSeconds: number }
  | { kind: 'network'; message: string };

export default function Login({ onAuthenticated }: LoginProps) {
  const [uidInput, setUidInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (submitting) return;

      const uid = uidInput.trim().toLowerCase();
      const pin = pinInput.trim();

      if (!uid) {
        setError({ kind: 'invalid_input', message: 'Enter your athlete id.' });
        return;
      }
      if (!pin) {
        setError({ kind: 'invalid_input', message: 'Enter your PIN.' });
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        const res = await verifyUserPin(uid, pin);

        if (res.ok) {
          // Prefer the server-returned uid (canonical · the RPC resolves
          // slug variants like firstname → firstname_bbf) and fall back
          // to the trimmed-lowercased input if the response omits it.
          const canonical = typeof res.uid === 'string' && res.uid ? res.uid : uid;
          setCurrentUser(canonical);
          setCurrentUserSigil(canonical);
          onAuthenticated(canonical);
          return;
        }

        if (res.lockout_active) {
          const raw = Number(res.retry_after_seconds ?? 0);
          const retry = Number.isFinite(raw) && raw > 0 ? Math.ceil(raw) : 60;
          setError({ kind: 'lockout', retryAfterSeconds: retry });
        } else {
          setError({
            kind: 'invalid_credentials',
            message: 'Athlete id or PIN incorrect.',
          });
        }
      } catch (err) {
        setError({
          kind: 'network',
          message:
            err instanceof Error && err.message
              ? err.message
              : 'Network error reaching the vault. Try again.',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [uidInput, pinInput, submitting, onAuthenticated]
  );

  const errorIsInputBlame =
    error?.kind === 'invalid_input' || error?.kind === 'invalid_credentials';
  const errorIsPinBlame =
    error?.kind === 'invalid_credentials' || error?.kind === 'lockout';

  return (
    <main style={styles.root}>
      <form onSubmit={handleSubmit} style={styles.card} noValidate>
        <header style={styles.header}>
          <div style={styles.kicker}>Build Believe Fit</div>
          <h1 style={styles.title}>Athlete Vault</h1>
          <div style={styles.sub}>Enter your athlete id and PIN to continue.</div>
        </header>

        <label style={styles.field}>
          <span style={styles.fieldLabel}>Athlete id</span>
          <input
            type="text"
            name="bbf-uid"
            autoComplete="username"
            inputMode="text"
            spellCheck={false}
            autoCapitalize="off"
            disabled={submitting}
            value={uidInput}
            onChange={(e) => setUidInput(e.target.value)}
            placeholder="e.g. firstname_bbf"
            style={styles.input}
            aria-invalid={errorIsInputBlame || undefined}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.fieldLabel}>PIN</span>
          <input
            type="password"
            name="bbf-pin"
            autoComplete="current-password"
            inputMode="numeric"
            disabled={submitting}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="••••"
            style={styles.input}
            aria-invalid={errorIsPinBlame || undefined}
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          style={{
            ...styles.submit,
            ...(submitting ? styles.submitBusy : null),
          }}
        >
          {submitting ? 'Verifying…' : 'Enter Vault'}
        </button>

        {error && (
          <div role="alert" style={styles.error}>
            {renderError(error)}
          </div>
        )}

        <footer style={styles.footer}>
          Trouble signing in? Reach out to your coach.
        </footer>
      </form>
    </main>
  );
}

function renderError(error: LoginError): string {
  switch (error.kind) {
    case 'lockout':
      return `Account locked · retry in ${error.retryAfterSeconds}s.`;
    case 'invalid_input':
    case 'invalid_credentials':
    case 'network':
      return error.message;
  }
}

const styles: Record<string, CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    background:
      'radial-gradient(circle at 30% 20%, #14202c 0%, #0b0d10 60%, #06070a 100%)',
    color: '#e8eaed',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem',
    background: '#11151a',
    border: '1px solid #1f262f',
    borderRadius: '0.9rem',
    boxShadow: '0 22px 40px -24px rgba(0,0,0,0.6)',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  kicker: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#fbbf24',
    fontWeight: 600,
  },
  title: { margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.01em' },
  sub: { fontSize: '0.85rem', opacity: 0.65 },
  field: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  fieldLabel: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    opacity: 0.7,
    fontWeight: 600,
  },
  input: {
    appearance: 'none',
    background: '#0a0f14',
    border: '1px solid #2a323d',
    borderRadius: '0.5rem',
    padding: '0.7rem 0.85rem',
    color: '#e8eaed',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    outline: 'none',
  },
  submit: {
    appearance: 'none',
    background: '#34d399',
    color: '#062e1e',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.8rem 1rem',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
    marginTop: '0.25rem',
  },
  submitBusy: { opacity: 0.6, cursor: 'wait' },
  error: {
    fontSize: '0.85rem',
    color: '#fca5a5',
    background: '#2a1212',
    border: '1px solid #5c1f1f',
    borderRadius: '0.5rem',
    padding: '0.55rem 0.7rem',
  },
  footer: {
    fontSize: '0.74rem',
    opacity: 0.55,
    textAlign: 'center',
    marginTop: '0.2rem',
  },
};
