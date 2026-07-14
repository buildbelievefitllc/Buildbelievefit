// src/components/SovereignStudioV4/SpotlightVideoStage.jsx
// Tier 2 — VIDEO SPOTLIGHT preview. Renders the client's PR/live-feed clip
// full-bleed at the true 1080×1920 design resolution (StageScaler shrinks it to
// fit), with the branded Spotlight frame + the stat callout composited over it.
// The overlay text is STATIC (doesn't move with the clip), so the export just
// rasterizes this stage once (SovereignFoundry.captureOverlay strips the <video>
// + controls) and bakes it onto every frame — no per-frame drawing needed here.

import { useState, useRef, useEffect } from 'react';

export default function SpotlightVideoStage({ spotData, stageRef }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const videoUrl = spotData.spotVideo?.url || null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    try { video.load(); } catch { /* noop */ }
    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => setDuration(video.duration || 0);
    const onEnded = () => setIsPlaying(false);
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
  }, [videoUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;
  const num = (spotData.statNumber || '').trim();
  const unit = (spotData.statUnit || '').trim();
  const lift = (spotData.statLift || '').trim();
  const rep = (spotData.repLine || '').trim();
  const hasStat = num || lift || rep || spotData.prBadge;

  return (
    <div className="stage-spotvid-v4" ref={stageRef}>
      {videoUrl
        ? <video ref={videoRef} src={videoUrl} className="spot-video-v4" playsInline crossOrigin="anonymous" />
        : (
          <div className="spot-vid-ph-v4" data-testid="spot-video-placeholder">
            <div className="spot-vid-ph-text-v4">UPLOAD A PR CLIP<br />TO SPOTLIGHT</div>
          </div>
        )}

      {/* legibility scrim + brand strip (static → baked into the export overlay) */}
      <div className="spot-vid-scrim-v4" />
      <div className="spot-vid-strip-v4" />

      <div className="spot-vid-top-v4">
        <div className="spot-vid-brand-v4">BUILD<span>BELIEVE</span>FIT</div>
        <div className="spot-vid-eye-v4">CLIENT SPOTLIGHT</div>
      </div>

      {hasStat && (
        <div className="spot-stat-v4" style={{ top: `${spotData.statPos ?? 24}%` }} data-testid="spot-stat">
          {spotData.prBadge && <div className="spot-pr-v4">NEW PR 🏆</div>}
          {num && (
            <div className="spot-stat-num-v4">
              {num}{unit && <span className="spot-stat-unit-v4">{unit}</span>}
            </div>
          )}
          {lift && <div className="spot-stat-lift-v4">{lift}</div>}
          {rep && <div className="spot-stat-rep-v4">{rep}</div>}
        </div>
      )}

      <div className="spot-vid-foot-v4">
        {spotData.clientName && <div className="spot-vid-name-v4">{spotData.clientName}</div>}
        {spotData.cta && <div className="spot-vid-cta-v4">{spotData.cta}</div>}
      </div>

      {videoUrl && (
        <>
          <button type="button" className="spot-play-v4" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <div className="spot-progress-v4">
            <div className="spot-progress-bar-v4" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
