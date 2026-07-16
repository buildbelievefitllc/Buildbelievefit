// src/components/vault/VoiceCoachButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// AI Voice Coach — the Program tab's LIVE voice-to-voice Coach Akeem trigger.
//
// ✅ VOICE ENGINE (CEO order — "Both surfaces get Akeem"): this button now runs on
// the ElevenLabs Agents platform (ConvAI 2.0, WebRTC) so the live coach speaks in
// the BBF Coach Akeem professional voice clone (voice_id ZbKDEqxkr8Ub4psNm5XD) —
// the SAME agent that powers the Live Mindset Check-In. It replaces the prior
// Gemini native-audio bridge (/ws/phantom-eye), which could only use Google's
// prebuilt realtime voices and had no slot for the Akeem clone.
//
// Session lifecycle: idle → connecting → live (hard cap countdown) → complete.
// The connection is minted server-side (bbf-convai-session — the fail-closed Apex
// gate + the shared voice-token ledger precheck); this component only drives the
// button UI. Metering settles on the post-call webhook (bbf-convai-postcall).
//
// Drop-in for the existing mount (<VoiceCoachButton text={coachCue} lang={lang} />):
// the ConvAI mint packages the athlete's own context (name, readiness, streak, last
// commitments) server-side, so the `text` cue is no longer forwarded as a brief.

import { useCallback, useEffect, useRef, useState } from 'react';
import { startConvaiSession } from '../../lib/convaiSession.js';

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

const SESSION_SECONDS = 480;     // hard 8:00 UI cap (mirrors bbf-convai-session UI_SESSION_CAP_MIN)
const RESET_MS = 6000;           // how long the complete / error state lingers

// Server denial slug → member-facing copy (ConvAI gateway slugs).
const DENY_COPY = {
  quota_exhausted:    'Monthly voice minutes used up — resets next cycle.',
  tier_not_entitled:  'The live Coach unlocks on the Apex tier.',
  account_locked:     'Account locked — contact support.',
  invalid_session:    'Session expired — sign in again.',
  missing_session:    'Sign in to start a voice session.',
  agent_unconfigured: 'Live Coach is warming up — try again shortly.',
  token_mint_failed:  'Coach connection dropped — try again.',
  convai_no_transport:'Coach connection dropped — try again.',
};

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// `text`/`payload` props from the legacy Gemini mount are accepted-and-ignored:
// the ConvAI mint packages the athlete's context server-side (see header note).
export default function VoiceCoachButton({ lang = 'en', idleLabel = 'Voice Coach' }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | live | complete | error
  const [errorMsg, setErrorMsg] = useState('');
  const [remaining, setRemaining] = useState(SESSION_SECONDS);
  const [agentTalking, setAgentTalking] = useState(false); // drives the EQ animation

  const sessionRef = useRef(null);  // ConvAI controller { end } for the active session
  const timerRef = useRef(null);    // 1s countdown interval
  const resetRef = useRef(null);    // complete/error → idle timeout
  const remainingRef = useRef(SESSION_SECONDS);
  const terminalRef = useRef(false); // dedupes the terminal transition
  const wentLiveRef = useRef(false);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (resetRef.current) { clearTimeout(resetRef.current); resetRef.current = null; }
  }, []);

  // Stop the live session (idempotent). Its onDisconnect drives the terminal UI.
  const endSession = useCallback(() => {
    if (sessionRef.current) { try { sessionRef.current.end?.(); } catch { /* noop */ } }
  }, []);

  // Single terminal transition: 'complete' (ran), 'idle' (cancelled pre-live), 'error'.
  const toTerminal = useCallback((kind, msg) => {
    if (terminalRef.current) return;
    terminalRef.current = true;
    clearTimers();
    sessionRef.current = null;
    if (!mountedRef.current) return;
    setAgentTalking(false);
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

  useEffect(() => () => { mountedRef.current = false; endSession(); clearTimers(); }, [endSession, clearTimers]);

  // Transition into the live state exactly once, and start the hard-cap countdown.
  const goLive = useCallback(() => {
    if (wentLiveRef.current || !mountedRef.current) return;
    wentLiveRef.current = true;
    setStatus('live');
    remainingRef.current = SESSION_SECONDS;
    setRemaining(SESSION_SECONDS);
    clearTimers();
    timerRef.current = setInterval(() => {
      const next = remainingRef.current - 1;
      if (next <= 0) {
        remainingRef.current = 0;
        setRemaining(0);
        endSession(); // → onDisconnect → toTerminal('complete')
      } else {
        remainingRef.current = next;
        setRemaining(next);
      }
    }, 1000);
  }, [clearTimers, endSession]);

  const handleClick = useCallback(() => {
    if (status === 'live' || status === 'connecting') { endSession(); if (status === 'connecting') toTerminal('idle'); return; }
    if (status === 'complete' || status === 'error') return; // wait out the reset

    terminalRef.current = false;
    wentLiveRef.current = false;
    remainingRef.current = SESSION_SECONDS;
    setErrorMsg(''); setAgentTalking(false); setRemaining(SESSION_SECONDS);
    setStatus('connecting');

    startConvaiSession({
      mode: 'checkin',
      locale: lang,
      hooks: {
        onStatus: (s) => {
          if (!mountedRef.current) return;
          if (s === 'connected') goLive();
          else if (s === 'disconnected') toTerminal(wentLiveRef.current ? 'complete' : 'idle');
        },
        onModeChange: (m) => { if (mountedRef.current) setAgentTalking(m === 'speaking'); },
        onDisconnect: () => { if (mountedRef.current) toTerminal(wentLiveRef.current ? 'complete' : 'idle'); },
        onError: () => { /* transport hiccups surface through onDisconnect */ },
      },
    })
      .then((ctrl) => {
        if (!mountedRef.current) { try { ctrl?.end?.(); } catch { /* noop */ } return; }
        sessionRef.current = ctrl;
        goLive(); // if onStatus('connected') hasn't already fired, promise resolution means we're live
      })
      .catch((e) => { toTerminal('error', DENY_COPY[e?.message]); });
  }, [status, lang, endSession, toTerminal, goLive]);

  const connecting = status === 'connecting';
  const live = status === 'live';
  const complete = status === 'complete';
  const errored = status === 'error';

  const label = errored ? errorMsg
    : connecting ? 'Connecting…'
    : live ? `Live · ${fmt(remaining)}`
    : complete ? 'Session Complete — Focus on your Next Set'
    : idleLabel;

  const cls = ['bbf-voice'];
  if (connecting) cls.push('is-loading', 'is-connecting');
  if (live) cls.push('is-playing', 'is-live');
  if (complete) cls.push('is-complete');
  if (errored) cls.push('is-error');

  const title = live
    ? `Stop session — ${fmt(remaining)} left`
    : connecting ? 'Connecting to Coach Akeem…'
    : complete ? 'Session complete'
    : 'Start a live voice session with Coach Akeem';

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
          <span className="bbf-voice-eq" data-talking={agentTalking ? '1' : '0'}><span /><span /><span /><span /></span>
        ) : (
          <MicIcon />
        )}
      </span>
      <span className="bbf-voice-label" aria-live="polite">{label}</span>
    </button>
  );
}
