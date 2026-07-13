// src/components/SovereignStudioV4/ReelPreviewEngine.jsx
// Video player + text-overlay state for the reel cover. Renders at the TRUE
// 1080×1920 design resolution (the parent StageScaler shrinks it to fit), so the
// px overlay typography matches the exported frame 1:1. Video wins over the
// placeholder; the overlay skin is driven by reelData.overlayStyle.

import { useState, useRef, useEffect } from 'react';
import { REEL_PHONE_FRAME } from '../../lib/reelPhoneBackdrop.js';
import { seriesLabel } from '../../lib/reelSeriesLabels.js';

const OVERLAY_CLASS = {
  scrim: 'ovl-scrim',
  cinematic: 'ovl-cinematic',
  minimal: 'ovl-minimal',
  lowerthird: 'ovl-lowerthird',
  frame: 'ovl-frame',
};

// Hook headline typeface choices — all three already load on the page (index.html's
// Google Fonts link) and are LOCKED-brand-approved display faces (index.css §Typography),
// so switching is instant with no extra asset cost. Barlow Condensed reads cleanly at
// smaller sizes — the pick for a more descriptive, multi-line hook.
const HOOK_FONT_STACK = {
  bebas: "'Bebas Neue', sans-serif",
  anton: "'Anton', sans-serif",
  barlow: "'Barlow Condensed', sans-serif",
};

// ── Kinetic Text (caption_animation_style) — split the hook into word spans so
// per-word keyframes (word-pop / shoot-in / fade-glide, sovereignStudioV4.css
// §Kinetic Text) can stagger via the --word-i custom property. 'static' skips
// the machinery entirely — zero DOM overhead on the default path. Line breaks
// in the hook are preserved (each \n renders a real <br/>). ──
const KINETIC_CLASS = {
  'word-pop': 'kin-pop',
  'shoot-in': 'kin-shoot',
  'fade-glide': 'kin-glide',
};

function KineticHook({ text, anim }) {
  let wordIndex = 0;
  const lines = String(text).split('\n');
  return lines.map((line, li) => (
    <span key={li} className="kin-line-v4">
      {line.split(/\s+/).filter(Boolean).map((word) => {
        const i = wordIndex++;
        return (
          <span key={`${i}-${word}`} className={`kin-word-v4 ${anim}`} style={{ '--word-i': i }}>
            {word}
          </span>
        );
      })}
      {li < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

export default function ReelPreviewEngine({ reelData, stageRef }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // FRONT 5 — Sovereign Voiceover playback (the cached/generated MP3 URL handed up
  // from VibeSelector via reelData.voUrl). musicRef is the SEPARATE backing-track
  // channel (reelData.musicFile) so voice and music mix independently.
  const voRef = useRef(null);
  const musicRef = useRef(null);
  const [voPlaying, setVoPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    // Fresh clip → reset the scrubber so the bar never carries a stale width.
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    // Source changed → force the element to (re)load the new blob/URL. React
    // swaps the `src` attribute but the browser won't pick up a dynamic source
    // change without an explicit load(); without this the player can flatline
    // on the previously decoded clip (BigJim: "triggers .load() if the source
    // changes dynamically").
    try { video.load(); } catch { /* noop */ }

    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => setDuration(video.duration || 0);
    const onEnded = () => setIsPlaying(false);
    // Drive isPlaying from the element's ACTUAL state, so external pauses (media
    // keys, autoplay rejection) can't desync the play/pause glyph.
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  // phoneBackdrop is included because toggling it moves the <video> to a different
  // spot in the tree (full-bleed vs. nested in the phone-screen) — React mounts a
  // fresh element either way, so listeners must rebind onto it.
  }, [reelData.videoFile?.url, reelData.phoneBackdrop]);

  // Only command the element; isPlaying follows the real play/pause events above.
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  // Voiceover audio: bind play/pause state to the element's real events; reset when
  // a new VO URL is loaded so a stale "playing" glyph never lingers.
  useEffect(() => {
    const audio = voRef.current;
    if (!audio) return undefined;
    setVoPlaying(false);
    const onPlay = () => setVoPlaying(true);
    const onPause = () => setVoPlaying(false);
    const onEnded = () => setVoPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [reelData.voUrl]);

  // Audio-mix sliders — THREE independent channels, each bound DIRECTLY to its own
  // element's volume property: voiceVolume → the voiceover track, musicVolume → the
  // backing music track, footageVolume → the uploaded clip's OWN baked-in audio (the
  // <video> element itself). Re-applied when a new source mounts each element.
  useEffect(() => {
    const voice = voRef.current;
    if (!voice) return;
    const v = Number(reelData.voiceVolume);
    voice.volume = Number.isFinite(v) ? Math.min(Math.max(v / 100, 0), 1) : 1;
  }, [reelData.voiceVolume, reelData.voUrl]);
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    const v = Number(reelData.musicVolume);
    music.volume = Number.isFinite(v) ? Math.min(Math.max(v / 100, 0), 1) : 1;
  }, [reelData.musicVolume, reelData.musicFile?.url]);
  // Clip audio — the footage's own soundtrack (e.g. music already baked into the
  // uploaded video). Bound to the <video> element so it can be turned down under a
  // voiceover, or up to feature it. videoFile.url + phoneBackdrop are deps because a
  // fresh <video> element mounts when either changes (and load() can reset volume).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const v = Number(reelData.footageVolume);
    video.volume = Number.isFinite(v) ? Math.min(Math.max(v / 100, 0), 1) : 1;
  }, [reelData.footageVolume, reelData.videoFile?.url, reelData.phoneBackdrop]);

  // One transport: play/pause the voice and the backing track together, in sync.
  const toggleVoiceover = () => {
    const voice = voRef.current;
    const music = musicRef.current;
    const anchor = voice || music;
    if (!anchor) return;
    if (anchor.paused) {
      if (voice) voice.play().catch(() => {});
      if (music) music.play().catch(() => {});
    } else {
      if (voice) voice.pause();
      if (music) music.pause();
    }
  };

  const overlayClass = OVERLAY_CLASS[reelData.overlayStyle] || 'ovl-scrim';
  const kineticClass = KINETIC_CLASS[reelData.caption_animation_style] || null;
  const layoutClass = `txt-${reelData.textLayout || 'bottom'}`; // overlay text-placement toggle
  const pct = duration ? (currentTime / duration) * 100 : 0;

  const video = reelData.videoFile?.url ? (
    <video ref={videoRef} src={reelData.videoFile.url} className="reel-video-v4" playsInline crossOrigin="anonymous" />
  ) : null;

  return (
    <div id="video-preview" className={`stage-reel-v4 ${overlayClass} ${layoutClass} ${reelData.phoneBackdrop ? 'has-phone-backdrop' : ''}`} ref={stageRef}>
      {reelData.phoneBackdrop ? (
        <div
          className={`phone-frame-v4 frame-${reelData.phoneFrame || 'sleek'}`}
          style={{ left: REEL_PHONE_FRAME.left, top: REEL_PHONE_FRAME.top, width: REEL_PHONE_FRAME.width, height: REEL_PHONE_FRAME.height, bottom: 'auto', transform: 'none' }}
        >
          <div className="phone-notch-v4" />
          <div className="phone-screen-v4">
            {video || <div className="phone-screen-ph-v4">UPLOAD<br />VIDEO</div>}
          </div>
        </div>
      ) : (
        video || (
          <div className="reel-placeholder-v4">
            <div className="placeholder-text-v4">UPLOAD A VIDEO<br />TO PREVIEW</div>
          </div>
        )
      )}

      <div className="reel-ov-v4" />
      <div className="reel-strip-v4" />

      <div className="reel-top-v4">
        <div className="reel-brand-v4">BUILD<span>BELIEVE</span>FIT</div>
        {reelData.series && <div className="reel-eye-v4">{seriesLabel(reelData.series)}</div>}
      </div>

      <div className="reel-bottom-v4">
        {reelData.hook && (
          <div
            // key remount replays the kinetic run whenever the style or copy
            // changes — the animation is always previewable, never one-shot.
            key={`${reelData.caption_animation_style || 'static'}::${reelData.hook}`}
            className="reel-hl-v4"
            style={{
              fontFamily: HOOK_FONT_STACK[reelData.hookFont] || undefined,
              fontSize: reelData.hookFontSize ? `${reelData.hookFontSize}px` : undefined,
            }}
          >
            {kineticClass ? <KineticHook text={reelData.hook} anim={kineticClass} /> : reelData.hook}
          </div>
        )}
        {reelData.hookSub && <div className="reel-sub-v4">{reelData.hookSub}</div>}
        {(reelData.hook || reelData.hookSub) && <div className="reel-watch-v4">▶ {reelData.watchText || 'WATCH'}</div>}
        {(reelData.voUrl || reelData.musicFile?.url) && (
          <button type="button" className="reel-vo-v4" onClick={toggleVoiceover} aria-label={voPlaying ? 'Pause audio' : 'Play audio'}>
            {voPlaying ? '❚❚ AUDIO' : '🎙 PLAY AUDIO'}
          </button>
        )}
      </div>

      {/* Hidden dual-track audio engine: the voiceover channel (voUrl) and the
          backing-music channel (musicFile) — each with its own volume binding. */}
      {reelData.voUrl && <audio ref={voRef} src={reelData.voUrl} preload="auto" data-testid="reel-audio-voice" />}
      {reelData.musicFile?.url && <audio ref={musicRef} src={reelData.musicFile.url} preload="auto" loop data-testid="reel-audio-music" />}

      {reelData.logoImage?.url && (
        <div className="reel-logo-v4" style={{ transform: `scale(${reelData.logoScale ?? 1})`, transformOrigin: 'top right' }}>
          <img src={reelData.logoImage.url} alt="Logo" />
        </div>
      )}

      {reelData.videoFile?.url && (
        <>
          <button type="button" className="reel-play-v4" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <div className="reel-progress-v4">
            <div className="reel-progress-bar-v4" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
