// src/pages/DailyBurnCalculator.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Metabolic Gateway — a standalone, jargon-free top-of-funnel lead magnet
// mounted at /burn. NO main-site nav or footer (zero click-aways): the only exit
// is forward, into the /explore mock lab.
//
// TRILINGUAL ENTRANCE: a visible EN | ES | PT selector row sits at the very top
// of the screen (social traffic lands here cold, in three languages). It writes
// through the app's native LangContext (`setLang`), so the choice persists to
// localStorage and travels with the visitor into /explore, the lead capture,
// and the whole funnel. Every calculator string localizes from the L10N table
// below; errors are stored as KEYS so a language toggle re-localizes a live
// error message instantly.
//
// Math reuses the SAME native engine the Pathfinder + TDEE widget run on
// (calcTDEE · Mifflin-St Jeor × activity factor) so the number a prospect sees
// here is byte-identical to what the intake stages — single source of truth. We
// deliberately never surface the words TDEE / BMR / NEAT: the screen speaks in
// "Daily Calorie Burn" only.
//
// The Reveal: results no longer print inline under the form. A valid calculation
// flips `showProfile` and the numbers land inside <MockProfileModal> — a
// full-screen "your profile is ready" overlay that blocks out the page and
// carries the lead capture + the only forward exit (the /explore mock lab).
//
// The Handoff: the modal's primary CTA routes to /explore — the read-only mock
// lab dashboard (ExplorerVault) — carrying the visitor's numbers in the
// bbf.explorer.token.v1 guest envelope. /explore bounces token-less visitors
// back to /burn, so the handoff mints the envelope first if the lead capture
// hasn't already done it. The pricing wall (/select-tier) is reached later,
// from inside the Explorer's own upgrade portals.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext.jsx';
import { calcTDEE } from '../components/vault/nutritionEngine.js';
import TdeeLeadCapture from '../components/TdeeLeadCapture.jsx';
import { startExplorerSession, hasExplorerSession } from '../lib/explorerSession.js';

const GOLD = '#F5C800';
const GOLD_SOFT = '#F5CF60';
const PUR = '#6A0DAD';
const PURL = '#9D27C9';
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";

// Mifflin-St Jeor activity multipliers. The plain-language label the prospect
// reads lives in L10N.activities; the factor is the math they never see.
const ACTIVITY_FACTORS = ['1.2', '1.375', '1.55', '1.725'];

const FAT_LOSS_ADJ = -500; // a moderate deficit
const MUSCLE_ADJ = 250;    // a lean surplus

const LANGS = [['en', 'EN'], ['es', 'ES'], ['pt', 'PT']];

// Full-surface trilingual chrome. EN is the LOCKED ground truth (the strings the
// e2e specs assert against); ES / PT are native-voice equivalents, not word-for-
// word translations.
const L10N = {
  en: {
    kicker: 'Free Metabolic Snapshot',
    h1: 'What Does Your Body Burn?',
    sub: 'Four quick answers. No sign-up. See exactly how many calories your body burns in a day — and the numbers to hit your goal.',
    age: 'Age', gender: 'Gender', male: 'Male', female: 'Female',
    weight: 'Weight (lbs)', height: 'Height', ftPh: 'ft', inPh: 'in',
    activity: 'Daily Activity',
    activities: { 1.2: 'Desk Job', 1.375: 'On my feet', 1.55: 'Active / Workout 3-5 days', 1.725: 'Hard Labor / Athlete' },
    errors: {
      fill: 'Please fill in age, weight, and height.',
      math: 'Those numbers don’t compute — double-check and try again.',
    },
    submit: 'Show My Numbers →',
    reopen: (n) => `View My Metabolic Profile (${n} cal) →`,
    modalKicker: 'Your Metabolic Profile', modalTitle: 'The Numbers Are In',
    burnLbl: 'Your Daily Calorie Burn', burnUnit: 'calories / day to maintain',
    loseFat: 'To Lose Fat', buildMuscle: 'To Build Muscle', perDay: 'calories / day',
    hookText: 'Knowing your numbers is only step one. You need a blueprint to hit them.',
    hookBtn: 'ENTER EXPLORER MODE →',
    close: 'Close profile', langAria: 'Choose language',
  },
  es: {
    kicker: 'Radiografía Metabólica Gratis',
    h1: '¿Cuánto Quema Tu Cuerpo?',
    sub: 'Cuatro respuestas rápidas. Sin registro. Descubre exactamente cuántas calorías quema tu cuerpo al día — y los números para lograr tu meta.',
    age: 'Edad', gender: 'Género', male: 'Hombre', female: 'Mujer',
    weight: 'Peso (lbs)', height: 'Estatura', ftPh: 'pies', inPh: 'pulg',
    activity: 'Actividad Diaria',
    activities: { 1.2: 'Trabajo de oficina', 1.375: 'De pie todo el día', 1.55: 'Activo / Entreno 3-5 días', 1.725: 'Trabajo pesado / Atleta' },
    errors: {
      fill: 'Completa edad, peso y estatura.',
      math: 'Esos números no cuadran — revísalos e inténtalo de nuevo.',
    },
    submit: 'Ver Mis Números →',
    reopen: (n) => `Ver Mi Perfil Metabólico (${n} cal) →`,
    modalKicker: 'Tu Perfil Metabólico', modalTitle: 'Los Números Están Listos',
    burnLbl: 'Tu Quema Calórica Diaria', burnUnit: 'calorías / día para mantener',
    loseFat: 'Para Perder Grasa', buildMuscle: 'Para Ganar Músculo', perDay: 'calorías / día',
    hookText: 'Conocer tus números es solo el primer paso. Necesitas un plan para alcanzarlos.',
    hookBtn: 'ENTRAR AL MODO EXPLORADOR →',
    close: 'Cerrar perfil', langAria: 'Elegir idioma',
  },
  pt: {
    kicker: 'Raio-X Metabólico Grátis',
    h1: 'Quanto Seu Corpo Queima?',
    sub: 'Quatro respostas rápidas. Sem cadastro. Veja exatamente quantas calorias seu corpo queima por dia — e os números para atingir sua meta.',
    age: 'Idade', gender: 'Gênero', male: 'Homem', female: 'Mulher',
    weight: 'Peso (lbs)', height: 'Altura', ftPh: 'pés', inPh: 'pol',
    activity: 'Atividade Diária',
    activities: { 1.2: 'Trabalho de escritório', 1.375: 'Em pé o dia todo', 1.55: 'Ativo / Treino 3-5 dias', 1.725: 'Trabalho pesado / Atleta' },
    errors: {
      fill: 'Preencha idade, peso e altura.',
      math: 'Esses números não fecham — confira e tente de novo.',
    },
    submit: 'Ver Meus Números →',
    reopen: (n) => `Ver Meu Perfil Metabólico (${n} cal) →`,
    modalKicker: 'Seu Perfil Metabólico', modalTitle: 'Os Números Chegaram',
    burnLbl: 'Sua Queima Calórica Diária', burnUnit: 'calorias / dia para manter',
    loseFat: 'Para Perder Gordura', buildMuscle: 'Para Ganhar Músculo', perDay: 'calorias / dia',
    hookText: 'Conhecer seus números é só o primeiro passo. Você precisa de um plano para alcançá-los.',
    hookBtn: 'ENTRAR NO MODO EXPLORADOR →',
    close: 'Fechar perfil', langAria: 'Escolher idioma',
  },
};

export default function DailyBurnCalculator() {
  const navigate = useNavigate();
  const { lang, setLang } = useLang();
  const L = L10N[lang] || L10N.en;
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('male');
  const [weight, setWeight] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [act, setAct] = useState('1.55');
  const [burn, setBurn] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [errorKey, setErrorKey] = useState(null);

  function calculate(e) {
    e.preventDefault();
    const a = parseInt(age, 10) || 0;
    const w = parseFloat(weight) || 0;
    const f = parseInt(ft, 10) || 0;
    const i = parseInt(inch, 10) || 0;
    if (!a || !w || !f) {
      setErrorKey('fill');
      setBurn(null);
      setShowProfile(false);
      return;
    }
    const tdee = calcTDEE(a, sex, w, f, i, parseFloat(act) || 1.55);
    if (!Number.isFinite(tdee) || tdee <= 0) {
      setErrorKey('math');
      setBurn(null);
      setShowProfile(false);
      return;
    }
    setErrorKey(null);
    setBurn(tdee);
    setShowProfile(true);
  }

  // Shared biometric snapshot — the SAME shape rides the lead payload and the
  // Explorer guest-token mint, built once so the two can never drift.
  const biometrics = {
    age: parseInt(age, 10) || null,
    sex,
    weight_lbs: parseFloat(weight) || null,
    height_ft: parseInt(ft, 10) || null,
    height_in: parseInt(inch, 10) || null,
    activity_factor: parseFloat(act) || null,
  };

  // The Handoff — straight into the /explore mock lab. ExplorerVault redirects
  // token-less visitors back to /burn, so if the lead capture hasn't minted the
  // guest envelope yet (onCaptured), mint it here from the same biometrics —
  // the CTA must land inside the lab on every path, captured or not.
  function enterMockLab() {
    if (!hasExplorerSession()) {
      startExplorerSession({
        source: 'daily_burn',
        profile: biometrics,
        targets: { tdee_maintenance: burn },
      });
    }
    navigate('/explore');
  }

  return (
    <div style={st.screen}>
      <div style={st.shell}>
        {/* Trilingual entrance — writes through the app-wide LangContext, so the
            choice persists and follows the visitor into /explore and beyond. */}
        <div style={st.langRow} role="group" aria-label={L.langAria}>
          {LANGS.map(([code, label]) => (
            <button
              key={code}
              type="button"
              style={{ ...st.langBtn, ...(lang === code ? st.langBtnOn : null) }}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
              data-testid={`burn-lang-${code}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={st.brand}>BUILD BELIEVE <b style={{ color: GOLD }}>FIT</b></div>

        <div style={st.head}>
          <div style={st.kicker}>{L.kicker}</div>
          <h1 style={st.h1}>{L.h1}</h1>
          <p style={st.sub}>{L.sub}</p>
        </div>

        <form onSubmit={calculate} style={st.card}>
          <div style={st.grid}>
            <Field label={L.age}>
              <input style={st.input} type="number" inputMode="numeric" min="13" max="100"
                value={age} onChange={(e) => setAge(e.target.value)} />
            </Field>
            <Field label={L.gender}>
              <select style={st.input} value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="male">{L.male}</option>
                <option value="female">{L.female}</option>
              </select>
            </Field>
            <Field label={L.weight}>
              <input style={st.input} type="number" inputMode="decimal" min="50" max="600"
                placeholder="lbs" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
            <Field label={L.height}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={st.input} type="number" inputMode="numeric" min="3" max="8"
                  placeholder={L.ftPh} value={ft} onChange={(e) => setFt(e.target.value)} />
                <input style={st.input} type="number" inputMode="numeric" min="0" max="11"
                  placeholder={L.inPh} value={inch} onChange={(e) => setInch(e.target.value)} />
              </div>
            </Field>
          </div>
          <Field label={L.activity}>
            <select style={st.input} value={act} onChange={(e) => setAct(e.target.value)}>
              {ACTIVITY_FACTORS.map((v) => <option key={v} value={v}>{L.activities[v]}</option>)}
            </select>
          </Field>

          {errorKey ? <div style={st.error} role="alert">{L.errors[errorKey]}</div> : null}

          <button type="submit" style={st.calcBtn}>{L.submit}</button>
        </form>

        {/* Post-close breadcrumb: if they dismiss the profile, the number stays
            reachable — one tap reopens the modal, no recalculation needed. */}
        {burn != null && !showProfile ? (
          <button type="button" style={st.reopenBtn} onClick={() => setShowProfile(true)}>
            {L.reopen(burn.toLocaleString())}
          </button>
        ) : null}
      </div>

      {showProfile && burn != null ? (
        <MockProfileModal
          burn={burn}
          biometrics={biometrics}
          L={L}
          onClose={() => setShowProfile(false)}
          onClaimProfile={enterMockLab}
          onCaptured={() => {
            // EXPLORER MODE gateway — guest token mints the moment the visitor
            // submits their details (no macros on this surface; the sandbox
            // recomputes them live from the stored biometrics). onClaimProfile
            // re-checks hasExplorerSession(), so this just gets there first.
            startExplorerSession({
              source: 'daily_burn',
              profile: biometrics,
              targets: { tdee_maintenance: burn },
            });
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * MockProfileModal — the premium "your profile is ready" reveal surface.
 *
 * Full-viewport overlay (blurred, darkened backdrop · zIndex 9999) over a matte
 * black panel with purple→gold hairline accents. Renders the maintenance burn,
 * the fat-loss (−500) and muscle (+250) targets, the in-modal lead capture, and
 * the only forward exit (the /explore mock lab). Escape or the backdrop closes
 * it; the numbers survive in parent state, so reopening is free.
 *
 * @param {object} props
 * @param {number} props.burn - computed maintenance TDEE (guaranteed finite by caller)
 * @param {object} props.biometrics - snake_case biometric snapshot for the lead payload
 * @param {object} props.L - the active-language string table (L10N[lang])
 * @param {() => void} props.onClose - dismiss the modal (state survives in parent)
 * @param {() => void} props.onClaimProfile - primary CTA → mint-if-missing, then /explore
 * @param {() => void} props.onCaptured - lead saved → mint the Explorer session
 */
function MockProfileModal({
  burn,
  biometrics,
  L,
  onClose,
  onClaimProfile,
  onCaptured,
}) {
  // Lock the page scroll behind the overlay and wire Escape-to-close for the
  // lifetime of the modal; both restore on unmount.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      style={st.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mock-profile-title"
    >
      <div style={st.modal} role="document">
        <div style={st.hairline} aria-hidden="true" />

        <button type="button" style={st.closeBtn} onClick={onClose} aria-label={L.close}>
          ✕
        </button>

        <div style={st.modalBody} role="status" aria-live="polite">
          <div style={st.modalKicker}>{L.modalKicker}</div>
          <h2 id="mock-profile-title" style={st.modalTitle}>{L.modalTitle}</h2>

          <div style={st.burnCard}>
            <div style={st.burnLbl}>{L.burnLbl}</div>
            <div style={st.burnBig}>{burn.toLocaleString()}</div>
            <div style={st.burnUnit}>{L.burnUnit}</div>
          </div>

          <div style={st.splitRow}>
            <GoalCard
              title={L.loseFat}
              value={(burn + FAT_LOSS_ADJ).toLocaleString()}
              note={L.perDay}
            />
            <GoalCard
              title={L.buildMuscle}
              value={(burn + MUSCLE_ADJ).toLocaleString()}
              note={L.perDay}
              gold
            />
          </div>

          {/* Phase 21 — capture the micro-intent lead right here, at the moment
              they see a real number, instead of only at the (much bigger)
              mock-lab ask below. No macros computed on this surface (calcTDEE
              only), so those fields ride as null — the schema is nullable. */}
          <TdeeLeadCapture
            source="daily_burn"
            payload={{ ...biometrics, tdee_maintenance: burn }}
            onCaptured={onCaptured}
          />

          {/* The Hook → the only forward exit: the /explore mock lab. */}
          <div style={st.hook}>
            <div style={st.hookText}>{L.hookText}</div>
            <button type="button" style={st.hookBtn} onClick={onClaimProfile} data-testid="enter-explorer">
              {L.hookBtn}
            </button>
          </div>
        </div>

        <div style={st.hairline} aria-hidden="true" />
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={st.field}>
      <span style={st.fieldLbl}>{label}</span>
      {children}
    </label>
  );
}

function GoalCard({ title, value, note, gold }) {
  return (
    <div style={{ ...st.goalCard, ...(gold ? st.goalCardGold : null) }}>
      <div style={st.goalTitle}>{title}</div>
      <div style={{ ...st.goalVal, color: gold ? GOLD_SOFT : '#fff' }}>{value}</div>
      <div style={st.goalNote}>{note}</div>
    </div>
  );
}

const st = {
  screen: { minHeight: '100vh', width: '100%', boxSizing: 'border-box', background: 'radial-gradient(120% 80% at 50% 0%, rgba(30,3,64,.6), #090909 70%)', padding: 'clamp(20px,5vw,56px) clamp(14px,4vw,24px)', display: 'flex', justifyContent: 'center' },
  shell: { width: '100%', maxWidth: 680 },
  langRow: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 'clamp(12px,2.5vw,18px)' },
  langBtn: { fontFamily: HEAD, fontSize: '.85rem', letterSpacing: '2px', color: 'rgba(255,255,255,.55)', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(157,39,201,.35)', borderRadius: 999, padding: '.35rem .95rem', cursor: 'pointer' },
  langBtnOn: { color: '#1B1106', background: `linear-gradient(180deg, ${GOLD} 0%, #D4AF37 100%)`, border: '1px solid rgba(245,200,0,.7)' },
  brand: { fontFamily: HEAD, fontSize: '1.4rem', letterSpacing: '2px', color: '#fff', textAlign: 'center', marginBottom: 'clamp(20px,4vw,34px)' },
  head: { textAlign: 'center', marginBottom: 24 },
  kicker: { fontFamily: BODY, fontSize: '.72rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: PURL },
  h1: { fontFamily: HEAD, fontSize: 'clamp(2rem,7vw,3rem)', letterSpacing: '1.5px', color: '#fff', margin: '.4rem 0 .6rem', lineHeight: 1 },
  sub: { fontFamily: BODY, fontSize: '1rem', color: 'rgba(255,255,255,.62)', lineHeight: 1.5, margin: '0 auto', maxWidth: 460 },
  card: { background: 'linear-gradient(160deg, rgba(30,3,64,.5), rgba(13,1,26,.85))', border: '1px solid rgba(157,39,201,.3)', borderRadius: 20, padding: 'clamp(20px,4vw,32px)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 },
  fieldLbl: { fontFamily: BODY, fontSize: '.72rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' },
  input: { width: '100%', boxSizing: 'border-box', background: '#0a0414', border: '1px solid rgba(157,39,201,.35)', borderRadius: 8, color: '#fff', fontFamily: BODY, fontSize: '1rem', fontWeight: 600, padding: '.7rem .8rem', outline: 'none' },
  error: { fontFamily: BODY, fontSize: '.88rem', fontWeight: 700, color: '#fca5a5', margin: '4px 0 10px' },
  calcBtn: { width: '100%', marginTop: 6, fontFamily: HEAD, fontSize: '1.1rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', background: `linear-gradient(180deg, ${PURL}, ${PUR})`, border: '1px solid rgba(157,39,201,.6)', borderRadius: 10, padding: '.9rem', cursor: 'pointer' },
  reopenBtn: { width: '100%', marginTop: 14, fontFamily: HEAD, fontSize: '1rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: GOLD_SOFT, background: 'rgba(8,2,18,.7)', border: '1px solid rgba(245,200,0,.35)', borderRadius: 10, padding: '.85rem', cursor: 'pointer' },

  // ── MockProfileModal ────────────────────────────────────────────────────────
  overlay: { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(4,1,10,.78)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px,3vw,28px)', overflowY: 'auto' },
  modal: { position: 'relative', width: '100%', maxWidth: 560, maxHeight: '92dvh', overflowY: 'auto', background: '#090909', border: '1px solid rgba(157,39,201,.35)', borderRadius: 20, boxShadow: '0 30px 80px rgba(0,0,0,.75), 0 0 60px rgba(106,13,173,.25)' },
  hairline: { height: 1, background: `linear-gradient(90deg, transparent 0%, ${PUR} 30%, ${GOLD} 70%, transparent 100%)` },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 1, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(157,39,201,.12)', border: '1px solid rgba(157,39,201,.4)', borderRadius: '50%', color: 'rgba(255,255,255,.75)', fontFamily: BODY, fontSize: '.95rem', fontWeight: 700, lineHeight: 1, cursor: 'pointer' },
  modalBody: { padding: 'clamp(22px,5vw,34px)' },
  modalKicker: { fontFamily: BODY, fontSize: '.7rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: PURL, textAlign: 'center' },
  modalTitle: { fontFamily: HEAD, fontSize: 'clamp(1.7rem,6vw,2.3rem)', letterSpacing: '1.5px', color: '#fff', textAlign: 'center', lineHeight: 1, margin: '.35rem 0 1.1rem' },
  burnCard: { background: 'rgba(8,2,18,.7)', border: `1px solid rgba(245,200,0,.3)`, borderRadius: 16, padding: 'clamp(20px,4vw,30px)', textAlign: 'center' },
  burnLbl: { fontFamily: BODY, fontSize: '.8rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' },
  burnBig: { fontFamily: HEAD, fontSize: 'clamp(3rem,12vw,4.4rem)', letterSpacing: '2px', color: GOLD_SOFT, lineHeight: 1, margin: '.2rem 0' },
  burnUnit: { fontFamily: BODY, fontSize: '.8rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' },
  splitRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '14px 0' },
  goalCard: { background: 'rgba(157,39,201,.1)', border: '1px solid rgba(157,39,201,.3)', borderRadius: 14, padding: 'clamp(16px,3vw,22px) 12px', textAlign: 'center' },
  goalCardGold: { background: 'rgba(245,200,0,.08)', border: '1px solid rgba(245,200,0,.32)' },
  goalTitle: { fontFamily: BODY, fontSize: '.82rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' },
  goalVal: { fontFamily: HEAD, fontSize: 'clamp(1.9rem,7vw,2.6rem)', letterSpacing: '1px', margin: '.15rem 0' },
  goalNote: { fontFamily: BODY, fontSize: '.7rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' },
  hook: { marginTop: 20, background: 'linear-gradient(160deg, rgba(106,13,173,.22), rgba(13,1,26,.5))', border: '1px solid rgba(245,200,0,.35)', borderRadius: 16, padding: 'clamp(20px,4vw,28px)', textAlign: 'center' },
  hookText: { fontFamily: HEAD, fontSize: 'clamp(1.2rem,4.5vw,1.6rem)', letterSpacing: '.5px', color: '#fff', lineHeight: 1.2, marginBottom: 16, maxWidth: 440, marginInline: 'auto' },
  hookBtn: { fontFamily: HEAD, fontSize: '1.15rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#1B1106', background: `linear-gradient(180deg, ${GOLD} 0%, #D4AF37 100%)`, border: 'none', borderRadius: 10, padding: '1rem 1.8rem', cursor: 'pointer', boxShadow: `0 10px 28px rgba(245,200,0,.35)`, width: '100%', maxWidth: 360 },
};
