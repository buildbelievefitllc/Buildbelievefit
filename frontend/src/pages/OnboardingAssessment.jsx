// src/pages/OnboardingAssessment.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Sovereign Intake — a premium, conversational multi-step assessment (public
// top-of-funnel). A state-driven wizard: one panel visible at a time (CLAUDE.md
// §10, zero scroll bloat), advancing in-viewport with no page reloads.
//
// FLOW: Focus → Biometrics → Weekly availability → Injury history → Get My Plan.
// Each step captures into a single `answers` bucket via option-pill selectors and
// clean numeric inputs. All chrome runs through the trilingual dictionary (t()).
//
// PERSISTENCE: on the final CTA the payload is staged in localStorage under
// `bbf_pending_intake` (durable across the OAuth round-trip, unlike sessionStorage
// which some WebView auth flows drop). PendingIntakeSync (root) reads + clears it
// on first authenticated load and writes bbf_intake_submissions.
//
// AUTH BRIDGE: the "Get My Fitness Plan" CTA calls supabase.auth.signInWithOAuth
// ('google' | 'apple') with redirectTo → /select-tier, so a one-click sign-in
// shunts straight into the subscription tier gate. Brand-locked (§2).

import { useMemo, useState } from 'react';
import { useLang } from '../context/LangContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import './onboardingAssessment.css';

// localStorage handoff key — read + cleared once, on the first authenticated load.
export const PENDING_INTAKE_KEY = 'bbf_pending_intake';

const STEPS = ['focus', 'metrics', 'availability', 'injuries', 'finish'];

const FOCUS_OPTIONS = [
  { id: 'lean_muscle', key: 'oa-focus-lean_muscle' },
  { id: 'fat_loss', key: 'oa-focus-fat_loss' },
  { id: 'strength', key: 'oa-focus-strength' },
  { id: 'recomp', key: 'oa-focus-recomp' },
  { id: 'mobility', key: 'oa-focus-mobility' },
  { id: 'general', key: 'oa-focus-general' },
];

const AVAILABILITY_OPTIONS = [
  { id: '2', n: '2' }, { id: '3', n: '3' }, { id: '4', n: '4' }, { id: '5', n: '5' }, { id: '6plus', n: '6+' },
];

const INJURY_OPTIONS = [
  { id: 'none', key: 'oa-inj-none' },
  { id: 'knee', key: 'oa-inj-knee' },
  { id: 'shoulder', key: 'oa-inj-shoulder' },
  { id: 'lower_back', key: 'oa-inj-lower_back' },
  { id: 'hip', key: 'oa-inj-hip' },
  { id: 'ankle', key: 'oa-inj-ankle' },
  { id: 'wrist_elbow', key: 'oa-inj-wrist_elbow' },
  { id: 'neck', key: 'oa-inj-neck' },
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
  const { t } = useLang();
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
    // Stage the intake so it survives the OAuth redirect and is written to the DB
    // on first authenticated load (PendingIntakeSync).
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
          <span className="oa-kicker">{t('oa-kicker')}</span>
          <div className="oa-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="oa-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="oa-step-count">{t('oa-step')} {step + 1} {t('oa-of')} {STEPS.length}</span>
        </header>

        <section className="oa-panel" key={key}>
          {key === 'focus' && (
            <StepShell title={t('oa-focus-title')} sub={t('oa-focus-sub')}>
              <div className="oa-pills" role="radiogroup" aria-label={t('oa-focus-title')}>
                {FOCUS_OPTIONS.map((o) => (
                  <button
                    key={o.id} type="button" role="radio" aria-checked={answers.focus === o.id}
                    className={`oa-pill oa-pill--wide${answers.focus === o.id ? ' is-on' : ''}`}
                    onClick={() => set({ focus: o.id })}
                    data-testid={`oa-focus-${o.id}`}
                  >{t(o.key)}</button>
                ))}
              </div>
            </StepShell>
          )}

          {key === 'metrics' && (
            <StepShell title={t('oa-metrics-title')} sub={t('oa-metrics-sub')}>
              <div className="oa-units" role="group" aria-label="Units">
                <button type="button" className={`oa-unit${answers.units === 'imperial' ? ' is-on' : ''}`} onClick={() => set({ units: 'imperial' })}>{t('oa-units-imperial')}</button>
                <button type="button" className={`oa-unit${answers.units === 'metric' ? ' is-on' : ''}`} onClick={() => set({ units: 'metric' })}>{t('oa-units-metric')}</button>
              </div>

              <div className="oa-fields">
                <label className="oa-field oa-field--full">
                  <span className="oa-field-lbl">{t('oa-height')}</span>
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
                  <span className="oa-field-lbl">{t('oa-weight')}</span>
                  <span className="oa-input-wrap">
                    <input className="oa-input" type="number" inputMode="numeric" min="0" value={answers.weight}
                      onChange={(e) => set({ weight: e.target.value })} placeholder={answers.units === 'metric' ? '80' : '175'} data-testid="oa-weight" />
                    <span className="oa-unit-tag">{answers.units === 'metric' ? 'kg' : 'lb'}</span>
                  </span>
                </label>

                <label className="oa-field">
                  <span className="oa-field-lbl">{t('oa-target')}</span>
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
            <StepShell title={t('oa-avail-title')} sub={t('oa-avail-sub')}>
              <div className="oa-pills oa-pills--row" role="radiogroup" aria-label={t('oa-avail-title')}>
                {AVAILABILITY_OPTIONS.map((o) => (
                  <button
                    key={o.id} type="button" role="radio" aria-checked={answers.availability === o.id}
                    className={`oa-pill${answers.availability === o.id ? ' is-on' : ''}`}
                    onClick={() => set({ availability: o.id })}
                    data-testid={`oa-avail-${o.id}`}
                  >{o.n} {t('oa-days')}</button>
                ))}
              </div>
            </StepShell>
          )}

          {key === 'injuries' && (
            <StepShell title={t('oa-inj-title')} sub={t('oa-inj-sub')}>
              <div className="oa-pills" role="group" aria-label={t('oa-inj-title')}>
                {INJURY_OPTIONS.map((o) => (
                  <button
                    key={o.id} type="button" aria-pressed={answers.injuries.includes(o.id)}
                    className={`oa-pill${answers.injuries.includes(o.id) ? ' is-on' : ''}`}
                    onClick={() => toggleInjury(o.id)}
                    data-testid={`oa-injury-${o.id}`}
                  >{t(o.key)}</button>
                ))}
              </div>
            </StepShell>
          )}

          {key === 'finish' && (
            <StepShell title={t('oa-finish-title')} sub={t('oa-finish-sub')}>
              <div className="oa-auth">
                <button type="button" className="oa-cta oa-cta--google" onClick={() => startAuth('google')} disabled={!!authBusy} data-testid="oa-cta-google">
                  {authBusy === 'google' ? t('oa-opening') : t('oa-cta-google')}
                </button>
                <button type="button" className="oa-cta oa-cta--apple" onClick={() => startAuth('apple')} disabled={!!authBusy} data-testid="oa-cta-apple">
                  {authBusy === 'apple' ? t('oa-opening') : t('oa-cta-apple')}
                </button>
                {authErr ? <p className="oa-auth-err" role="alert" data-testid="oa-auth-err">{authErr}</p> : null}
                <p className="oa-auth-note">{t('oa-auth-note')}</p>
              </div>
            </StepShell>
          )}
        </section>

        {key !== 'finish' ? (
          <footer className="oa-nav">
            <button type="button" className="oa-back" onClick={back} disabled={step === 0} data-testid="oa-back">← {t('oa-back')}</button>
            <button type="button" className="oa-next" onClick={next} disabled={!stepValid} data-testid="oa-next">
              {step === STEPS.length - 2 ? t('oa-review') : t('oa-continue')} →
            </button>
          </footer>
        ) : (
          <footer className="oa-nav oa-nav--finish">
            <button type="button" className="oa-back" onClick={back} data-testid="oa-back">← {t('oa-back')}</button>
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
