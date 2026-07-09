// src/components/TdeeLeadCapture.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21 — the calculator-to-lead bridge. TDEECalculator.jsx and
// DailyBurnCalculator.jsx both compute a real number and then hand the visitor
// straight to the Pathfinder (a much bigger commitment: name/email/PAR-Q/
// liability). Anyone who calculates and doesn't complete that full intake was,
// until now, a fully invisible drop-off — no lead captured at all.
//
// This is a frictionless, 2-field (Name + Email) micro-form that mounts the
// instant a result renders. Submitting fires a background POST to the SAME
// public bbf-lead-capture pipeline the Pathfinder uses (source:'tdee_calculator'
// | 'daily_burn'), which routes to the dedicated bbf_tdee_leads table — NOT
// bbf_leads, since a calculator-only visitor has given no PAR-Q/liability
// disclosure. The calculator's results are ALWAYS visible regardless of whether
// this capture succeeds, fails, or is skipped entirely — it never gates the
// core experience.

import { useState } from 'react';
import { submitLead } from '../lib/leadApi.js';
import { useTurnstile } from '../lib/useTurnstile.js';
import { useLang } from '../context/LangContext.jsx';

const TURNSTILE_SITE_KEY = '0x4AAAAAADNeGfwul8991iH-';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GOLD = '#F5C800';
const PURL = '#9D27C9';
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";

// `payload` carries the biometrics + computed numbers to persist alongside the
// lead (age, sex, weight_lbs, height_ft, height_in, activity_factor, goal,
// tdee_maintenance, tdee_target, macro_p, macro_c, macro_f) — whatever the
// calling calculator actually has. `source` is 'tdee_calculator' | 'daily_burn'.
export default function TdeeLeadCapture({ source, payload }) {
  const { lang } = useLang();
  const { containerRef, obtainToken } = useTurnstile(TURNSTILE_SITE_KEY);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, done: false, err: null });

  async function handleSubmit(e) {
    e.preventDefault();
    if (state.busy || state.done) return;
    if (!name.trim() || !EMAIL_RE.test(email.trim())) {
      setState({ busy: false, done: false, err: 'Enter your name and a valid email.' });
      return;
    }
    setState({ busy: true, done: false, err: null });
    try {
      let token;
      try {
        token = await obtainToken();
      } catch {
        // Fails soft: the visitor already has their numbers on screen regardless.
        setState({ busy: false, done: false, err: 'Security check could not complete — please retry.' });
        return;
      }
      await submitLead(
        { source, full_name: name.trim(), email: email.trim().toLowerCase(), ...payload },
        token,
        lang,
      );
      setState({ busy: false, done: true, err: null });
    } catch (err) {
      setState({ busy: false, done: false, err: err?.message || 'Could not save — please try again.' });
    }
  }

  if (state.done) {
    return (
      <div style={st.doneCard} role="status" aria-live="polite">
        <span style={st.doneMark}>✓</span>
        <span style={st.doneText}>Sent! Check your inbox for this snapshot.</span>
      </div>
    );
  }

  return (
    <form style={st.card} onSubmit={handleSubmit} aria-label="Save your results">
      <div style={st.kicker}>Save These Numbers</div>
      <div style={st.row}>
        <input
          style={st.input}
          type="text"
          placeholder="Your name"
          autoComplete="name"
          value={name}
          disabled={state.busy}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          style={st.input}
          type="email"
          placeholder="you@email.com"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          disabled={state.busy}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" style={st.cta} disabled={state.busy}>
          {state.busy ? 'Sending…' : 'Email Me This'}
        </button>
      </div>
      {state.err ? <div style={st.err} role="alert">{state.err}</div> : null}
      <div ref={containerRef} aria-hidden="true" />
    </form>
  );
}

const st = {
  card: { marginTop: 14, background: 'rgba(157,39,201,.08)', border: `1px solid rgba(245,200,0,.3)`, borderRadius: 12, padding: '14px 16px' },
  kicker: { fontFamily: BODY, fontSize: '.68rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: PURL, marginBottom: 8 },
  row: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  input: { flex: '1 1 140px', minWidth: 0, boxSizing: 'border-box', background: '#0a0414', border: '1px solid rgba(157,39,201,.35)', borderRadius: 8, color: '#fff', fontFamily: BODY, fontSize: '.92rem', fontWeight: 600, padding: '.6rem .7rem', outline: 'none' },
  cta: { flex: '0 0 auto', fontFamily: HEAD, fontSize: '.9rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#1B1106', background: `linear-gradient(180deg, ${GOLD} 0%, #D4AF37 100%)`, border: 'none', borderRadius: 8, padding: '.6rem 1.1rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  err: { fontFamily: BODY, fontSize: '.78rem', fontWeight: 700, color: '#fca5a5', marginTop: 8 },
  doneCard: { marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.4)', borderRadius: 12, padding: '12px 16px' },
  doneMark: { fontFamily: HEAD, fontSize: '1.1rem', color: '#22c55e' },
  doneText: { fontFamily: BODY, fontSize: '.88rem', fontWeight: 600, color: 'rgba(255,255,255,.85)' },
};
