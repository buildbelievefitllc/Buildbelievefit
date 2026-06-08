// src/lib/voiceSession.js
// ─────────────────────────────────────────────────────────────────────────────
// LIVE voice-to-voice session transport for the Sovereign Coach — the real-time
// bridge to Gemini 2.5 Flash native-audio via the Render WS proxy (/ws/phantom-eye).
// Pure JS, no React. One call → one controller with a single stop().
//
// Flow:
//   1. POST /api/auth/ws-ticket with the stored vault_token. The server resolves
//      identity SERVER-SIDE, checks the Autonomous+ band gate + the monthly token
//      balance, and returns a 60s single-use HMAC ticket (+ the remaining budget).
//   2. getUserMedia(audio) — the mic (the click is the required user gesture).
//   3. open the proxy WS with ?ticket=…, send the {context} bootstrap (mode:'voice'
//      → PROMPT_VIRTUAL_COACH + the BBF Immutable Laws, scope-locked server-side).
//   4. stream 16 kHz PCM16 mic chunks up; play 24 kHz PCM native-audio replies down.
//
// Teardown is idempotent and leak-safe: mic tracks stopped, both AudioContexts
// closed, the WS closed. The proxy commits the session's token delta to the
// monthly ledger on its own teardown — the client never reports usage.

import { getStoredVaultToken } from '../context/AuthContext.jsx';

const PROXY_BASE = (import.meta.env.VITE_VOICE_PROXY_URL || 'https://buildbelievefit.onrender.com')
  .replace(/\/+$/, '');
const WS_BASE = PROXY_BASE.replace(/^http/i, 'ws'); // https→wss · http→ws

const MIC_SAMPLE_RATE = 16000;  // Gemini Live input contract
const OUT_SAMPLE_RATE = 24000;  // Gemini Live native-audio output
const PROCESSOR_BUFFER = 4096;  // ~256 ms mono chunks
const OFF_TOPIC = '[BBF_OFF_TOPIC]';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToInt16(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const usable = bytes.length - (bytes.length % 2); // Int16 needs an even byte count
  return new Int16Array(bytes.buffer, 0, usable / 2);
}

// Start a live session. Callbacks: onState(state, meta), onTranscript(text),
// onError(code, detail). States: 'connecting' → 'live' → 'ended'. Returns { stop }.
export function startVoiceSession({ payload = {}, onState, onTranscript, onError } = {}) {
  let ws = null;
  let micStream = null;
  let micCtx = null;
  let source = null;
  let processor = null;
  let muteGain = null;
  let playbackCtx = null;
  let playbackCursor = 0;
  let stopped = false;
  let headBuffer = '';
  let headFlushed = false;

  const emitState = (s, meta) => { try { onState && onState(s, meta || {}); } catch { /* noop */ } };
  const emitText = (t) => { try { onTranscript && onTranscript(t); } catch { /* noop */ } };
  const emitError = (code, detail) => { try { onError && onError(code, detail); } catch { /* noop */ } };

  function stop(reason) {
    if (stopped) return;
    stopped = true;
    try { if (processor) { processor.onaudioprocess = null; processor.disconnect(); } } catch { /* noop */ }
    try { if (source) source.disconnect(); } catch { /* noop */ }
    try { if (muteGain) muteGain.disconnect(); } catch { /* noop */ }
    try { if (micCtx && micCtx.state !== 'closed') micCtx.close(); } catch { /* noop */ }
    try { if (playbackCtx && playbackCtx.state !== 'closed') playbackCtx.close(); } catch { /* noop */ }
    try { if (micStream) micStream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, reason || 'client-stop');
      }
    } catch { /* noop */ }
    ws = null; micStream = null; micCtx = null; source = null;
    processor = null; muteGain = null; playbackCtx = null;
    emitState('ended', { reason: reason || 'client-stop' });
  }

  // Schedule a 24 kHz PCM16 reply chunk at the running cursor so chunks play seamlessly.
  function queuePlayback(b64) {
    try {
      if (!playbackCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        playbackCtx = new AC({ sampleRate: OUT_SAMPLE_RATE });
        playbackCursor = 0;
      }
      const int16 = base64ToInt16(b64);
      if (!int16.length) return;
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
      const buffer = playbackCtx.createBuffer(1, float32.length, OUT_SAMPLE_RATE);
      buffer.copyToChannel(float32, 0, 0);
      const src = playbackCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(playbackCtx.destination);
      const startAt = Math.max(playbackCtx.currentTime + 0.05, playbackCursor);
      src.start(startAt);
      playbackCursor = startAt + buffer.duration;
    } catch { /* a dropped chunk is non-fatal */ }
  }

  function startCapture() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { emitError('audio_unsupported'); return; }
      micCtx = new AC({ sampleRate: MIC_SAMPLE_RATE });
      source = micCtx.createMediaStreamSource(micStream);
      processor = micCtx.createScriptProcessor(PROCESSOR_BUFFER, 1, 1);
      muteGain = micCtx.createGain();
      muteGain.gain.value = 0; // silent local sink so the mic never echoes back
      processor.onaudioprocess = (e) => {
        if (stopped || !ws || ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        try {
          ws.send(JSON.stringify({
            realtime_input: { media_chunks: [
              { mime_type: 'audio/pcm;rate=16000', data: arrayBufferToBase64(pcm16.buffer) },
            ] },
          }));
        } catch { /* drop a frame on a transient send failure */ }
      };
      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(micCtx.destination);
    } catch (e) {
      emitError('mic_init_failed', e && e.message);
    }
  }

  // Strip the off-topic sentinel from the head of a turn before surfacing the transcript.
  function handleText(text) {
    if (headFlushed) { emitText(text); return; }
    headBuffer += text;
    if (headBuffer.length >= 25 || headBuffer.indexOf('\n') >= 0) {
      let head = headBuffer;
      if (head.indexOf(OFF_TOPIC) === 0) head = head.replace(/^\[BBF_OFF_TOPIC\]\s*/, '');
      headFlushed = true;
      headBuffer = '';
      if (head) emitText(head);
    }
  }

  async function run() {
    const token = getStoredVaultToken();
    if (!token) { emitError('no_session'); emitState('ended', { reason: 'no_session' }); stopped = true; return; }
    emitState('connecting');

    // 1 — mint a session ticket (server-side band gate + monthly balance check).
    let ticketRes = null;
    try {
      const r = await fetch(`${PROXY_BASE}/api/auth/ws-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault_token: token }),
      });
      ticketRes = await r.json().catch(() => null);
      if (!r.ok || !ticketRes || !ticketRes.ok || !ticketRes.ticket) {
        const reason = (ticketRes && ticketRes.error) || 'ticket_denied';
        emitError(reason, ticketRes);
        emitState('ended', { reason });
        stopped = true;
        return;
      }
    } catch (e) {
      emitError('ticket_unreachable', e && e.message);
      emitState('ended', { reason: 'ticket_unreachable' });
      stopped = true;
      return;
    }
    if (stopped) return;
    emitState('connecting', { remaining: ticketRes.remaining, ceiling: ticketRes.ceiling, godMode: !!ticketRes.god_mode });

    // 2 — acquire the mic.
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      emitError('mic_denied', e && e.message);
      emitState('ended', { reason: 'mic_denied' });
      stopped = true;
      return;
    }
    if (stopped) { try { micStream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ } return; }

    // 3 — open the proxy WS with the one-shot ticket.
    try {
      ws = new WebSocket(`${WS_BASE}/ws/phantom-eye?ticket=${encodeURIComponent(ticketRes.ticket)}`);
    } catch (e) {
      emitError('ws_construct_failed', e && e.message);
      stop('ws-construct-failed');
      return;
    }
    ws.binaryType = 'arraybuffer';

    ws.addEventListener('open', () => {
      if (stopped) return;
      try {
        ws.send(JSON.stringify({ type: 'context', mode: 'voice', feature: 'virtual_coach', payload }));
      } catch { /* a failed bootstrap surfaces as a dead session → user retries */ }
    });

    ws.addEventListener('message', (ev) => {
      if (stopped) return;
      let msg;
      try {
        const text = (typeof ev.data === 'string') ? ev.data : new TextDecoder().decode(ev.data);
        msg = JSON.parse(text);
      } catch { return; }

      if (msg.type === 'ready') {
        emitState('live', { remaining: ticketRes.remaining, ceiling: ticketRes.ceiling, godMode: !!ticketRes.god_mode });
        startCapture();
        return;
      }
      if (msg.type === 'upstream-closed' || msg.type === 'upstream-error') {
        emitError('upstream_failure', msg);
        stop('upstream');
        return;
      }
      if (msg.type === 'gemini-text' && typeof msg.text === 'string' && msg.text) { handleText(msg.text); return; }
      if (msg.type === 'gemini-turn-complete') {
        if (!headFlushed && headBuffer) {
          let head = headBuffer;
          if (head.indexOf(OFF_TOPIC) === 0) head = head.replace(/^\[BBF_OFF_TOPIC\]\s*/, '');
          if (head) emitText(head);
        }
        headFlushed = false;
        headBuffer = '';
        return;
      }
      if (msg.serverContent && msg.serverContent.modelTurn && Array.isArray(msg.serverContent.modelTurn.parts)) {
        msg.serverContent.modelTurn.parts.forEach((part) => {
          if (part.inlineData && typeof part.inlineData.mimeType === 'string'
              && part.inlineData.mimeType.indexOf('audio/pcm') === 0) {
            queuePlayback(part.inlineData.data);
          }
        });
      }
    });

    ws.addEventListener('close', () => { if (!stopped) stop('ws-close'); });
    ws.addEventListener('error', () => { if (!stopped) { emitError('ws_error'); stop('ws-error'); } });
  }

  run();
  return { stop };
}
