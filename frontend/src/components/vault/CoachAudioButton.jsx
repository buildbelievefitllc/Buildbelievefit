// src/components/vault/CoachAudioButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PLAY COACH AUDIO — a sleek in-ear voice transport injected into the active
// movement on the Program tab. PRIMARY path: the universal voice coach
// (bbf-biokinetic-briefing · context='program') streamed via ElevenLabs (the
// locale-mapped voice). FAILURE-ONLY fallback: if the premium path errors (e.g.
// a billing/entitlement block or an ElevenLabs outage), it gracefully degrades to
// the device's built-in stock voice (window.speechSynthesis) reading a locally
// composed cue — never as the primary, only when ElevenLabs fails. Trilingual.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { fetchCoachAudio } from '../../lib/forecastApi.js';
import { speakWithBrowser, warmUpSpeech, browserSpeechSupported } from '../../lib/speechFallback.js';
import './coachAudio.css';

const STR = {
  en: {
    play: 'Play Coach Audio', cueing: 'Cueing Coach…', pause: 'Pause', replay: 'Replay Cue',
    stock: 'Coach · stock voice', err: 'Coach audio unavailable.',
    repsCue: (n) => `Target ${n} reps`, defaultCue: 'Brace the core and drive through every rep.',
  },
  es: {
    play: 'Reproducir Coach', cueing: 'Preparando Coach…', pause: 'Pausar', replay: 'Repetir Indicación',
    stock: 'Coach · voz estándar', err: 'Audio del coach no disponible.',
    repsCue: (n) => `Apunta a ${n} repeticiones`, defaultCue: 'Activa el core y domina cada repetición.',
  },
  pt: {
    play: 'Reproduzir Coach', cueing: 'Preparando Coach…', pause: 'Pausar', replay: 'Repetir Comando',
    stock: 'Coach · voz padrão', err: 'Áudio do coach indisponível.',
    repsCue: (n) => `Mire ${n} repetições`, defaultCue: 'Trave o core e domine cada repetição.',
  },
};

// Props:
//   • Program path (default): { exerciseName, targetReps, formCues, equipment }.
//   • Section path (Recovery/Prehab/Cardio): pass `audioRequest` (async () => objectURL,
//     e.g. fetchSectionCoachAudio) + `fallbackText` (spoken on stock-voice fallback).
export default function CoachAudioButton({ exerciseName, targetReps, formCues, equipment, audioRequest = null, fallbackText = '' }) {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const audioRef = useRef(null);
  const stockRef = useRef(null); // active stock-voice controller (failure fallback)
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [stock, setStock] = useState(false); // true while the stock fallback is speaking
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (stockRef.current) { try { stockRef.current.stop(); } catch { /* noop */ } } }, []);

  // Locally-composed cue spoken ONLY when the premium ElevenLabs path fails.
  function composeCue() {
    if (fallbackText) return String(fallbackText);
    return [exerciseName, targetReps ? tr.repsCue(targetReps) : '', (Array.isArray(formCues) && formCues[0]) || tr.defaultCue]
      .filter(Boolean).join('. ');
  }

  async function onClick() {
    if (busy) return;
    const el = audioRef.current;
    // Toggle an already-loaded ElevenLabs clip.
    if (url && el) { if (playing) el.pause(); else el.play().catch(() => setErr(true)); return; }
    // Toggle an active stock-voice fallback.
    if (stockRef.current) { try { stockRef.current.stop(); } catch { /* noop */ } stockRef.current = null; setPlaying(false); return; }

    // Unlock speechSynthesis INSIDE the click gesture (iOS) before the async hop —
    // cheap no-op when the premium path succeeds.
    warmUpSpeech();
    setBusy(true);
    setErr(false);
    setStock(false);
    try {
      // PRIMARY: ElevenLabs via bbf-biokinetic-briefing. Section callers supply
      // their own cached request; Program uses the default context='program' path.
      const u = audioRequest
        ? await audioRequest()
        : await fetchCoachAudio({ exerciseName, targetReps, formCues, equipment, locale: lang });
      setUrl(u);
      requestAnimationFrame(() => { audioRef.current?.play().catch(() => setErr(true)); });
    } catch {
      // FAILURE-ONLY: degrade to the device stock voice. Never the primary.
      const cue = composeCue();
      if (browserSpeechSupported() && cue) {
        try {
          setStock(true);
          stockRef.current = await speakWithBrowser({
            text: cue,
            lang,
            onEnd: () => { setPlaying(false); stockRef.current = null; },
            onError: () => { setErr(true); setPlaying(false); stockRef.current = null; },
          });
          setPlaying(true);
        } catch { setErr(true); setStock(false); }
      } else {
        setErr(true);
      }
    } finally {
      setBusy(false);
    }
  }

  const label = busy ? tr.cueing
    : stock && playing ? tr.stock
    : url ? (playing ? tr.pause : tr.replay)
    : tr.play;

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
