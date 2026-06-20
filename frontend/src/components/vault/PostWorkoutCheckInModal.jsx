// src/components/vault/PostWorkoutCheckInModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Post-Workout Check-In — a premium Sovereign-Vault bottom-sheet modal that feeds
// the Dynamic Prescription Engine. The athlete picks a target area + rates pain
// (1–10) and session difficulty / RPE (1–10); on save it POSTs through
// sessionFeedbackApi → bbf-prescription-checkin, which resolves identity from the
// vault session and writes session_feedback (the DB tripwire then generates the
// next day's playlist).
//
// CONTROLLED component — meant to be driven by global app state:
//     <PostWorkoutCheckInModal open={open} onClose={...} onSuccess={...} />
//
// Brand-locked (CLAUDE.md §2): matte-black/void canvas, BBF Purple→Gold accents,
// Bebas headers / Barlow body. Trilingual (EN/ES/PT is structural, §1). The native
// bottom-sheet feel carries through the Capacitor shell.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { submitSessionFeedback, TARGET_AREAS } from '../../lib/sessionFeedbackApi.js';
import './postWorkoutCheckIn.css';

const SUCCESS_DISMISS_MS = 1500; // psychological-closure beat before auto-dismiss

const STR = {
  en: {
    title: 'Post-Workout Check-In',
    sub: 'Tell the engine how that session landed — it builds tomorrow from this.',
    area: 'Target Area',
    pain: 'Pain Level',
    painLow: 'No pain',
    painHigh: 'Severe',
    rpe: 'Session Difficulty (RPE)',
    rpeLow: 'Easy',
    rpeHigh: 'Maximal',
    save: 'Save & Recover',
    saving: 'Saving…',
    success: 'Locked In',
    close: 'Close',
    errGeneric: 'Couldn’t save your check-in. Try again.',
    areas: { shoulder: 'Shoulder', lower_body: 'Lower Body', knee: 'Knee', neck: 'Neck', upper_body: 'Upper Body', full_body: 'Full Body' },
  },
  es: {
    title: 'Registro Post-Entrenamiento',
    sub: 'Dile al motor cómo te cayó la sesión — con esto construye tu mañana.',
    area: 'Zona Objetivo',
    pain: 'Nivel de Dolor',
    painLow: 'Sin dolor',
    painHigh: 'Severo',
    rpe: 'Dificultad de la Sesión (RPE)',
    rpeLow: 'Fácil',
    rpeHigh: 'Máxima',
    save: 'Guardar y Recuperar',
    saving: 'Guardando…',
    success: 'Confirmado',
    close: 'Cerrar',
    errGeneric: 'No se pudo guardar tu registro. Inténtalo de nuevo.',
    areas: { shoulder: 'Hombro', lower_body: 'Tren Inferior', knee: 'Rodilla', neck: 'Cuello', upper_body: 'Tren Superior', full_body: 'Cuerpo Completo' },
  },
  pt: {
    title: 'Check-In Pós-Treino',
    sub: 'Diga ao motor como foi a sessão — é com isso que ele monta o amanhã.',
    area: 'Área Alvo',
    pain: 'Nível de Dor',
    painLow: 'Sem dor',
    painHigh: 'Severa',
    rpe: 'Dificuldade da Sessão (RPE)',
    rpeLow: 'Fácil',
    rpeHigh: 'Máxima',
    save: 'Salvar e Recuperar',
    saving: 'Salvando…',
    success: 'Confirmado',
    close: 'Fechar',
    errGeneric: 'Não foi possível salvar seu check-in. Tente novamente.',
    areas: { shoulder: 'Ombro', lower_body: 'Inferiores', knee: 'Joelho', neck: 'Pescoço', upper_body: 'Superiores', full_body: 'Corpo Inteiro' },
  },
};

export default function PostWorkoutCheckInModal({ open, onClose, onSuccess }) {
  const { lang } = useLang();
  const { user } = useAuth();
  const S = STR[lang] || STR.en;

  const [targetArea, setTargetArea] = useState('full_body');
  const [pain, setPain] = useState(3);
  const [rpe, setRpe] = useState(5);
  const [status, setStatus] = useState('idle'); // idle | saving | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);
  const dismissTimer = useRef(null);

  const busy = status === 'saving';
  const done = status === 'success';
  const locked = busy || done; // inputs + scrim frozen while saving or celebrating

  // Stable close that also clears any pending auto-dismiss timer.
  const handleClose = useCallback(() => {
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; }
    onClose?.();
  }, [onClose]);

  // Reset the form the moment the sheet transitions closed → open. This is the
  // React-sanctioned "adjust state when a prop changes" pattern (a guarded setState
  // during render), NOT an effect — so it never triggers cascading-effect renders.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTargetArea('full_body');
      setPain(3);
      setRpe(5);
      setStatus('idle');
      setErrorMsg('');
    }
  }

  // While open: lock body scroll + wire ESC-to-close (external-system sync only).
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; }
    };
  }, [open, handleClose]);

  async function handleSave() {
    if (locked) return;
    setStatus('saving');
    setErrorMsg('');
    try {
      const result = await submitSessionFeedback({
        uid: user?.id,
        painScore: pain,
        rpeScore: rpe,
        targetArea,
      });
      setStatus('success');
      onSuccess?.(result);
      // Hold "Locked In" for a beat of closure, then dismiss.
      dismissTimer.current = setTimeout(() => { handleClose(); }, SUCCESS_DISMISS_MS);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err?.message || S.errGeneric);
    }
  }

  if (!open) return null;

  const saveLabel = done ? S.success : busy ? S.saving : S.save;

  return (
    <div
      className="pwc-scrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) handleClose(); }}
    >
      <section
        className="pwc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwc-title"
        data-testid="post-workout-checkin"
      >
        <div className="pwc-handle" aria-hidden="true" />

        <header className="pwc-head">
          <h2 id="pwc-title" className="pwc-title">{S.title}</h2>
          <p className="pwc-sub">{S.sub}</p>
        </header>

        {/* Target Area — pill row */}
        <div className="pwc-section">
          <span className="pwc-label">{S.area}</span>
          <div className="pwc-pills" role="radiogroup" aria-label={S.area}>
            {TARGET_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                role="radio"
                aria-checked={targetArea === area}
                className={`pwc-pill${targetArea === area ? ' pwc-pill--active' : ''}`}
                onClick={() => !locked && setTargetArea(area)}
                disabled={locked}
              >
                {S.areas[area]}
              </button>
            ))}
          </div>
        </div>

        {/* Pain slider — green → yellow → red */}
        <div className="pwc-section">
          <div className="pwc-slider-head">
            <span className="pwc-label">{S.pain}</span>
            <span className="pwc-value" data-tone="pain">{pain}<span className="pwc-value-max">/10</span></span>
          </div>
          <input
            type="range" min="1" max="10" step="1"
            className="pwc-range pwc-range--pain"
            value={pain}
            onChange={(e) => setPain(Number(e.target.value))}
            disabled={locked}
            aria-label={S.pain}
            aria-valuetext={`${pain} / 10`}
          />
          <div className="pwc-scale"><span>{S.painLow}</span><span>{S.painHigh}</span></div>
        </div>

        {/* RPE slider — purple → gold */}
        <div className="pwc-section">
          <div className="pwc-slider-head">
            <span className="pwc-label">{S.rpe}</span>
            <span className="pwc-value" data-tone="rpe">{rpe}<span className="pwc-value-max">/10</span></span>
          </div>
          <input
            type="range" min="1" max="10" step="1"
            className="pwc-range pwc-range--rpe"
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            disabled={locked}
            aria-label={S.rpe}
            aria-valuetext={`${rpe} / 10`}
          />
          <div className="pwc-scale"><span>{S.rpeLow}</span><span>{S.rpeHigh}</span></div>
        </div>

        {errorMsg ? <p className="pwc-error" role="alert">{errorMsg}</p> : null}

        <button
          type="button"
          className={`pwc-save${done ? ' pwc-save--done' : ''}`}
          onClick={handleSave}
          disabled={locked}
          aria-busy={busy}
        >
          {done ? <span className="pwc-check" aria-hidden="true">✓</span> : null}
          {saveLabel}
        </button>
      </section>
    </div>
  );
}
