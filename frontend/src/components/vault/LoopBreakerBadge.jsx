// src/components/vault/LoopBreakerBadge.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — "BBF LOOP BREAKER" status designation.
//
// Renders ONLY when the athlete has crossed the 12-week (84-day) macrocycle
// threshold (useProgramDay().isLoopBreaker — enrolled >= 84 days, per-athlete).
// Premium visual weight on a matte-black surface (an APPROVED canvas, never a CTA):
// BBF Gold (#f5c800) + a brushed-titanium accent + the locked BBF Purple (#6a0dad).
// Self-contained trilingual chrome (EN/ES/PT), mirroring SovereignBriefingCard.
//
// There is intentionally NO legacy "Phase 1: Initiate" badge to strip — none ever
// existed in the SPA — so this is a pure additive status upgrade.

const LB_STR = {
  en: { kicker: 'Macrocycle Status', title: 'BBF Loop Breaker', sub: 'You have broken the 12-week loop.', day: (n) => `Day ${n} on protocol` },
  es: { kicker: 'Estado del Macrociclo', title: 'BBF Loop Breaker', sub: 'Has roto el ciclo de 12 semanas.', day: (n) => `Día ${n} en el protocolo` },
  pt: { kicker: 'Status do Macrociclo', title: 'BBF Loop Breaker', sub: 'Você quebrou o ciclo de 12 semanas.', day: (n) => `Dia ${n} no protocolo` },
};

export default function LoopBreakerBadge({ active, daysOnProgram, lang = 'en' }) {
  if (!active) return null;
  const tr = LB_STR[lang] || LB_STR.en;
  return (
    <section className="vh-loop-breaker" data-testid="loop-breaker-badge" style={WRAP}>
      <div style={SHEEN} aria-hidden="true" />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '.9rem' }}>
        <span style={CREST} aria-hidden="true">∞</span>
        <div style={{ minWidth: 0 }}>
          <span style={KICKER}>◆ {tr.kicker}</span>
          <h3 style={TITLE}>{tr.title}</h3>
          <p style={SUB}>{tr.sub}</p>
        </div>
        {Number.isFinite(daysOnProgram) ? (
          <span style={DAYPILL} data-testid="loop-breaker-day">{tr.day(daysOnProgram)}</span>
        ) : null}
      </div>
    </section>
  );
}

// Matte-black canvas (approved surface) with a purple→black field, a hairline gold
// frame, and a brushed-titanium edge highlight. Gold + titanium read "premium" without
// turning the badge into a load-bearing CTA (brand guardrail §2).
const WRAP = {
  position: 'relative', overflow: 'hidden', margin: '0 0 1rem', padding: '.9rem 1.1rem',
  borderRadius: 16, border: '1px solid rgba(245,200,0,.55)',
  background: 'linear-gradient(135deg, #090909 0%, rgba(106,13,173,.55) 100%)',
  boxShadow: '0 0 0 1px rgba(200,204,212,.18) inset, 0 6px 24px rgba(0,0,0,.35)',
};
const SHEEN = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: 'linear-gradient(105deg, transparent 35%, rgba(200,204,212,.16) 50%, transparent 65%)',
};
// Brushed-titanium crest holding the BBF Gold infinity mark.
const CREST = {
  flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 44, height: 44, borderRadius: 12, fontSize: '1.5rem', fontWeight: 700, color: '#f5c800',
  background: 'linear-gradient(145deg,#e7e9ee,#9aa0ac)', border: '1px solid rgba(255,255,255,.35)',
  textShadow: '0 1px 1px rgba(0,0,0,.35)',
};
const KICKER = { fontFamily: 'var(--hb)', fontSize: '.62rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#c8ccd4' };
const TITLE = { fontFamily: 'var(--hb)', fontSize: '1.55rem', margin: '.1rem 0 .15rem', letterSpacing: '1px', lineHeight: 1, color: '#f5c800' };
const SUB = { margin: 0, color: 'rgba(244,238,251,.86)', fontSize: '.86rem', lineHeight: 1.4 };
const DAYPILL = {
  marginLeft: 'auto', flex: '0 0 auto', alignSelf: 'flex-start', whiteSpace: 'nowrap',
  fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '.8px', textTransform: 'uppercase', fontWeight: 700,
  color: '#090909', background: 'linear-gradient(90deg,#f5c800,#ffd83a)', borderRadius: 999, padding: '.25rem .7rem',
};
