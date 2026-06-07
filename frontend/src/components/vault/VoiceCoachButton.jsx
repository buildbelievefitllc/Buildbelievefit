// src/components/vault/VoiceCoachButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// AI Voice Coach — the Program tab's audio-coaching trigger (RESTORED to the React
// engine; the Live Vision camera path stays deprecated). A sleek, brutalist mic
// button that speaks the session briefing.
//
// VOICE (fallback chain): premium ElevenLabs "Julius" (bbf-tts-eleven) is tried
// first; on ANY failure — network, config, or the ElevenLabs 401 billing block —
// it falls back to the device's built-in "stock" voice via window.speechSynthesis
// (free, no key, no billing — the mechanism the legacy app used). When ElevenLabs
// billing is restored, Julius returns automatically with no code change.
//
// State machine: idle → loading → playing → idle; errors flash briefly then fall
// back to idle. Playback is initiated from the click (a user gesture) and the
// stock voice is warmed up synchronously so iOS/Safari permit the later fallback.
// A monotonic token guards stale async callbacks; every backend is fully stopped
// on toggle / unmount (blob URLs revoked, utterances cancelled) — no leaks.

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestCoachVoice, decodeAudio, COACH_FEATURE } from '../../lib/voiceCoachApi.js';
import { speakWithBrowser, browserSpeechSupported, warmUpSpeech } from '../../lib/speechFallback.js';

// Classic line-art mic (Feather "mic"); inherits currentColor so the brand
// treatment lives entirely in CSS. aria-hidden — the button carries the label.
function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

const STATUS_RESET_MS = 3500;

export default function VoiceCoachButton({ feature = COACH_FEATURE, text, lang = 'en', idleLabel = 'Voice Coach' }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'playing' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const playbackRef = useRef(null);   // { stop } for the ACTIVE backend (audio | speech)
  const abortRef = useRef(null);      // AbortController for the ElevenLabs fetch
  const resetTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const tokenRef = useRef(0);         // bumped on every start/stop; guards stale callbacks

  const hasText = Boolean(String(text ?? '').trim());

  // Stop whatever is playing and invalidate any pending async callbacks.
  const stopPlayback = useCallback(() => {
    tokenRef.current += 1;
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (playbackRef.current) { try { playbackRef.current.stop(); } catch { /* noop */ } playbackRef.current = null; }
  }, []);

  // Unmount: stop playback, clear the reset timer.
  useEffect(() => () => {
    mountedRef.current = false;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    stopPlayback();
  }, [stopPlayback]);

  const flashError = useCallback((msg) => {
    if (!mountedRef.current) return;
    setStatus('error');
    setErrorMsg(msg || 'Voice coach unavailable.');
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      if (mountedRef.current) { setStatus('idle'); setErrorMsg(''); }
    }, STATUS_RESET_MS);
  }, []);

  // Fallback path — the device's built-in stock voice. Returns true if it started.
  const playStockVoice = useCallback(async (token) => {
    if (!browserSpeechSupported()) return false;
    try {
      const ctrl = await speakWithBrowser({
        text,
        lang,
        onEnd: () => {
          if (token !== tokenRef.current) return;
          playbackRef.current = null;
          if (mountedRef.current) setStatus('idle');
        },
        onError: () => {
          if (token !== tokenRef.current) return;
          playbackRef.current = null;
          flashError('Voice unavailable.');
        },
      });
      if (!mountedRef.current || token !== tokenRef.current) { ctrl.stop(); return true; }
      playbackRef.current = ctrl;
      setStatus('playing');
      return true;
    } catch {
      return false;
    }
  }, [text, lang, flashError]);

  const handleClick = useCallback(async () => {
    if (status === 'playing') { stopPlayback(); setStatus('idle'); return; } // toggle off
    if (status === 'loading') return;                                        // ignore mid-flight
    if (!hasText) return;

    // Unlock the stock voice within THIS gesture so the fallback can speak after
    // the (async) ElevenLabs attempt — required by iOS, harmless elsewhere.
    warmUpSpeech();

    stopPlayback();
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setErrorMsg('');
    setStatus('loading');

    const token = tokenRef.current; // unique to this run (stopPlayback just bumped it)
    const controller = new AbortController();
    abortRef.current = controller;

    // 1 — Premium path: ElevenLabs "Julius".
    try {
      const { audioBase64, mime } = await requestCoachVoice({ feature, text, signal: controller.signal });
      if (!mountedRef.current || token !== tokenRef.current) return; // superseded / stopped

      const { url, revoke } = decodeAudio(audioBase64, mime);
      const audio = new Audio(url);
      const stop = () => {
        audio.onended = null; audio.onerror = null;
        try { audio.pause(); } catch { /* noop */ }
        audio.src = ''; revoke();
      };
      audio.onended = () => { if (token !== tokenRef.current) return; stop(); playbackRef.current = null; if (mountedRef.current) setStatus('idle'); };
      audio.onerror = () => { if (token !== tokenRef.current) return; stop(); playbackRef.current = null; flashError('Audio playback failed.'); };

      await audio.play();
      if (!mountedRef.current || token !== tokenRef.current) { stop(); return; }
      playbackRef.current = { stop };
      setStatus('playing');
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // ElevenLabs unavailable (401 billing / network / config) → fall through to stock voice.
    }

    // 2 — Fallback: device stock voice (free, no billing).
    if (!mountedRef.current || token !== tokenRef.current) return;
    const spoke = await playStockVoice(token);
    if (!spoke && mountedRef.current && token === tokenRef.current) {
      flashError('No voice available on this device.');
    }
  }, [status, hasText, feature, text, stopPlayback, flashError, playStockVoice]);

  const loading = status === 'loading';
  const playing = status === 'playing';
  const errored = status === 'error';

  const label = errored ? errorMsg : loading ? 'Synthesizing…' : playing ? 'Stop' : idleLabel;

  const cls = ['bbf-voice'];
  if (loading) cls.push('is-loading');
  if (playing) cls.push('is-playing');
  if (errored) cls.push('is-error');

  return (
    <button
      type="button"
      className={cls.join(' ')}
      onClick={handleClick}
      disabled={!hasText && !playing}
      aria-busy={loading}
      title={hasText ? 'AI Voice Coach — audio session briefing' : 'No briefing available yet'}
      aria-label={playing ? 'Stop voice coach' : 'Play AI voice coach briefing'}
    >
      <span className="bbf-voice-icon" aria-hidden="true">
        {loading ? (
          <span className="bbf-voice-dot" />
        ) : playing ? (
          <span className="bbf-voice-eq"><span /><span /><span /><span /></span>
        ) : (
          <MicIcon />
        )}
      </span>
      <span className="bbf-voice-label" aria-live="polite">{label}</span>
    </button>
  );
}
