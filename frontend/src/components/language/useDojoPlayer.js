// src/components/language/useDojoPlayer.js
// ─────────────────────────────────────────────────────────────────────────────
// AUDIO DOJO engine — the Zero-API Pimsleur stitch loop on the Web Audio API.
//
// ⛔ ZERO-API LAW: fragments are pre-baked native-pronunciation clips pulled
// DIRECTLY from the public 'language-fragments' storage bucket — never a live TTS.
//
// LOOKAHEAD PRELOAD BUFFER: while fragment N plays, N+1 and N+2 are silently
// fetched + decoded, so the 3.0s/4.0s anticipation pauses never stutter on
// cellular/Wi-Fi. NATIVE-TIMELINE PAUSES: when the next buffer is decoded in
// time, it is scheduled sample-accurately on the AudioContext clock at
// (start + duration + gap) — the pause exists ON the context timeline, not as a
// JS timer. A late decode falls back to a timer so playback never deadlocks.
//
// DEGRADATION: an unbaked opening fragment resolves to status 'calibrating'
// (the Dojo shows its baking notice), never a raw error.

import { useCallback, useEffect, useRef, useState } from 'react';
import { FUNCTIONS_BASE } from '../../lib/supabaseClient.js';

const STORAGE_BASE = String(FUNCTIONS_BASE || '').replace(/\/functions\/v1$/, '/storage/v1/object/public');

/** Public bucket URL for a language fragment key (Zero-API construction). */
export function fragmentUrl(key) {
  return `${STORAGE_BASE}/language-fragments/${encodeURIComponent(String(key))}.mp3`;
}

/**
 * @param {Array<{key:string, gapAfterMs?:number}>} fragments
 * @param {{ onAdvance?:(i:number)=>void, onEnded?:()=>void }} [hooks]
 */
export function useDojoPlayer(fragments, { onAdvance, onEnded } = {}) {
  const [state, setState] = useState({ status: 'idle', index: 0 }); // idle|playing|ended|calibrating
  const ctxRef = useRef(null);
  const buffersRef = useRef(new Map()); // key → Promise<AudioBuffer|null>
  const srcRef = useRef(null);
  const timerRef = useRef(null);
  const scheduledRef = useRef(-1); // highest index already scheduled on the timeline
  const stoppedRef = useRef(false);
  const alive = useRef(true);
  const hooksRef = useRef({ onAdvance, onEnded });
  useEffect(() => { hooksRef.current = { onAdvance, onEnded }; }, [onAdvance, onEnded]);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  };

  // Fetch + decode one fragment (memoized). Resolves null for an unbaked fragment.
  const load = useCallback((i) => {
    if (i < 0 || i >= fragments.length) return Promise.resolve(null);
    const key = fragments[i].key;
    if (!buffersRef.current.has(key)) {
      const p = fetch(fragmentUrl(key))
        .then((r) => { if (!r.ok) throw new Error('missing_fragment'); return r.arrayBuffer(); })
        .then((ab) => ensureCtx().decodeAudioData(ab))
        .catch(() => null);
      buffersRef.current.set(key, p);
    }
    return buffersRef.current.get(key);
  }, [fragments]);

  // Schedule fragment i at `when` on the CONTEXT TIMELINE, then chain i+1.
  // Self-recursive sequencing lives behind a ref (the useBriefPlayer house pattern)
  // so the chain always operates on fresh state without a self-referential closure.
  const scheduleAtRef = useRef(() => {});
  useEffect(() => {
    scheduleAtRef.current = (i, buf, when) => {
      if (stoppedRef.current || !alive.current) return;
      const ctx = ensureCtx();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      srcRef.current = src;
      scheduledRef.current = i;
      src.start(Math.max(when, ctx.currentTime));

      // Flip the visible index when this fragment actually begins.
      const untilStartMs = Math.max(0, (when - ctx.currentTime) * 1000);
      setTimeout(() => { if (alive.current && !stoppedRef.current) setState({ status: 'playing', index: i }); }, untilStartMs);

      const gapS = Math.max(0, Number(fragments[i].gapAfterMs) || 0) / 1000;
      const nextAt = Math.max(when, ctx.currentTime) + buf.duration + gapS; // the pause lives on the timeline
      const next = i + 1;

      // LOOKAHEAD: prefetch N+1 and N+2 NOW. If N+1 decodes before its start time,
      // chain it natively at nextAt (sample-accurate anticipation pause).
      if (next < fragments.length) {
        load(next).then((nb) => {
          load(next + 1); // keep the buffer two ahead
          if (!alive.current || stoppedRef.current || scheduledRef.current >= next) return;
          if (nb && ctx.currentTime < nextAt) {
            scheduleAtRef.current(next, nb, nextAt);
          }
        });
      }

      src.onended = () => {
        if (!alive.current || stoppedRef.current) return;
        hooksRef.current.onAdvance?.(i);
        if (next >= fragments.length) {
          setState({ status: 'ended', index: fragments.length });
          hooksRef.current.onEnded?.();
          return;
        }
        // Fallback path — the next fragment wasn't chain-scheduled in time (slow
        // decode). Honor the remaining gap with a timer, then play it.
        if (scheduledRef.current < next) {
          const waitMs = Math.max(0, (nextAt - ctx.currentTime) * 1000);
          timerRef.current = setTimeout(async () => {
            if (!alive.current || stoppedRef.current || scheduledRef.current >= next) return;
            const nb = await load(next);
            if (!alive.current || stoppedRef.current || scheduledRef.current >= next) return;
            if (nb) scheduleAtRef.current(next, nb, ensureCtx().currentTime);
            else { setState({ status: 'ended', index: fragments.length }); hooksRef.current.onEnded?.(); }
          }, waitMs);
        }
      };
    };
  }, [fragments, load]);

  const play = useCallback(async (fromIndex = 0) => {
    stoppedRef.current = false;
    scheduledRef.current = fromIndex - 1;
    const ctx = ensureCtx();
    try { await ctx.resume(); } catch { /* autoplay policies — the click gesture covers it */ }
    const buf = await load(fromIndex);
    if (!alive.current || stoppedRef.current) return;
    if (!buf) { setState({ status: 'calibrating', index: fromIndex }); return; }
    scheduleAtRef.current(fromIndex, buf, ctx.currentTime + 0.05);
  }, [load]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    try { srcRef.current?.stop(); } catch { /* not started */ }
    if (timerRef.current) clearTimeout(timerRef.current);
    setState((s) => ({ ...s, status: 'idle' }));
  }, []);

  useEffect(() => () => {
    alive.current = false;
    stoppedRef.current = true;
    try { srcRef.current?.stop(); } catch { /* noop */ }
    if (timerRef.current) clearTimeout(timerRef.current);
    try { ctxRef.current?.close(); } catch { /* noop */ }
  }, []);

  return { ...state, play, stop };
}
