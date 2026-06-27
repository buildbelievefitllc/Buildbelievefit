// src/components/vault/CoachVoiceNote.jsx
// ─────────────────────────────────────────────────────────────────────────────
// FRONT 4 → MARGIN GUARD — "Breaking the Loop" educational audio layer · Coach's
// Voice note. A reusable, lazy inline player for PRE-BAKED coach clips synthesized
// ONCE in Coach Akeem's cloned voice (ElevenLabs multilingual_v2). This component
// is a pure static <audio> transport: NO API, NO entitlement gate, NO metering,
// NO fallback to the live backend. It is how we protect ElevenLabs margins —
// standardized, unchanging cues never ping the backend; they play from a static
// file.
//
// TWO clip families (same transport):
//   1. module  — the 3 original FRONT-4 essays (primer / flush / fuel), repo-static
//                at /audio/coach-edu/<module>.<locale>.mp3.
//   2. slug    — the STATIC EXERCISE LIBRARY (program form cues + prehab drills).
//                Served from the repo (/media/coach-static/<slug>.<locale>.mp3)
//                once scripts/sync-coach-static.mjs has mirrored the one-time bake
//                in; until then it falls back on a 404 to the public Supabase
//                bucket CDN (still 100% static — no synth, no backend ping). The
//                caller passes the resolved `slug` plus the live `title`/`topic`
//                it already renders, so this file holds no per-exercise copy.
//
// Lazy by contract: preload="none" — the MP3 is fetched only when the athlete taps
// play, so the screen never pays an upfront audio cost. The service worker
// (stale-while-revalidate on same-origin assets) caches it after the first listen.
// Trilingual chrome via useLang(); LOCKED brand tokens.
//
// Props:
//   • module:  'primer' | 'flush' | 'fuel'   (essay clip — legacy FRONT-4 path)
//   • slug:    static-library clip id         (e.g. 'lat-pulldown', 'prehab-bird-dog-mcgill')
//   • title:   heading shown for a slug clip  (the live movement name)
//   • topic:   one-line subtitle for a slug clip
//   • eyebrow: optional override for the kicker (defaults to the localized "Coach's Voice")
//   • variant: 'default' | 'gate'             ('gate' = stronger framing)

import { useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { COACH_STATIC_REPO_BASE, COACH_STATIC_BUCKET_BASE } from './coachStaticManifest.js';
import './coachVoiceNote.css';

// Essay clips (legacy FRONT-4). Title/topic are baked in here because the host
// screens render them as fixed section headers.
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

export default function CoachVoiceNote({ module, slug, title, topic, eyebrow, variant = 'default' }) {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const lc = lang === 'es' || lang === 'pt' ? lang : 'en';
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  // The clip key (clip+locale) whose repo path 404'd → play it from the bucket CDN
  // instead. Held as STATE (not a ref) and compared to the live key, so a new clip
  // or locale automatically retries the repo path first — no reset effect needed.
  const [failedKey, setFailedKey] = useState(null);

  // Resolve clip family + source. `slug` (static library) takes precedence; else
  // the legacy `module` essay clip. Title/topic come from props in slug mode (the
  // caller already has the live movement name) and from STR in module mode.
  const clipId = slug || module || '';
  const clipKey = `${clipId}.${lc}`;
  let base = null;
  let head = null;
  if (slug) {
    base = failedKey === clipKey ? COACH_STATIC_BUCKET_BASE : COACH_STATIC_REPO_BASE;
    head = { title: title || '', topic: topic || '' };
  } else if (module) {
    const m = tr.modules[module] || STR.en.modules[module];
    if (m) { base = '/audio/coach-edu'; head = m; }
  }
  const src = (base && clipId) ? `${base}/${clipId}.${lc}.mp3` : null;

  if (!src || !head) return null;

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
  function onError() {
    // Repo path missing (clips not yet mirrored into the repo) → fall back ONCE to
    // the public bucket CDN so the static clip still plays. Slug clips only. The
    // setState lives in this event handler (never in an effect) per house lint; the
    // src swaps on re-render and rAF resumes the playback the athlete asked for.
    if (slug && failedKey !== clipKey) {
      setFailedKey(clipKey);
      requestAnimationFrame(() => { audioRef.current?.play().catch(() => {}); });
    }
  }

  const label = playing ? tr.playing : pct > 0 ? tr.replay : tr.listen;
  const testId = slug ? `coach-voice-slug-${slug}` : `coach-voice-${module}`;

  return (
    <div
      className={`cvn cvn--${variant}`}
      data-testid={testId}
      data-playing={playing ? '1' : '0'}
    >
      <button type="button" className="cvn-btn" onClick={toggle} aria-label={`${head.title} — ${label}`}>
        <span className="cvn-ic" aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>

      <div className="cvn-body">
        <div className="cvn-eyebrow">
          <span className="cvn-mic" aria-hidden="true">🎙</span>{eyebrow || tr.eyebrow}
        </div>
        <div className="cvn-title">{head.title}</div>
        {head.topic ? <div className="cvn-topic">{head.topic}</div> : null}
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
        onError={onError}
      />
    </div>
  );
}
