// src/components/vault/MotivationSliderCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Motivation Slider card — fallback for users who skip check-in.
// Manual "How are you feeling?" slider (1–10) → CNS state → video prescription.
// Mounted in Champions Mindset as a separate card.
// Trilingual (EN/ES/PT), brand-locked UI.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../../lib/supabaseClient.js';
import './cnsVideoCard.css';

const STR = {
  en: {
    title: '💪 How Are You Feeling?',
    sub: 'Select your current mood to get a personalized meditation',
    sliderMin: 'Need Calm',
    sliderMid: 'Balanced',
    sliderMax: 'Energized',
    cta: 'Play Video for This Mood',
    ctaLoading: 'Loading...',
    loading: 'Loading...',
    error: 'Failed to load video. Try again.',
    mood: {
      calm: 'Need Calm',
      balanced: 'Balanced',
      energized: 'Energized',
    },
  },
  es: {
    title: '💪 ¿Cómo Te Sientes?',
    sub: 'Selecciona tu estado de ánimo actual para obtener una meditación personalizada',
    sliderMin: 'Necesito Calma',
    sliderMid: 'Equilibrado',
    sliderMax: 'Energizado',
    cta: 'Reproducir Vídeo para Este Estado',
    ctaLoading: 'Cargando...',
    loading: 'Cargando...',
    error: 'No se pudo cargar el video. Intenta de nuevo.',
    mood: {
      calm: 'Necesito Calma',
      balanced: 'Equilibrado',
      energized: 'Energizado',
    },
  },
  pt: {
    title: '💪 Como Você Se Sente?',
    sub: 'Selecione seu estado de humor atual para obter uma meditação personalizada',
    sliderMin: 'Preciso de Calma',
    sliderMid: 'Equilibrado',
    sliderMax: 'Energizado',
    cta: 'Reproduzir Vídeo para Este Mood',
    ctaLoading: 'Carregando...',
    loading: 'Carregando...',
    error: 'Falha ao carregar o vídeo. Tente novamente.',
    mood: {
      calm: 'Preciso de Calma',
      balanced: 'Equilibrado',
      energized: 'Energizado',
    },
  },
};

function sliderToCNSState(value) {
  if (value <= 3) return 'DECOMPRESS';
  if (value <= 6) return 'BALANCED';
  return 'ENERGIZED';
}

function getMoodLabel(value, lang) {
  const labels = STR[lang]?.mood || STR.en.mood;
  if (value <= 3) return labels.calm;
  if (value <= 6) return labels.balanced;
  return labels.energized;
}

export default function MotivationSliderCard() {
  const { lang } = useLang();
  const { user } = useAuth();
  const S = STR[lang] || STR.en;

  const [sliderValue, setSliderValue] = useState(5);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);

  const handleSliderSubmit = async () => {
    if (!user?.id) {
      setError(S.error);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cnsState = sliderToCNSState(sliderValue);
      const response = await fetch(`${FUNCTIONS_BASE}/bbf-agentic-cns-video-prescription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          user_id: user.id,
          cns_state: cnsState,
          language: lang,
          source: 'slider',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch video');
      }

      const data = await response.json();
      if (data.ok) {
        setVideo(data);
      } else {
        setError(S.error);
      }
    } catch (err) {
      console.error('[MotivationSliderCard]', err);
      setError(S.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cns-video-card cns-slider-card" data-testid="motivation-slider-card">
      <div className="cns-video-head">
        <h3 className="cns-video-title">{S.title}</h3>
        <p className="cns-video-subtitle">{S.sub}</p>
      </div>

      <div className="cns-slider-container">
        <label className="cns-slider-label">{S.sliderMin}</label>
        <div className="cns-slider-wrapper">
          <input
            type="range"
            className="cns-slider-input"
            min="1"
            max="10"
            value={sliderValue}
            onChange={(e) => setSliderValue(parseInt(e.target.value))}
            aria-label={S.title}
          />
        </div>
        <label className="cns-slider-label">{S.sliderMax}</label>
      </div>

      <p className="cns-slider-mood">{getMoodLabel(sliderValue, lang)}</p>

      <button
        type="button"
        className="cns-slider-cta"
        onClick={handleSliderSubmit}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? S.ctaLoading : S.cta}
      </button>

      {error && (
        <div className="cns-video-error">
          <p>{error}</p>
        </div>
      )}

      {video && (
        <div className="cns-slider-video-preview">
          {!playing ? (
            <div className="cns-video-cover">
              <button
                type="button"
                className="cns-video-play-btn"
                onClick={() => setPlaying(true)}
                aria-label="Play video"
              >
                ▶
              </button>
            </div>
          ) : (
            <iframe
              className="cns-video-iframe"
              src={video.video_url}
              title={video.video_title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}

          <div className="cns-video-meta">
            <p className="cns-video-video-title">{video.video_title}</p>
            <p className="cns-video-duration">{video.duration_minutes} minutes</p>
          </div>
        </div>
      )}
    </div>
  );
}
