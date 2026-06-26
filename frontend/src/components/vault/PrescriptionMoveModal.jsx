// src/components/vault/PrescriptionMoveModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Pop-up demo player for ONE prescribed recovery movement. Opens over the Vault
// (backdrop / ✕ / Esc all close it — the athlete never leaves the page) and shows:
//   • an in-app YouTube mini-player, OR a clean "demo coming soon" chip until the
//     clinical-video manifest is filled (never a broken embed);
//   • the recovery dosage (holds/reps/minutes), inferred per movement;
//   • the trilingual ElevenLabs coach button — Coach Akeem for ALL locales (EN/ES/PT) —
//     voicing a short cue for THIS movement, with a device-voice fallback.
// Brand-locked (§2), trilingual EN/ES/PT (§1).

import { useEffect } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { resolveClinicalVideo } from '../../data/clinicalExerciseVideos.js';
import { resolveDosage, coachCueText } from '../../data/prescriptionDosage.js';
import { fetchSectionCoachAudio } from '../../lib/forecastApi.js';
import CoachAudioButton from './CoachAudioButton.jsx';
import './prescriptionMoveModal.css';

const STR = {
  en: { close: 'Close', dose: 'Target', soon: 'Demo coming soon', soonSub: 'Your coach is sourcing the form video for this movement.' },
  es: { close: 'Cerrar', dose: 'Objetivo', soon: 'Demostración próximamente', soonSub: 'Tu coach está consiguiendo el video de técnica para este movimiento.' },
  pt: { close: 'Fechar', dose: 'Alvo', soon: 'Demonstração em breve', soonSub: 'Seu coach está providenciando o vídeo de técnica deste movimento.' },
};

const ytEmbed = (id) => `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

export default function PrescriptionMoveModal({ ex, onClose }) {
  const { lang } = useLang();
  const S = STR[lang] || STR.en;

  // Esc closes; lock background scroll while the pop-up is open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!ex) return null;
  const videoId = resolveClinicalVideo(ex.id, lang);
  const dose = resolveDosage(ex, lang);
  const cueText = coachCueText(ex, lang);

  return (
    <div className="rxpm-backdrop" role="dialog" aria-modal="true" aria-label={ex.name} onClick={onClose} data-testid="rxpm">
      <div className="rxpm" onClick={(e) => e.stopPropagation()}>
        <header className="rxpm-head">
          <span className="rxpm-title">{ex.name}</span>
          <button type="button" className="rxpm-x" onClick={onClose} aria-label={S.close} data-testid="rxpm-close">✕</button>
        </header>

        <div className="rxpm-video">
          {videoId ? (
            <iframe
              key={videoId}
              className="rxpm-frame"
              src={ytEmbed(videoId)}
              title={ex.name}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <div className="rxpm-soon" data-testid="rxpm-soon">
              <span className="rxpm-soon-ic" aria-hidden="true">🎬</span>
              <span className="rxpm-soon-t">{S.soon}</span>
              <span className="rxpm-soon-s">{S.soonSub}</span>
            </div>
          )}
        </div>

        <div className="rxpm-dose">
          <span className="rxpm-dose-k">{S.dose}</span>
          <strong className="rxpm-dose-v">{dose}</strong>
        </div>

        <div className="rxpm-coach">
          <CoachAudioButton
            audioRequest={() => fetchSectionCoachAudio({ context: 'recovery', cueRef: `rx:${ex.id}:${lang}`, cueText, locale: lang })}
            fallbackText={cueText}
          />
        </div>
      </div>
    </div>
  );
}
