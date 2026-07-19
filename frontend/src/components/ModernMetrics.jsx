// src/components/ModernMetrics.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Landing · Knowledge deck tab "03 · Modern Metrics" — GLP-1 / peptide weight-loss
// education. A Coach Akeem audio briefing (a PRE-BAKED static asset — zero runtime
// API) flanked by a scannable 3-card grid on preserving lean mass through the shift.
//
// Brand-locked glassmorphism (§2): BBF Purple / Gold edges over dark translucent
// panels. Self-contained styles; slots into the Knowledge deck panel like the
// Science Hub / Routine Interrogator siblings. Responsive by construction
// (auto-fit grid + clamp scaling), so it holds on desktop and mobile alike.

const GOLD = '#F5C800';
const PUR = '#6A0DAD';
const PURL = '#9D27C9';
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";

// The pre-baked Coach Akeem voiceover (public/audio/glp1-coaching-overview.mp3).
const AUDIO_SRC = '/audio/glp1-coaching-overview.mp3';

const CARDS = [
  { idx: '01', title: 'Metabolic Defense', body: 'Forcing muscle preservation via heavy load progressions rather than lean mass wasting.' },
  { idx: '02', title: 'Macro Accounting', body: 'Clear protein targets mapped to your training volume to fuel cellular repair.' },
  { idx: '03', title: 'Closed-Loop Telemetry', body: 'Tracking strength trends over 30, 60, and 90 days to prove your body composition is optimizing.' },
];

export default function ModernMetrics() {
  return (
    <div style={s.wrap} data-testid="modern-metrics">
      <div style={s.kicker}>Modern Metrics</div>
      <h2 style={s.h}>Optimization Beyond the Scale</h2>
      <p style={s.sub}>
        The scale drops fast on a GLP-1 or peptide protocol — but a huge share of that loss can be muscle,
        not fat. Coach Akeem breaks down how to defend your lean mass, then the system that proves it.
      </p>

      {/* Coach Akeem audio briefing — static asset, no dynamic fetching. */}
      <div style={s.audioCard}>
        <div style={s.audioHead}>
          <span style={s.audioMark} aria-hidden="true">▶</span>
          <div>
            <div style={s.audioKicker}>Coach Akeem · Audio Briefing</div>
            <div style={s.audioTitle}>GLP-1 &amp; Peptides — Protect Your Lean Mass</div>
          </div>
        </div>
        <audio style={s.audio} controls preload="none" src={AUDIO_SRC} data-testid="glp1-audio">
          Your browser does not support the audio element.
        </audio>
      </div>

      {/* Scannable 3-card grid. */}
      <div style={s.grid}>
        {CARDS.map((c) => (
          <div key={c.idx} style={s.card}>
            <span style={s.cardIdx}>{c.idx}</span>
            <h3 style={s.cardTitle}>{c.title}</h3>
            <p style={s.cardBody}>{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap: { maxWidth: 1080, margin: '0 auto', padding: 'clamp(22px,4vw,44px) clamp(4px,2vw,12px) 10px' },
  kicker: { textAlign: 'center', fontFamily: BODY, fontSize: '.78rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: PURL, marginBottom: 10 },
  h: { fontFamily: HEAD, fontSize: 'clamp(1.9rem,5vw,3rem)', letterSpacing: '1px', color: '#fff', textAlign: 'center', margin: '0 0 12px' },
  sub: { textAlign: 'center', color: 'rgba(255,255,255,.6)', fontFamily: BODY, fontSize: '1.02rem', lineHeight: 1.5, margin: '0 auto 32px', maxWidth: '60ch' },

  // Glass audio card — gold edge, purple glow, dark translucent + blur.
  audioCard: {
    maxWidth: 720, margin: '0 auto 30px', padding: 'clamp(15px,3vw,22px)',
    borderRadius: 16, border: `1px solid rgba(245,200,0,.28)`,
    background: 'linear-gradient(160deg, rgba(30,3,64,.72), rgba(9,9,9,.82))',
    backdropFilter: 'blur(18px) saturate(150%)', WebkitBackdropFilter: 'blur(18px) saturate(150%)',
    boxShadow: `0 0 44px rgba(106,13,173,.28)`,
  },
  audioHead: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 },
  audioMark: { flex: 'none', width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#090909', background: GOLD, fontSize: '.9rem', boxShadow: `0 0 18px rgba(245,200,0,.5)` },
  audioKicker: { fontFamily: BODY, fontSize: '.72rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: PURL },
  audioTitle: { fontFamily: HEAD, fontSize: '1.2rem', letterSpacing: '.5px', color: '#fff', lineHeight: 1.05 },
  audio: { width: '100%', height: 40, borderRadius: 10 },

  // Responsive 3-card grid — 3-up on desktop, gracefully stacks on mobile.
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 258px), 1fr))', gap: 'clamp(12px,2vw,18px)' },
  card: {
    padding: 'clamp(18px,2.4vw,24px)', borderRadius: 14,
    border: `1px solid rgba(157,39,201,.3)`,
    background: 'linear-gradient(165deg, rgba(30,3,64,.6), rgba(9,9,9,.78))',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    boxShadow: `0 12px 34px -20px ${PUR}`,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  cardIdx: { fontFamily: HEAD, fontSize: '1.7rem', letterSpacing: '1px', color: GOLD, lineHeight: 1 },
  cardTitle: { fontFamily: HEAD, fontSize: '1.15rem', letterSpacing: '.5px', color: '#fff', margin: 0 },
  cardBody: { fontFamily: BODY, fontSize: '.96rem', lineHeight: 1.5, color: 'rgba(255,255,255,.68)', margin: 0 },
};
