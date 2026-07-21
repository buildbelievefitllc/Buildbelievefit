// src/pages/VoiceIntake.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE VOICE INTAKE — a live, conversational top-of-funnel intake (public).
//
// Coach Akeem's ElevenLabs clone TALKS the visitor through their goals as a real
// back-and-forth: he asks a question aloud, the visitor answers by VOICE (Web
// Speech STT, parsed to canonical values) OR by tapping — a live transcript builds
// as they go. It captures the EXACT same signal as the old tap wizard and emits
// the IDENTICAL `bbf_pending_intake` payload, so every downstream system is reused
// untouched: PendingIntakeSync → bbf_intake_submissions → reconciliation trigger
// → bbf_intake_profile → generator calibration → tier recommendation → PAR-Q →
// checkout. This is a front-door swap, not a new pipeline.
//
// FLOW (one panel at a time — §10, zero scroll bloat):
//   greeting+focus → metrics → availability → injuries → wrap (OAuth handoff).
//
// VOICE is Akeem's signature clone, lazy-baked + cached by the public, allowlisted
// bbf-intake-voice edge function (never arbitrary text). Tap controls are ALWAYS
// visible and are the source of truth, so a flaky mic or a mis-parse can never
// trap a buyer mid-funnel. Brand-locked (§2). Trilingual via t().

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../context/LangContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { PENDING_INTAKE_KEY } from './OnboardingAssessment.jsx';
import {
  fetchIntakeVoice, prefetchIntakeVoice, createListener, sttSupported,
  parseFocus, parseMetrics, parseAvailability, parseInjuries,
} from '../lib/intakeVoice.js';
import './voiceIntake.css';

// Steps carry the voice `key` (must match the bbf-intake-voice allowlist) and the
// answer surface rendered for that turn.
const STEPS = [
  { key: 'greeting', surface: 'focus' },
  { key: 'metrics', surface: 'metrics' },
  { key: 'availability', surface: 'availability' },
  { key: 'injuries', surface: 'injuries' },
  { key: 'wrap', surface: 'auth' },
];

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
  units: 'imperial',
  heightFt: '', heightIn: '',
  heightCm: '',
  weight: '', targetWeight: '',
  availability: null,
  injuries: [],
};

export default function VoiceIntake() {
  const { t, lang } = useLang();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(EMPTY);
  const [transcript, setTranscript] = useState([]); // { who:'coach'|'you', text }
  const [voiceOn, setVoiceOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [listening, setListening] = useState(false);
  const [needsTap, setNeedsTap] = useState(false); // autoplay was blocked → invite a tap
  const [sttNote, setSttNote] = useState(null);     // 'unsupported' | 'no-speech' | null
  const [authBusy, setAuthBusy] = useState(null);
  const [authErr, setAuthErr] = useState(null);

  const audioRef = useRef(null);
  const listenerRef = useRef(null);
  const answersRef = useRef(answers);
  const stepRef = useRef(step);
  const announced = useRef(new Set());
  const scrollRef = useRef(null);

  // Latest-value refs — synced in effects (never mutated during render, per the
  // house react-hooks/refs rule). Read by the deferred auto-advance timer + nav.
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { stepRef.current = step; }, [step]);

  const surface = STEPS[step].surface;
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));

  // ── audio helpers ──────────────────────────────────────────────────────────
  function stopAudio() {
    const el = audioRef.current;
    if (el) { try { el.pause(); } catch { /* ignore */ } }
    setPlaying(false);
  }

  async function playLine(stepKey, { userGesture = false } = {}) {
    const res = await fetchIntakeVoice(stepKey, lang);
    const el = audioRef.current;
    if (!res || !res.url || !el) { setNeedsTap(false); return; }
    try {
      el.src = res.url;
      el.load();
    } catch { /* ignore */ }
    if (!voiceOn && !userGesture) { setNeedsTap(false); return; }
    try {
      await el.play();
      setNeedsTap(false);
    } catch {
      // Autoplay policy blocked us before a user gesture — surface a tap affordance.
      setNeedsTap(true);
    }
  }

  // Build (and rebuild on language switch) the single-shot speech listener.
  useEffect(() => {
    listenerRef.current = createListener(lang);
    return () => { try { listenerRef.current?.stop(); } catch { /* ignore */ } };
  }, [lang]);

  // On entering a step: announce the coach line once, play Akeem, prefetch next.
  // All setState is deferred to a microtask (house set-state-in-effect rule).
  useEffect(() => {
    const k = STEPS[step].key;
    const nextKey = STEPS[step + 1]?.key;
    queueMicrotask(() => {
      if (!announced.current.has(k)) {
        announced.current.add(k);
        setTranscript((tr) => [...tr, { who: 'coach', text: t(`vi-say-${k}`) }]);
      }
      playLine(k);
      if (nextKey) prefetchIntakeVoice(nextKey, lang);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, lang]);

  // Keep the transcript pinned to the latest turn.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  // ── per-step validity (identical gate to the tap wizard) ────────────────────
  function isValid(k, a) {
    switch (k) {
      case 'greeting': return !!a.focus;
      case 'metrics': {
        const h = a.units === 'metric'
          ? Number(a.heightCm) > 0
          : (Number(a.heightFt) > 0 && Number(a.heightIn) >= 0 && Number(a.heightIn) < 12);
        return h && Number(a.weight) > 0 && Number(a.targetWeight) > 0;
      }
      case 'availability': return !!a.availability;
      case 'injuries': return a.injuries.length > 0;
      default: return true;
    }
  }
  const stepValid = useMemo(() => isValid(STEPS[step].key, answers), [step, answers]);

  // ── transcript "you" summaries (canonical, trilingual) ──────────────────────
  function focusLabel(id) {
    const o = FOCUS_OPTIONS.find((x) => x.id === id);
    return o ? t(o.key) : '';
  }
  function summaryFor(k, a) {
    switch (k) {
      case 'greeting': return focusLabel(a.focus);
      case 'metrics': {
        const u = a.units === 'metric' ? 'cm' : 'ft/in';
        const wu = a.units === 'metric' ? 'kg' : 'lb';
        const height = a.units === 'metric' ? `${a.heightCm}cm` : `${a.heightFt}'${a.heightIn || 0}"`;
        void u;
        return `${height} · ${a.weight}${wu} → ${a.targetWeight}${wu}`;
      }
      case 'availability': {
        const o = AVAILABILITY_OPTIONS.find((x) => x.id === a.availability);
        return `${o ? o.n : a.availability} ${t('oa-days')}`;
      }
      case 'injuries':
        return a.injuries
          .map((id) => t((INJURY_OPTIONS.find((x) => x.id === id) || {}).key || ''))
          .filter(Boolean).join(', ');
      default: return '';
    }
  }
  const pushYou = (text) => { if (text) setTranscript((tr) => [...tr, { who: 'you', text }]); };

  // ── navigation ──────────────────────────────────────────────────────────────
  function goNext() {
    const s = stepRef.current;
    const k = STEPS[s].key;
    const a = answersRef.current;
    if (!isValid(k, a) || s >= STEPS.length - 1) return;
    pushYou(summaryFor(k, a));
    stopAudio();
    setSttNote(null);
    setStep(() => s + 1);
  }
  function goBack() {
    stopAudio();
    setSttNote(null);
    setStep((s) => Math.max(0, s - 1));
  }
  // Auto-advance after a tap/voice answer on a single-select step, once it's valid.
  function maybeAutoAdvance(fromStep) {
    setTimeout(() => {
      if (stepRef.current !== fromStep) return;                 // user already moved
      if (!isValid(STEPS[fromStep].key, answersRef.current)) return;
      goNext();
    }, 620);
  }

  // ── answer handlers ─────────────────────────────────────────────────────────
  function pickFocus(id) {
    set({ focus: id });
    maybeAutoAdvance(step);
  }
  function pickAvailability(id) {
    set({ availability: id });
    maybeAutoAdvance(step);
  }
  function toggleInjury(id) {
    setAnswers((a) => {
      if (id === 'none') return { ...a, injuries: a.injuries.includes('none') ? [] : ['none'] };
      const next = new Set(a.injuries);
      next.delete('none');
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...a, injuries: [...next] };
    });
  }

  // ── speak (STT) ──────────────────────────────────────────────────────────────
  function onSpeak() {
    const L = listenerRef.current;
    if (!L || !L.supported) { setSttNote('unsupported'); return; }
    if (listening) { L.stop(); setListening(false); return; }
    setSttNote(null);
    stopAudio();                       // don't let the mic hear Akeem
    setListening(true);
    L.start({
      onResult: (raw) => handleSpoken(raw),
      onEnd: () => setListening(false),
      onError: (kind) => { setListening(false); if (kind === 'not-allowed' || kind === 'service-not-allowed') setSttNote('denied'); else if (kind === 'no-speech') setSttNote('no-speech'); },
    });
  }

  function handleSpoken(raw) {
    if (!raw) return;
    const k = STEPS[step].key;
    pushYou(raw);
    if (k === 'greeting') {
      const f = parseFocus(raw);
      if (f) { set({ focus: f }); maybeAutoAdvance(step); }
    } else if (k === 'metrics') {
      const patch = parseMetrics(raw, answersRef.current.units);
      if (patch) set(patch);          // no auto-advance — let them confirm the numbers
    } else if (k === 'availability') {
      const a = parseAvailability(raw);
      if (a) { set({ availability: a }); maybeAutoAdvance(step); }
    } else if (k === 'injuries') {
      const inj = parseInjuries(raw);
      if (inj) { set({ injuries: inj }); maybeAutoAdvance(step); }
    }
  }

  // ── OAuth handoff (identical to the tap wizard) ─────────────────────────────
  async function startAuth(provider) {
    if (authBusy) return;
    setAuthErr(null);
    setAuthBusy(provider);
    try {
      localStorage.setItem(PENDING_INTAKE_KEY, JSON.stringify({ v: 1, at: new Date().toISOString(), answers }));
    } catch { /* private-mode / quota — proceed; auth still works */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/select-tier` },
    });
    if (error) {
      setAuthBusy(null);
      setAuthErr(error.message || 'Sign-in could not be started. Please try again.');
    }
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const statusText = listening ? t('vi-status-listening') : playing ? t('vi-status-speaking') : t('vi-status-turn');
  const canSpeak = sttSupported();

  return (
    <main className="vi" data-testid="voice-intake">
      <div className="vi-shell">
        <header className="vi-head">
          <span className="vi-kicker"><span className="vi-mic" aria-hidden="true">🎙</span>{t('vi-kicker')}</span>
          <div className="vi-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="vi-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="vi-step-count">{t('oa-step')} {step + 1} {t('oa-of')} {STEPS.length}</span>
        </header>

        {/* Coach orb + live status */}
        <div className="vi-stage">
          <button
            type="button"
            className={`vi-orb${playing ? ' is-speaking' : ''}${listening ? ' is-listening' : ''}${needsTap ? ' bbf-pulse bbf-pulse--gold' : ''}`}
            onClick={() => playLine(STEPS[step].key, { userGesture: true })}
            aria-label={t('vi-replay')}
            data-testid="vi-orb"
          >
            <span className="vi-orb-ic" aria-hidden="true">{playing ? '🔊' : needsTap ? '▶' : '🎧'}</span>
          </button>
          <div className="vi-status" data-testid="vi-status">{statusText}</div>
        </div>

        {/* Live transcript */}
        <div className="vi-transcript" ref={scrollRef} data-testid="vi-transcript">
          {transcript.map((line, i) => (
            <div key={i} className={`vi-line vi-line--${line.who}`}>
              <span className="vi-line-who">{line.who === 'coach' ? t('vi-who-coach') : t('vi-who-you')}</span>
              <span className="vi-line-text">{line.text}</span>
            </div>
          ))}
        </div>

        {/* Answer surface for the current turn */}
        <section className="vi-answer" key={STEPS[step].key}>
          {surface === 'focus' && (
            <div className="vi-pills" role="radiogroup" aria-label={t('oa-focus-title')}>
              {FOCUS_OPTIONS.map((o) => (
                <button
                  key={o.id} type="button" role="radio" aria-checked={answers.focus === o.id}
                  className={`vi-pill vi-pill--wide${answers.focus === o.id ? ' is-on' : ''}`}
                  onClick={() => pickFocus(o.id)}
                  data-testid={`vi-focus-${o.id}`}
                >{t(o.key)}</button>
              ))}
            </div>
          )}

          {surface === 'metrics' && (
            <div className="vi-metrics">
              <div className="vi-units" role="group" aria-label="Units">
                <button type="button" className={`vi-unit${answers.units === 'imperial' ? ' is-on' : ''}`} onClick={() => set({ units: 'imperial' })}>{t('oa-units-imperial')}</button>
                <button type="button" className={`vi-unit${answers.units === 'metric' ? ' is-on' : ''}`} onClick={() => set({ units: 'metric' })}>{t('oa-units-metric')}</button>
              </div>
              <div className="vi-fields">
                <label className="vi-field vi-field--full">
                  <span className="vi-field-lbl">{t('oa-height')}</span>
                  {answers.units === 'metric' ? (
                    <span className="vi-input-wrap">
                      <input className="vi-input" type="number" inputMode="numeric" min="0" value={answers.heightCm}
                        onChange={(e) => set({ heightCm: e.target.value })} placeholder="178" data-testid="vi-height-cm" />
                      <span className="vi-unit-tag">cm</span>
                    </span>
                  ) : (
                    <span className="vi-split">
                      <span className="vi-input-wrap">
                        <input className="vi-input" type="number" inputMode="numeric" min="0" value={answers.heightFt}
                          onChange={(e) => set({ heightFt: e.target.value })} placeholder="5" data-testid="vi-height-ft" />
                        <span className="vi-unit-tag">ft</span>
                      </span>
                      <span className="vi-input-wrap">
                        <input className="vi-input" type="number" inputMode="numeric" min="0" max="11" value={answers.heightIn}
                          onChange={(e) => set({ heightIn: e.target.value })} placeholder="10" data-testid="vi-height-in" />
                        <span className="vi-unit-tag">in</span>
                      </span>
                    </span>
                  )}
                </label>
                <label className="vi-field">
                  <span className="vi-field-lbl">{t('oa-weight')}</span>
                  <span className="vi-input-wrap">
                    <input className="vi-input" type="number" inputMode="numeric" min="0" value={answers.weight}
                      onChange={(e) => set({ weight: e.target.value })} placeholder={answers.units === 'metric' ? '80' : '175'} data-testid="vi-weight" />
                    <span className="vi-unit-tag">{answers.units === 'metric' ? 'kg' : 'lb'}</span>
                  </span>
                </label>
                <label className="vi-field">
                  <span className="vi-field-lbl">{t('oa-target')}</span>
                  <span className="vi-input-wrap">
                    <input className="vi-input" type="number" inputMode="numeric" min="0" value={answers.targetWeight}
                      onChange={(e) => set({ targetWeight: e.target.value })} placeholder={answers.units === 'metric' ? '75' : '165'} data-testid="vi-target" />
                    <span className="vi-unit-tag">{answers.units === 'metric' ? 'kg' : 'lb'}</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {surface === 'availability' && (
            <div className="vi-pills vi-pills--row" role="radiogroup" aria-label={t('oa-avail-title')}>
              {AVAILABILITY_OPTIONS.map((o) => (
                <button
                  key={o.id} type="button" role="radio" aria-checked={answers.availability === o.id}
                  className={`vi-pill${answers.availability === o.id ? ' is-on' : ''}`}
                  onClick={() => pickAvailability(o.id)}
                  data-testid={`vi-avail-${o.id}`}
                >{o.n} {t('oa-days')}</button>
              ))}
            </div>
          )}

          {surface === 'injuries' && (
            <div className="vi-pills" role="group" aria-label={t('oa-inj-title')}>
              {INJURY_OPTIONS.map((o) => (
                <button
                  key={o.id} type="button" aria-pressed={answers.injuries.includes(o.id)}
                  className={`vi-pill${answers.injuries.includes(o.id) ? ' is-on' : ''}`}
                  onClick={() => toggleInjury(o.id)}
                  data-testid={`vi-injury-${o.id}`}
                >{t(o.key)}</button>
              ))}
            </div>
          )}

          {surface === 'auth' && (
            <div className="vi-auth">
              <button type="button" className="vi-cta vi-cta--google" onClick={() => startAuth('google')} disabled={!!authBusy} data-testid="vi-cta-google">
                {authBusy === 'google' ? t('oa-opening') : t('oa-cta-google')}
              </button>
              <button type="button" className="vi-cta vi-cta--apple" onClick={() => startAuth('apple')} disabled={!!authBusy} data-testid="vi-cta-apple">
                {authBusy === 'apple' ? t('oa-opening') : t('oa-cta-apple')}
              </button>
              {authErr ? <p className="vi-auth-err" role="alert" data-testid="vi-auth-err">{authErr}</p> : null}
              <p className="vi-auth-note">{t('oa-auth-note')}</p>
            </div>
          )}
        </section>

        {/* Controls: speak / mute / nav */}
        {surface !== 'auth' && (
          <div className="vi-controls">
            <div className="vi-voice-row">
              {canSpeak ? (
                <button
                  type="button"
                  className={`vi-speak${listening ? ' is-live' : ''}`}
                  onClick={onSpeak}
                  data-testid="vi-speak"
                >
                  <span className="vi-speak-ic" aria-hidden="true">{listening ? '■' : '🎤'}</span>
                  {listening ? t('vi-listening-btn') : t('vi-speak-btn')}
                </button>
              ) : null}
              <button
                type="button"
                className={`vi-mute${voiceOn ? '' : ' is-off'}`}
                onClick={() => { const on = !voiceOn; setVoiceOn(on); if (!on) stopAudio(); }}
                aria-pressed={!voiceOn}
                data-testid="vi-mute"
                title={voiceOn ? t('vi-mute') : t('vi-unmute')}
              >
                {voiceOn ? '🔊' : '🔈'}
              </button>
            </div>
            {sttNote ? <p className="vi-stt-note" data-testid="vi-stt-note">{t(`vi-stt-${sttNote}`)}</p> : null}
            <div className="vi-nav">
              <button type="button" className="vi-back" onClick={goBack} disabled={step === 0} data-testid="vi-back">← {t('oa-back')}</button>
              <button type="button" className="vi-next" onClick={goNext} disabled={!stepValid} data-testid="vi-next">
                {step === STEPS.length - 2 ? t('oa-review') : t('oa-continue')} →
              </button>
            </div>
          </div>
        )}

        {surface === 'auth' && (
          <div className="vi-nav vi-nav--finish">
            <button type="button" className="vi-back" onClick={goBack} data-testid="vi-back">← {t('oa-back')}</button>
          </div>
        )}

        {/* Prefer to type? — the whole surface already works tap-only; this hint
            reassures the mic-averse. */}
        <p className="vi-tap-hint">{t('vi-tap-hint')}</p>

        <audio
          ref={audioRef}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>
    </main>
  );
}
