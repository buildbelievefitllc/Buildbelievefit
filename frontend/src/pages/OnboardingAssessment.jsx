// src/pages/OnboardingAssessment.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Sovereign Intake — a premium, conversational multi-step assessment (public
// top-of-funnel). A state-driven wizard: one panel visible at a time (CLAUDE.md
// §10, zero scroll bloat), advancing in-viewport with no page reloads.
//
// FLOW: Focus → Biometrics → Weekly availability → Injury history → Get My Plan.
// Each step captures into a single `answers` bucket via option-pill selectors and
// clean numeric inputs.
//
// PERSISTENCE: on the final CTA the payload is staged in localStorage under
// `bbf_pending_intake` (durable across the OAuth round-trip, unlike sessionStorage
// which some WebView auth flows drop). A future authenticated-first-load step reads
// + clears it to write the profile ledger row on user ingestion.
//
// AUTH BRIDGE: the "Get My Fitness Plan" CTA calls supabase.auth.signInWithOAuth
// ('google' | 'apple') with redirectTo → /select-tier, so a one-click sign-in
// shunts straight into the subscription tier gate. Brand-locked (§2).

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import './onboardingAssessment.css';

// localStorage handoff key — read + cleared once, on the first authenticated load.
export const PENDING_INTAKE_KEY = 'bbf_pending_intake';

const STEPS = ['focus', 'metrics', 'availability', 'injuries', 'finish'];

const FOCUS_OPTIONS = [
  { id: 'lean_muscle', label: 'Build lean muscle mass fast' },
  { id: 'fat_loss', label: 'Lose fat & get lean' },
  { id: 'strength', label: 'Boost raw strength & power' },
  { id: 'recomp', label: 'Recomposition — build & burn at once' },
  { id: 'mobility', label: 'Restore mobility & joint health' },
  { id: 'general', label: 'General fitness & daily energy' },
];

const AVAILABILITY_OPTIONS = [
  { id: '2', label: '2 days' },
  { id: '3', label: '3 days' },
  { id: '4', label: '4 days' },
  { id: '5', label: '5 days' },
  { id: '6plus', label: '6+ days' },
];

const INJURY_OPTIONS = [
  { id: 'none', label: 'No injuries' },
  { id: 'knee', label: 'Knee' },
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'lower_back', label: 'Lower back' },
  { id: 'hip', label: 'Hip' },
  { id: 'ankle', label: 'Ankle / foot' },
  { id: 'wrist_elbow', label: 'Wrist / elbow' },
  { id: 'neck', label: 'Neck' },
];

const EMPTY = {
  focus: null,
  units: 'imperial',           // 'imperial' | 'metric'
  heightFt: '', heightIn: '',  // imperial height
  heightCm: '',                // metric height
  weight: '', targetWeight: '',
  availability: null,
  injuries: [],
};

export default function OnboardingAssessment() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(EMPTY);
  const [authBusy, setAuthBusy] = useState(null); // null | 'google' | 'apple'
  const [authErr, setAuthErr] = useState(null);

  const key = STEPS[step];
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));

  // Injury multi-select with "No injuries" exclusivity.
  const toggleInjury = (id) => setAnswers((a) => {
    if (id === 'none') return { ...a, injuries: a.injuries.includes('none') ? [] : ['none'] };
    const next = new Set(a.injuries);
    next.delete('none');
    if (next.has(id)) next.delete(id); else next.add(id);
    return { ...a, injuries: [...next] };
  });

  // Per-step gate — Next / the final CTA stay disabled until the step is answered.
  const stepValid = useMemo(() => {
    switch (key) {
      case 'focus': return !!answers.focus;
      case 'metrics': {
        const h = answers.units === 'metric'
          ? Number(answers.heightCm) > 0
          : (Number(answers.heightFt) > 0 && Number(answers.heightIn) >= 0 && Number(answers.heightIn) < 12);
        return h && Number(answers.weight) > 0 && Number(answers.targetWeight) > 0;
      }
      case 'availability': return !!answers.availability;
      case 'injuries': return answers.injuries.length > 0;
      default: return true;
    }
  }, [key, answers]);

  const next = () => { if (stepValid && step < STEPS.length - 1) setStep((s) => s + 1); };
  const back = () => setStep((s) => Math.max(0, s - 1));

  async function startAuth(provider) {
    if (authBusy) return;
    setAuthErr(null);
    setAuthBusy(provider);
    // Stage the intake so it survives the OAuth redirect and is written to the
    // profile ledger on first authenticated load.
    try {
      localStorage.setItem(PENDING_INTAKE_KEY, JSON.stringify({ v: 1, at: new Date().toISOString(), answers }));
    } catch { /* private-mode / quota — proceed; auth still works */ }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/select-tier` },
    });
    // On success the tab navigates away to the provider — nothing more to do here.
    if (error) {
      setAuthBusy(null);
      setAuthErr(error.message || 'Sign-in could not be started. Please try again.');
    }
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <main className="oa" data-testid="onboarding-assessment">
      <div className="oa-shell">
        <header className="oa-head">
          <span className="oa-kicker">Sovereign Intake</span>
          <div className="oa-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="oa-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="oa-step-count">Step {step + 1} of {STEPS.length}</span>
        </header>

        <section className="oa-panel" key={key}>
          {key === 'focus' && (
            <StepShell title="What's your #1 focus right now?" sub="This sets the engine behind your whole plan.">
              <div className="oa-pills" role="radiogroup" aria-label="Primary focus">
                {FOCUS_OPTIONS.map((o) => (
                  <button
                    key={o.id} type="button" role="radio" aria-checked={answers.focus === o.id}
                    className={`oa-pill oa-pill--wide${answers.focus === o.id ? ' is-on' : ''}`}
                    onClick={() => set({ focus: o.id })}
                    data-testid={`oa-focus-${o.id}`}
                  >{o.label}</button>
                ))}
              </div>
            </StepShell>
          )}

          {key === 'metrics' && (
            <StepShell title="Your starting numbers" sub="We calibrate load and targets to your body — nothing shared.">
              <div className="oa-units" role="group" aria-label="Units">
                <button type="button" className={`oa-unit${answers.units === 'imperial' ? ' is-on' : ''}`} onClick={() => set({ units: 'imperial' })}>Imperial</button>
                <button type="button" className={`oa-unit${answers.units === 'metric' ? ' is-on' : ''}`} onClick={() => set({ units: 'metric' })}>Metric</button>
              </div>

              <div className="oa-fields">
                <label className="oa-field oa-field--full">
                  <span className="oa-field-lbl">Height</span>
                  {answers.units === 'metric' ? (
                    <span className="oa-input-wrap">
                      <input className="oa-input" type="number" inputMode="numeric" min="0" value={answers.heightCm}
                        onChange={(e) => set({ heightCm: e.target.value })} placeholder="178" data-testid="oa-height-cm" />
                      <span className="oa-unit-tag">cm</span>
                    </span>
                  ) : (
                    <span className="oa-split">
                      <span className="oa-input-wrap">
                        <input className="oa-input" type="number" inputMode="numeric" min="0" value={answers.heightFt}
                          onChange={(e) => set({ heightFt: e.target.value })} placeholder="5" data-testid="oa-height-ft" />
                        <span className="oa-unit-tag">ft</span>
                      </span>
                      <span className="oa-input-wrap">
                        <input className="oa-input" type="number" inputMode="numeric" min="0" max="11" value={answers.heightIn}
                          onChange={(e) => set({ heightIn: e.target.value })} placeholder="10" data-testid="oa-height-in" />
                        <span className="oa-unit-tag">in</span>
                      </span>
                    </span>
                  )}
                </label>

                <label className="oa-field">
                  <span className="oa-field-lbl">Current weight</span>
                  <span className="oa-input-wrap">
                    <input className="oa-input" type="number" inputMode="numeric" min="0" value={answers.weight}
                      onChange={(e) => set({ weight: e.target.value })} placeholder={answers.units === 'metric' ? '80' : '175'} data-testid="oa-weight" />
                    <span className="oa-unit-tag">{answers.units === 'metric' ? 'kg' : 'lb'}</span>
                  </span>
                </label>

                <label className="oa-field">
                  <span className="oa-field-lbl">Target weight</span>
                  <span className="oa-input-wrap">
                    <input className="oa-input" type="number" inputMode="numeric" min="0" value={answers.targetWeight}
                      onChange={(e) => set({ targetWeight: e.target.value })} placeholder={answers.units === 'metric' ? '75' : '165'} data-testid="oa-target" />
                    <span className="oa-unit-tag">{answers.units === 'metric' ? 'kg' : 'lb'}</span>
                  </span>
                </label>
              </div>
            </StepShell>
          )}

          {key === 'availability' && (
            <StepShell title="How many days a week can you train?" sub="Be honest — we build the plan around your real life.">
              <div className="oa-pills oa-pills--row" role="radiogroup" aria-label="Weekly availability">
                {AVAILABILITY_OPTIONS.map((o) => (
                  <button
                    key={o.id} type="button" role="radio" aria-checked={answers.availability === o.id}
                    className={`oa-pill${answers.availability === o.id ? ' is-on' : ''}`}
                    onClick={() => set({ availability: o.id })}
                    data-testid={`oa-avail-${o.id}`}
                  >{o.label}</button>
                ))}
              </div>
            </StepShell>
          )}

          {key === 'injuries' && (
            <StepShell title="Any injuries we should train around?" sub="Select all that apply — this drives your prehab and load caps.">
              <div className="oa-pills" role="group" aria-label="Injury history">
                {INJURY_OPTIONS.map((o) => (
                  <button
                    key={o.id} type="button" aria-pressed={answers.injuries.includes(o.id)}
                    className={`oa-pill${answers.injuries.includes(o.id) ? ' is-on' : ''}`}
                    onClick={() => toggleInjury(o.id)}
                    data-testid={`oa-injury-${o.id}`}
                  >{o.label}</button>
                ))}
              </div>
            </StepShell>
          )}

          {key === 'finish' && (
            <StepShell title="Your plan is ready to build" sub="Create your account to lock it in — takes one tap.">
              <div className="oa-auth">
                <button type="button" className="oa-cta oa-cta--google" onClick={() => startAuth('google')} disabled={!!authBusy} data-testid="oa-cta-google">
                  {authBusy === 'google' ? 'Opening…' : 'Get My Fitness Plan with Google'}
                </button>
                <button type="button" className="oa-cta oa-cta--apple" onClick={() => startAuth('apple')} disabled={!!authBusy} data-testid="oa-cta-apple">
                  {authBusy === 'apple' ? 'Opening…' : ' Continue with Apple'}
                </button>
                {authErr ? <p className="oa-auth-err" role="alert" data-testid="oa-auth-err">{authErr}</p> : null}
                <p className="oa-auth-note">Your answers are saved and applied to your plan the moment you sign in.</p>
              </div>
            </StepShell>
          )}
        </section>

        {key !== 'finish' ? (
          <footer className="oa-nav">
            <button type="button" className="oa-back" onClick={back} disabled={step === 0} data-testid="oa-back">← Back</button>
            <button type="button" className="oa-next" onClick={next} disabled={!stepValid} data-testid="oa-next">
              {step === STEPS.length - 2 ? 'Review my plan →' : 'Continue →'}
            </button>
          </footer>
        ) : (
          <footer className="oa-nav oa-nav--finish">
            <button type="button" className="oa-back" onClick={back} data-testid="oa-back">← Back</button>
          </footer>
        )}
      </div>
    </main>
  );
}

function StepShell({ title, sub, children }) {
  return (
    <div className="oa-stepshell">
      <h1 className="oa-title">{title}</h1>
      {sub ? <p className="oa-sub">{sub}</p> : null}
      {children}
    </div>
  );
}
