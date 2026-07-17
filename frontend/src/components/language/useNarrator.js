// src/components/language/useNarrator.js
// ─────────────────────────────────────────────────────────────────────────────
// THE UNIFIED NARRATION ROUTER — meshes the Lab's two voice systems into one.
//
// Every 🔊 in the Language Lab calls narrate() from this hook, which reads the
// global SYSTEM NARRATION ENGINE toggle (LanguageLabContext.narrationEngine) and
// routes to the matching backend:
//
//   'natural' → NATURAL SYNTHESIZER: the premium native Web Speech player
//               (speechNarrator.speakScript — premium-OS-voice filtered).
//   'akeem'   → BBF COACH AKEEM: the pre-baked ElevenLabs clip. If a specific
//               clipKey (a language-fragments bucket key like VOC-<slug>) is
//               given, that exact native clip plays first; otherwise / on miss,
//               speakBaked's own chain runs (static hash clip → live cached
//               synth → free browser voice), so a cue always speaks.
//
// GRACEFUL FLOORS: with Coach Akeem selected but WebCodecs-free/offline, the
// speakBaked chain still degrades to the browser voice; with Natural selected on
// a browser without speechSynthesis, we fall through to the Akeem/baked path so
// the button is never dead. Both engines are warmed inside the click gesture
// (iOS autoplay unlock) before any async hop.

import { useCallback } from 'react';
import { useLanguageLab } from './LanguageLabContext.jsx';
import { speakScript, stopSpeech, ttsSupported } from '../../lib/speechNarrator.js';
import { speakBaked, warmUpAudioPlayback } from '../../lib/languageSoundboardVoice.js';
import { warmUpSpeech } from '../../lib/speechFallback.js';
import { fragmentUrl } from './useDojoPlayer.js';

export function useNarrator() {
  const { narrationEngine } = useLanguageLab();

  // Play the pre-baked native clip for `clipKey`; on any failure fall through to
  // speakBaked's full chain so Coach Akeem's voice still lands (or its browser floor).
  const playAkeem = useCallback((cue, lang, clipKey, onEnd, onError) => {
    const fallback = () => speakBaked({ text: cue, lang, onEnd, onError }).catch(() => onError?.(new Error('audio_unavailable')));
    if (!clipKey) { fallback(); return; }
    try {
      const audio = new Audio(fragmentUrl(clipKey));
      audio.onended = () => onEnd?.();
      audio.onerror = () => fallback();
      audio.play().catch(() => fallback());
    } catch { fallback(); }
  }, []);

  const narrate = useCallback(({ text, lang = 'es', clipKey = null, rate = 1, onEnd, onError } = {}) => {
    const cue = String(text ?? '').trim();
    if (!cue) return;
    // Unlock BOTH engines inside the gesture (safe no-ops if already primed).
    try { warmUpSpeech(); } catch { /* noop */ }
    try { warmUpAudioPlayback(); } catch { /* noop */ }

    if (narrationEngine === 'natural') {
      // Thread the TARGET language through — the premium voice must speak
      // es/pt natively, never read Spanish with an English voice.
      if (ttsSupported) { speakScript(cue, { onEnd, rate, lang }); return; }
      // No Web Speech on this browser → don't leave the button dead; use Akeem.
    }
    playAkeem(cue, lang, clipKey, onEnd, onError);
  }, [narrationEngine, playAkeem]);

  const stop = useCallback(() => { try { stopSpeech(); } catch { /* noop */ } }, []);

  return { engine: narrationEngine, narrate, stop };
}

export default useNarrator;
