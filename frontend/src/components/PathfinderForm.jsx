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
import { createCheckoutSession } from '../lib/checkoutApi.js';
import { generateProgram, toAssignedPlan } from './vault/generatorEngine.js';
import { CUISINE_PLANS } from './vault/cuisineMeals.js';
import { calcTDEE, calcMacros, scaleMealPlan } from './vault/nutritionEngine.js';
import { buildSportsProtocol } from '../lib/sportsEngine.js';
import { buildMealPlan } from '../lib/nutritionEngine.js';
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
// Athlete sport — drives the native Sports Engine matrices. 'none' → no sports_protocol.
// [value, i18n-key] — labels are trilingual via the dictionary (pf-sport-*).
const SPORT_OPTIONS = [
  ['none', 'pf-sport-none'],
  ['basketball', 'pf-sport-basketball'],
  ['football', 'pf-sport-football'],
  ['soccer', 'pf-sport-soccer'],
  ['track', 'pf-sport-track'],
  ['baseball', 'pf-sport-baseball'],
  ['general', 'pf-sport-general'],
];
// Dietary profile — drives the native Nutrition Engine database filter. The VALUE
// stays the canonical English token the engine filters on; the label is i18n.
const DIET_OPTIONS = [
  ['Omnivore', 'pf-diet-omnivore'],
  ['Vegetarian', 'pf-diet-vegetarian'],
  ['Vegan', 'pf-diet-vegan'],
];
// Fasting window — replaces the binary 16/8 toggle. 16/8 drops breakfast; 12/12 &
// 14/10 are time-restricted windows that KEEP all three meals. Locked to 'none' for youth.
const FASTING_OPTIONS = [
  ['none', 'pf-fasting-none'],
  ['12/12', 'pf-fasting-1212'],
  ['14/10', 'pf-fasting-1410'],
  ['16/8', 'pf-fasting-168'],
];
const YOUTH_MAX_AGE = 18; // minors → fasting locked off (continuous nutrient delivery · CNS)
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

// 4 · SPORTS — NATIVE sport-specific, periodized protocol. Fires when the athlete
// selects a sport (the explicit athlete signal); 'none'/empty → no sports_protocol
// (the Athlete Portal then shows the General Physical Preparedness state). ZERO AI.
function buildIntakeSportsProtocol(form) {
  const sport = String(form.sport || '').trim();
  if (!sport || sport === 'none') return null;
  const age = parseInt(form.age, 10) || 0;
  try {
    return buildSportsProtocol({ sport, age, experience: form.experience, goal: form.goal });
  } catch {
    return null; // a generation hiccup must never block the intake
  }
}

// `onComplete(payload)` — OPTIONAL. When provided, a successful submission
// calls it with { form, nutrition } instead of rendering this component's own
// success/checkout card, and the caller owns what happens next (e.g. the
// Protocol Initialization screen forwards the biometrics via router state and
// navigates to /select-tier). Omitted by every existing caller (PathfinderPage,
// MarketingLanding) — their plain-application / gated-checkout success cards
// are byte-for-byte unchanged.
export default function PathfinderForm({ checkout = null, prefill = null, onComplete = null }) {
  const { t, lang, setLang } = useLang();
  const { containerRef, obtainToken, error: tsError } = useTurnstile(TURNSTILE_SITE_KEY);

  // Biometrics may arrive pre-filled from the /burn Metabolic Gateway handoff
  // (location state → PathfinderPage → here). Only the known biometric keys are
  // honored; everything else starts blank. Lazy initializer so it seeds once.
  const [form, setForm] = useState(() => {
    const base = {
      fullName: '', email: '', phone: '', goal: '', experience: '',
      age: '', sex: 'male', weight: '', heightFt: '', heightIn: '', // biometrics → native TDEE
      sport: 'none', dietaryProfile: 'Omnivore', fastingWindow: 'none', // athlete + nutrition engines
      injuries: '', medicalConditions: '', medications: '',
      parq: {}, // { 'f-parq1': true, ... } — standard PAR-Q flags
      liabilityCleared: false, // Phase C — REQUIRED waiver + Terms consent gate
      marketingConsent: false,
    };
    if (prefill && typeof prefill === 'object') {
      for (const k of ['age', 'sex', 'weight', 'heightFt', 'heightIn']) {
        if (prefill[k] !== undefined && prefill[k] !== null && prefill[k] !== '') base[k] = String(prefill[k]);
      }
    }
    return base;
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false); // gated-checkout in flight
  const [checkoutErr, setCheckoutErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleParq = (key, on) => setForm((f) => ({ ...f, parq: { ...f.parq, [key]: on } }));

  // Youth lockout — a minor is NEVER placed on a fasting protocol (continuous nutrient
  // delivery for CNS development). `isYouth` drives the disabled selector + the submit
  // override; setting age to a minor value also forces the window off in the SAME state
  // update (event-driven — avoids the set-state-in-effect anti-pattern).
  const ageNum = parseInt(form.age, 10) || 0;
  const isYouth = ageNum >= 13 && ageNum < YOUTH_MAX_AGE;
  // Phase C — medical gate. Any PAR-Q "yes" flips the clearance state: the UI
  // surfaces a physician-clearance notice and the automated physical program
  // (workout + sports protocol) is withheld at submit until coach review.
  const requiresClearance = PARQ_KEYS.some((k) => form.parq[k]);
  const onAgeChange = (v) => setForm((f) => {
    const a = parseInt(v, 10) || 0;
    const next = { ...f, age: v };
    if (a >= 13 && a < YOUTH_MAX_AGE) next.fastingWindow = 'none';
    return next;
  });

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
    // Phase C — RESTORED consent gate: the liability waiver + Terms checkbox is a
    // required boolean; submission is blocked until it is checked.
    if (!form.liabilityCleared) e.liability = t('f-must-agree');
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
      // Phase C medical gate: when a PAR-Q item is flagged, WITHHOLD the automated
      // physical program (workout + sports protocol) — a physician's clearance is
      // required first, and the coach reviews before any training is generated.
      // Nutrition (TDEE/macros/meal plan) is non-exertional and still seeds.
      const workout_plan = requiresClearance ? null : buildIntakeWorkoutPlan(form);
      const nutrition = computeNutrition(form);
      // Native Nutrition Engine (DB-driven · dietary-filtered · 16/8-aware) is the
      // PRIMARY meal_plan source; the cuisine-catalog scaler is the fallback.
      // Youth lock re-enforced at submit (belt + suspenders), regardless of UI state.
      const fasting_window = isYouth ? 'none' : form.fastingWindow;
      const meal_plan = buildMealPlan({ tdee: nutrition.tdee_target, dietary_profile: form.dietaryProfile, fasting_window })
        || buildScaledMealPlan(form, nutrition.tdee_target);
      const sports_protocol = requiresClearance ? null : buildIntakeSportsProtocol(form);
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
          parq_any: requiresClearance,
          // Phase C — explicit clearance flag + restored consent, both persisted by
          // bbf-lead-capture (clearance routes the record to coach review).
          requires_clearance: requiresClearance,
          liability_cleared: form.liabilityCleared,
          marketing_consent: form.marketingConsent,
          // Intake-time NATIVE plans + targets → staged into bbf_active_clients.
          tdee_target: nutrition.tdee_target,
          macro_p: nutrition.macro_p,
          macro_c: nutrition.macro_c,
          macro_f: nutrition.macro_f,
          dietary_profile: form.dietaryProfile,
          fasting_window,
          is_fasting: fasting_window === '16/8',
          ...(workout_plan ? { workout_plan } : {}),
          ...(meal_plan ? { meal_plan } : {}),
          // Native sports protocol for youth/collegiate performance athletes →
          // staged into bbf_active_clients.sports_protocol by bbf-lead-capture.
          ...(sports_protocol ? { sports_protocol } : {}),
        },
        token,
        lang,
      );
      if (onComplete) {
        onComplete({ form, nutrition });
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    // Two success states: a plain "application received" mirror, OR — when the
    // prospect arrived via a price CTA — the gated Stripe handoff. The PAR-Q /
    // medical screening is already captured at this point, so checkout is safe.
    return (
      <div style={styles.successCard} role="status" aria-live="polite">
        <div style={styles.successMark}>✓</div>
        <div style={styles.successTitle}>{checkout?.priceId ? t('pf-checkout-title') : t('f-success-title')}</div>
        <p style={styles.successBody}>{checkout?.priceId ? t('pf-checkout-body') : t('f-success-body')}</p>
        {checkout?.priceId ? (
          <>
            <div style={styles.enrollTier}>
              {t('pf-checkout-enrolling')} <strong style={{ color: '#f5c800' }}>{checkout.tierName}</strong>
              {checkout.price ? ` · ${checkout.price}` : ''}
            </div>
            <button
              type="button"
              className="bbf-btn"
              style={styles.checkoutBtn}
              disabled={checkingOut}
              onClick={async () => {
                // GATED: bbf-create-checkout refuses unless a screening is on file for
                // this email. We just submitted the Pathfinder, so it is — but the
                // server, not the client, is the authority that lets payment proceed.
                setCheckoutErr(null);
                setCheckingOut(true);
                try {
                  const url = await createCheckoutSession(form.email.trim().toLowerCase(), checkout.priceId);
                  window.location.href = url;
                } catch (err) {
                  setCheckoutErr(err?.message || 'Could not open checkout. Please try again.');
                  setCheckingOut(false);
                }
              }}
            >
              {checkingOut ? t('pf-checkout-loading') : t('pf-checkout-cta')}
            </button>
            <div style={styles.checkoutSecured}>{t('pf-checkout-secured')}</div>
            {checkoutErr ? <div style={styles.checkoutErr} role="alert">{checkoutErr}</div> : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <form style={styles.card} onSubmit={handleSubmit} noValidate>
      {/* Selected-plan banner — shown only when the prospect arrived via a price CTA.
          Signals WHY they're screening first: complete the PAR-Q to reach checkout. */}
      {checkout?.priceId ? (
        <div style={styles.enrollBanner}>
          <div style={styles.enrollKicker}>{t('pf-enroll-kicker')}</div>
          <div style={styles.enrollTierName}>{checkout.tierName}{checkout.price ? ` · ${checkout.price}` : ''}</div>
          <div style={styles.enrollNote}>{t('pf-enroll-note')}</div>
        </div>
      ) : null}
      {/* ── PREFERRED LANGUAGE (Phase A) — defaults to the active site toggle, but
          a hard override here is persisted (bbf_active_clients.preferred_language)
          so the portal + plans open in THIS language on any device. Changing it
          flips the live UI immediately so the rest of intake is in-language. ── */}
      <Field id="pf-lang" label={t('pf-lang-label')} error={null}>
        <select id="pf-lang" className="bbf-input" value={lang} disabled={submitting}
          onChange={(e) => setLang(e.target.value)}>
          <option value="en">{t('pf-lang-en')}</option>
          <option value="es">{t('pf-lang-es')}</option>
          <option value="pt">{t('pf-lang-pt')}</option>
        </select>
        <div style={styles.parqNote}>{t('pf-lang-note')}</div>
      </Field>
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

      {/* ── ATHLETE + NUTRITION ENGINE INPUTS — drive the native sports + meal engines ── */}
      <div style={styles.bioRow}>
        <Field id="pf-sport" label={t('pf-sport-label')} error={null}>
          <select id="pf-sport" className="bbf-input" value={form.sport} disabled={submitting}
            onChange={(e) => set('sport', e.target.value)}>
            {SPORT_OPTIONS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
          </select>
        </Field>
        <Field id="pf-diet" label={t('pf-diet-label')} error={null}>
          <select id="pf-diet" className="bbf-input" value={form.dietaryProfile} disabled={submitting}
            onChange={(e) => set('dietaryProfile', e.target.value)}>
            {DIET_OPTIONS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
          </select>
        </Field>
      </div>
      <Field id="pf-fasting" label={t('pf-fasting-label')} error={null}>
        <select id="pf-fasting" className="bbf-input"
          value={isYouth ? 'none' : form.fastingWindow}
          disabled={submitting || isYouth}
          onChange={(e) => set('fastingWindow', e.target.value)}>
          {FASTING_OPTIONS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
        </select>
        {isYouth ? (
          <div style={styles.parqNote}>{t('pf-fasting-youth-note')}</div>
        ) : null}
      </Field>

      {/* ── BIOMETRICS — power the native Mifflin-St Jeor TDEE + portion scaler ── */}
      <div style={styles.bioRow}>
        <Field id="pf-age" label={t('tdee-age')} error={fieldErrors.age}>
          <input id="pf-age" className="bbf-input" type="number" inputMode="numeric" min="13" max="100"
            placeholder={t('tdee-age')} value={form.age} disabled={submitting}
            onChange={(e) => onAgeChange(e.target.value)} />
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
        <Field id="pf-height" label={t('pf-height-label')} error={fieldErrors.height}>
          <div style={styles.heightRow}>
            <input id="pf-height" className="bbf-input" type="number" inputMode="numeric" min="3" max="8"
              placeholder={t('pf-height-ft')} value={form.heightFt} disabled={submitting}
              onChange={(e) => set('heightFt', e.target.value)} />
            <input className="bbf-input" type="number" inputMode="numeric" min="0" max="11"
              placeholder={t('pf-height-in')} value={form.heightIn} disabled={submitting}
              aria-label={t('pf-height-in')} onChange={(e) => set('heightIn', e.target.value)} />
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

      {/* ── PHYSICIAN-CLEARANCE NOTICE (Phase C) — surfaces live the moment any
          PAR-Q item is flagged; mirrors the Youth intake standard. The automated
          physical program is withheld at submit until coach review. ── */}
      {requiresClearance ? (
        <div style={styles.clearanceFlag} role="status" aria-live="polite">{t('pf-clearance-flag')}</div>
      ) : null}

      {/* ── LIABILITY SHIELD (Phase C · RESTORED) — required waiver + Terms consent ── */}
      <CheckRow id="pf-liability" checked={form.liabilityCleared} disabled={submitting}
        onChange={(v) => set('liabilityCleared', v)} label={t('f-liability')} required />
      {fieldErrors.liability ? <div style={styles.fieldErr}>{fieldErrors.liability}</div> : null}
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
  clearanceFlag: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.9rem', fontWeight: 700, lineHeight: 1.45, color: '#f5c800', background: 'rgba(245,200,0,.1)', border: '1px solid rgba(245,200,0,.45)', borderRadius: 10, padding: '.7rem .85rem', margin: '0 0 1rem' },
  submit: { marginTop: '.6rem' },
  formError: { fontWeight: 700 },
  tsNote: { color: 'rgba(255,255,255,.5)' },
  successCard: { background: 'rgba(20,12,32,.92)', border: '1px solid #22c55e', borderRadius: 16, padding: '2.4rem 2rem', textAlign: 'center', maxWidth: 480, width: '100%', margin: '0 auto' },
  successMark: { width: 56, height: 56, margin: '0 auto 1.1rem', borderRadius: '50%', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.6rem', color: '#22c55e' },
  successTitle: { fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.7rem', letterSpacing: '1px', margin: '0 0 .7rem', color: '#fff' },
  successBody: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, color: 'rgba(255,255,255,.7)', margin: 0 },
  // Pricing → Pathfinder → Pay gate (selected-plan banner + post-screening checkout).
  enrollBanner: { background: 'rgba(106,13,173,.18)', border: '1px solid rgba(245,200,0,.4)', borderRadius: 12, padding: '0.9rem 1rem', marginBottom: '1.3rem', textAlign: 'center' },
  enrollKicker: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.7rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#9D27C9' },
  enrollTierName: { fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.3rem', letterSpacing: '1px', color: '#f5c800', margin: '.15rem 0 .35rem' },
  enrollNote: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.85rem', fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.7)' },
  enrollTier: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255,255,255,.85)', margin: '1rem 0 1.2rem' },
  checkoutBtn: { width: '100%', cursor: 'pointer', marginTop: '.4rem' },
  checkoutSecured: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.8rem', fontWeight: 600, color: 'rgba(255,255,255,.5)', marginTop: '.8rem' },
  checkoutErr: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.85rem', fontWeight: 700, color: '#ef4444', marginTop: '.7rem' },
};
