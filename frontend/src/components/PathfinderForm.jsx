// src/components/PathfinderForm.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Phase 13 Pathfinder lead-capture engine, extracted into a reusable
// component so it can be embedded in the restored marketing site (Phase 14)
// without changing its data contract.
//
// Identical behavior to the Phase 13 PublicTerminal form: strict client-side
// validation, invisible Turnstile (lib/useTurnstile), POST via lib/leadApi
// (Content-Type only, source:'pathfinder', primary_goal), explicit loading /
// success / error states.

import { useState } from 'react';
import { submitLead } from '../lib/leadApi.js';
import { useTurnstile } from '../lib/useTurnstile.js';

const TURNSTILE_SITE_KEY = '0x4AAAAAADNeGfwul8991iH-';
const GOALS = ['Fat Loss', 'Build Muscle', 'Athletic Performance', 'Joint Health & Longevity', 'General Fitness'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PathfinderForm() {
  const { containerRef, obtainToken, error: tsError } = useTurnstile(TURNSTILE_SITE_KEY);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [goal, setGoal] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  function validate() {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Required';
    if (!email.trim()) e.email = 'Required';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email';
    if (!goal) e.goal = 'Select a goal';
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
      await submitLead(
        { full_name: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || undefined, primary_goal: goal },
        token,
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
        <div style={styles.successTitle}>Application Received</div>
        <p style={styles.successBody}>
          Your intake is in and securely logged. The Build Believe Fit team will reach out
          shortly with your next steps. Welcome to the standard.
        </p>
      </div>
    );
  }

  return (
    <form style={styles.card} onSubmit={handleSubmit} noValidate>
      <Field id="pf-name" label="Full Name" error={fieldErrors.fullName}>
        <input id="pf-name" className="bbf-input" type="text" autoComplete="name"
          placeholder="Your name" value={fullName} disabled={submitting}
          onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field id="pf-email" label="Email" error={fieldErrors.email}>
        <input id="pf-email" className="bbf-input" type="email" autoComplete="email"
          autoCapitalize="none" spellCheck={false} placeholder="you@email.com"
          value={email} disabled={submitting} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="pf-phone" label="Phone (optional)" error={null}>
        <input id="pf-phone" className="bbf-input" type="tel" autoComplete="tel"
          placeholder="+1 …" value={phone} disabled={submitting}
          onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field id="pf-goal" label="Primary Goal" error={fieldErrors.goal}>
        <select id="pf-goal" className="bbf-input" value={goal} disabled={submitting}
          onChange={(e) => setGoal(e.target.value)}>
          <option value="">Select your goal…</option>
          {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </Field>

      {/* Invisible Turnstile widget — executed on submit (renders nothing). */}
      <div ref={containerRef} aria-hidden="true" />

      <button className="bbf-btn" type="submit" style={styles.submit} disabled={submitting}>
        {submitting ? 'Securing your application…' : 'Apply Now →'}
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

const styles = {
  card: { background: 'rgba(20,20,20,.9)', border: '1px solid rgba(245,200,0,.2)', borderRadius: 16, padding: '1.8rem 1.6rem', maxWidth: 480, width: '100%', margin: '0 auto' },
  field: { marginBottom: '1rem' },
  fieldErr: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.78rem', fontWeight: 700, color: '#ef4444', marginTop: '.3rem', letterSpacing: '.3px' },
  submit: { marginTop: '.6rem' },
  formError: { fontWeight: 700 },
  tsNote: { color: 'rgba(255,255,255,.5)' },
  successCard: { background: 'rgba(20,20,20,.9)', border: '1px solid #22c55e', borderRadius: 16, padding: '2.4rem 2rem', textAlign: 'center', maxWidth: 480, width: '100%', margin: '0 auto' },
  successMark: { width: 56, height: 56, margin: '0 auto 1.1rem', borderRadius: '50%', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.6rem', color: '#22c55e' },
  successTitle: { fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.7rem', letterSpacing: '1px', margin: '0 0 .7rem', color: '#fff' },
  successBody: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, color: 'rgba(255,255,255,.7)', margin: 0 },
};
