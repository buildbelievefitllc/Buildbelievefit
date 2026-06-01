// src/components/vault/SovereignSentinel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21.5 — Sovereign Sentinel: the athlete's master visual dashboard, a
// canvas reconstruction of the KFH biomechanics wireframe (drawSovereignSentinel
// in hologram-renderer.js). Renders the gold dashed anatomical blueprint with a
// purple spine accent. Mounts at the top of the Program tab, above the grid.
//
// Pure presentation — no biometric input yet; this is the "Custom Kinetic
// Blueprint Pending" sentinel the monolith shows until a kinetic map is bound.

import { useEffect, useRef } from 'react';
import './vault.css';

function drawSentinel(ctx, W, H, label) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  const cx = W * 0.5;
  const topY = H * 0.16;
  const headR = Math.min(W, H) * 0.075;
  const shoulderY = topY + headR * 2.3;
  const shoulderHalf = W * 0.11;
  const hipY = topY + H * 0.5;
  const hipHalf = W * 0.08;
  const footY = hipY + H * 0.24;

  ctx.save();
  ctx.strokeStyle = 'rgba(212,175,55,0.55)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.shadowColor = 'rgba(212,175,55,0.3)';
  ctx.shadowBlur = 6;

  // Head
  ctx.beginPath();
  ctx.arc(cx, topY + headR, headR, 0, Math.PI * 2);
  ctx.stroke();

  // Neck + shoulder line
  ctx.beginPath();
  ctx.moveTo(cx, topY + headR * 2);
  ctx.lineTo(cx, shoulderY);
  ctx.moveTo(cx - shoulderHalf, shoulderY);
  ctx.lineTo(cx + shoulderHalf, shoulderY);
  ctx.stroke();

  // Torso
  ctx.beginPath();
  ctx.moveTo(cx - shoulderHalf, shoulderY);
  ctx.lineTo(cx - hipHalf, hipY);
  ctx.lineTo(cx + hipHalf, hipY);
  ctx.lineTo(cx + shoulderHalf, shoulderY);
  ctx.stroke();

  // Arms
  ctx.beginPath();
  ctx.moveTo(cx - shoulderHalf, shoulderY);
  ctx.lineTo(cx - shoulderHalf - W * 0.06, shoulderY + H * 0.28);
  ctx.moveTo(cx + shoulderHalf, shoulderY);
  ctx.lineTo(cx + shoulderHalf + W * 0.06, shoulderY + H * 0.28);
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(cx - hipHalf, hipY);
  ctx.lineTo(cx - hipHalf, footY);
  ctx.moveTo(cx + hipHalf, hipY);
  ctx.lineTo(cx + hipHalf, footY);
  ctx.stroke();

  // Purple spine accent
  ctx.strokeStyle = 'rgba(106,13,173,0.55)';
  ctx.beginPath();
  ctx.moveTo(cx, shoulderY);
  ctx.lineTo(cx, hipY);
  ctx.stroke();
  ctx.restore();

  // Labels
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 13px "Barlow Condensed", sans-serif';
  ctx.fillStyle = 'rgba(212,175,55,0.75)';
  ctx.fillText('SOVEREIGN SENTINEL', cx, H - 30);
  ctx.font = '400 11px "Barlow Condensed", sans-serif';
  ctx.fillStyle = 'rgba(180,180,180,0.6)';
  ctx.fillText(label || 'Custom Kinetic Blueprint Pending', cx, H - 16);
  ctx.restore();
}

export default function SovereignSentinel({ label }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.clientWidth;
      const H = 260;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSentinel(ctx, W, H, label);
    };

    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [label]);

  return (
    <div className="sentinel" ref={wrapRef}>
      <div className="sentinel-kicker">Kinematic Form HUD</div>
      <canvas ref={canvasRef} className="sentinel-canvas" role="img" aria-label="Sovereign Sentinel anatomical blueprint" />
    </div>
  );
}
