// src/pages/PathfinderPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Standalone /pathfinder route — the landing target for the /burn Metabolic
// Gateway handoff. It reads the biometrics passed in React Router location state
// (navigate('/pathfinder', { state: { prefill } })) and hands them to
// <PathfinderForm prefill={...}>, which seeds its biometric fields so a prospect
// who came from the calculator never re-types age / weight / height / gender.
//
// Direct visits to /pathfinder (no state) simply render an empty intake. The
// in-page Pathfinder inside MarketingLanding (#pathfinder deck tab) is unchanged;
// this is an additive, deep-linkable surface — not a replacement.
//
// When the prospect arrives via the /select-tier upsell bridge, location state
// also carries a `checkout` object ({ priceId, tierName, price }); we forward it
// to PathfinderForm so the post-submit success card surfaces the screening-gated
// Stripe handoff for the chosen tier. Absent (direct visit / top-of-funnel) →
// the form just collects the application with no checkout step.

import { Link, useLocation } from 'react-router-dom';
import PathfinderForm from '../components/PathfinderForm.jsx';
import { useLang } from '../context/LangContext.jsx';

export default function PathfinderPage() {
  const { t } = useLang();
  const location = useLocation();
  const prefill = location.state?.prefill || null;
  const checkout = location.state?.checkout || null;

  return (
    <div style={st.screen}>
      <div style={st.shell}>
        <Link to="/" style={st.back}>← Build Believe Fit</Link>
        <div style={st.head}>
          <div style={st.kicker}>{t('pf-lbl')}</div>
          <h1 style={st.h1}>{t('pf-h')}</h1>
          <p style={st.sub}>{t('pf-sub')}</p>
        </div>
        <PathfinderForm prefill={prefill} checkout={checkout} />
      </div>
    </div>
  );
}

const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";

const st = {
  screen: { minHeight: '100vh', width: '100%', boxSizing: 'border-box', background: 'radial-gradient(120% 80% at 50% 0%, rgba(30,3,64,.6), #090909 70%)', padding: 'clamp(18px,4vw,48px) clamp(14px,4vw,24px)', display: 'flex', justifyContent: 'center' },
  shell: { width: '100%', maxWidth: 520 },
  back: { display: 'inline-block', fontFamily: BODY, fontSize: '.85rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', textDecoration: 'none', marginBottom: 'clamp(16px,3vw,26px)' },
  head: { textAlign: 'center', marginBottom: 22 },
  kicker: { fontFamily: BODY, fontSize: '.72rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#9D27C9' },
  h1: { fontFamily: HEAD, fontSize: 'clamp(2rem,7vw,2.8rem)', letterSpacing: '1.5px', color: '#fff', margin: '.35rem 0 .55rem', lineHeight: 1 },
  sub: { fontFamily: BODY, fontSize: '.98rem', color: 'rgba(255,255,255,.62)', lineHeight: 1.5, margin: '0 auto', maxWidth: 420 },
};
