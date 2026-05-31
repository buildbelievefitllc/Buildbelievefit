// src/pages/PublicTerminal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 12 — Public catch-surface for the apex cutover.
//
// Unauthenticated visitors hitting the root (the old marketing site) land HERE
// instead of being force-redirected to /login. PLACEHOLDER landing — it preserves
// the brand, a live sign-in path for existing members, and an enquiry channel so
// prospects are not dead-ended.
//
// ⚠️ NOT a replacement for the marketing/conversion funnel. The Pathfinder signup
// that feeds the Comlink leads pipeline is NOT migrated here — see the cutover
// notes; the funnel must be migrated or preserved or new-lead capture stops.

import { useNavigate } from 'react-router-dom';

export default function PublicTerminal() {
  const navigate = useNavigate();

  return (
    <div style={styles.screen}>
      <div style={styles.hero}>
        <div style={styles.logo}>BUILD BELIEVE <span style={{ color: 'var(--yel)' }}>FIT</span></div>
        <div style={styles.kicker}>Universal Human Optimization</div>
        <h1 style={styles.title}>Strength. Joint Health. Cardio.<br />Engineered.</h1>
        <p style={styles.body}>
          The Sovereign platform is being upgraded. Members can sign in below;
          new transformations are taking enquiries directly.
        </p>
        <button type="button" style={styles.cta} onClick={() => navigate('/login')}>
          Member Sign In →
        </button>
        <a style={styles.link} href="mailto:buildbelievefit@gmail.com?subject=Build%20Believe%20Fit%20%E2%80%94%20Coaching%20Enquiry">
          Start your transformation →
        </a>
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
    background: 'linear-gradient(180deg, var(--purp) 0%, var(--blk) 60%)',
  },
  hero: { maxWidth: 560, width: '100%', textAlign: 'center' },
  logo: { fontFamily: 'var(--hb)', fontSize: '2.2rem', fontWeight: 900, letterSpacing: '4px', marginBottom: '1rem' },
  kicker: { fontFamily: 'var(--hb)', fontSize: '.74rem', letterSpacing: '4px', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '1.2rem' },
  title: { fontFamily: 'var(--display)', fontSize: '2.6rem', lineHeight: 1.05, letterSpacing: '1px', margin: '0 0 1.1rem' },
  body: { fontFamily: 'var(--bd)', fontSize: '1.02rem', fontWeight: 600, lineHeight: 1.55, color: 'var(--mut)', margin: '0 auto 1.8rem', maxWidth: '46ch' },
  cta: {
    fontFamily: 'var(--hb)',
    fontSize: '1rem',
    fontWeight: 900,
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: '#090909',
    background: 'var(--yel)',
    border: 'none',
    borderRadius: 10,
    padding: '1rem 2rem',
    cursor: 'pointer',
    display: 'inline-block',
  },
  link: { display: 'block', marginTop: '1.4rem', fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-soft)' },
};
