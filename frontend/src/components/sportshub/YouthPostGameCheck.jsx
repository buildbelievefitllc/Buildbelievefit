// src/components/sportshub/YouthPostGameCheck.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 + 4 · POST-GAME CHECK — the youth post-workout friction logger that the
// Sports Hub was missing, parked at the foot of the Drills tab. Dead-simple visual
// UI ("How do you feel? Any pain today?") → one tap on Knees / Shoulders / Lower
// Back, or "I feel great". It writes to the EXACT SAME session_feedback table as
// the adults (via sessionFeedbackApi → bbf-prescription-checkin), so tomorrow's
// bbf-agentic-recovery reads the youth athlete's friction and prescribes the same
// closed loop. Identity is resolved server-side from the vault token.
//
// After the check answers, PHASE 4 forks: PRIMARY "Step 4: Cool Down" → Mindset
// (mental conditioning close-out — youth has no cardio tab, CEO order); SECONDARY
// "Fix the Pain (Prehab)" → the prescription-only Prehab tab, shown ONLY when a
// pain zone was reported.
//
// Youth UX note: the logger is binary (a zone = "this is sore"), so we send a fixed
// pain_score of 6 (clearly ≥ the engine's targeted threshold of 4) for a reported
// zone, and 1 for "I feel great"; RPE is not asked of a 10-year-old, so a neutral
// default rides along. Pain SEVERITY granularity is an adult-tier concern.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { submitSessionFeedback } from '../../lib/sessionFeedbackApi.js';
import { YouthCTA } from './youthSequenceParts.jsx';
import './youthSequence.css';

const REPORTED_PAIN = 6;   // a tapped zone = real soreness → crosses the targeted threshold (≥4)
const CLEAR_PAIN = 1;      // "I feel great" → a clean no-pain signal resets the loop to maintenance
const DEFAULT_RPE = 5;     // youth logger doesn't ask difficulty; neutral middle default

// Visual zones → canonical session_feedback.target_area. "Lower Back" maps to the
// posterior-chain zone the engine knows ('lower_body' covers the lower back).
const ZONES = [
  { key: 'knee', ic: '🦵' },
  { key: 'shoulder', ic: '💪' },
  { key: 'lower_body', ic: '🦴' },
];

const STR = {
  en: {
    kicker: 'Post-Game Check',
    prompt: 'How do you feel? Any pain today?',
    zones: { knee: 'Knees', shoulder: 'Shoulders', lower_body: 'Lower Back' },
    great: '🙌  I feel great',
    saving: 'Logging…',
    okPain: ['Locked in. Your targeted fix is ready in ', '.'],
    okGreat: 'Clean bill — nothing flagged. Cool down and finish strong. 💯',
    err: 'Couldn’t save that — tap again.',
    change: '↻ Change my answer',
    cool: 'Step 4: Cool Down ➔',
    fix: 'Fix the Pain (Prehab) ➔',
    zoneName: { knee: 'Knees', shoulder: 'Shoulders', lower_body: 'Lower Back' },
  },
  es: {
    kicker: 'Chequeo Post-Juego',
    prompt: '¿Cómo te sientes? ¿Algún dolor hoy?',
    zones: { knee: 'Rodillas', shoulder: 'Hombros', lower_body: 'Espalda Baja' },
    great: '🙌  Me siento genial',
    saving: 'Guardando…',
    okPain: ['Listo. Tu rutina específica te espera en ', '.'],
    okGreat: 'Todo limpio — nada que marcar. Enfría y termina fuerte. 💯',
    err: 'No se pudo guardar — toca otra vez.',
    change: '↻ Cambiar mi respuesta',
    cool: 'Paso 4: Enfriamiento ➔',
    fix: 'Arregla el Dolor (Prehab) ➔',
    zoneName: { knee: 'Rodillas', shoulder: 'Hombros', lower_body: 'Espalda Baja' },
  },
  pt: {
    kicker: 'Checagem Pós-Jogo',
    prompt: 'Como você está? Alguma dor hoje?',
    zones: { knee: 'Joelhos', shoulder: 'Ombros', lower_body: 'Lombar' },
    great: '🙌  Tô ótimo',
    saving: 'Salvando…',
    okPain: ['Pronto. Sua rotina específica te espera em ', '.'],
    okGreat: 'Tudo limpo — nada marcado. Desaqueça e termine forte. 💯',
    err: 'Não deu pra salvar — toque de novo.',
    change: '↻ Mudar minha resposta',
    cool: 'Passo 4: Desaquecimento ➔',
    fix: 'Resolver a Dor (Prehab) ➔',
    zoneName: { knee: 'Joelhos', shoulder: 'Ombros', lower_body: 'Lombar' },
  },
};

// `onNavigate(tabId)` swaps the hub tab; `onLogged(friction|null)` lifts the result
// to the hub so the Prehab tab + persistence track the latest reported zone.
export default function YouthPostGameCheck({ onNavigate, onLogged }) {
  const { lang } = useLang();
  const { user } = useAuth();
  const s = STR[lang] || STR.en;

  // result: null (unanswered) | { area } (pain zone) | { great: true }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function log(area, pain) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await submitSessionFeedback({ uid: user?.id, painScore: pain, rpeScore: DEFAULT_RPE, targetArea: area });
      if (area === 'full_body') {
        setResult({ great: true });
        onLogged?.(null);                 // cleared → no fix to surface
      } else {
        setResult({ area });
        onLogged?.({ area, pain });        // drives the Prehab prescription
      }
    } catch (e) {
      setError(e?.message || s.err);
    } finally {
      setBusy(false);
    }
  }

  const answered = result !== null;
  const hasPain = !!result?.area;

  return (
    <section className="ypg" data-testid="youth-postgame">
      <div className="ypg-kicker">{s.kicker}</div>
      <h3 className="ypg-prompt">{s.prompt}</h3>

      <div className="ypg-zones" role="group" aria-label={s.prompt}>
        {ZONES.map((z) => {
          const on = result?.area === z.key;
          return (
            <button
              key={z.key}
              type="button"
              className={`ypg-zone${on ? ' is-on' : ''}`}
              aria-pressed={on}
              disabled={busy || (answered && !on)}
              data-testid={`youth-zone-${z.key}`}
              onClick={() => log(z.key, REPORTED_PAIN)}
            >
              <span className="ypg-zone-ic" aria-hidden="true">{z.ic}</span>
              {s.zones[z.key]}
            </button>
          );
        })}
        <button
          type="button"
          className={`ypg-zone ypg-zone--great${result?.great ? ' is-on' : ''}`}
          aria-pressed={!!result?.great}
          disabled={busy || (answered && !result?.great)}
          data-testid="youth-zone-great"
          onClick={() => log('full_body', CLEAR_PAIN)}
        >
          {busy ? s.saving : s.great}
        </button>
      </div>

      {error ? <p className="ypg-err" role="alert">{error}</p> : null}

      {answered ? (
        <>
          <p className="ypg-msg" role="status" data-testid="youth-postgame-msg">
            {hasPain
              ? <>{s.okPain[0]}<b>{s.zoneName[result.area]}</b>{s.okPain[1]}</>
              : s.okGreat}
          </p>

          {/* PHASE 4 · the fork — Cool Down always; Fix the Pain only when sore. */}
          <div className="yseq-next" data-testid="youth-fork">
            <YouthCTA label={s.cool} onClick={() => onNavigate?.('mindset')} testid="youth-step-4" />
            {hasPain ? (
              <YouthCTA label={s.fix} onClick={() => onNavigate?.('prehab')} testid="youth-fork-prehab" variant="secondary" />
            ) : null}
          </div>

          <button type="button" className="ypg-change" onClick={() => { setResult(null); setError(''); }}>
            {s.change}
          </button>
        </>
      ) : null}
    </section>
  );
}
