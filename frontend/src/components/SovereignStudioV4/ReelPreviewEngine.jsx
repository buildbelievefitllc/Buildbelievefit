// src/components/SovereignStudioV4/ReelPreviewEngine.jsx
// Video player + text overlay state for the reel preview

import { useState, useRef, useEffect } from 'react';

export default function ReelPreviewEngine({ reelData }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const getOverlayClass = () => {
    const overlayMap = {
      scrim: 'ovl-scrim',
      cinematic: 'ovl-cinematic',
      minimal: 'ovl-minimal',
      lowerthird: 'ovl-lowerthird',
      frame: 'ovl-frame',
    };
    return overlayMap[reelData.overlayStyle] || 'ovl-scrim';
  };

  return (
    <div className="reel-preview-v4">
      <div className={`stage-reel-v4 ${getOverlayClass()}`}>
        {reelData.videoFile?.url ? (
          <>
            <video
              ref={videoRef}
              src={reelData.videoFile.url}
              className="reel-video-v4"
            />
            <div className="reel-play-overlay-v4">
              <button className="play-btn-v4" onClick={togglePlay}>
                {isPlaying ? '⏸' : '▶'}
              </button>
            </div>
          </>
        ) : (
          <div className="reel-placeholder-v4">
            <div className="placeholder-text-v4">Upload a video to preview</div>
          </div>
        )}

        <div className="reel-ov-v4"></div>

        <div className="reel-strip-v4"></div>

        <div className="reel-top-v4">
          <div className="reel-brand-v4">Build<span>Believe</span>Fit</div>
          {reelData.series && (
            <div className="reel-eye-v4">{reelData.series}</div>
          )}
        </div>

        <div className="reel-bottom-v4">
          {reelData.hook && (
            <div className="reel-hl-v4">{reelData.hook}</div>
          )}
          {reelData.hookSub && (
            <div className="reel-sub-v4">{reelData.hookSub}</div>
          )}
          {(reelData.hook || reelData.hookSub) && (
            <div className="reel-watch-v4">WATCH</div>
          )}
        </div>

        {reelData.logoImage?.url && (
          <div className="reel-logo-v4">
            <img src={reelData.logoImage.url} alt="BBF Logo" />
          </div>
        )}
      </div>

      {reelData.videoFile?.url && (
        <div className="reel-controls-v4">
          <div className="progress-v4">
            <div className="progress-bar-v4" style={{
              width: duration ? `${(currentTime / duration) * 100}%` : '0%'
            }}></div>
          </div>
          <div className="time-display-v4">
            {Math.floor(currentTime)}s / {Math.floor(duration)}s
          </div>
        </div>
      )}
    </div>
  );
}
