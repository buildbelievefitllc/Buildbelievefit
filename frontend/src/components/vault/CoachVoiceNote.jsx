// src/components/vault/CoachVoiceNote.jsx
// ─────────────────────────────────────────────────────────────────────────────
// FRONT 4 — "Breaking the Loop" educational audio layer · Coach's Voice note.
//
// A reusable, lazy inline player for the 9 pre-baked coach-education clips
// (primer / flush / fuel × en / es / pt) living repo-static under
// /audio/coach-edu/<module>.<locale>.mp3. Synthesized once in Coach Akeem's
// cloned voice (ElevenLabs multilingual_v2) — so this component is a pure static
// <audio> transport: NO API, NO entitlement gate, NO metering, NO fallback path.
//
// Lazy by contract: preload="none" — the (~0.4–0.6 MB) MP3 is fetched only when
// the athlete taps play, so the screen never pays an upfront audio cost. The
// service worker (stale-while-revalidate on same-origin assets) caches it after
// the first listen. Trilingual chrome via useLang(); LOCKED brand tokens.
//
// Props:
//   • module:  'primer' | 'flush' | 'fuel'   (which clip)
//   • variant: 'default' | 'gate'            ('gate' = stronger framing, e.g. the
//                                              pre-cardio "flush" transition)

import { useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import './coachVoiceNote.css';

const STR = {
  en: {
    eyebrow: "Coach's Voice", listen: 'Listen', playing: 'Now Playing', replay: 'Replay',
    modules: {
      primer: { title: 'The Primer', topic: 'Why we prime the engine before you touch the floor.' },
      flush:  { title: 'The Flush',  topic: 'Why cardio after the iron is the flush — not a punishment.' },
      fuel:   { title: 'Fuel Science', topic: 'Why your macros and your TDEE decide the outcome.' },
    },
  },
  es: {
    eyebrow: 'La Voz del Coach', listen: 'Escuchar', playing: 'Reproduciendo', replay: 'Repetir',
    modules: {
      primer: { title: 'El Arranque', topic: 'Por qué preparamos el motor antes de pisar el piso.' },
      flush:  { title: 'El Drenaje',  topic: 'Por qué el cardio después del hierro es el drenaje — no un castigo.' },
      fuel:   { title: 'La Ciencia del Combustible', topic: 'Por qué tus macros y tu GEDT deciden el resultado.' },
    },
  },
  pt: {
    eyebrow: 'A Voz do Coach', listen: 'Ouvir', playing: 'Tocando agora', replay: 'Repetir',
    modules: {
      primer: { title: 'A Preparação', topic: 'Por que a gente prepara o motor antes de entrar no treino.' },
      flush:  { title: 'O Dreno',      topic: 'Por que o cardio depois do ferro é o dreno — não um castigo.' },
      fuel:   { title: 'A Ciência do Combustível', topic: 'Por que seus macros e seu GEDT decidem o resultado.' },
    },
  },
};

export default function CoachVoiceNote({ module, variant = 'default' }) {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const m = tr.modules[module] || STR.en.modules[module];
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);

  if (!m) return null;
  const lc = lang === 'es' || lang === 'pt' ? lang : 'en';
  const src = `/audio/coach-edu/${module}.${lc}.mp3`;

  // Ref reads live ONLY in the click / media event handlers (never during render)
  // — clear of react-hooks/refs. preload="none" → first play() triggers the fetch.
  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }
  function onTime() {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    setPct(Math.min(100, (el.currentTime / el.duration) * 100));
  }

  const label = playing ? tr.playing : pct > 0 ? tr.replay : tr.listen;

  return (
    <div
      className={`cvn cvn--${variant}`}
      data-testid={`coach-voice-${module}`}
      data-playing={playing ? '1' : '0'}
    >
      <button type="button" className="cvn-btn" onClick={toggle} aria-label={`${m.title} — ${label}`}>
        <span className="cvn-ic" aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>

      <div className="cvn-body">
        <div className="cvn-eyebrow">
          <span className="cvn-mic" aria-hidden="true">🎙</span>{tr.eyebrow}
        </div>
        <div className="cvn-title">{m.title}</div>
        <div className="cvn-topic">{m.topic}</div>
        <div className="cvn-track" aria-hidden="true"><span className="cvn-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <span className={`cvn-eq${playing ? ' is-live' : ''}`} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="cvn-bar" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPct(0); }}
        onTimeUpdate={onTime}
      />
    </div>
  );
}
