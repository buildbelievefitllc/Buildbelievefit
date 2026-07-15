// src/components/vault/SessionLoadLogger.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Session Load Logger — a premium Sovereign-Vault bottom-sheet where the athlete
// logs Duration + session intensity (sRPE, Borg CR10). On save it POSTs through
// sessionLoadApi → bbf-log-session, which resolves identity from the vault session
// and writes bbf_athlete_load_logs — the input rows for the in-house SUBJECTIVE
// ACWR engine (bbf_compute_acwr). Distinct from the Post-Workout Check-In (pain +
// target area → prescription engine); this feeds the load / injury-risk engine.
//
// CONTROLLED component: <SessionLoadLogger open={open} onClose={…} onSuccess={…} />
// Brand-locked (§2): void canvas, Purple→Gold accents, Bebas/Barlow. Trilingual.
// Styles are scoped under `.sll-` (no bleed into Studio / Language Lab).

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { submitSessionLoad } from '../../lib/sessionLoadApi.js';
import './sessionLoadLogger.css';

const SUCCESS_DISMISS_MS = 1700;

// Borg CR10 descriptor per 1–10 value (anchored 1 = Rest, 5 = Moderate, 10 = Max).
const CR10 = {
  en: ['Rest', 'Very Light', 'Light', 'Moderate–', 'Moderate', 'Moderate+', 'Hard', 'Very Hard', 'Near Max', 'Maximum Effort'],
  es: ['Reposo', 'Muy Ligero', 'Ligero', 'Moderado–', 'Moderado', 'Moderado+', 'Duro', 'Muy Duro', 'Casi Máx', 'Esfuerzo Máximo'],
  pt: ['Repouso', 'Muito Leve', 'Leve', 'Moderado–', 'Moderado', 'Moderado+', 'Difícil', 'Muito Difícil', 'Quase Máx', 'Esforço Máximo'],
};

const STR = {
  en: {
    title: 'Log Training Load', sub: 'Two taps. It feeds your injury-risk radar and tomorrow’s load.',
    dur: 'How long was your training session?', durUnit: 'minutes', durPh: 'e.g. 60',
    rpe: 'Rate your session intensity (sRPE)', low: 'Rest', mid: 'Moderate', high: 'Max Effort',
    load: 'Training Load', au: 'AU', save: 'Log Session', saving: 'Saving…', success: 'Session Logged',
    close: 'Close', errGeneric: 'Couldn’t save your session. Try again.', durErr: 'Enter 1–1440 minutes.',
  },
  es: {
    title: 'Registrar Carga', sub: 'Dos toques. Alimenta tu radar de riesgo y la carga de mañana.',
    dur: '¿Cuánto duró tu sesión de entrenamiento?', durUnit: 'minutos', durPh: 'ej. 60',
    rpe: 'Califica la intensidad (sRPE)', low: 'Reposo', mid: 'Moderado', high: 'Esfuerzo Máx',
    load: 'Carga de Entrenamiento', au: 'UA', save: 'Registrar', saving: 'Guardando…', success: 'Sesión Registrada',
    close: 'Cerrar', errGeneric: 'No se pudo guardar. Inténtalo de nuevo.', durErr: 'Ingresa 1–1440 minutos.',
  },
  pt: {
    title: 'Registrar Carga', sub: 'Dois toques. Alimenta seu radar de risco e a carga de amanhã.',
    dur: 'Quanto durou sua sessão de treino?', durUnit: 'minutos', durPh: 'ex. 60',
    rpe: 'Avalie a intensidade (sRPE)', low: 'Repouso', mid: 'Moderado', high: 'Esforço Máx',
    load: 'Carga de Treino', au: 'UA', save: 'Registrar', saving: 'Salvando…', success: 'Sessão Registrada',
    close: 'Fechar', errGeneric: 'Não foi possível salvar. Tente novamente.', durErr: 'Insira 1–1440 minutos.',
  },
};

export default function SessionLoadLogger({ open, onClose, onSuccess }) {
  const { lang } = useLang();
  const { user } = useAuth();
  const S = STR[lang] || STR.en;
  const cr10 = CR10[lang] || CR10.en;

  const [duration, setDuration] = useState('');
  const [srpe, setSrpe] = useState(5);
  const [status, setStatus] = useState('idle'); // idle | saving | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);
  const dismissTimer = useRef(null);

  const busy = status === 'saving';
  const done = status === 'success';
  const locked = busy || done;

  const durationNum = Math.round(Number(duration));
  const durationValid = Number.isFinite(durationNum) && durationNum >= 1 && durationNum <= 1440;
  const loadAu = durationValid ? durationNum * srpe : 0;

  const handleClose = useCallback(() => {
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; }
    onClose?.();
  }, [onClose]);

  // Reset when the sheet transitions closed → open (guarded setState during render,
  // the React-sanctioned "adjust state on prop change" — not an effect).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDuration('');
      setSrpe(5);
      setStatus('idle');
      setErrorMsg('');
    }
  }

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
    if (!durationValid) { setStatus('error'); setErrorMsg(S.durErr); return; }
    setStatus('saving');
    setErrorMsg('');
    try {
      const result = await submitSessionLoad({
        uid: user?.id,
        durationMinutes: durationNum,
        srpeIntensity: srpe,
        sessionType: 'sovereign_session',
      });
      setStatus('success');
      onSuccess?.(result);
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
      className="sll-scrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) handleClose(); }}
    >
      <section
        className="sll-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sll-title"
        data-testid="session-load-logger"
      >
        <div className="sll-handle" aria-hidden="true" />

        <header className="sll-head">
          <h2 id="sll-title" className="sll-title">{S.title}</h2>
          <p className="sll-sub">{S.sub}</p>
        </header>

        {/* Duration */}
        <div className="sll-section">
          <label className="sll-label" htmlFor="sll-duration">{S.dur}</label>
          <div className="sll-durwrap">
            <input
              id="sll-duration"
              type="number"
              inputMode="numeric"
              min="1"
              max="1440"
              className="sll-durinput"
              placeholder={S.durPh}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={locked}
              aria-label={S.dur}
            />
            <span className="sll-durunit">{S.durUnit}</span>
          </div>
        </div>

        {/* sRPE — Borg CR10 slider */}
        <div className="sll-section">
          <div className="sll-slider-head">
            <span className="sll-label">{S.rpe}</span>
            <span className="sll-value">{srpe}<span className="sll-value-max">/10</span></span>
          </div>
          <input
            type="range" min="1" max="10" step="1"
            className="sll-range"
            value={srpe}
            onChange={(e) => setSrpe(Number(e.target.value))}
            disabled={locked}
            aria-label={S.rpe}
            aria-valuetext={`${srpe} / 10 — ${cr10[srpe - 1]}`}
          />
          <div className="sll-cr10" data-testid="sll-cr10-descriptor">{cr10[srpe - 1]}</div>
          <div className="sll-scale"><span>{S.low}</span><span>{S.mid}</span><span>{S.high}</span></div>
        </div>

        {/* Live training-load preview (duration × sRPE = load AU) */}
        <div className={`sll-loadchip${loadAu > 0 ? ' is-live' : ''}`} aria-live="polite">
          <span className="sll-loadlabel">{S.load}</span>
          <span className="sll-loadval">{loadAu > 0 ? loadAu : '—'} <em>{S.au}</em></span>
        </div>

        {errorMsg ? <p className="sll-error" role="alert">{errorMsg}</p> : null}

        <button
          type="button"
          className={`sll-save${done ? ' sll-save--done' : ''}`}
          onClick={handleSave}
          disabled={locked || !durationValid}
          aria-busy={busy}
        >
          {done ? <span className="sll-check" aria-hidden="true">✓</span> : null}
          {saveLabel}
        </button>
      </section>
    </div>
  );
}
