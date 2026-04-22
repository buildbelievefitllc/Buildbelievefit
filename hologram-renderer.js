// ═══════════════════════════════════════════════════════════════
// HOLOGRAM-RENDERER.JS — BBF Biomechanical Hologram Overlay
// Sovereign Gold Standard — HTML5 Canvas Kinetic Visualization
// ═══════════════════════════════════════════════════════════════

var BBF_HOLOGRAM = (function() {
  'use strict';

  var GOLD = '#D4AF37';
  var GOLD_GLOW = 'rgba(212,175,55,0.4)';
  var PURPLE = '#6a0dad';
  var WHITE = 'rgba(255,255,255,0.85)';

  function getLang() {
    return (typeof BBF_LANG !== 'undefined' && BBF_LANG.get) ? BBF_LANG.get() : 'en';
  }

  function findMapping(exerciseName) {
    if (typeof KINETIC_MAPPINGS === 'undefined' || !exerciseName) return null;
    if (KINETIC_MAPPINGS[exerciseName]) return KINETIC_MAPPINGS[exerciseName];
    // Fuzzy match
    var lower = exerciseName.toLowerCase();
    for (var key in KINETIC_MAPPINGS) {
      if (lower.indexOf(key.toLowerCase()) > -1) {
        return KINETIC_MAPPINGS[key];
      }
    }
    return null;
  }

  // ─── SOVEREIGN SENTINEL ──────────────────────────────────
  // Fallback anatomical wireframe for exercises without a specific kinetic map
  function drawSovereignSentinel(ctx, W, H) {
    var cx = W * 0.5;
    var topY = H * 0.18;
    var headR = Math.min(W, H) * 0.07;
    var shoulderY = topY + headR * 2.3;
    var shoulderHalf = W * 0.1;
    var hipY = topY + H * 0.52;
    var hipHalf = W * 0.075;
    var footY = hipY + H * 0.22;

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

    // Torso (shoulders -> hips)
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
    ctx.strokeStyle = 'rgba(106,13,173,0.45)';
    ctx.beginPath();
    ctx.moveTo(cx, shoulderY);
    ctx.lineTo(cx, hipY);
    ctx.stroke();
    ctx.restore();

    // Sentinel label
    ctx.save();
    ctx.font = '700 10px "Barlow Condensed", sans-serif';
    ctx.fillStyle = 'rgba(212,175,55,0.65)';
    ctx.textAlign = 'center';
    ctx.fillText('SOVEREIGN SENTINEL', cx, H - 58);
    ctx.font = '400 9px "Barlow Condensed", sans-serif';
    ctx.fillStyle = 'rgba(180,180,180,0.55)';
    ctx.fillText('Custom Kinetic Blueprint Pending', cx, H - 44);
    ctx.restore();
  }

  function drawExerciseTitle(ctx, W, exerciseName) {
    var label = 'EXERCISE — ' + String(exerciseName || 'UNSPECIFIED').toUpperCase();
    ctx.save();
    ctx.font = '700 11px "Bebas Neue", "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#D4AF37';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(212,175,55,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(label, 10, 16);
    ctx.restore();
  }

  function drawKineticHologram(canvas, exerciseName, lang) {
    if (!canvas) return false;

    var L = lang || getLang();
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;

    // Always clear and paint a known background so prior exercise graphics never persist
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Dynamic title — always reflects the currently selected exercise
    drawExerciseTitle(ctx, W, exerciseName);

    var mapping = findMapping(exerciseName);
    if (!mapping) {
      // No specific SVG for this exercise — render the Sovereign Sentinel wireframe
      drawSovereignSentinel(ctx, W, H);
      return true;
    }

    // ─── PRIMARY VECTOR (dashed gold line) ─────────────────
    var v = mapping.primaryVector;
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.shadowColor = GOLD_GLOW;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(v.x1 * W, v.y1 * H);
    ctx.lineTo(v.x2 * W, v.y2 * H);
    ctx.stroke();
    ctx.restore();

    // Vector label
    ctx.save();
    ctx.font = '600 11px "Barlow Condensed", sans-serif';
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    var midX = ((v.x1 + v.x2) / 2) * W;
    var midY = ((v.y1 + v.y2) / 2) * H;
    ctx.fillText(v.label, midX + 40, midY);
    ctx.restore();

    // ─── JOINT ANGLES ──────────────────────────────────────
    if (mapping.jointAngles) {
      mapping.jointAngles.forEach(function(ja) {
        ctx.save();
        ctx.strokeStyle = PURPLE;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        // Draw angle arc
        ctx.beginPath();
        ctx.arc(ja.x * W, ja.y * H, 20, 0, Math.PI * 0.35);
        ctx.stroke();
        // Label
        ctx.font = '700 10px "Barlow Condensed", sans-serif';
        ctx.fillStyle = WHITE;
        ctx.fillText(ja.optimal, ja.x * W + 24, ja.y * H - 4);
        ctx.restore();
      });
    }

    // ─── FOCAL POINT (glowing circle) ──────────────────────
    var fp = mapping._overrideFocal || mapping.focalPoint;
    if (fp) {
      ctx.save();
      // Outer glow
      var grad = ctx.createRadialGradient(fp.x * W, fp.y * H, 0, fp.x * W, fp.y * H, fp.radius * W);
      grad.addColorStop(0, 'rgba(212,175,55,0.3)');
      grad.addColorStop(0.7, 'rgba(212,175,55,0.08)');
      grad.addColorStop(1, 'rgba(212,175,55,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fp.x * W, fp.y * H, fp.radius * W, 0, Math.PI * 2);
      ctx.fill();
      // Inner ring
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fp.x * W, fp.y * H, fp.radius * W * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      // Label
      ctx.font = '700 10px "Barlow Condensed", sans-serif';
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'center';
      var fpLabel = (fp.label && fp.label[L]) ? fp.label[L] : (fp.label.en || '');
      ctx.fillText(fpLabel, fp.x * W, fp.y * H + fp.radius * W + 14);
      ctx.restore();
    }

    // ─── CLINICAL CUE TEXT ─────────────────────────────────
    var cue = mapping.clinicalCues ? (mapping.clinicalCues[L] || mapping.clinicalCues.en) : '';
    if (cue) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(8, H - 52, W - 16, 44);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      ctx.strokeRect(8, H - 52, W - 16, 44);
      ctx.font = '600 11px "Barlow Condensed", sans-serif';
      ctx.fillStyle = WHITE;
      // Word wrap
      var words = cue.split(' ');
      var line = '';
      var y = H - 38;
      var maxW = W - 32;
      for (var i = 0; i < words.length; i++) {
        var test = line + words[i] + ' ';
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line.trim(), 16, y);
          line = words[i] + ' ';
          y += 14;
          if (y > H - 10) break;
        } else { line = test; }
      }
      if (line && y <= H - 10) ctx.fillText(line.trim(), 16, y);
      ctx.restore();
    }

    return true;
  }

  function toggle(containerId, exerciseName) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var canvas = container.querySelector('.holo-canvas');
    // If canvas is visible and the exercise hasn't changed, collapse it (true toggle).
    // If the exercise has changed, redraw with the new exercise instead of hiding.
    if (canvas && canvas.style.display !== 'none') {
      if (canvas.dataset.exercise === exerciseName) {
        canvas.style.display = 'none';
        return;
      }
    }
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'holo-canvas';
      canvas.width = container.offsetWidth || 300;
      canvas.height = container.offsetHeight || 200;
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10';
      container.style.position = 'relative';
      container.appendChild(canvas);
    }
    canvas.style.display = 'block';
    canvas.width = container.offsetWidth || 300;
    canvas.height = container.offsetHeight || 200;
    canvas.dataset.exercise = exerciseName || '';
    drawKineticHologram(canvas, exerciseName);
  }

  return {
    draw: drawKineticHologram,
    toggle: toggle,
    findMapping: findMapping
  };

})();
