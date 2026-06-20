// src/components/vault/RPEEducationCard.jsx
// ─────────────────────────────────────────────────────────────────
// RPE (Rate of Perceived Exertion) education card · collapsible,
// text-first with audio + video fallback. Mount at top of program page.

import { useRef, useState } from 'react';

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
    watchBtn: '👀 WATCH THE DEMO',
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
    watchBtn: '👀 VER DEMOSTRACIÓN',
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
    watchBtn: '👀 VER DEMONSTRAÇÃO',
    listenLoading: 'Carregando...',
  },
};

const VIDEO_URLs = {
  rpe5: 'https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/public/bbf-education/rpe-controlled-movement-5.mp4',
  rpe9: 'https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/public/bbf-education/rpe-maximum-effort-9.mp4',
};

const VIDEO_LABELS = {
  en: {
    rpe5: { headline: 'Controlled Movement — RPE 5', subline: 'Smooth and controlled. You have reps left.' },
    rpe9: { headline: 'Maximum Effort — RPE 9', subline: 'After RPE 9, you\'re pushing beyond exertion.' },
  },
  es: {
    rpe5: { headline: 'Movimiento Controlado — RPE 5', subline: 'Suave y controlado. Te quedan repeticiones.' },
    rpe9: { headline: 'Máximo Esfuerzo — RPE 9', subline: 'Después de RPE 9, estás empujando más allá del esfuerzo.' },
  },
  pt: {
    rpe5: { headline: 'Movimento Controlado — RPE 5', subline: 'Suave e controlado. Você tem reps restantes.' },
    rpe9: { headline: 'Esforço Máximo — RPE 9', subline: 'Depois de RPE 9, você está empurrando além do esforço.' },
  },
};

function VideoModal({ videoUrl, headline, subline, onClose, lang }) {
  return (
    <div className="rpe-video-modal-overlay" onClick={onClose}>
      <div className="rpe-video-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="rpe-modal-close">×</button>
        <video controls width="100%" height="auto" autoPlay>
          <source src={videoUrl} type="video/mp4" />
        </video>
        <div className="rpe-video-info">
          <h4>{headline}</h4>
          <p>{subline}</p>
        </div>
      </div>
    </div>
  );
}

export default function RPEEducationCard({ preferred_locale = 'en' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [audio, setAudio] = useState(null);
  const [videoOpen, setVideoOpen] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioRef = useRef(null);

  const lang = ['es', 'pt'].includes(preferred_locale) ? preferred_locale : 'en';
  const tr = RPE_TEXT[lang];
  const vidLabels = VIDEO_LABELS[lang];

  const handleListenClick = async () => {
    setLoadingAudio(true);
    try {
      const res = await fetch('/functions/v1/bbf-agentic-rpe-voice-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });

      if (!res.ok) {
        console.error('Audio fetch failed:', res.statusText);
        setLoadingAudio(false);
        return;
      }

      const result = await res.json();
      if (result.ok) {
        setAudio({
          audio_url: result.audio_url,
          duration_seconds: result.duration_seconds,
          is_playing: false,
        });
        setTimeout(() => {
          if (audioRef.current) audioRef.current.play();
        }, 100);
      } else {
        console.error('Audio generation failed:', result.error);
      }
    } catch (err) {
      console.error('Audio fetch error:', err);
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

              <button
                onClick={() => setVideoOpen('rpe5')}
                className="rpe-btn-watch"
              >
                {tr.watchBtn}
              </button>
            </div>

            {audio && (
              <div className="rpe-audio-player">
                <audio
                  ref={audioRef}
                  controls
                  src={audio.audio_url}
                />
                <p className="rpe-audio-duration">
                  {formatDuration(audio.duration_seconds)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {videoOpen === 'rpe5' && (
        <VideoModal
          videoUrl={VIDEO_URLs.rpe5}
          headline={vidLabels.rpe5.headline}
          subline={vidLabels.rpe5.subline}
          onClose={() => setVideoOpen(null)}
          lang={lang}
        />
      )}

      {videoOpen === 'rpe9' && (
        <VideoModal
          videoUrl={VIDEO_URLs.rpe9}
          headline={vidLabels.rpe9.headline}
          subline={vidLabels.rpe9.subline}
          onClose={() => setVideoOpen(null)}
          lang={lang}
        />
      )}
    </>
  );
}
