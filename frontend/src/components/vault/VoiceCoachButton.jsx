// src/components/vault/VoiceCoachButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// AI Voice Coach — the Program tab's LIVE voice-to-voice Sovereign Coach trigger.
// Replaces the prior one-shot TTS briefing with a real-time conversation on the
// Gemini 2.5 Flash native-audio bridge (/ws/phantom-eye), scope-locked server-side
// to workout/prehab (PROMPT_VIRTUAL_COACH + the BBF Immutable Laws).
//
// Session lifecycle: idle → connecting → live (hard 5:00 countdown) → complete.
// The session terminates GRACEFULLY at 0:00, on quota exhaustion (the ticket mint
// refuses to start when the monthly balance is spent), on an upstream failure, or
// on a user stop — tearing down the mic + WS + audio every time (no leaks). The
// server commits the session's token delta to the monthly ledger on its teardown.
//
// Drop-in for the existing mount (<VoiceCoachButton text={coachCue} lang={lang} />):
// the `text` cue is forwarded to the coach as the session brief.

import { useCallback, useEffect, useRef, useState } from 'react';
import { startVoiceSession } from '../../lib/voiceSession.js';

// Classic line-art mic (Feather "mic"); inherits currentColor. aria-hidden.
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

const SESSION_SECONDS = 300;     // hard 5:00 cap
const RESET_MS = 6000;           // how long the complete / error state lingers

// Server denial slug → member-facing copy.
const DENY_COPY = {
  quota_exhausted: 'Monthly voice minutes used up — resets next cycle.',
  not_entitled:    'Voice Coach unlocks on the Autonomous tier.',
  account_locked:  'Account locked — contact support.',
  invalid_session: 'Session expired — sign in again.',
  no_session:      'Sign in to start a voice session.',
  mic_denied:      'Microphone access is required.',
  ticket_unreachable: 'Coach service unreachable — try again.',
  upstream_failure:   'Coach connection dropped — try again.',
};

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VoiceCoachButton({ text, lang = 'en', payload, idleLabel = 'Voice Coach' }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | live | complete | error
  const [errorMsg, setErrorMsg] = useState('');
  const [remaining, setRemaining] = useState(SESSION_SECONDS);
  const [budget, setBudget] = useState(null);    // { remaining, ceiling, godMode }

  const sessionRef = useRef(null);  // { stop } for the active session
  const timerRef = useRef(null);    // 1s countdown interval
  const resetRef = useRef(null);    // complete/error → idle timeout
  const remainingRef = useRef(SESSION_SECONDS);
  const terminalRef = useRef(false); // dedupes the terminal transition
  const wentLiveRef = useRef(false);
  const godModeRef = useRef(false);  // server-authoritative God Mode (admin/coach/akeem/trial)
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (resetRef.current) { clearTimeout(resetRef.current); resetRef.current = null; }
  }, []);

  // Stop the live session (idempotent). Its onState('ended') drives the terminal UI.
  const endSession = useCallback((reason) => {
    if (sessionRef.current) { try { sessionRef.current.stop(reason); } catch { /* noop */ } }
  }, []);

  // Single terminal transition: 'complete' (ran), 'idle' (cancelled pre-live), 'error'.
  const toTerminal = useCallback((kind, msg) => {
    if (terminalRef.current) return;
    terminalRef.current = true;
    clearTimers();
    sessionRef.current = null;
    if (!mountedRef.current) return;
    if (kind === 'error') { setStatus('error'); setErrorMsg(msg || 'Voice Coach unavailable.'); }
    else if (kind === 'complete') { setStatus('complete'); }
    else { setStatus('idle'); setRemaining(SESSION_SECONDS); }
    if (kind === 'error' || kind === 'complete') {
      resetRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setStatus('idle'); setRemaining(SESSION_SECONDS); setErrorMsg('');
      }, RESET_MS);
    }
  }, [clearTimers]);

  useEffect(() => () => { mountedRef.current = false; endSession('unmount'); clearTimers(); }, [endSession, clearTimers]);

  const handleClick = useCallback(() => {
    if (status === 'live' || status === 'connecting') { endSession('user-stop'); return; }
    if (status === 'complete' || status === 'error') return; // wait out the reset

    terminalRef.current = false;
    wentLiveRef.current = false;
    godModeRef.current = false;
    remainingRef.current = SESSION_SECONDS;
    setErrorMsg(''); setBudget(null); setRemaining(SESSION_SECONDS);
    setStatus('connecting');

    sessionRef.current = startVoiceSession({
      payload: { ...(payload || {}), lang, session_brief: String(text ?? '').trim() || undefined },
      onState: (s, meta) => {
        if (!mountedRef.current) return;
        if (meta && meta.godMode) godModeRef.current = true;
        if (meta && (meta.remaining !== undefined || meta.godMode)) {
          setBudget({ remaining: meta.remaining, ceiling: meta.ceiling, godMode: !!meta.godMode });
        }
        if (s === 'live') {
          wentLiveRef.current = true;
          setStatus('live');
          clearTimers();
          // God Mode (admin / coach / akeem / active trial) is UNMETERED — no
          // forced 5-minute teardown. The session stays open until the admin
          // clicks Stop or the connection drops.
          if (!godModeRef.current) {
            timerRef.current = setInterval(() => {
              const next = remainingRef.current - 1;
              if (next <= 0) {
                remainingRef.current = 0;
                setRemaining(0);
                endSession('time-cap'); // → onState('ended') → toTerminal('complete')
              } else {
                remainingRef.current = next;
                setRemaining(next);
              }
            }, 1000);
          }
        } else if (s === 'ended') {
          toTerminal(wentLiveRef.current ? 'complete' : 'idle');
        }
      },
      onError: (code) => { toTerminal('error', DENY_COPY[code]); },
    });
  }, [status, payload, lang, text, endSession, toTerminal, clearTimers]);

  const connecting = status === 'connecting';
  const live = status === 'live';
  const complete = status === 'complete';
  const errored = status === 'error';
  const unrestricted = live && !!budget?.godMode; // admin / God Mode — no 5:00 cap

  const label = errored ? errorMsg
    : connecting ? 'Connecting…'
    : live ? (unrestricted ? 'Live · Unrestricted' : `Live · ${fmt(remaining)}`)
    : complete ? 'Session Complete — Focus on your Next Set'
    : idleLabel;

  const cls = ['bbf-voice'];
  if (connecting) cls.push('is-loading', 'is-connecting');
  if (live) cls.push('is-playing', 'is-live');
  if (unrestricted) cls.push('is-unrestricted');
  if (complete) cls.push('is-complete');
  if (errored) cls.push('is-error');

  const budgetTitle = budget
    ? (budget.godMode ? 'Unmetered (God Mode)' : (budget.remaining != null ? `${budget.remaining.toLocaleString()} tokens left this month` : ''))
    : '';
  const title = live
    ? (unrestricted ? 'Stop session — unrestricted (admin)' : `Stop session — ${fmt(remaining)} left`)
    : connecting ? 'Connecting to the live coach…'
    : complete ? 'Session complete'
    : `Start a live voice coaching session${budgetTitle ? ` · ${budgetTitle}` : ''}`;

  return (
    <button
      type="button"
      className={cls.join(' ')}
      onClick={handleClick}
      disabled={complete || errored}
      aria-busy={connecting}
      title={title}
      aria-label={
        live || connecting ? 'Stop live voice coaching session'
          : complete ? 'Session complete'
          : 'Start live voice coaching session'
      }
    >
      <span className="bbf-voice-icon" aria-hidden="true">
        {connecting ? (
          <span className="bbf-voice-dot" />
        ) : live ? (
          <span className="bbf-voice-eq"><span /><span /><span /><span /></span>
        ) : (
          <MicIcon />
        )}
      </span>
      <span className="bbf-voice-label" aria-live="polite">{label}</span>
    </button>
  );
}
