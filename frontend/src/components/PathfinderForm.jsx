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

export default function PathfinderForm() {
  const { t, lang } = useLang();
  const { containerRef, obtainToken, error: tsError } = useTurnstile(TURNSTILE_SITE_KEY);

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', goal: '', experience: '',
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
      // Data contract preserved — all shield fields ride in the lead payload.
      await submitLead(
        {
          full_name: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          primary_goal: form.goal,
          experience: form.experience || undefined,
          injuries: form.injuries.trim() || undefined,
          medical_conditions: form.medicalConditions.trim() || undefined,
          medications: form.medications.trim() || undefined,
          // Standard PAR-Q: list the ids the applicant flagged "yes" + a quick
          // boolean so the backend can route anyone who flagged any item.
          parq_flags: PARQ_KEYS.filter((k) => form.parq[k]),
          parq_any: PARQ_KEYS.some((k) => form.parq[k]),
          marketing_consent: form.marketingConsent,
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
