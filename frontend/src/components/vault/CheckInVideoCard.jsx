// src/components/vault/CheckInVideoCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Check-In → Video Prescription card. Mounted after user submits sleep + stress.
// Calls bbf-agentic-cns-video-prescription edge function.
// Trilingual (EN/ES/PT), brand-locked UI, responsive iframe embed.

import { useState, useEffect } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../../lib/supabaseClient.js';
import './cnsVideoCard.css';

const STR = {
  en: {
    title: '🎯 Recommended for You',
    subtitle: (state) => {
      const stateLabels = {
        DECOMPRESS: 'Low sleep + High stress',
        BALANCED: 'Balanced recovery',
        ENERGIZED: 'Great recovery + Low stress',
        GROUNDED: 'Good sleep + Low stress',
      };
      return `Your check-in shows: ${stateLabels[state] || state}`;
    },
    cta: 'Play Video',
    duration: (m) => `${m} minutes`,
    loading: 'Loading...',
    error: 'Failed to load video. Try again.',
  },
  es: {
    title: '🎯 Recomendado para Ti',
    subtitle: (state) => {
      const stateLabels = {
        DECOMPRESS: 'Poco sueño + Estrés alto',
        BALANCED: 'Recuperación equilibrada',
        ENERGIZED: 'Excelente recuperación + Bajo estrés',
        GROUNDED: 'Buen sueño + Bajo estrés',
      };
      return `Tu check-in muestra: ${stateLabels[state] || state}`;
    },
    cta: 'Reproducir Video',
    duration: (m) => `${m} minutos`,
    loading: 'Cargando...',
    error: 'No se pudo cargar el video. Intenta de nuevo.',
  },
  pt: {
    title: '🎯 Recomendado para Você',
    subtitle: (state) => {
      const stateLabels = {
        DECOMPRESS: 'Pouco sono + Estresse alto',
        BALANCED: 'Recuperação equilibrada',
        ENERGIZED: 'Excelente recuperação + Baixo estresse',
        GROUNDED: 'Bom sono + Baixo estresse',
      };
      return `Seu check-in mostra: ${stateLabels[state] || state}`;
    },
    cta: 'Reproduzir Vídeo',
    duration: (m) => `${m} minutos`,
    loading: 'Carregando...',
    error: 'Falha ao carregar o vídeo. Tente novamente.',
  },
};

export default function CheckInVideoCard({ sleepHours, stressLevel, onVideoLoaded }) {
  const { lang } = useLang();
  const { user } = useAuth();
  const S = STR[lang] || STR.en;

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);

  // Fetch video on mount
  useEffect(() => {
    if (!user?.id || sleepHours == null || stressLevel == null) {
      setError(S.error);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const response = await fetch(`${FUNCTIONS_BASE}/bbf-agentic-cns-video-prescription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            user_id: user.id,
            sleep_hours: sleepHours,
            stress_level: stressLevel,
            language: lang,
            source: 'checkin',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch video');
        }

        const data = await response.json();
        if (data.ok) {
          setVideo(data);
          onVideoLoaded?.(data);
        } else {
          setError(S.error);
        }
      } catch (err) {
        console.error('[CheckInVideoCard]', err);
        setError(S.error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, sleepHours, stressLevel, lang]);

  if (loading) {
    return (
      <div className="cns-video-card cns-video-card--loading">
        <p>{S.loading}</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="cns-video-card cns-video-card--error">
        <p>{error || S.error}</p>
      </div>
    );
  }

  return (
    <div className="cns-video-card" data-testid="checkin-video-card">
      <div className="cns-video-head">
        <h3 className="cns-video-title">{S.title}</h3>
        <p className="cns-video-subtitle">{S.subtitle(video.cns_state)}</p>
      </div>

      {!playing ? (
        <div className="cns-video-cover">
          <button
            type="button"
            className="cns-video-play-btn"
            onClick={() => setPlaying(true)}
            aria-label={S.cta}
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
        <p className="cns-video-duration">{S.duration(video.duration_minutes)}</p>
      </div>
    </div>
  );
}
