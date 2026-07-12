// src/pages/DailyBurnCalculator.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Metabolic Gateway — a standalone, jargon-free top-of-funnel lead magnet
// mounted at /burn. NO main-site nav or footer (zero click-aways): the only exit
// is forward, into the /explore mock lab.
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
import { calcTDEE } from '../components/vault/nutritionEngine.js';
import TdeeLeadCapture from '../components/TdeeLeadCapture.jsx';
import { startExplorerSession, hasExplorerSession } from '../lib/explorerSession.js';

const GOLD = '#F5C800';
const GOLD_SOFT = '#F5CF60';
const PUR = '#6A0DAD';
const PURL = '#9D27C9';
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";

// Plain-English activity levels → Mifflin-St Jeor activity multipliers. The label
// is what the prospect reads; the factor is the math they never see.
const ACTIVITY_OPTIONS = [
  ['1.2', 'Desk Job'],
  ['1.375', 'On my feet'],
  ['1.55', 'Active / Workout 3-5 days'],
  ['1.725', 'Hard Labor / Athlete'],
];

const FAT_LOSS_ADJ = -500; // a moderate deficit
const MUSCLE_ADJ = 250;    // a lean surplus

export default function DailyBurnCalculator() {
  const navigate = useNavigate();
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('male');
  const [weight, setWeight] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [act, setAct] = useState('1.55');
  const [burn, setBurn] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [error, setError] = useState(null);

  function calculate(e) {
    e.preventDefault();
    const a = parseInt(age, 10) || 0;
    const w = parseFloat(weight) || 0;
    const f = parseInt(ft, 10) || 0;
    const i = parseInt(inch, 10) || 0;
    if (!a || !w || !f) {
      setError('Please fill in age, weight, and height.');
      setBurn(null);
      setShowProfile(false);
      return;
    }
    const tdee = calcTDEE(a, sex, w, f, i, parseFloat(act) || 1.55);
    if (!Number.isFinite(tdee) || tdee <= 0) {
      setError('Those numbers don’t compute — double-check and try again.');
      setBurn(null);
      setShowProfile(false);
      return;
    }
    setError(null);
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
        <div style={st.brand}>BUILD BELIEVE <b style={{ color: GOLD }}>FIT</b></div>

        <div style={st.head}>
          <div style={st.kicker}>Free Metabolic Snapshot</div>
          <h1 style={st.h1}>What Does Your Body Burn?</h1>
          <p style={st.sub}>
            Four quick answers. No sign-up. See exactly how many calories your body
            burns in a day — and the numbers to hit your goal.
          </p>
        </div>

        <form onSubmit={calculate} style={st.card}>
          <div style={st.grid}>
            <Field label="Age">
              <input style={st.input} type="number" inputMode="numeric" min="13" max="100"
                value={age} onChange={(e) => setAge(e.target.value)} />
            </Field>
            <Field label="Gender">
              <select style={st.input} value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="Weight (lbs)">
              <input style={st.input} type="number" inputMode="decimal" min="50" max="600"
                placeholder="lbs" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
            <Field label="Height">
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={st.input} type="number" inputMode="numeric" min="3" max="8"
                  placeholder="ft" value={ft} onChange={(e) => setFt(e.target.value)} />
                <input style={st.input} type="number" inputMode="numeric" min="0" max="11"
                  placeholder="in" value={inch} onChange={(e) => setInch(e.target.value)} />
              </div>
            </Field>
          </div>
          <Field label="Daily Activity">
            <select style={st.input} value={act} onChange={(e) => setAct(e.target.value)}>
              {ACTIVITY_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </Field>

          {error ? <div style={st.error} role="alert">{error}</div> : null}

          <button type="submit" style={st.calcBtn}>Show My Numbers →</button>
        </form>

        {/* Post-close breadcrumb: if they dismiss the profile, the number stays
            reachable — one tap reopens the modal, no recalculation needed. */}
        {burn != null && !showProfile ? (
          <button type="button" style={st.reopenBtn} onClick={() => setShowProfile(true)}>
            View My Metabolic Profile ({burn.toLocaleString()} cal) →
          </button>
        ) : null}
      </div>

      {showProfile && burn != null ? (
        <MockProfileModal
          burn={burn}
          biometrics={biometrics}
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
 * @param {() => void} props.onClose - dismiss the modal (state survives in parent)
 * @param {() => void} props.onClaimProfile - primary CTA → mint-if-missing, then /explore
 * @param {() => void} props.onCaptured - lead saved → mint the Explorer session
 */
function MockProfileModal({
  burn,
  biometrics,
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

        <button type="button" style={st.closeBtn} onClick={onClose} aria-label="Close profile">
          ✕
        </button>

        <div style={st.modalBody} role="status" aria-live="polite">
          <div style={st.modalKicker}>Your Metabolic Profile</div>
          <h2 id="mock-profile-title" style={st.modalTitle}>The Numbers Are In</h2>

          <div style={st.burnCard}>
            <div style={st.burnLbl}>Your Daily Calorie Burn</div>
            <div style={st.burnBig}>{burn.toLocaleString()}</div>
            <div style={st.burnUnit}>calories / day to maintain</div>
          </div>

          <div style={st.splitRow}>
            <GoalCard
              title="To Lose Fat"
              value={(burn + FAT_LOSS_ADJ).toLocaleString()}
              note="calories / day"
            />
            <GoalCard
              title="To Build Muscle"
              value={(burn + MUSCLE_ADJ).toLocaleString()}
              note="calories / day"
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
            <div style={st.hookText}>
              Knowing your numbers is only step one. You need a blueprint to hit them.
            </div>
            <button type="button" style={st.hookBtn} onClick={onClaimProfile} data-testid="enter-explorer">
              ENTER EXPLORER MODE →
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
