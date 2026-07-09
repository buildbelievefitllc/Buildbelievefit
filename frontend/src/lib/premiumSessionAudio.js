// src/lib/premiumSessionAudio.js
// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM SESSION AUDIO ENGINE — the client half of the Biometric Narration &
// Music Engine (blueprint c509f26 §5). Plays a composer PLAY CONTRACT as a
// two-layer mix, entirely client-side (the server never concatenates bytes):
//
//   LAYER A · MUSIC BED  — one reused HTMLAudioElement (the MediaSession anchor;
//       an element, not WebAudio, must own background playback). Ducking is a
//       volume envelope on the element — robust across CORS/lock-screen edge
//       cases where a MediaElementSource would tainted-mute.
//   LAYER B · VOICE      — AudioContext + decodeAudioData buffers scheduled on
//       the manifest's virtual timeline, next segments prefetched (the
//       backgroundLessonAudio warmNext doctrine). NO AudioContext available →
//       degrade to element-sequenced playback with timeline gaps (never fail).
//
//   INFLECTION GOVERNOR  — the LOCAL biometric state machine. Live HR crossing
//       the active block's band (with hysteresis + cooldown) arms a PRE-BAKED
//       Akeem cue; the engine splices it at the next SEAM (segment boundary) —
//       zero network calls mid-workout, no cue ever talks over another.

// ── Inflection governor — pure, injectable, unit-testable ────────────────────
// policy: { hysteresis_s, cooldown_s } (manifest inflections.policy).
// feed(hr, nowMs) → 'INF_HR_LOW' | 'INF_HR_HIGH' | 'INF_ON_TARGET' | null.
export function createInflectionGovernor(policy = {}) {
  const hysteresisMs = Math.max(0, (Number(policy.hysteresis_s) || 10) * 1000);
  const cooldownMs = Math.max(0, (Number(policy.cooldown_s) || 60) * 1000);
  const onTargetEveryMs = cooldownMs * 3; // affirmations are rarer than corrections

  let band = null;             // { floor, ceiling } for the ACTIVE block
  let zone = null;             // 'low' | 'high' | 'in'
  let zoneSince = 0;
  let lastCueAt = -Infinity;
  let lastOnTargetAt = -Infinity;

  function setBand(next) {
    band = (next && Number.isFinite(next.floor) && Number.isFinite(next.ceiling)) ? next : null;
    zone = null; // a new block re-arms cleanly
  }

  function feed(hr, nowMs) {
    if (!band || !Number.isFinite(hr) || hr <= 0) return null;
    const next = hr < band.floor ? 'low' : hr > band.ceiling ? 'high' : 'in';
    if (next !== zone) { zone = next; zoneSince = nowMs; return null; }
    if (nowMs - zoneSince < hysteresisMs) return null;

    if (zone === 'low' && nowMs - lastCueAt >= cooldownMs) {
      lastCueAt = nowMs; zoneSince = nowMs;
      return 'INF_HR_LOW';
    }
    if (zone === 'high' && nowMs - lastCueAt >= cooldownMs) {
      lastCueAt = nowMs; zoneSince = nowMs;
      return 'INF_HR_HIGH';
    }
    if (zone === 'in' && nowMs - lastCueAt >= cooldownMs && nowMs - lastOnTargetAt >= onTargetEveryMs) {
      lastCueAt = nowMs; lastOnTargetAt = nowMs; zoneSince = nowMs;
      return 'INF_ON_TARGET';
    }
    return null;
  }

  return { setBand, feed, get zone() { return zone; } };
}

// ── helpers ──────────────────────────────────────────────────────────────────
const DEFAULT_ARTWORK = [
  { src: '/media/bbf-icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/media/bbf-icon-512.png', sizes: '512x512', type: 'image/png' },
];
const hasMediaSession = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator;
const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

function activeBlockAt(blocks, tMs) {
  for (const b of blocks || []) {
    const [a, z] = b.work_window_ms || [];
    if (Number.isFinite(a) && Number.isFinite(z) && tMs >= a && tMs < z) return b;
  }
  return null;
}

// ── the player ───────────────────────────────────────────────────────────────
// createPremiumSessionPlayer(manifest, {
//   hrSource:  (cb) => unsubscribe   — pushes live HR numbers (Health Connect /
//                                      BLE / harness); optional — absent = the
//                                      inflection layer silently disables.
//   onState:   (state) => {}         — 'loading'|'playing'|'paused'|'ended'|'error'
//   onSlot:    (slotId) => {}        — active narration slot (UI highlight)
//   onInflection: (key) => {}        — an inflection cue just spliced in
//   resign:    async (paths) => urls — signed-URL refresh (403 retry path)
// })
export function createPremiumSessionPlayer(manifest, opts = {}) {
  const timeline = Array.isArray(manifest?.timeline) ? [...manifest.timeline].sort((a, b) => a.start_ms - b.start_ms) : [];
  const blocks = Array.isArray(manifest?.blocks) ? manifest.blocks : [];
  const inflections = manifest?.inflections || null;
  const governor = createInflectionGovernor(inflections?.policy);

  const duckDb = Number(manifest?.music?.duck_db) || -12;
  const duckGain = Math.pow(10, duckDb / 20); // dB → linear element volume
  const BED_VOLUME = 1.0;

  let musicEl = null;
  let ctx = null;
  let state = 'idle';
  let startedAtMs = 0;         // performance.now() anchor for the virtual timeline
  let pausedAtMs = 0;          // virtual position when paused
  let tickTimer = null;
  let hrUnsub = null;
  let pendingInflection = null;
  let voiceBusyUntil = 0;      // virtual ms until which the voice layer is occupied
  let scheduled = new Set();   // slot ids already played
  let buffers = new Map();     // url → AudioBuffer (decoded prefetch cache)
  let fallbackEl = null;       // degrade-mode voice element
  let disposed = false;
  let resignedOnce = false;

  const setState = (s) => { state = s; opts.onState?.(s); };
  const nowVirtual = () => (state === 'playing' ? pausedAtMs + (performance.now() - startedAtMs) : pausedAtMs);

  function setMediaSession() {
    if (!hasMediaSession()) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'BBF Premium Session', artist: 'Coach Akeem · BBF',
        album: 'Sovereign Vault', artwork: DEFAULT_ARTWORK,
      });
      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('stop', () => stop());
    } catch { /* unsupported */ }
  }
  function clearMediaSession() {
    if (!hasMediaSession()) return;
    ['play', 'pause', 'stop'].forEach((a) => { try { navigator.mediaSession.setActionHandler(a, null); } catch { /* noop */ } });
  }

  // Signed-URL fetch with ONE resign retry on 403 (12h TTL expiry mid-session).
  async function fetchAsset(item) {
    const url = item?.url;
    if (!url) throw new Error('no_url');
    let res = await fetch(url);
    if (res.status === 403 && typeof opts.resign === 'function' && !resignedOnce) {
      resignedOnce = true;
      const paths = timeline.map((s) => s.path).filter(Boolean);
      if (manifest?.music?.path) paths.push(manifest.music.path);
      try {
        const fresh = await opts.resign(paths);
        for (const seg of timeline) if (fresh[seg.path]) seg.url = fresh[seg.path];
        if (manifest?.music?.path && fresh[manifest.music.path]) manifest.music.url = fresh[manifest.music.path];
        res = await fetch(item.url);
      } catch { /* fall through to the error below */ }
    }
    if (!res.ok) throw new Error(`asset_${res.status}`);
    return res.arrayBuffer();
  }

  async function decodeItem(item) {
    if (!item?.url) return null;
    if (buffers.has(item.url)) return buffers.get(item.url);
    try {
      const bytes = await fetchAsset(item);
      const buf = await ctx.decodeAudioData(bytes.slice(0));
      buffers.set(item.url, buf);
      return buf;
    } catch { return null; }
  }

  // Duck envelope on the ELEMENT volume (attack/release stepped per frame).
  let duckTarget = BED_VOLUME;
  let duckRaf = null;
  function duckTo(target, ms) {
    duckTarget = target;
    if (!musicEl) return;
    cancelAnimationFrame(duckRaf);
    const from = musicEl.volume;
    const t0 = performance.now();
    const step = () => {
      if (!musicEl || disposed) return;
      const k = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
      musicEl.volume = from + (duckTarget - from) * k;
      if (k < 1) duckRaf = requestAnimationFrame(step);
    };
    duckRaf = requestAnimationFrame(step);
  }
  const duckDown = () => duckTo(duckGain, Number(manifest?.music?.duck_attack_ms) || 250);
  const duckUp = () => duckTo(BED_VOLUME, Number(manifest?.music?.duck_release_ms) || 900);

  function playVoiceBuffer(buf, onEnd) {
    duckDown();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => { duckUp(); onEnd?.(); };
    src.start();
    return buf.duration * 1000;
  }
  function playVoiceElement(url, onEnd) {
    duckDown();
    if (!fallbackEl) { fallbackEl = new Audio(); try { fallbackEl.setAttribute('playsinline', ''); } catch { /* noop */ } }
    fallbackEl.onended = () => { duckUp(); onEnd?.(); };
    fallbackEl.onerror = () => { duckUp(); onEnd?.(); };
    fallbackEl.src = url;
    fallbackEl.play().catch(() => { duckUp(); onEnd?.(); });
  }

  async function playSegment(item) {
    scheduled.add(item.slot);
    opts.onSlot?.(item.slot);
    const durEstimate = Number(item.duration_ms) || 8000;
    voiceBusyUntil = nowVirtual() + durEstimate;
    if (ctx) {
      const buf = await decodeItem(item);
      if (buf && !disposed && state === 'playing') {
        const ms = playVoiceBuffer(buf);
        voiceBusyUntil = nowVirtual() + ms;
        return;
      }
    }
    if (item.url && !disposed && state === 'playing') playVoiceElement(item.url);
  }

  async function playInflection(key) {
    const v = inflections?.variants?.[key];
    if (!v?.url) return;
    opts.onInflection?.(key);
    voiceBusyUntil = nowVirtual() + (Number(v.duration_ms) || 8000);
    if (ctx) {
      const buf = await decodeItem(v);
      if (buf && !disposed && state === 'playing') {
        const ms = playVoiceBuffer(buf);
        voiceBusyUntil = nowVirtual() + ms;
        return;
      }
    }
    if (!disposed && state === 'playing') playVoiceElement(v.url);
  }

  // The heartbeat — fires due segments, splices armed inflections at seams,
  // keeps the governor pointed at the active block, prefetches ahead.
  function tick() {
    if (disposed || state !== 'playing') return;
    const t = nowVirtual();

    // 1 · due narration segments (never overlap the busy voice layer — a late
    // segment waits for the seam rather than talking over the previous cue).
    for (const item of timeline) {
      if (scheduled.has(item.slot)) continue;
      if (t >= item.start_ms) {
        if (t < voiceBusyUntil) break; // wait for the seam
        playSegment(item);
        break;
      }
      break; // timeline is sorted — nothing due yet
    }

    // 2 · armed inflection → splice at a free seam only (seam_only policy).
    if (pendingInflection && t >= voiceBusyUntil) {
      const next = timeline.find((it) => !scheduled.has(it.slot));
      const room = !next || (next.start_ms - t) > ((Number(inflections?.variants?.[pendingInflection]?.duration_ms) || 8000) + 500);
      if (room) { const key = pendingInflection; pendingInflection = null; playInflection(key); }
    }

    // 3 · governor band follows the active block.
    const block = activeBlockAt(blocks, t);
    governor.setBand(block?.hr_band ?? null);

    // 4 · prefetch the next two undecoded segments (warmNext doctrine).
    if (ctx) {
      timeline.filter((it) => !scheduled.has(it.slot) && !buffers.has(it.url)).slice(0, 2).forEach((it) => { decodeItem(it); });
    }

    // 5 · end of track.
    if (t >= (Number(manifest?.total_duration_ms) || 0) && scheduled.size >= timeline.length) {
      stop(true);
      return;
    }
    tickTimer = setTimeout(tick, 250);
  }

  // NOTE: setBand is called every tick with the SAME object for an unchanged
  // block — the governor treats band identity loosely (floor/ceiling values),
  // so re-arming only happens on a REAL block change.
  const rawSetBand = governor.setBand;
  let lastBandKey = '';
  governor.setBand = (b) => {
    const key = b ? `${b.floor}|${b.ceiling}` : '';
    if (key === lastBandKey) return;
    lastBandKey = key;
    rawSetBand(b);
  };

  async function play() {
    if (disposed || state === 'playing') return;
    setState('loading');

    // Both unlocks ride the same user gesture (iOS): the AudioContext resume AND
    // the media element play.
    if (AudioCtx && !ctx) { try { ctx = new AudioCtx(); } catch { ctx = null; } }
    if (ctx?.state === 'suspended') { try { await ctx.resume(); } catch { /* degrade */ } }

    if (manifest?.music?.url && !musicEl) {
      musicEl = new Audio();
      try { musicEl.setAttribute('playsinline', ''); } catch { /* noop */ }
      musicEl.preload = 'auto';
      musicEl.loop = !!manifest.music.loop;
      musicEl.volume = BED_VOLUME;
      musicEl.src = manifest.music.url;
    }
    setMediaSession();
    if (hasMediaSession()) { try { navigator.mediaSession.playbackState = 'playing'; } catch { /* noop */ } }

    if (musicEl) { musicEl.play().catch(() => { /* bed blocked — voice still runs */ }); }
    if (opts.hrSource && inflections && !hrUnsub) {
      try {
        hrUnsub = opts.hrSource((hr) => {
          const cue = governor.feed(Number(hr), nowVirtual());
          if (cue && inflections.variants?.[cue]) pendingInflection = cue;
        });
      } catch { hrUnsub = null; }
    }

    startedAtMs = performance.now();
    setState('playing');
    tick();
  }

  function pause() {
    if (state !== 'playing') return;
    pausedAtMs = nowVirtual();
    clearTimeout(tickTimer);
    try { musicEl?.pause(); } catch { /* noop */ }
    try { fallbackEl?.pause(); } catch { /* noop */ }
    if (ctx) { try { ctx.suspend(); } catch { /* noop */ } }
    if (hasMediaSession()) { try { navigator.mediaSession.playbackState = 'paused'; } catch { /* noop */ } }
    setState('paused');
  }
  function resume() {
    if (state !== 'paused' || disposed) return;
    if (ctx) { try { ctx.resume(); } catch { /* noop */ } }
    try { musicEl?.play().catch(() => {}); } catch { /* noop */ }
    startedAtMs = performance.now();
    setState('playing');
    tick();
  }
  function stop(ended = false) {
    clearTimeout(tickTimer);
    cancelAnimationFrame(duckRaf);
    pausedAtMs = 0;
    try { musicEl?.pause(); } catch { /* noop */ }
    if (musicEl) { try { musicEl.removeAttribute('src'); musicEl.load(); } catch { /* noop */ } }
    try { fallbackEl?.pause(); } catch { /* noop */ }
    if (hrUnsub) { try { hrUnsub(); } catch { /* noop */ } hrUnsub = null; }
    if (hasMediaSession()) { try { navigator.mediaSession.playbackState = 'none'; } catch { /* noop */ } }
    clearMediaSession();
    scheduled = new Set();
    pendingInflection = null;
    voiceBusyUntil = 0;
    setState(ended ? 'ended' : 'idle');
  }
  function destroy() {
    stop();
    disposed = true;
    if (ctx) { try { ctx.close(); } catch { /* noop */ } ctx = null; }
    musicEl = null;
    fallbackEl = null;
    buffers = new Map();
  }

  return {
    play, pause, resume, stop, destroy,
    get state() { return state; },
    get positionMs() { return nowVirtual(); },
    // Test seam: feed a biometric reading directly (bypasses hrSource wiring).
    feedHeartRate(hr) {
      const cue = governor.feed(Number(hr), nowVirtual());
      if (cue && inflections?.variants?.[cue]) pendingInflection = cue;
      return cue;
    },
  };
}
