// src/components/vault/CoachAudioButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PLAY COACH AUDIO — a sleek in-ear voice transport injected into the active
// movement on the Program tab. Fires the universal voice coach (bbf-biokinetic-
// briefing · context='program') with the exercise details and streams the
// ElevenLabs cue natively with simple Play/Pause states. Trilingual.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { fetchCoachAudio } from '../../lib/forecastApi.js';
import './coachAudio.css';

const STR = {
  en: { play: 'Play Coach Audio', cueing: 'Cueing Coach…', pause: 'Pause', replay: 'Replay Cue', err: 'Coach audio unavailable.' },
  es: { play: 'Reproducir Coach', cueing: 'Preparando Coach…', pause: 'Pausar', replay: 'Repetir Indicación', err: 'Audio del coach no disponible.' },
  pt: { play: 'Reproduzir Coach', cueing: 'Preparando Coach…', pause: 'Pausar', replay: 'Repetir Comando', err: 'Áudio do coach indisponível.' },
};

export default function CoachAudioButton({ exerciseName, targetReps, targetSets, formCues, equipment }) {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const audioRef = useRef(null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function onClick() {
    if (busy) return;
    const el = audioRef.current;
    if (url && el) { if (playing) el.pause(); else el.play().catch(() => setErr(true)); return; }
    setBusy(true);
    setErr(false);
    try {
      const u = await fetchCoachAudio({ exerciseName, targetReps, targetSets, formCues, equipment, locale: lang });
      setUrl(u);
      requestAnimationFrame(() => { audioRef.current?.play().catch(() => setErr(true)); });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  const label = busy ? tr.cueing : url ? (playing ? tr.pause : tr.replay) : tr.play;

  return (
    <div className="ca">
      <button
        type="button"
        className={`ca-btn${playing ? ' is-playing' : ''}`}
        onClick={onClick}
        disabled={busy}
        data-testid="program-coach-audio"
        aria-label={label}
      >
        <span className="ca-ic" aria-hidden="true">{busy ? '◌' : playing ? '❚❚' : '🎙'}</span>
        <span className="ca-label">{label}</span>
        <span className={`ca-wave${playing ? ' is-live' : ''}`} aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => <span key={i} className="ca-bar" style={{ animationDelay: `${i * 100}ms` }} />)}
        </span>
      </button>
      {err ? <span className="ca-err" role="status">{tr.err}</span> : null}
      <audio
        ref={audioRef}
        src={url || undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { if (url) setErr(true); }}
        preload="none"
      />
    </div>
  );
}
