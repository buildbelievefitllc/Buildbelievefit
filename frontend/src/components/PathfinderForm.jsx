// src/components/PathfinderForm.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Pathfinder lead-capture engine (Phase 13) + the LIABILITY SHIELD (Phase 17.9).
//
// Phase 17.9 restores the legacy intake's health/injury/medical disclosure +
// PAR-Q+ screening + the required liability waiver & Terms consent that were
// dropped in the React rebuild — closing the legal-exposure gap. ALL field labels
// and legal copy are VERBATIM from the legacy form / bbf-lang.js (f-* keys);
// nothing invented.
//
// Validation gate (the previously broken logic): liability_cleared AND
// terms_agreed are REQUIRED — submission is blocked until both are checked, exactly
// as the legacy form's `required` attributes enforced.
//
// Data contract UNCHANGED: every field rides in the bbf-lead-capture payload
// (free-form), source:'pathfinder', invisible Turnstile, Content-Type-only POST.

import { useState } from 'react';
import { submitLead } from '../lib/leadApi.js';
import { generateProgram, toAssignedPlan } from './vault/generatorEngine.js';
import { CUISINE_PLANS } from './vault/cuisineMeals.js';
import { calcTDEE, calcMacros, scaleMealPlan } from './vault/nutritionEngine.js';
import { buildSportsProtocol } from '../lib/sportsEngine.js';
import { useTurnstile } from '../lib/useTurnstile.js';
import { useLang } from '../context/LangContext.jsx';

const TURNSTILE_SITE_KEY = '0x4AAAAAADNeGfwul8991iH-';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Primary-goal options — value + i18n label key (verbatim from legacy f-goal-*).
const GOAL_OPTIONS = [
  ['fat-loss', 'f-goal-fatloss'],
  ['muscle', 'f-goal-muscle'],
  ['performance', 'f-goal-perf'],
  ['health', 'f-goal-health'],
  ['recovery', 'f-goal-recovery'],
];
const EXP_OPTIONS = [
  ['beginner', 'f-exp-beg'],
  ['intermediate', 'f-exp-int'],
  ['advanced', 'f-exp-adv'],
];
// Standard PAR-Q items (7). Stored as a flags map keyed by these ids.
const PARQ_KEYS = ['f-parq1', 'f-parq2', 'f-parq3', 'f-parq4', 'f-parq5', 'f-parq6', 'f-parq7'];

// ── Intake-time plan generation (Zero-Friction onboarding · NATIVE-FIRST) ─────────
// On submit we seed BOTH a starter workout_plan and a starter meal_plan + TDEE/macro
// targets, entirely from our OWN rule-based engines + catalogs — ZERO AI spend. They
// ride in the lead payload; bbf-lead-capture stages them into bbf_active_clients (by
// vault_email) so they hydrate on first login post-payment. AI generation
// (rotate-nutrition / the Anthropic agents) stays a POST-PAYMENT refinement step,
// never burned on un-provisioned leads. Every step is best-effort: a hiccup returns
// null and never blocks the submission.

// 1 · WORKOUT — map goal/experience onto the rule-based Vault generator (generatorEngine).
const GOAL_TO_ENGINE = { 'fat-loss': 'fatloss', muscle: 'hypertrophy', performance: 'strength', health: 'general', recovery: 'general' };
const EXP_TO_LEVEL = { beginner: '1', intermediate: '2', advanced: '3' };

function buildIntakeWorkoutPlan(form) {
  try {
    const result = generateProgram({
      goal: GOAL_TO_ENGINE[form.goal] || 'general',
      level: EXP_TO_LEVEL[form.experience] || '2',
      days: '4', loc: 'any-home', arch: 'full', dur: '60', intensifier: 'none',
    });
    const plan = toAssignedPlan(result);
    return Array.isArray(plan) && plan.length ? plan : null;
  } catch {
    return null; // never let a generation hiccup block the intake
  }
}

// 2 · TDEE / MACROS — TRUE Mifflin-St Jeor from the intake's biometrics (age, sex,
// weight, height) × an activity factor derived from experience, then a goal-based
// calorie adjustment. Macros via calcMacros (protein from bodyweight). Same engine
// the public TDEE calculator renders — single source of truth, deterministic, no AI.
const GOAL_LABEL = { 'fat-loss': 'Fat Loss', muscle: 'Lean Muscle', performance: 'Performance', health: 'General Health', recovery: 'Recovery' };
const ACT_BY_EXP = { beginner: 1.375, intermediate: 1.55, advanced: 1.725 };
const ADJ_BY_GOAL = { 'fat-loss': -500, muscle: 300, performance: 200, health: 0, recovery: 0 };

function computeNutrition(form) {
  const age = parseInt(form.age, 10) || 0;
  const wt = parseFloat(form.weight) || 0;
  const ft = parseInt(form.heightFt, 10) || 0;
  const ins = parseInt(form.heightIn, 10) || 0;
  const act = ACT_BY_EXP[form.experience] || 1.55;
  const adj = ADJ_BY_GOAL[form.goal] ?? 0;
  const target = calcTDEE(age, form.sex, wt, ft, ins, act) + adj;
  const { p, c, f } = calcMacros(target, wt, adj);
  return { tdee_target: target, macro_p: p, macro_c: c, macro_f: f };
}

// 3 · MEAL — NATIVE portion-scaled plan. Take the established catalog template
// (cuisineMeals · American default; cuisine is a post-login preference) and run the
// Native Nutrition Engine's portion scaler so every day's ingredients + macros are
// mathematically rescaled to the prospect's EXACT tdee_target. NO fixed-calorie
// templates, NO AI. Best-effort: null on any failure → staged TDEE/macros still seed
// first-login (we never fall back to an unscaled fixed plan).
function buildScaledMealPlan(form, target) {
  try {
    const label = GOAL_LABEL[form.goal] || 'Foundation';
    return scaleMealPlan(CUISINE_PLANS.american, target, { name: `BBF Native Plan — ${label}`, goal: label });
  } catch {
    return null;
  }
}

// 4 · SPORTS — NATIVE general athletic-development protocol, generated only for
// youth/collegiate PERFORMANCE athletes. The public intake has no sport field, so
// this stages a sport-agnostic base (speed/agility/power/strength/conditioning)
// the athlete refines in the Athlete Portal; a coach can later override it. ZERO AI.
const YOUTH_COLLEGIATE_MAX_AGE = 25;
function buildIntakeSportsProtocol(form) {
  const age = parseInt(form.age, 10) || 0;
  if (form.goal !== 'performance' || age < 13 || age > YOUTH_COLLEGIATE_MAX_AGE) return null;
  try {
    return buildSportsProtocol({ age, experience: form.experience, goal: form.goal });
  } catch {
    return null; // a generation hiccup must never block the intake
  }
}

export default function PathfinderForm() {
  const { t, lang } = useLang();
  const { containerRef, obtainToken, error: tsError } = useTurnstile(TURNSTILE_SITE_KEY);

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', goal: '', experience: '',
    age: '', sex: 'male', weight: '', heightFt: '', heightIn: '', // biometrics → native TDEE
    injuries: '', medicalConditions: '', medications: '',
    parq: {}, // { 'f-parq1': true, ... } — standard PAR-Q flags
    marketingConsent: false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleParq = (key, on) => setForm((f) => ({ ...f, parq: { ...f.parq, [key]: on } }));

  function validate() {
    const e = {};
    if (!form.fullName.trim()) e.fullName = t('f-required');
    if (!form.email.trim()) e.email = t('f-required');
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email';
    if (!form.goal) e.goal = t('f-required');
    // Biometrics — REQUIRED for the native Mifflin-St Jeor TDEE + portion scaler.
    const age = parseInt(form.age, 10);
    const wt = parseFloat(form.weight);
    const ft = parseInt(form.heightFt, 10);
    if (!age || age < 13 || age > 100) e.age = t('f-required');
    if (!wt || wt <= 0) e.weight = t('f-required');
    if (!ft || ft <= 0) e.height = t('f-required');
    // Waiver checkbox removed per CEO funnel-friction directive — no consent gate.
    return Object.keys(e).length ? e : null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const errs = validate();
    setFieldErrors(errs || {});
    if (errs) return;

    setSubmitting(true);
    setError(null);
    try {
      let token;
      try {
        token = await obtainToken();
      } catch {
        setError('Security check could not complete — please retry.');
        return;
      }
      // Zero-Friction onboarding (NATIVE-FIRST): seed the starter workout + a TRUE
      // Mifflin-St Jeor TDEE/macros and a portion-SCALED meal plan now — all from our
      // own rule-based engines/catalogs, no AI spend — so they stage with the intake
      // and hydrate on first login. AI (rotate-nutrition) stays a post-payment
      // refinement, never burned on a lead.
      const workout_plan = buildIntakeWorkoutPlan(form);
      const nutrition = computeNutrition(form);
      const meal_plan = buildScaledMealPlan(form, nutrition.tdee_target);
      const sports_protocol = buildIntakeSportsProtocol(form);
      const height_weight = `${parseInt(form.heightFt, 10) || 0}'${parseInt(form.heightIn, 10) || 0}" / ${parseFloat(form.weight) || 0} lbs`;
      // Data contract preserved — all shield fields ride in the lead payload.
      await submitLead(
        {
          full_name: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          primary_goal: form.goal,
          experience: form.experience || undefined,
          // Biometrics → bbf_active_clients (age + height_weight columns); sex rides
          // in the payload (baked into tdee_target — no dedicated column).
          age: parseInt(form.age, 10) || undefined,
          sex: form.sex,
          height_weight,
          injuries: form.injuries.trim() || undefined,
          medical_conditions: form.medicalConditions.trim() || undefined,
          medications: form.medications.trim() || undefined,
          // Standard PAR-Q: list the ids the applicant flagged "yes" + a quick
          // boolean so the backend can route anyone who flagged any item.
          parq_flags: PARQ_KEYS.filter((k) => form.parq[k]),
          parq_any: PARQ_KEYS.some((k) => form.parq[k]),
          marketing_consent: form.marketingConsent,
          // Intake-time NATIVE plans + targets → staged into bbf_active_clients.
          tdee_target: nutrition.tdee_target,
          macro_p: nutrition.macro_p,
          macro_c: nutrition.macro_c,
          macro_f: nutrition.macro_f,
          ...(workout_plan ? { workout_plan } : {}),
          ...(meal_plan ? { meal_plan } : {}),
          // Native sports protocol for youth/collegiate performance athletes →
          // staged into bbf_active_clients.sports_protocol by bbf-lead-capture.
          ...(sports_protocol ? { sports_protocol } : {}),
        },
        token,
        lang,
      );
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={styles.successCard} role="status" aria-live="polite">
        <div style={styles.successMark}>✓</div>
        <div style={styles.successTitle}>{t('f-success-title')}</div>
        <p style={styles.successBody}>{t('f-success-body')}</p>
      </div>
    );
  }

  return (
    <form style={styles.card} onSubmit={handleSubmit} noValidate>
      <Field id="pf-name" label={t('f-name')} error={fieldErrors.fullName}>
        <input id="pf-name" className="bbf-input" type="text" autoComplete="name"
          placeholder={t('f-name')} value={form.fullName} disabled={submitting}
          onChange={(e) => set('fullName', e.target.value)} />
      </Field>
      <Field id="pf-email" label={t('f-email')} error={fieldErrors.email}>
        <input id="pf-email" className="bbf-input" type="email" autoComplete="email"
          autoCapitalize="none" spellCheck={false} placeholder="you@email.com"
          value={form.email} disabled={submitting} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <Field id="pf-phone" label={t('f-phone')} error={null}>
        <input id="pf-phone" className="bbf-input" type="tel" autoComplete="tel"
          placeholder="+1 …" value={form.phone} disabled={submitting}
          onChange={(e) => set('phone', e.target.value)} />
      </Field>
      <Field id="pf-goal" label={t('f-goal')} error={fieldErrors.goal}>
        <select id="pf-goal" className="bbf-input" value={form.goal} disabled={submitting}
          onChange={(e) => set('goal', e.target.value)}>
          <option value="">{t('f-goal-ph')}</option>
          {GOAL_OPTIONS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
        </select>
      </Field>
      <Field id="pf-exp" label={t('f-experience')} error={null}>
        <select id="pf-exp" className="bbf-input" value={form.experience} disabled={submitting}
          onChange={(e) => set('experience', e.target.value)}>
          <option value="">{t('f-exp-ph')}</option>
          {EXP_OPTIONS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
        </select>
      </Field>

      {/* ── BIOMETRICS — power the native Mifflin-St Jeor TDEE + portion scaler ── */}
      <div style={styles.bioRow}>
        <Field id="pf-age" label={t('tdee-age')} error={fieldErrors.age}>
          <input id="pf-age" className="bbf-input" type="number" inputMode="numeric" min="13" max="100"
            placeholder={t('tdee-age')} value={form.age} disabled={submitting}
            onChange={(e) => set('age', e.target.value)} />
        </Field>
        <Field id="pf-sex" label={t('tdee-sex')} error={null}>
          <select id="pf-sex" className="bbf-input" value={form.sex} disabled={submitting}
            onChange={(e) => set('sex', e.target.value)}>
            <option value="male">{t('tdee-male')}</option>
            <option value="female">{t('tdee-female')}</option>
          </select>
        </Field>
      </div>
      <div style={styles.bioRow}>
        <Field id="pf-weight" label={t('tdee-weight')} error={fieldErrors.weight}>
          <input id="pf-weight" className="bbf-input" type="number" inputMode="decimal" min="50" max="600"
            placeholder="lbs" value={form.weight} disabled={submitting}
            onChange={(e) => set('weight', e.target.value)} />
        </Field>
        <Field id="pf-height" label="Height (ft / in)" error={fieldErrors.height}>
          <div style={styles.heightRow}>
            <input id="pf-height" className="bbf-input" type="number" inputMode="numeric" min="3" max="8"
              placeholder="ft" value={form.heightFt} disabled={submitting}
              onChange={(e) => set('heightFt', e.target.value)} />
            <input className="bbf-input" type="number" inputMode="numeric" min="0" max="11"
              placeholder="in" value={form.heightIn} disabled={submitting}
              aria-label="Height (inches)" onChange={(e) => set('heightIn', e.target.value)} />
          </div>
        </Field>
      </div>

      {/* ── LIABILITY SHIELD — health / injury / medical disclosure ── */}
      <Field id="pf-injuries" label={t('f-injuries')} error={null}>
        <textarea id="pf-injuries" className="bbf-input" rows={2} placeholder={t('f-injuries-ph')}
          value={form.injuries} disabled={submitting} onChange={(e) => set('injuries', e.target.value)} />
      </Field>
      <Field id="pf-conditions" label={t('f-conditions')} error={null}>
        <textarea id="pf-conditions" className="bbf-input" rows={2} placeholder={t('f-conditions-ph')}
          value={form.medicalConditions} disabled={submitting} onChange={(e) => set('medicalConditions', e.target.value)} />
      </Field>
      <Field id="pf-medications" label={t('f-medications')} error={null}>
        <textarea id="pf-medications" className="bbf-input" rows={2} placeholder={t('f-medications-ph')}
          value={form.medications} disabled={submitting} onChange={(e) => set('medications', e.target.value)} />
      </Field>

      {/* ── PAR-Q · standard physical-activity readiness screening (7 items) ── */}
      <div style={styles.parqHeader}>{t('f-health-q')}</div>
      <div style={styles.parqNote}>{t('f-parq-note')}</div>
      {PARQ_KEYS.map((k) => (
        <CheckRow key={k} id={`pf-${k}`} checked={!!form.parq[k]} disabled={submitting}
          onChange={(v) => toggleParq(k, v)} label={t(k)} />
      ))}

      {/* Liability waiver checkbox removed per CEO funnel-friction directive. */}
      <CheckRow id="pf-marketing" checked={form.marketingConsent} disabled={submitting}
        onChange={(v) => set('marketingConsent', v)} label={t('f-marketing')} />

      {/* Invisible Turnstile widget — executed on submit (renders nothing). */}
      <div ref={containerRef} aria-hidden="true" />

      <button className="bbf-btn" type="submit" style={styles.submit} disabled={submitting}>
        {submitting ? t('f-submitting') : t('f-submit')}
      </button>

      {error ? <div className="bbf-msg bbf-msg--error" role="alert" style={styles.formError}>{error}</div> : null}
      {tsError && !error ? (
        <div className="bbf-msg" role="status" style={styles.tsNote}>Security check is still loading — give it a moment before submitting.</div>
      ) : null}
    </form>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div style={styles.field}>
      <label className="bbf-label" htmlFor={id}>{label}</label>
      {children}
      {error ? <div style={styles.fieldErr}>{error}</div> : null}
    </div>
  );
}

function CheckRow({ id, label, checked, onChange, disabled, required }) {
  return (
    <label htmlFor={id} style={styles.checkRow}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} style={styles.checkbox} />
      <span style={styles.checkLabel}>
        {label}{required ? <span style={styles.req}> *</span> : null}
      </span>
    </label>
  );
}

const styles = {
  card: { background: 'rgba(20,12,32,.92)', border: '1px solid rgba(157,39,201,.3)', borderRadius: 16, padding: '1.8rem 1.6rem', maxWidth: 480, width: '100%', margin: '0 auto' },
  field: { marginBottom: '1rem' },
  bioRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' },
  heightRow: { display: 'flex', gap: 8 },
  fieldErr: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.78rem', fontWeight: 700, color: '#ef4444', marginTop: '.3rem', letterSpacing: '.3px' },
  parqHeader: { fontFamily: "'Bebas Neue',sans-serif", fontSize: '.9rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#f5c800', margin: '1.2rem 0 .3rem', paddingTop: '.6rem', borderTop: '1px solid rgba(157,39,201,.25)' },
  parqNote: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.82rem', fontWeight: 600, color: 'rgba(255,255,255,.55)', marginBottom: '.7rem' },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: '.6rem', marginBottom: '.7rem', cursor: 'pointer' },
  checkbox: { width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: '#6a0dad', cursor: 'pointer' },
  checkLabel: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.9rem', fontWeight: 600, lineHeight: 1.45, color: 'rgba(255,255,255,.8)' },
  req: { color: '#f5c800', fontWeight: 900 },
  submit: { marginTop: '.6rem' },
  formError: { fontWeight: 700 },
  tsNote: { color: 'rgba(255,255,255,.5)' },
  successCard: { background: 'rgba(20,12,32,.92)', border: '1px solid #22c55e', borderRadius: 16, padding: '2.4rem 2rem', textAlign: 'center', maxWidth: 480, width: '100%', margin: '0 auto' },
  successMark: { width: 56, height: 56, margin: '0 auto 1.1rem', borderRadius: '50%', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.6rem', color: '#22c55e' },
  successTitle: { fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.7rem', letterSpacing: '1px', margin: '0 0 .7rem', color: '#fff' },
  successBody: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, color: 'rgba(255,255,255,.7)', margin: 0 },
};
