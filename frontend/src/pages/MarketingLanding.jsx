// src/pages/MarketingLanding.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 — the Build Believe Fit marketing site, restored into React.
//
// Faithful rebuild of the legacy index.html landing (copy, layout, brand, media)
// translated to JSX with inline styles mirroring the originals — responsive via
// the same clamp() typography + auto-fit grids the legacy used (no media queries
// required). Media assets migrated to /public/media. The Phase 13 lead engine is
// embedded VERBATIM as <PathfinderForm> at the #pathfinder anchor, exactly where
// the legacy application form sat — its data contract is unchanged.
//
// Deferred (interactive engines, follow-up phases): the live TDEE calculator, the
// AI "Interrogator" quiz, trilingual i18n runtime, and the secondary nutrition-
// lite form. The brand surface + primary conversion funnel are restored here.

import { useNavigate } from 'react-router-dom';
import PathfinderForm from '../components/PathfinderForm.jsx';

const GOLD = '#f5c800';
const BODY = "'Barlow Condensed',sans-serif";
const HEAD = "'Bebas Neue',sans-serif";
const DISPLAY = "'Anton',sans-serif";

export default function MarketingLanding() {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      {/* ── NAV ── */}
      <nav style={styles.nav}>
        <a href="#hero" style={styles.navLogo} aria-label="Build Believe Fit home">
          <span style={styles.navLogoText}>BUILD BELIEVE <span style={{ color: GOLD }}>FIT</span></span>
        </a>
        <div style={styles.navLinks}>
          <a href="#programs" style={styles.navLink}>Programs</a>
          <a href="#founder" style={styles.navLink}>Founder</a>
          <a href="#transformation" style={styles.navLink}>Results</a>
          <button type="button" style={styles.navSignIn} onClick={() => navigate('/login')}>Sign In</button>
          <a href="#pathfinder" style={styles.navCta}>Apply Now</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="hero" style={styles.hero}>
        <video autoPlay muted loop playsInline poster="/media/bbf-photo.jpg" style={styles.heroVideo}>
          <source src="/media/bbf_source_v2_compressed.mp4" type="video/mp4" />
        </video>
        <div style={styles.heroScrim} />
        <div style={styles.heroInner}>
          <h1 style={styles.heroStack} aria-label="Build Believe Fit">
            <span style={{ display: 'block' }}>BUILD</span>
            <span style={{ display: 'block' }}>BELIEVE</span>
            <span style={{ display: 'block' }}>FIT</span>
          </h1>
          <p style={styles.heroTag}>Universal Human Optimization</p>
          <p style={styles.heroSub}>Strength · Joint Health · Cardio</p>
          <a href="#pathfinder" style={styles.heroCta}>START YOUR PATH</a>
        </div>
      </section>

      {/* ── PROGRAMS ── */}
      <section id="programs" style={styles.sectionWide}>
        <h2 style={styles.secH}>CHOOSE YOUR PATH</h2>
        <p style={styles.secSub}>Three ways to train with BBF</p>
        <div style={styles.progGrid}>
          <ProgramCard name="YOUTH ATHLETE" price="$197" copy="Sport-specific strength & conditioning for the next generation. Build the engine early." />
          <ProgramCard name="SOVEREIGN ADULT" price="$297" copy="16/8 intermittent fasting protocol fused with clinical hypertrophy. For the disciplined professional." />
          <ProgramCard name="NUTRITION" price="$67" copy="Personalized meal architecture aligned to your training and metabolic profile." />
        </div>
      </section>

      <Divider />

      {/* ── FOUNDER ── */}
      <section id="founder" style={styles.section}>
        <h2 style={styles.secH}>THE FOUNDER</h2>
        <p style={styles.founderKicker}>NASM Certified Personal Trainer</p>
        <div style={styles.founderGrid}>
          <img src="/media/akeem-nasm.jpg" alt="Akeem — NASM Certified Personal Trainer" loading="lazy" style={styles.founderImg} />
          <div>
            <p style={styles.founderP}>
              I&apos;m Akeem — founder of Build Believe Fit. After years in the trenches of strength &amp;
              conditioning, I built BBF to deliver one thing: <strong style={{ color: GOLD }}>elite coaching,
              engineered for your life.</strong>
            </p>
            <p style={styles.founderP}>
              Every program is built on NASM-certified methodology, periodized for real progress, and backed
              by a nutrition system that actually fits how you live.
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── TRANSFORMATION ── */}
      <section id="transformation" style={styles.section}>
        <h2 style={styles.secH}>THE BBF STANDARD</h2>
        <p style={styles.secSub}>Engineered, not guessed. Every protocol is periodized, tracked, and adjusted.</p>
        <div style={styles.proofGrid}>
          <figure style={styles.proofFig}>
            <img src="/media/akeem-before.png" alt="Before" loading="lazy" style={styles.proofImg} />
            <figcaption style={styles.proofCap}>Before</figcaption>
          </figure>
          <figure style={styles.proofFig}>
            <img src="/media/akeem-after.png" alt="After" loading="lazy" style={styles.proofImg} />
            <figcaption style={{ ...styles.proofCap, color: GOLD }}>After</figcaption>
          </figure>
          <figure style={styles.proofFig}>
            <img src="/media/verification5.png" alt="Verified results" loading="lazy" style={styles.proofImg} />
            <figcaption style={styles.proofCap}>Verified</figcaption>
          </figure>
        </div>
      </section>

      <Divider />

      {/* ── PATHFINDER (the embedded Phase 13 form) ── */}
      <section id="pathfinder" style={styles.sectionWide}>
        <p style={styles.pfKicker}>The Pathfinder Protocol</p>
        <h2 style={styles.secH}>FIND YOUR PATH</h2>
        <p style={styles.secSub}>
          The Pathfinder analyzes your goals, body, and schedule to architect your ideal program.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <PathfinderForm />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={styles.footer}>
        <div style={styles.footLogo}>BUILD BELIEVE <span style={{ color: GOLD }}>FIT</span></div>
        <p style={styles.footTag}>Universal Human Optimization · Strength · Joint Health · Cardio</p>
        <div style={styles.footLinks}>
          <button type="button" style={styles.footLink} onClick={() => navigate('/login')}>Member Sign In</button>
          <a style={styles.footLink} href="mailto:buildbelievefit@gmail.com">Contact</a>
        </div>
        <p style={styles.footCopy}>© {new Date().getFullYear()} Build Believe Fit LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}

function ProgramCard({ name, price, copy }) {
  return (
    <article style={styles.progCard}>
      <div style={styles.progName}>{name}</div>
      <p style={styles.progCopy}>{copy}</p>
      <div style={styles.progPrice}>{price}<span style={styles.progPer}>/mo</span></div>
    </article>
  );
}

function Divider() {
  return <div style={styles.divider} />;
}

const styles = {
  page: { background: '#090909', color: '#fff', minHeight: '100%', overflowX: 'hidden' },

  nav: {
    position: 'sticky', top: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 clamp(16px,4vw,40px)', height: 64, background: 'rgba(9,9,9,.72)',
    backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    borderBottom: '1px solid rgba(245,200,0,.12)',
  },
  navLogo: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
  navLogoText: { fontFamily: HEAD, fontSize: '1.5rem', letterSpacing: '2px', color: '#fff' },
  navLinks: { display: 'flex', alignItems: 'center', gap: 'clamp(10px,2.5vw,24px)' },
  navLink: { fontFamily: BODY, fontSize: '.95rem', letterSpacing: '1px', color: 'rgba(255,255,255,.82)', textDecoration: 'none', textTransform: 'uppercase', fontWeight: 600 },
  navSignIn: { fontFamily: BODY, fontSize: '.95rem', letterSpacing: '1px', color: 'rgba(255,255,255,.82)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 600, padding: 0 },
  navCta: { fontFamily: BODY, fontSize: '.9rem', letterSpacing: '1px', padding: '8px 20px', background: GOLD, color: '#090909', borderRadius: 6, textDecoration: 'none', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' },

  hero: { position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden' },
  heroVideo: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
  heroScrim: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(9,9,9,.55),rgba(9,9,9,.8))', zIndex: 1 },
  heroInner: { position: 'relative', zIndex: 2, padding: '0 clamp(16px,4vw,40px)', maxWidth: 900 },
  heroStack: { fontFamily: DISPLAY, fontSize: 'clamp(3rem,12vw,8rem)', lineHeight: .9, letterSpacing: '1px', color: '#fff', margin: '0 0 16px' },
  heroTag: { fontFamily: BODY, fontSize: 'clamp(1.1rem,3vw,1.6rem)', letterSpacing: '1px', color: 'rgba(255,255,255,.9)', margin: '0 0 8px' },
  heroSub: { fontFamily: BODY, fontSize: 'clamp(.95rem,2vw,1.2rem)', color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 32px' },
  heroCta: { display: 'inline-block', fontFamily: HEAD, fontSize: '1.3rem', letterSpacing: '2px', padding: '16px 48px', background: GOLD, color: '#090909', borderRadius: 8, textDecoration: 'none' },

  section: { maxWidth: 1100, margin: '0 auto', padding: 'clamp(40px,8vw,90px) clamp(16px,4vw,40px)' },
  sectionWide: { maxWidth: 1200, margin: '0 auto', padding: 'clamp(40px,8vw,90px) clamp(16px,4vw,40px)' },
  secH: { fontFamily: HEAD, fontSize: 'clamp(2rem,5vw,3.4rem)', letterSpacing: '1px', color: '#fff', textAlign: 'center', margin: '0 0 8px' },
  secSub: { textAlign: 'center', color: 'rgba(255,255,255,.6)', fontFamily: BODY, fontSize: '1.05rem', letterSpacing: '1px', margin: '0 auto 48px', maxWidth: '60ch' },
  divider: { maxWidth: 900, margin: '0 auto', height: 1, background: 'linear-gradient(90deg,transparent,rgba(245,200,0,.3),transparent)' },

  progGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 },
  progCard: { background: 'linear-gradient(180deg,rgba(20,20,20,.9),rgba(9,9,9,.9))', border: '1px solid rgba(245,200,0,.15)', borderRadius: 16, padding: 32, position: 'relative', overflow: 'hidden' },
  progName: { fontFamily: HEAD, fontSize: '1.8rem', letterSpacing: '1px', color: '#fff', marginBottom: 8 },
  progCopy: { fontFamily: BODY, color: 'rgba(255,255,255,.65)', fontSize: '1rem', lineHeight: 1.5, marginBottom: 20 },
  progPrice: { fontFamily: HEAD, fontSize: '2.4rem', color: GOLD },
  progPer: { fontSize: '1rem', color: 'rgba(255,255,255,.5)' },

  founderKicker: { textAlign: 'center', color: GOLD, fontFamily: BODY, fontSize: '1.05rem', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 40px' },
  founderGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 32, alignItems: 'center' },
  founderImg: { width: '100%', borderRadius: 16, border: '1px solid rgba(245,200,0,.2)', display: 'block' },
  founderP: { fontFamily: BODY, fontSize: '1.15rem', lineHeight: 1.7, color: 'rgba(255,255,255,.86)', marginBottom: 20 },

  proofGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 },
  proofFig: { margin: 0 },
  proofImg: { width: '100%', borderRadius: 14, border: '1px solid rgba(245,200,0,.18)', display: 'block', objectFit: 'cover' },
  proofCap: { fontFamily: HEAD, fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', textAlign: 'center', marginTop: 12 },

  pfKicker: { textAlign: 'center', color: GOLD, fontFamily: BODY, fontSize: '1rem', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 8px' },

  footer: { borderTop: '1px solid rgba(245,200,0,.12)', padding: 'clamp(32px,6vw,56px) clamp(16px,4vw,40px)', textAlign: 'center', background: '#070707' },
  footLogo: { fontFamily: HEAD, fontSize: '1.6rem', letterSpacing: '2px', color: '#fff', marginBottom: 10 },
  footTag: { fontFamily: BODY, fontSize: '.9rem', letterSpacing: '1px', color: 'rgba(255,255,255,.5)', margin: '0 0 18px' },
  footLinks: { display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 },
  footLink: { fontFamily: HEAD, fontSize: '.78rem', letterSpacing: '2px', textTransform: 'uppercase', color: GOLD, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none' },
  footCopy: { fontFamily: BODY, fontSize: '.78rem', letterSpacing: '.5px', color: 'rgba(255,255,255,.35)', margin: 0 },
};
