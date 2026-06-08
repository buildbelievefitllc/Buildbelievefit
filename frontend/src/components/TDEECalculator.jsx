// src/components/TDEECalculator.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 17 — TDEE Calculator, restored into React.
//
// Legacy lead-pipeline feature (index.html "TDEE WIDGET"). The math is ported
// VERBATIM from the legacy calcTDEE/calcMacros (Mifflin-St Jeor BMR × activity;
// protein from bodyweight, fat at 25% kcal, carbs = remainder) — NOT re-derived.
// On "Use These In My Application", it routes the user into the Pathfinder intake
// (the legacy .tdee-cta behavior) so the calculator keeps feeding the funnel.
//
// Brand: Purple/Gold only (no red). Victory Gold reserved for the primary CTA.

import { useState } from 'react';
import { useLang } from '../context/LangContext.jsx';
// TDEE + macro math lives in the shared Native Nutrition Engine (single source of
// truth) so the calculator and the Pathfinder intake stage identical numbers.
import { calcTDEE, calcMacros } from './vault/nutritionEngine.js';

const GOLD = '#F5C800';
const GOLD_SOFT = '#F5CF60';
const PUR = '#6A0DAD';
const PURL = '#9D27C9';
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";

export default function TDEECalculator({ onUseResults }) {
  const { t } = useLang();
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('male');
  const [weight, setWeight] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [act, setAct] = useState('1.55');
  const [goal, setGoal] = useState('-500'); // adj: cut -500 / maintain 0 / gain +300
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function calculate(e) {
    e.preventDefault();
    const a = parseInt(age, 10) || 0;
    const w = parseFloat(weight) || 0;
    const f = parseInt(ft, 10) || 0;
    const i = parseInt(inch, 10) || 0;
    const adj = parseInt(goal, 10);
    if (!a || !w || !f) {
      setError('Please fill in age, weight, and height.');
      setResult(null);
      return;
    }
    setError(null);
    const base = calcTDEE(a, sex, w, f, i, parseFloat(act));
    const target = base + adj;
    const mac = calcMacros(target, w, adj);
    const goalLabel = adj < 0 ? t('tdee-goal-cut') : adj > 0 ? t('tdee-goal-gain') : t('tdee-goal-maintain');
    setResult({ base, target, ...mac, goalLabel });
  }

  return (
    <div style={st.widget}>
      <div style={st.head}>
        <div style={st.lbl}>{t('tdee-lbl')}</div>
        <h3 style={st.h}>{t('tdee-h')}</h3>
        <p style={st.sub}>{t('tdee-sub')}</p>
      </div>

      <form onSubmit={calculate}>
        <div style={st.grid}>
          <Field label={t('tdee-age')}>
            <input style={st.input} type="number" inputMode="numeric" min="13" max="100" value={age} onChange={(e) => setAge(e.target.value)} />
          </Field>
          <Field label={t('tdee-sex')}>
            <select style={st.input} value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="male">{t('tdee-male')}</option>
              <option value="female">{t('tdee-female')}</option>
            </select>
          </Field>
          <Field label={t('tdee-weight')}>
            <input style={st.input} type="number" inputMode="decimal" min="50" max="600" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label="Height (ft / in)">
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={st.input} type="number" inputMode="numeric" min="3" max="8" placeholder="ft" value={ft} onChange={(e) => setFt(e.target.value)} />
              <input style={st.input} type="number" inputMode="numeric" min="0" max="11" placeholder="in" value={inch} onChange={(e) => setInch(e.target.value)} />
            </div>
          </Field>
          <Field label={t('tdee-activity')}>
            <select style={st.input} value={act} onChange={(e) => setAct(e.target.value)}>
              <option value="1.2">{t('tdee-act-sed')}</option>
              <option value="1.375">{t('tdee-act-light')}</option>
              <option value="1.55">{t('tdee-act-mod')}</option>
              <option value="1.725">{t('tdee-act-very')}</option>
              <option value="1.9">{t('tdee-act-extreme')}</option>
            </select>
          </Field>
          <Field label={t('tdee-goal')}>
            <select style={st.input} value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="-500">{t('tdee-goal-cut')}</option>
              <option value="0">{t('tdee-goal-maintain')}</option>
              <option value="300">{t('tdee-goal-gain')}</option>
            </select>
          </Field>
        </div>

        {error ? <div style={st.error} role="alert">{error}</div> : null}

        <button type="submit" style={st.calcBtn}>{t('tdee-calc')}</button>
      </form>

      {result ? (
        <div style={st.res} role="status" aria-live="polite">
          <div style={st.big}>{result.target.toLocaleString()}</div>
          <div style={st.resSub}>{t('tdee-target')} · kcal/day</div>
          <div style={st.macros}>
            <Macro label="Protein" value={`${result.p}g`} />
            <Macro label="Carbs" value={`${result.c}g`} />
            <Macro label="Fat" value={`${result.f}g`} />
          </div>
          <p style={st.note}>
            Maintenance TDEE: {result.base.toLocaleString()} cal/day. Adjusted for {result.goalLabel.toLowerCase()}.
            These are starting targets — Akeem will fine-tune based on your progress.
          </p>
          <button
            type="button"
            style={st.useCta}
            onClick={() => onUseResults?.({ tdee_target: result.target, macro_p: result.p, macro_c: result.c, macro_f: result.f })}
          >
            {t('tdee-cta')}
          </button>
        </div>
      ) : null}
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
function Macro({ label, value }) {
  return (
    <div style={st.macro}>
      <div style={st.macroVal}>{value}</div>
      <div style={st.macroLbl}>{label}</div>
    </div>
  );
}

const st = {
  widget: { background: `linear-gradient(160deg, rgba(30,3,64,.5), rgba(13,1,26,.85))`, border: `1px solid rgba(157,39,201,.3)`, borderRadius: 20, padding: 'clamp(20px,4vw,32px)', maxWidth: 680, margin: '0 auto' },
  head: { textAlign: 'center', marginBottom: 20 },
  lbl: { fontFamily: BODY, fontSize: '.66rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: PURL },
  h: { fontFamily: HEAD, fontSize: '1.7rem', letterSpacing: '1.5px', color: '#fff', margin: '.3rem 0 .5rem' },
  sub: { fontFamily: BODY, fontSize: '.95rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.5, margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLbl: { fontFamily: BODY, fontSize: '.72rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' },
  input: { width: '100%', boxSizing: 'border-box', background: '#0a0414', border: `1px solid rgba(157,39,201,.35)`, borderRadius: 8, color: '#fff', fontFamily: BODY, fontSize: '1rem', fontWeight: 600, padding: '.7rem .8rem', outline: 'none' },
  error: { fontFamily: BODY, fontSize: '.88rem', fontWeight: 700, color: '#fca5a5', marginBottom: 10 },
  calcBtn: { width: '100%', marginTop: 6, fontFamily: HEAD, fontSize: '1.1rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', background: `linear-gradient(180deg, ${PURL}, ${PUR})`, border: `1px solid rgba(157,39,201,.6)`, borderRadius: 10, padding: '.9rem', cursor: 'pointer' },
  res: { display: 'block', marginTop: 20, background: 'rgba(8,2,18,.7)', border: `1px solid rgba(245,200,0,.25)`, borderRadius: 14, padding: 'clamp(18px,3vw,26px)', textAlign: 'center' },
  big: { fontFamily: HEAD, fontSize: 'clamp(2.6rem,8vw,3.5rem)', letterSpacing: '2px', color: GOLD_SOFT, lineHeight: 1 },
  resSub: { fontFamily: BODY, fontSize: '.66rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginTop: 4 },
  macros: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '18px 0' },
  macro: { background: 'rgba(157,39,201,.1)', border: `1px solid rgba(157,39,201,.25)`, borderRadius: 10, padding: '12px 8px' },
  macroVal: { fontFamily: HEAD, fontSize: '1.4rem', color: '#fff', letterSpacing: '1px' },
  macroLbl: { fontFamily: BODY, fontSize: '.66rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' },
  note: { fontFamily: BODY, fontSize: '.82rem', fontWeight: 600, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, margin: '0 0 16px' },
  useCta: { fontFamily: HEAD, fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#1B1106', background: `linear-gradient(180deg, ${GOLD} 0%, #D4AF37 100%)`, border: 'none', borderRadius: 10, padding: '.9rem 1.6rem', cursor: 'pointer', boxShadow: `0 10px 28px rgba(245,200,0,.35)` },
};
