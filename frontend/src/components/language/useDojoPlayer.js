// src/components/language/useDojoPlayer.js
// ─────────────────────────────────────────────────────────────────────────────
// AUDIO DOJO engine — the Zero-API Pimsleur stitch loop, now on a single
// HTMLAudioElement + MediaSession so it keeps playing with the SCREEN LOCKED.
//
// ⛔ ZERO-API LAW: fragments are pre-baked native-pronunciation clips pulled
// DIRECTLY from the public 'language-fragments' storage bucket — never a live TTS.
//
// BACKGROUND PLAYBACK: the lesson is flattened to a playlist of [clip, silence,
// clip, silence, …] where every anticipation/echo pause is a generated silent-WAV
// spacer (see backgroundLessonAudio.js), NOT a JS timer. One media element plays
// the whole chain end to end, so a locked/backgrounded screen never suspends it
// (the old Web Audio engine was suspended the instant the app backgrounded) and
// the MediaSession lock-screen transport stays live for the full lesson.
//
// DEGRADATION: an unbaked opening fragment resolves to status 'calibrating'
// (the Dojo shows its baking notice), never a raw error.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FUNCTIONS_BASE } from '../../lib/supabaseClient.js';
import { createBackgroundLesson, silentWavUri } from '../../lib/backgroundLessonAudio.js';

const STORAGE_BASE = String(FUNCTIONS_BASE || '').replace(/\/functions\/v1$/, '/storage/v1/object/public');

/** Public bucket URL for a language fragment key (Zero-API construction). */
export function fragmentUrl(key) {
  return `${STORAGE_BASE}/language-fragments/${encodeURIComponent(String(key))}.mp3`;
}

// Flatten fragments → a background-safe playlist. Each fragment becomes its clip
// followed by a silent-WAV spacer of its gapAfterMs (the pause lives IN the audio
// stream, so it survives backgrounding). Silences carry the clip index they follow
// so the UI holds position through the pause.
function buildPlaylist(fragments) {
  const out = [];
  fragments.forEach((f, i) => {
    out.push({ url: fragmentUrl(f.key), clip: i });
    const gap = Math.max(0, Number(f.gapAfterMs) || 0);
    const uri = gap > 0 ? silentWavUri(gap) : null;
    if (uri) out.push({ url: uri, silent: true, clip: i });
  });
  return out;
}

/**
 * @param {Array<{key:string, gapAfterMs?:number}>} fragments
 * @param {{ onAdvance?:(i:number)=>void, onEnded?:()=>void }} [hooks]
 */
export function useDojoPlayer(fragments, { onAdvance, onEnded } = {}) {
  const [state, setState] = useState({ status: 'idle', index: 0 }); // idle|playing|ended|calibrating
  const engineRef = useRef(null);
  const playlistRef = useRef([]);
  const alive = useRef(true);
  const hooksRef = useRef({ onAdvance, onEnded });
  useEffect(() => { hooksRef.current = { onAdvance, onEnded }; }, [onAdvance, onEnded]);

  const playlist = useMemo(() => buildPlaylist(fragments), [fragments]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  const ensureEngine = () => {
    if (!engineRef.current) engineRef.current = createBackgroundLesson();
    return engineRef.current;
  };

  const play = useCallback(async (fromIndex = 0) => {
    if (!fragments.length) return;
    const list = buildPlaylist(fragments);
    playlistRef.current = list;

    // Calibrating gate: if the resume fragment's clip isn't baked yet, show the
    // baking notice instead of a broken element (mirrors the old null-buffer path).
    const first = list.find((it) => it.clip === fromIndex && !it.silent) || list[0];
    try {
      const head = await fetch(first.url, { method: 'HEAD' });
      if (!head.ok) { if (alive.current) setState({ status: 'calibrating', index: fromIndex }); return; }
    } catch {
      if (alive.current) setState({ status: 'calibrating', index: fromIndex }); return;
    }
    if (!alive.current) return;

    // Start item = the first playlist entry for the resume clip.
    const startAt = Math.max(0, list.findIndex((it) => it.clip === fromIndex && !it.silent));

    ensureEngine().play(startAt, {
      items: list,
      media: {
        title: `BBF Language Lab — Fragment ${fromIndex + 1}`,
        artist: 'Coach Akeem · Audio Dojo',
        album: 'BBF Lab · Pimsleur Stitch',
      },
      hooks: {
        onItemStart: (k, item) => {
          if (!alive.current) return;
          // The item BEFORE this one — if it was a clip, that fragment just ended.
          const prev = playlistRef.current[k - 1];
          if (prev && !prev.silent) hooksRef.current.onAdvance?.(prev.clip);
          if (!item.silent) setState({ status: 'playing', index: item.clip });
        },
        onEnded: () => {
          if (!alive.current) return;
          // The final clip's audio ended with no item after it — checkpoint it, then done.
          const list2 = playlistRef.current;
          for (let i = list2.length - 1; i >= 0; i -= 1) {
            if (!list2[i].silent) { hooksRef.current.onAdvance?.(list2[i].clip); break; }
          }
          setState({ status: 'ended', index: fragments.length });
          hooksRef.current.onEnded?.();
        },
      },
    });
  }, [fragments]);

  const stop = useCallback(() => {
    try { engineRef.current?.stop(); } catch { /* noop */ }
    setState((s) => ({ ...s, status: 'idle' }));
  }, []);

  useEffect(() => () => {
    alive.current = false;
    try { engineRef.current?.destroy(); } catch { /* noop */ }
  }, []);

  return { ...state, play, stop };
}
