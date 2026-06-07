// src/components/vault/VoiceCoachButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// AI Voice Coach — the Program tab's audio-coaching trigger (RESTORED to the React
// engine; the Live Vision camera path stays deprecated). A sleek, brutalist mic
// button that synthesizes the session briefing through bbf-tts-eleven
// (virtual_coach → Julius) and plays it inline.
//
// State machine: idle → loading → playing → idle; errors flash briefly then fall
// back to idle. play() is initiated from the click (a user gesture), so it is
// never blocked by browser autoplay policy. Every object-URL is revoked on
// ended / stop / unmount — no leaked blobs, no in-flight requests after unmount.

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestCoachVoice, decodeAudio, COACH_FEATURE } from '../../lib/voiceCoachApi.js';

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

export default function VoiceCoachButton({ feature = COACH_FEATURE, text, idleLabel = 'Voice Coach' }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'playing' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const audioRef = useRef(null);
  const revokeRef = useRef(null);
  const abortRef = useRef(null);
  const resetTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const hasText = Boolean(String(text ?? '').trim());

  // Stop any live audio and free its blob URL. Safe to call repeatedly.
  const teardown = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      try { audioRef.current.pause(); } catch { /* noop */ }
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (revokeRef.current) { revokeRef.current(); revokeRef.current = null; }
  }, []);

  // Unmount: cancel in-flight synthesis, stop audio, clear the reset timer.
  useEffect(() => () => {
    mountedRef.current = false;
    if (abortRef.current) abortRef.current.abort();
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    teardown();
  }, [teardown]);

  const flashError = useCallback((msg) => {
    if (!mountedRef.current) return;
    setStatus('error');
    setErrorMsg(msg || 'Voice coach unavailable.');
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      if (mountedRef.current) { setStatus('idle'); setErrorMsg(''); }
    }, STATUS_RESET_MS);
  }, []);

  const handleClick = useCallback(async () => {
    if (status === 'playing') { teardown(); setStatus('idle'); return; } // toggle off
    if (status === 'loading') return;                                    // ignore mid-synthesis
    if (!hasText) return;

    teardown();
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setErrorMsg('');
    setStatus('loading');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { audioBase64, mime } = await requestCoachVoice({ feature, text, signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;

      const { url, revoke } = decodeAudio(audioBase64, mime);
      revokeRef.current = revoke;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { teardown(); if (mountedRef.current) setStatus('idle'); };
      audio.onerror = () => { teardown(); flashError('Audio playback failed.'); };

      await audio.play();
      if (mountedRef.current) setStatus('playing');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      teardown();
      flashError(err?.message);
    }
  }, [status, hasText, feature, text, teardown, flashError]);

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
