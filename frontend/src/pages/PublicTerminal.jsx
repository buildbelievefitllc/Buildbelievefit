// src/pages/PublicTerminal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 12 — public catch-surface for the apex.   Phase 13 — live lead intake.
//
// Unauthenticated visitors land here. The placeholder mailto is replaced with the
// Pathfinder lead-capture funnel, wired to the bbf-lead-capture edge function
// (lib/leadApi) and gated by an invisible Cloudflare Turnstile token
// (lib/useTurnstile) — the same pipeline that feeds bbf_leads → the Comlink.
//
// Strict client-side validation (required fields + email format) and explicit
// loading / success / error states so the prospect always knows the outcome.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitLead } from '../lib/leadApi.js';
import { useTurnstile } from '../lib/useTurnstile.js';

// Public Cloudflare Turnstile site key (mirrors the legacy storefront index.html;
// site keys are public by design).
const TURNSTILE_SITE_KEY = '0x4AAAAAADNeGfwul8991iH-';

const GOALS = ['Fat Loss', 'Build Muscle', 'Athletic Performance', 'Joint Health & Longevity', 'General Fitness'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PublicTerminal() {
  const navigate = useNavigate();
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
        {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          primary_goal: goal,
        },
        token,
      );
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.screen}>
      <div style={styles.col}>
        <header style={styles.hero}>
          <div style={styles.logo}>BUILD BELIEVE <span style={{ color: 'var(--yel)' }}>FIT</span></div>
          <div style={styles.kicker}>Universal Human Optimization</div>
          <h1 style={styles.title}>Strength. Joint Health. Cardio. Engineered.</h1>
          <p style={styles.body}>
            Apply for coaching — built around your body, your sport, and your goals.
            Tell us where you are and we&apos;ll map the path.
          </p>
        </header>

        {submitted ? (
          <div style={styles.successCard} role="status" aria-live="polite">
            <div style={styles.successMark}>✓</div>
            <div style={styles.successTitle}>Application received</div>
            <p style={styles.successBody}>
              Your intake is in and securely logged. The Build Believe Fit team will reach
              out shortly with your next steps. Welcome to the standard.
            </p>
            <button type="button" style={styles.ghostBtn} onClick={() => navigate('/login')}>
              Member Sign In →
            </button>
          </div>
        ) : (
          <form style={styles.card} onSubmit={handleSubmit} noValidate>
            <Field id="lf-name" label="Full Name" error={fieldErrors.fullName}>
              <input
                id="lf-name" className="bbf-input" type="text" autoComplete="name"
                placeholder="Your name" value={fullName} disabled={submitting}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>

            <Field id="lf-email" label="Email" error={fieldErrors.email}>
              <input
                id="lf-email" className="bbf-input" type="email" autoComplete="email"
                autoCapitalize="none" spellCheck={false} placeholder="you@email.com"
                value={email} disabled={submitting}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field id="lf-phone" label="Phone (optional)" error={null}>
              <input
                id="lf-phone" className="bbf-input" type="tel" autoComplete="tel"
                placeholder="+1 …" value={phone} disabled={submitting}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>

            <Field id="lf-goal" label="Primary Goal" error={fieldErrors.goal}>
              <select
                id="lf-goal" className="bbf-input" value={goal} disabled={submitting}
                onChange={(e) => setGoal(e.target.value)}
              >
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
              <div className="bbf-msg" role="status" style={styles.tsNote}>
                Security check is still loading — give it a moment before submitting.
              </div>
            ) : null}

            <button type="button" style={styles.ghostBtn} onClick={() => navigate('/login')}>
              Already a member? Sign In →
            </button>
          </form>
        )}
      </div>
    </div>
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
  screen: {
    minHeight: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '2.5rem 1.5rem',
    background: 'linear-gradient(180deg, var(--purp) 0%, var(--blk) 45%)',
  },
  col: { width: '100%', maxWidth: 520 },
  hero: { textAlign: 'center', marginBottom: '1.8rem' },
  logo: { fontFamily: 'var(--hb)', fontSize: '2rem', fontWeight: 900, letterSpacing: '4px', marginBottom: '.8rem' },
  kicker: { fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '4px', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '.9rem' },
  title: { fontFamily: 'var(--display)', fontSize: '2.1rem', lineHeight: 1.08, letterSpacing: '1px', margin: '0 0 .9rem' },
  body: { fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--mut)', margin: '0 auto', maxWidth: '44ch' },

  card: { background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 16, padding: '1.8rem 1.6rem' },
  field: { marginBottom: '1rem' },
  fieldErr: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--red)', marginTop: '.3rem', letterSpacing: '.3px' },
  submit: { marginTop: '.6rem' },
  formError: { fontWeight: 700 },
  tsNote: { color: 'var(--mut)' },
  ghostBtn: {
    width: '100%', marginTop: '1.1rem', fontFamily: 'var(--hb)', fontSize: '.74rem',
    letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-soft)',
    background: 'none', border: 'none', cursor: 'pointer',
  },

  successCard: { background: 'var(--gry)', border: '1px solid var(--grn)', borderRadius: 16, padding: '2.4rem 2rem', textAlign: 'center' },
  successMark: {
    width: 56, height: 56, margin: '0 auto 1.1rem', borderRadius: '50%', border: '2px solid var(--grn)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--hb)', fontSize: '1.6rem', color: 'var(--grn)',
  },
  successTitle: { fontFamily: 'var(--display)', fontSize: '1.7rem', letterSpacing: '1px', margin: '0 0 .7rem' },
  successBody: { fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--mut)', margin: '0 0 1.5rem' },
};
