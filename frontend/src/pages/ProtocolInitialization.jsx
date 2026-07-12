// src/pages/ProtocolInitialization.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PROTOCOL INITIALIZATION — the guest funnel's screening-first entry ritual.
//
// Explorer Mode's 'Break the Loop' portal (and every gated preview it fronts —
// Biometric Sync, Coach Audio) routes here instead of straight to pricing. This
// screen embeds the REAL Pathfinder intake (<PathfinderForm> — the liability
// shield, PAR-Q screening, and lead capture, byte-for-byte unchanged) and asks
// nothing the visitor hasn't already answered: biometrics carried in router
// state from /burn or /explore seed the form via `prefill`.
//
// Screening BEFORE pricing: `onComplete` fires the moment the intake submits
// successfully — no `checkout` prop is passed here (no tier is chosen yet), so
// PathfinderForm skips its own success/checkout card entirely and this screen
// takes over, forwarding the same biometrics onward and landing the visitor on
// /select-tier to pick a plan now that sovereign execution is unlocked.
//
// This is intentionally a SEPARATE route from /pathfinder — the existing
// /select-tier → /pathfinder(+checkout) → Stripe bridge (TierSelectionPitch)
// stays untouched for visitors who pick a tier first; this route serves the
// opposite order the Explorer funnel now uses.

import { useNavigate, useLocation } from 'react-router-dom';
import PathfinderForm from '../components/PathfinderForm.jsx';
import { useLang } from '../context/LangContext.jsx';

const L10N = {
  en: {
    kicker: 'Protocol Initialization',
    h1: 'Initialize Your Sovereign Protocol',
    sub: 'A 60-second screening — the single gateway to full sovereign execution. Clear it once and the entire engine adapts to YOUR biometrics, every single day.',
  },
  es: {
    kicker: 'Inicialización de Protocolo',
    h1: 'Inicializa Tu Protocolo Soberano',
    sub: 'Una revisión de 60 segundos — la única puerta a la ejecución soberana completa. Complétala una vez y todo el motor se adapta a TUS biométricos, cada día.',
  },
  pt: {
    kicker: 'Inicialização de Protocolo',
    h1: 'Inicialize Seu Protocolo Soberano',
    sub: 'Uma triagem de 60 segundos — a única porta para a execução soberana completa. Complete uma vez e todo o motor se adapta aos SEUS biométricos, todos os dias.',
  },
};

export default function ProtocolInitialization() {
  const { lang } = useLang();
  const L = L10N[lang] || L10N.en;
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill || null;

  // The intake just collected/confirmed these biometrics — forward them
  // untouched to the pricing grid so /select-tier never re-asks.
  function handleComplete() {
    navigate('/select-tier', { state: { prefill } });
  }

  return (
    <div style={st.screen}>
      <div style={st.shell}>
        <div style={st.head}>
          <div style={st.kicker}>{L.kicker}</div>
          <h1 style={st.h1}>{L.h1}</h1>
          <p style={st.sub}>{L.sub}</p>
        </div>
        <PathfinderForm prefill={prefill} onComplete={handleComplete} />
      </div>
    </div>
  );
}

const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";

const st = {
  screen: { minHeight: '100vh', width: '100%', boxSizing: 'border-box', background: 'radial-gradient(120% 80% at 50% 0%, rgba(30,3,64,.6), #090909 70%)', padding: 'clamp(18px,4vw,48px) clamp(14px,4vw,24px)', display: 'flex', justifyContent: 'center' },
  shell: { width: '100%', maxWidth: 520 },
  head: { textAlign: 'center', marginBottom: 22 },
  kicker: { fontFamily: BODY, fontSize: '.72rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#9D27C9' },
  h1: { fontFamily: HEAD, fontSize: 'clamp(2rem,7vw,2.8rem)', letterSpacing: '1.5px', color: '#fff', margin: '.35rem 0 .55rem', lineHeight: 1 },
  sub: { fontFamily: BODY, fontSize: '.98rem', color: 'rgba(255,255,255,.62)', lineHeight: 1.5, margin: '0 auto', maxWidth: 420 },
};
