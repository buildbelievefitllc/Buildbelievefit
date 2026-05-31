// src/components/AdminGuard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 — RBAC perimeter for the Sovereign Command Center.
//
// The Command Center is an ADMIN/COACH surface. This guard physically gates the
// route BEFORE the shell mounts — a non-admin never renders <MasterLayout> or
// <CommandCenter>. Four outcomes, in order:
//
//   loading            → minimal auth screen (no shell)
//   no session         → redirect to /login
//   session, not admin → <Unauthorized> denial screen (NOT the shell) + sign-out
//   session + admin    → <MasterLayout>{children}</MasterLayout>
//
// Authorization is sourced from AuthContext.isAdmin (role admin/trainer, or the
// `akeem` CEO fallback). Fail-closed: unknown/empty role → denied.
//
// ⚠️ SCOPE: this is a CLIENT-SIDE perimeter/UX control, not the security boundary.
// The real protection is server-side — Client Hub needs BBF_COACH_AGENT_TOKEN,
// Comlink needs BBF_ADMIN_TOKEN, the Panopticon is anon+RLS — so a determined
// non-admin who bypasses this guard still pulls no privileged data. RBAC hides the
// admin UI and stops casual/accidental access.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import MasterLayout from './MasterLayout.jsx';

export default function AdminGuard({ children }) {
  const { user, loading, isAdmin, signOut } = useAuth();

  if (loading) return <GateScreen>Authenticating…</GateScreen>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Unauthorized username={user.username} onSignOut={signOut} />;

  return <MasterLayout>{children}</MasterLayout>;
}

// Bare auth screen shown while the session resolves — deliberately NOT the shell.
function GateScreen({ children }) {
  return (
    <div style={styles.screen}>
      <div style={styles.note} role="status" aria-live="polite">{children}</div>
    </div>
  );
}

// Denial screen for authenticated-but-unauthorized users. Standalone — no sidebar,
// no Command Center. Offers a sign-out (which redirects to /login) and a route
// back to the public site.
function Unauthorized({ username, onSignOut }) {
  return (
    <div style={styles.screen}>
      <div style={styles.card} role="alert">
        <div style={styles.mark} aria-hidden="true">✕</div>
        <div style={styles.kicker}>Access Restricted</div>
        <h1 style={styles.title}>Command Center Locked</h1>
        <p style={styles.body}>
          The Sovereign Command Center is reserved for the administrative tier.
          {username ? ` The account @${username} is not cleared for this surface.` : ''}
          {' '}If you believe this is in error, contact the head coach.
        </p>
        <button type="button" style={styles.signout} onClick={onSignOut}>Sign Out</button>
        <a style={styles.link} href="https://buildbelievefit.fitness">← Return to buildbelievefit.fitness</a>
      </div>
    </div>
  );
}

const styles = {
  screen: {
    minHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: 'linear-gradient(180deg, var(--purp) 0%, var(--blk) 55%)',
  },
  note: { fontFamily: 'var(--bd)', fontSize: '.95rem', fontWeight: 600, letterSpacing: '.5px', color: 'var(--mut)' },
  card: {
    maxWidth: 460,
    width: '100%',
    textAlign: 'center',
    background: 'var(--gry)',
    border: '1px solid var(--line)',
    borderRadius: 16,
    padding: '2.4rem 2rem',
  },
  mark: {
    width: 56,
    height: 56,
    margin: '0 auto 1.2rem',
    borderRadius: '50%',
    border: '2px solid var(--red)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--hb)',
    fontSize: '1.6rem',
    color: 'var(--red)',
  },
  kicker: { fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '.5rem' },
  title: { fontFamily: 'var(--display)', fontSize: '1.9rem', letterSpacing: '1px', margin: '0 0 .8rem' },
  body: { fontFamily: 'var(--bd)', fontSize: '.98rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--mut)', margin: '0 0 1.6rem' },
  signout: {
    width: '100%',
    fontFamily: 'var(--hb)',
    fontSize: '.82rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#090909',
    background: 'var(--yel)',
    border: '1px solid var(--yel)',
    borderRadius: 10,
    padding: '.85rem',
    cursor: 'pointer',
    marginBottom: '1rem',
  },
  link: { fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--gold-soft)' },
};
