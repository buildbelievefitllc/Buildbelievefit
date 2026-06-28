// src/components/SovereignStudioV4/StageScaler.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Fit-to-width scaler — the native-React replacement for v3's imperative
// `fitPreview()`. Each export stage is authored at its TRUE design resolution
// (1080×1350 feed, 1080×1920 story/reel) so every px value — font sizes, padding,
// absolute positions — stays internally consistent and export-accurate. This
// wrapper measures the available width via a ResizeObserver and applies a single
// `transform: scale()` so the whole card shrinks as a unit to fit the preview
// pane (never upscaled past 1:1). The outer box reserves the SCALED height so the
// surrounding layout flows correctly instead of overlapping.

import { useEffect, useRef, useState } from 'react';

export default function StageScaler({ designWidth, designHeight, children }) {
  const hostRef = useRef(null);
  const [scale, setScale] = useState(0); // 0 until first measure → avoids a flash at 1:1

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let raf = 0;
    const measure = () => {
      const available = host.clientWidth;
      if (available > 0) {
        setScale(Math.min(available / designWidth, 1));
      } else {
        // Mounted at zero width (e.g. inside a not-yet-laid-out flex/hidden
        // ancestor). Retry next frame so the stage never stays stuck invisible.
        raf = requestAnimationFrame(measure);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [designWidth]);

  return (
    <div
      ref={hostRef}
      className="stage-scaler-host"
      style={{ width: '100%', height: scale ? designHeight * scale : undefined }}
    >
      <div
        className="stage-scaler-inner"
        style={{
          width: designWidth,
          height: designHeight,
          transform: `scale(${scale || 0})`,
          transformOrigin: 'top left',
          // Hidden until the first measure lands so we never flash the full-size card.
          visibility: scale ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
