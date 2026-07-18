// src/components/media/LiveCaptionOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// LIVE CAPTION ENGINE — browser-native live captions over a <video> canvas,
// driven by the Web Speech API (window.SpeechRecognition / webkitSpeechRecognition)
// and synchronized to the player's lifecycle.
//
// ⚠️ HONEST SCOPE — READ BEFORE RELYING ON THIS:
//   SpeechRecognition transcribes the DEVICE MICROPHONE, not the <video>
//   element's decoded audio track. No browser API can feed a media element's
//   audio into SpeechRecognition. In practice this captions whatever the mic
//   hears — the video played ALOUD in the room, or a coach narrating live —
//   which is genuinely useful for live/accessibility narration, but it does NOT
//   read an embedded audio track and is not a substitute for a real transcript
//   (a <track> VTT sidecar, or a server STT pass on the audio file). It needs
//   mic permission and quietly no-ops where the API is absent (Firefox, most
//   in-app webviews) or permission is denied.
//
// Wired to the player LIFECYCLE exactly as specified:
//   video 'play'            → reset the caption buffer + recognizer.start()
//   video 'pause' / 'ended' → recognizer.stop()
// Engine config: continuous = true, interimResults = true, lang (default en-US).
// continuous recognition still ends on silence/network in Chrome, so onend
// self-restarts while playback is active (the "run for the whole video" intent).
//
// Brand-locked (§2): gold-on-matte-black lower-third band; the CAPTIONS toggle
// is the master switch (attaches the engine only when ON). Fully self-cleaning
// on unmount. Drop inside a position:relative video container.
//
// @param {{ videoRef: React.RefObject<HTMLVideoElement>, lang?: string,
//           defaultOn?: boolean, className?: string }} props

import { useEffect, useRef, useState } from 'react';
import './liveCaption.css';

const SR_CTOR =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

// Keep the visible transcript to a scrolling tail so it never grows unbounded.
const TAIL_CHARS = 180;
function trimTail(s) {
  const t = s.replace(/\s+/g, ' ');
  if (t.length <= TAIL_CHARS) return t;
  const cut = t.slice(t.length - TAIL_CHARS);
  const sp = cut.indexOf(' ');
  return (sp > 0 ? cut.slice(sp + 1) : cut).trimStart();
}

const STR = {
  en: { on: '💬 Captions On', off: '💬 Captions Off', unsupported: 'Live captions unavailable on this browser.', denied: 'Mic access denied — captions need microphone permission.', listening: 'Listening…' },
  es: { on: '💬 Subtítulos On', off: '💬 Subtítulos Off', unsupported: 'Subtítulos en vivo no disponibles en este navegador.', denied: 'Micrófono denegado — los subtítulos necesitan permiso de micrófono.', listening: 'Escuchando…' },
  pt: { on: '💬 Legendas On', off: '💬 Legendas Off', unsupported: 'Legendas ao vivo indisponíveis neste navegador.', denied: 'Microfone negado — as legendas precisam de permissão do microfone.', listening: 'Ouvindo…' },
};

export default function LiveCaptionOverlay({ videoRef, lang = 'en-US', defaultOn = false, uiLang = 'en', className = '' }) {
  const supported = !!SR_CTOR;
  const [enabled, setEnabled] = useState(!!defaultOn && supported);
  const [denied, setDenied] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');

  // `want` tracks whether recognition SHOULD be running (video playing + on),
  // so onend can transparently restart the continuous stream mid-playback.
  const wantRef = useRef(false);
  const t = STR[uiLang] || STR.en;

  useEffect(() => {
    if (!enabled || !supported) return undefined;
    const video = videoRef?.current;
    if (!video) return undefined;

    const rec = new SR_CTOR();
    rec.continuous = true;       // hold the capture stream for the whole video
    rec.interimResults = true;   // print words the instant they drop (zero-latency)
    rec.lang = lang;             // target the English audio (default en-US)

    rec.onresult = (e) => {
      let interim = '';
      let committed = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const seg = e.results[i];
        if (seg.isFinal) committed += seg[0].transcript;
        else interim += seg[0].transcript;
      }
      if (committed) setFinalText((prev) => trimTail(`${prev} ${committed}`));
      setInterimText(interim);
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        wantRef.current = false;
        setDenied(true);
        setEnabled(false); // flip the master switch off — permission is a hard stop
      }
      // 'no-speech' / 'aborted' / 'network' fall through; onend handles restart.
    };
    // Continuous recognition still fires onend (silence/network). Restart while
    // playback is active so captions persist for the full duration.
    rec.onend = () => {
      if (wantRef.current) { try { rec.start(); } catch { /* already starting */ } }
    };

    const start = () => {
      wantRef.current = true;
      setFinalText('');            // reset the caption buffer on (re)play
      setInterimText('');
      try { rec.start(); } catch { /* already running */ }
    };
    const stop = () => {
      wantRef.current = false;
      setInterimText('');
      try { rec.stop(); } catch { /* already stopped */ }
    };

    const onPlay = () => start();
    const onPause = () => stop();
    const onEnded = () => stop();

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    // If the video is already mid-play when captions are switched on, begin now.
    if (!video.paused && !video.ended) start();

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      wantRef.current = false;
      rec.onend = null;   // prevent restart-on-teardown
      rec.onresult = null;
      rec.onerror = null;
      try { rec.stop(); } catch { /* noop */ }
    };
  }, [enabled, supported, videoRef, lang]);

  const toggle = () => {
    if (!supported) return;
    setDenied(false);
    setEnabled((on) => !on);
  };

  return (
    <>
      {/* Master toggle — drop into the player's control tray. */}
      <button
        type="button"
        className={`lco-toggle${enabled ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
        onClick={toggle}
        disabled={!supported}
        aria-pressed={enabled}
        title={supported ? undefined : t.unsupported}
        data-testid="live-caption-toggle"
      >
        {enabled ? t.on : t.off}
      </button>

      {/* Lower-third caption band — only mounted while captions are ON. */}
      {enabled && supported ? (
        <div className="lco-band" role="status" aria-live="polite" data-testid="live-caption-band">
          {denied ? (
            <span className="lco-denied">{t.denied}</span>
          ) : (finalText || interimText) ? (
            <p className="lco-line">
              {finalText ? <span className="lco-final">{finalText}</span> : null}
              {interimText ? <span className="lco-interim"> {interimText}</span> : null}
            </p>
          ) : (
            <span className="lco-idle">{t.listening}</span>
          )}
        </div>
      ) : null}
    </>
  );
}
