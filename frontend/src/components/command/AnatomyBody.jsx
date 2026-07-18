// src/components/command/AnatomyBody.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Anatomy Arena — the REGIONAL ZOOM canvas.
//
// Renders one training-split lane (push / pull / legs) on its own tuned viewBox
// so the muscles fill the frame. Every muscle is a <g role="button"> wrapping one
// or two distinct, non-overlapping vector <path>s — the silhouette behind is
// pointer-events:none, so a tap registers on EXACTLY the muscle path clicked
// (no bounding-box bleed between neighbors).
//
// REALISTIC BASE LAYER (optional): when the lane carries an `imageUrl`, a
// high-fidelity muscle map (WebP/AVIF from the anatomy-assets bucket) paints as
// the absolute base layer INSIDE the svg, under the interactive hit-map. The
// vector silhouette stays as an instant placeholder; the photo is decoded off
// the main thread (img.decode) and cross-fades in once ready. With no imageUrl
// the game renders the pure vector map, exactly as before (fully backward-compat).
//
// State (BBF signature palette, driven by CSS):
//   • idle            — deep gray fill (transparent once the photo is ready).
//   • hover / focus   — gold outline hint.
//   • is-correct      — the player nailed it → snaps to BBF Purple.
//   • is-reveal       — the answer after a miss/timeout → flashes BBF Gold.
//   • is-wrong        — the muscle the player tapped by mistake → red.
// On reveal the correct muscle also gets a crisp Barlow Condensed on-body label.

import { useEffect, useState } from 'react';

export default function AnatomyBody({ lane, onPick, disabled, reveal }) {
  const imageUrl = lane?.imageUrl || null;
  // Which URL has finished decoding — derive `ready` from it so a lane switch
  // resets the fade without a synchronous setState in the effect body.
  const [decodedUrl, setDecodedUrl] = useState(null);

  useEffect(() => {
    if (!imageUrl) return undefined;
    let alive = true;
    const img = new Image();
    img.src = imageUrl;
    const done = () => { if (alive) setDecodedUrl(imageUrl); };
    if (img.decode) img.decode().then(done).catch(() => { img.onload = done; });
    else img.onload = done;
    return () => { alive = false; };
  }, [imageUrl]);

  if (!lane) return null;

  const [, , vbW, vbH] = String(lane.viewBox).split(/\s+/).map(Number);
  const hasImage = !!imageUrl;
  const ready = hasImage && decodedUrl === imageUrl;
  const cls = `kl-anat-svg${hasImage ? ' has-image' : ''}${ready ? ' is-ready' : ''}`;

  return (
    <svg viewBox={lane.viewBox} className={cls} role="group" aria-label={`${lane.id} muscle map`}>
      {hasImage ? (
        <image
          className="kl-anat-photo"
          href={imageUrl}
          x="0"
          y="0"
          width={vbW}
          height={vbH}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        />
      ) : null}

      <g className="kl-anat-body" aria-hidden="true">
        {lane.head ? <circle cx={lane.head.cx} cy={lane.head.cy} r={lane.head.r} /> : null}
        {lane.silhouette.map((d, i) => <path key={i} d={d} />)}
      </g>

      {lane.muscles.map((m) => {
        let state = '';
        if (reveal) {
          if (m.id === reveal.correctId) state = reveal.pickedId === reveal.correctId ? ' is-correct' : ' is-reveal';
          else if (m.id === reveal.pickedId) state = ' is-wrong';
          else state = ' is-dim';
        }
        return (
          <g
            key={m.id}
            className={`kl-anat-region${state}`}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={m.name}
            data-testid={`kl-anat-${m.id}`}
            onClick={() => { if (!disabled) onPick(m.id); }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(m.id); }
            }}
          >
            {m.paths.map((d, i) => <path key={i} className="kl-anat-path" d={d} />)}
            {reveal && m.id === reveal.correctId ? (
              <text className="kl-anat-lbl" x={m.l[0]} y={m.l[1]} textAnchor="middle">{m.name.toUpperCase()}</text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
