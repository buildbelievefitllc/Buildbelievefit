// src/lib/backgroundLessonAudio.js
// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND / LOCK-SCREEN lesson audio — the one mechanism the OS keeps alive
// when the screen is off.
//
// Plays an ordered playlist of MP3 URLs (the existing pre-baked language clips)
// through ONE reused HTMLAudioElement wired to the MediaSession API. Two things
// make it survive a locked screen (Android especially):
//
//   1. A single <audio> media element (NOT Web Audio, NOT speechSynthesis) — the
//      only playback path a mobile browser keeps running in the background.
//   2. Pauses are AUDIO, not JS timers. Every "your turn" / anticipation gap is a
//      generated silent-WAV spacer in the playlist, so the element is ALWAYS
//      playing something. A page with continuously-playing media is not frozen or
//      throttled in the background, and the MediaSession (lock-screen transport)
//      stays alive across the whole lesson.
//
// The MediaSession metadata + play/pause/next/prev/stop handlers give real
// lock-screen controls. Framework-agnostic controller; the React players wrap it.

// ── Silent-WAV spacer generator ──────────────────────────────────────────────
// A valid mono 8-bit PCM WAV of `ms` of silence, as a data: URI. 8 kHz keeps the
// payload tiny (silence needs no fidelity). Cached per rounded duration so a
// lesson's handful of distinct gap lengths are each built once.
const _silenceCache = new Map();
export function silentWavUri(ms) {
  const dur = Math.max(0, Math.round(Number(ms) / 250) * 250); // 250 ms granularity
  if (dur <= 0) return null;
  if (_silenceCache.has(dur)) return _silenceCache.get(dur);

  const sampleRate = 8000;
  const numSamples = Math.round((dur / 1000) * sampleRate);
  const dataLen = numSamples; // 8-bit mono → 1 byte/sample
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);
  const wr = (off, s) => { for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i)); };
  wr(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  wr(8, 'WAVE');
  wr(12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM fmt chunk size
  view.setUint16(20, 1, true);           // audio format = PCM
  view.setUint16(22, 1, true);           // channels = mono
  view.setUint32(24, sampleRate, true);  // sample rate
  view.setUint32(28, sampleRate, true);  // byte rate (8-bit mono = sampleRate)
  view.setUint16(32, 1, true);           // block align
  view.setUint16(34, 8, true);           // bits per sample
  wr(36, 'data');
  view.setUint32(40, dataLen, true);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < dataLen; i += 1) bytes[44 + i] = 128; // 8-bit PCM silence = midpoint

  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  const uri = `data:audio/wav;base64,${btoa(bin)}`;
  _silenceCache.set(dur, uri);
  return uri;
}

const DEFAULT_ARTWORK = [
  { src: '/media/bbf-icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/media/bbf-icon-512.png', sizes: '512x512', type: 'image/png' },
];

const hasMediaSession = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator;

// ── The controller ───────────────────────────────────────────────────────────
// Playlist item shape:
//   { url: string, silent?: boolean, clip?: number, title?: string }
// `clip` = the caller's logical clip index this item belongs to (drives the
// current-clip callback + next/prev seeking). Silent spacers carry the clip index
// of the clip they FOLLOW so the UI holds the right position through the pause.
export function createBackgroundLesson() {
  let el = null;
  let items = [];
  let idx = -1;
  let stopped = true;
  let hooks = {};      // { onItemStart, onEnded, onError }
  let media = {};      // { title, artist, album, artwork }

  function ensureEl() {
    if (!el) {
      el = new Audio();
      el.preload = 'auto';
      try { el.setAttribute('playsinline', ''); } catch { /* noop */ }
      el.addEventListener('ended', onNativeEnded);
      el.addEventListener('error', onNativeError);
      el.addEventListener('timeupdate', onNativeTimeUpdate);
    }
    return el;
  }

  function onNativeTimeUpdate() {
    if (stopped || !el) return;
    hooks.onProgress?.(el.currentTime || 0, Number.isFinite(el.duration) ? el.duration : 0, items[idx], idx);
  }

  function onNativeEnded() {
    if (stopped) return;
    advance(idx + 1);
  }
  function onNativeError() {
    if (stopped) return;
    // A missing/broken clip must never deadlock the lesson — skip to the next item.
    hooks.onError?.(idx, items[idx]);
    advance(idx + 1);
  }

  function warmNext(i) {
    const nx = items[i];
    if (nx && !nx.silent && nx.url) { try { fetch(nx.url).catch(() => {}); } catch { /* noop */ } }
  }

  function setPlaybackState(s) {
    if (hasMediaSession()) { try { navigator.mediaSession.playbackState = s; } catch { /* noop */ } }
  }

  function setMetadata(item) {
    if (!hasMediaSession()) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item?.title || media.title || 'BBF Language Lab',
        artist: media.artist || 'Coach Akeem · BBF',
        album: media.album || 'BBF Lab',
        artwork: media.artwork || DEFAULT_ARTWORK,
      });
    } catch { /* noop */ }
  }

  function wireHandlers() {
    if (!hasMediaSession()) return;
    const set = (action, handler) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ }
    };
    set('play', () => resume());
    set('pause', () => pause());
    set('stop', () => stop());
    set('previoustrack', () => prevClip());
    set('nexttrack', () => nextClip());
  }
  function clearHandlers() {
    if (!hasMediaSession()) return;
    ['play', 'pause', 'stop', 'previoustrack', 'nexttrack'].forEach((a) => {
      try { navigator.mediaSession.setActionHandler(a, null); } catch { /* noop */ }
    });
  }

  function advance(i) {
    if (i >= items.length) {
      stopped = true;
      setPlaybackState('none');
      hooks.onEnded?.();
      return;
    }
    idx = i;
    const item = items[i];
    const node = ensureEl();
    node.src = item.url;
    setMetadata(item);
    setPlaybackState('playing');
    node.play().catch(() => { /* blocked (no gesture / policy) — surface as stop */ });
    hooks.onItemStart?.(i, item);
    warmNext(i + 1);
  }

  function play(fromItem = 0, opts = {}) {
    items = Array.isArray(opts.items) ? opts.items : items;
    hooks = opts.hooks || hooks;
    media = opts.media || media;
    if (!items.length) return;
    stopped = false;
    ensureEl();
    wireHandlers();
    advance(Math.max(0, Math.min(fromItem, items.length - 1)));
  }

  function pause() {
    try { el?.pause(); } catch { /* noop */ }
    setPlaybackState('paused');
  }
  function resume() {
    if (stopped || !el) return;
    setPlaybackState('playing');
    el.play().catch(() => { /* noop */ });
  }
  function stop() {
    stopped = true;
    try { el?.pause(); } catch { /* noop */ }
    if (el) { try { el.removeAttribute('src'); el.load(); } catch { /* noop */ } }
    idx = -1;
    setPlaybackState('none');
    clearHandlers();
  }

  // Seek to the first item of the next/previous logical clip (skips silences).
  function seekToClip(targetClip) {
    if (targetClip === null || targetClip === undefined) return;
    const at = items.findIndex((it) => it.clip === targetClip && !it.silent);
    if (at >= 0) advance(at);
  }
  function currentClip() {
    for (let i = idx; i >= 0; i -= 1) {
      if (items[i] && items[i].clip !== undefined && items[i].clip !== null) return items[i].clip;
    }
    return null;
  }
  function nextClip() {
    const c = currentClip();
    if (c === null) return;
    seekToClip(c + 1);
  }
  function prevClip() {
    const c = currentClip();
    if (c === null || c <= 0) { seekToClip(0); return; }
    seekToClip(c - 1);
  }

  function destroy() {
    stop();
    if (el) {
      el.removeEventListener('ended', onNativeEnded);
      el.removeEventListener('error', onNativeError);
      el.removeEventListener('timeupdate', onNativeTimeUpdate);
      el = null;
    }
  }

  return { play, pause, resume, stop, nextClip, prevClip, seekToClip, destroy, get index() { return idx; }, get isStopped() { return stopped; } };
}
