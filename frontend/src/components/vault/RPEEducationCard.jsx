// src/components/vault/RPEEducationCard.jsx
// ─────────────────────────────────────────────────────────────────
// RPE (Rate of Perceived Exertion) education card · collapsible,
// text-first with audio explanation. Mount at top of program page.

import { useRef, useState } from 'react';
import { rpeExplainUrl } from '../../lib/staticVoice.js';
import { speakWithBrowser, warmUpSpeech, browserSpeechSupported } from '../../lib/speechFallback.js';

const RPE_TEXT = {
  en: {
    title: '❓ WHAT IS RPE?',
    subtitle: 'RPE = Rate of Perceived Exertion',
    desc: 'How hard a set felt on a 1–10 scale (your honest effort)',
    whyTitle: 'Why it matters:',
    whyItems: [
      'Tracks your effort, not just the weight on the bar',
      'Helps us adjust your program based on recovery',
      'Same weight, different RPE = different stimulus',
    ],
    scaleTitle: 'The Scale:',
    scaleItems: [
      { range: '1–3', desc: 'Easy (could do 10+ more reps)' },
      { range: '4–6', desc: 'Moderate (could do 5–7 more reps)' },
      { range: '7–8', desc: 'Hard (1–2 reps left in the tank)' },
      { range: '9–10', desc: 'Max effort (nothing left in tank)' },
    ],
    listenBtn: '🎙️ LISTEN TO EXPLANATION',
    listenLoading: 'Loading...',
  },
  es: {
    title: '❓ ¿QUÉ ES RPE?',
    subtitle: 'RPE = Tasa de Esfuerzo Percibido',
    desc: 'Qué tan difícil se sintió la serie en una escala de 1–10 (tu esfuerzo honesto)',
    whyTitle: 'Por qué importa:',
    whyItems: [
      'Registra tu esfuerzo, no solo el peso en la barra',
      'Nos ayuda a ajustar tu programa según tu recuperación',
      'Mismo peso, diferente RPE = diferente estímulo',
    ],
    scaleTitle: 'La Escala:',
    scaleItems: [
      { range: '1–3', desc: 'Fácil (podrías hacer 10+ reps más)' },
      { range: '4–6', desc: 'Moderado (podrías hacer 5–7 reps más)' },
      { range: '7–8', desc: 'Difícil (1–2 reps restantes)' },
      { range: '9–10', desc: 'Máximo esfuerzo (nada restante)' },
    ],
    listenBtn: '🎙️ ESCUCHAR EXPLICACIÓN',
    listenLoading: 'Cargando...',
  },
  pt: {
    title: '❓ O QUE É RPE?',
    subtitle: 'RPE = Taxa de Esforço Percebido',
    desc: 'O quão difícil a série foi em uma escala de 1–10 (seu esforço honesto)',
    whyTitle: 'Por que importa:',
    whyItems: [
      'Rastreia seu esforço, não apenas o peso na barra',
      'Nos ajuda a ajustar seu programa com base na recuperação',
      'Mesmo peso, RPE diferente = estímulo diferente',
    ],
    scaleTitle: 'A Escala:',
    scaleItems: [
      { range: '1–3', desc: 'Fácil (você conseguiria fazer 10+ reps mais)' },
      { range: '4–6', desc: 'Moderado (você conseguiria fazer 5–7 reps mais)' },
      { range: '7–8', desc: 'Difícil (1–2 reps restantes)' },
      { range: '9–10', desc: 'Esforço máximo (nada restante)' },
    ],
    listenBtn: '🎙️ OUVIR EXPLICAÇÃO',
    listenLoading: 'Carregando...',
  },
};

export default function RPEEducationCard({ preferred_locale = 'en' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [audio, setAudio] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioRef = useRef(null);

  const lang = ['es', 'pt'].includes(preferred_locale) ? preferred_locale : 'en';
  const tr = RPE_TEXT[lang];

  // STATIC-BUCKET path (no live ElevenLabs): play the pre-rendered RPE clip from
  // the manifest. On a manifest miss, degrade to the device-native voice reading a
  // composed explanation (speechFallback) so the surface always works.
  const handleListenClick = async () => {
    warmUpSpeech(); // unlock speechSynthesis inside the click gesture (iOS), cheap no-op otherwise
    setLoadingAudio(true);
    try {
      const url = rpeExplainUrl(lang);
      if (url) {
        setAudio({ audio_url: url, is_playing: false });
        setTimeout(() => { if (audioRef.current) audioRef.current.play(); }, 100);
      } else if (browserSpeechSupported()) {
        const cue = `${tr.subtitle}. ${tr.desc}. ${tr.whyTitle} ${tr.whyItems.join('. ')}.`;
        await speakWithBrowser({ text: cue, lang });
      }
    } catch (err) {
      console.error('RPE audio error:', err);
    }
    setLoadingAudio(false);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <>
      <div className="rpe-card">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rpe-header"
          aria-expanded={isExpanded}
        >
          <span className="rpe-title">{tr.title}</span>
          <span className="rpe-toggle">{isExpanded ? '▲' : '▼'}</span>
        </button>

        {isExpanded && (
          <div className="rpe-content">
            <p className="rpe-subtitle">{tr.subtitle}</p>
            <p className="rpe-desc">{tr.desc}</p>

            <div className="rpe-why">
              <h4>{tr.whyTitle}</h4>
              <ul>
                {tr.whyItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rpe-scale">
              <h4>{tr.scaleTitle}</h4>
              {tr.scaleItems.map((item, i) => (
                <p key={i}>
                  <strong>{item.range}:</strong> {item.desc}
                </p>
              ))}
            </div>

            <div className="rpe-separator">───────────────────────────────────</div>

            <div className="rpe-actions">
              <button
                onClick={handleListenClick}
                disabled={loadingAudio}
                className="rpe-btn-listen"
              >
                {loadingAudio ? tr.listenLoading : tr.listenBtn}
              </button>
            </div>

            {audio && (
              <div className="rpe-audio-player">
                <audio
                  ref={audioRef}
                  controls
                  src={audio.audio_url}
                />
                {Number.isFinite(audio.duration_seconds) ? (
                  <p className="rpe-audio-duration">
                    {formatDuration(audio.duration_seconds)}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
