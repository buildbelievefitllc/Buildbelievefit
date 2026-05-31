// src/pages/ClientVault.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 12 — Client catch-surface for the apex cutover.
//
// When buildbelievefit.fitness moves to the React engine, authenticated NON-admin
// users (role client / athlete) land HERE instead of the admin RBAC denial screen.
// This is a PLACEHOLDER holding surface — the full Sovereign Vault (training,
// nutrition, logging) is a later migration. It exists so the cutover drops no
// client onto a dead end: account stays active, data is untouched (it lives in
// Supabase, not here), and the user has a clear, branded landing + sign-out.

import { useAuth } from '../context/AuthContext.jsx';

export default function ClientVault() {
  const { user, signOut } = useAuth();
  const who = user?.username ? `@${user.username}` : 'Athlete';

  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <div style={styles.logo}>BUILD BELIEVE <span style={{ color: 'var(--yel)' }}>FIT</span></div>
        <div style={styles.kicker}>Sovereign Vault</div>
        <h1 style={styles.title}>Welcome, {who}</h1>
        <p style={styles.body}>
          Your Vault is being upgraded to the new Sovereign engine. Your account is active
          and all of your training and nutrition data is safe — the full experience is
          migrating here now. Hold tight; your coach has you.
        </p>
        <button type="button" style={styles.signout} onClick={signOut}>Sign Out</button>
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
  card: {
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
    background: 'var(--gry)',
    border: '1px solid var(--line)',
    borderRadius: 16,
    padding: '2.6rem 2rem',
  },
  logo: { fontFamily: 'var(--hb)', fontSize: '1.5rem', fontWeight: 900, letterSpacing: '3px', marginBottom: '1.2rem' },
  kicker: { fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '.5rem' },
  title: { fontFamily: 'var(--display)', fontSize: '2rem', letterSpacing: '1px', margin: '0 0 .9rem' },
  body: { fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 600, lineHeight: 1.55, color: 'var(--mut)', margin: '0 0 1.7rem' },
  signout: {
    width: '100%',
    fontFamily: 'var(--hb)',
    fontSize: '.82rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'var(--gold-soft)',
    background: 'none',
    border: '1px solid rgba(245,200,0,.3)',
    borderRadius: 10,
    padding: '.85rem',
    cursor: 'pointer',
  },
};
