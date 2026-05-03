// ═══════════════════════════════════════════════════════════════
// HOLOGRAM-RENDERER.JS — BBF Biomechanical Hologram Overlay
// Sovereign Gold Standard — HTML5 Canvas Kinetic Visualization
// ═══════════════════════════════════════════════════════════════

var BBF_HOLOGRAM = (function() {
  'use strict';

  // Page-load sentinel so live-fire tests can prove this file
  // actually parsed + executed (Phase 13 / B3-3 Option B). If
  // the next button click logs [KFH-BTN] CLICK but no [BBF_HOLOGRAM]
  // toggle, the load order is wrong; if neither logs, the click
  // intercept itself didn't fire.
  console.log('%c[BBF_HOLOGRAM] module loaded · Phase 13 / B3-3 Option B per-card V3 path active',
              'color:#f5c800;font-weight:bold');

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

  // ═══════════════════════════════════════════════════════════════
  // PHASE 13 / B3-3 · OPTION B · 3D Kinetic Hologram per-card path
  //
  // Hand-picked Blueprint ids drop the WebGL YBot rig into the
  // exercise card's existing holo-N viewport instead of the V1 2D
  // Sentinel canvas. The page-level #kfh-3d-stage canvas is the
  // single rendering surface — re-parented into the active card on
  // engage, moved back to its #kfh-3d-canvas-home div on retreat.
  //
  // ID resolution intentionally goes through BBF_KFH_CATALOG so
  // any case / alias variant of the user-facing name ("Lat Pulldown",
  // "lat pulldowns", "Cable Pulldown", etc.) maps to the canonical
  // snake_case Blueprint id ('lat_pulldowns') before the strict
  // allow-list check.
  //
  // Every gate logs through `[BBF_HOLOGRAM]` so the next live-fire
  // test surfaces exactly which check passes or fails.
  //
  // Constraints (B3-3 Option B mandatory):
  //   · Trilingual DOM overlay  → engage paints exercise title in en/es/pt.
  //   · WebGL Context Disposal → retreat calls renderer.dispose().
  // ═══════════════════════════════════════════════════════════════
  var KFH_3D_PILOT_IDS = { 'lat_pulldowns': true };
  var _v3ActiveContainerId = null;
  var _v3CanvasHomeId      = 'kfh-3d-canvas-home';
  var _v3InitInFlight      = false;

  function _resolve3DEntry(exerciseName) {
    if (typeof BBF_KFH_CATALOG === 'undefined' || !BBF_KFH_CATALOG.getExercise) {
      console.log('[BBF_HOLOGRAM] BBF_KFH_CATALOG unavailable — V3 gate falls through to V1');
      return null;
    }
    var entry = BBF_KFH_CATALOG.getExercise(exerciseName);
    if (!entry) {
      console.log('[BBF_HOLOGRAM] no catalog entry for "' + exerciseName + '" — V1 path');
      return null;
    }
    if (!entry.id) {
      console.log('[BBF_HOLOGRAM] entry has no id (legacy/static catalog row) — V1 path');
      return null;
    }
    if (!KFH_3D_PILOT_IDS[entry.id]) {
      console.log('[BBF_HOLOGRAM] entry.id "' + entry.id + '" not in 3D pilot allow-list — V1 path');
      return null;
    }
    if (!entry.animation) {
      console.warn('[BBF_HOLOGRAM] piloted entry "' + entry.id + '" has no animation block — V1 path');
      return null;
    }
    console.log('%c[BBF_HOLOGRAM] V3 piloted entry resolved · id=' + entry.id,
                'color:#f5c800;font-weight:bold');
    return entry;
  }

  function _v3CanvasHome() {
    return document.getElementById(_v3CanvasHomeId)
      || document.querySelector('.kfh-stage')
      || document.body;
  }

  function _pickLang() {
    return getLang ? getLang() : 'en';
  }

  function _attachOverlay(container, entry) {
    // Trilingual DOM overlay — title pulled from the transpiled
    // entry's i18n.title block (en/es/pt). Sits above the canvas
    // in the same containing div so it scrolls + resizes with it.
    var lang = _pickLang();
    var titleI18n = (entry.i18n && entry.i18n.title) || {};
    var title = titleI18n[lang] || titleI18n.en || entry.title || '';
    var subI18n = (entry.i18n && entry.i18n.subtitle) || {};
    var sub = subI18n[lang] || subI18n.en || entry.subtitle || '';

    var overlay = container.querySelector('.kfh-3d-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'kfh-3d-overlay';
      overlay.style.cssText = [
        'position:absolute', 'left:8px', 'top:6px', 'right:8px',
        'pointer-events:none', 'z-index:11',
        'font-family:"Bebas Neue","Barlow Condensed",sans-serif',
        'color:#f5c800',
        'text-shadow:0 0 6px rgba(245,200,0,.5)'
      ].join(';');
      container.appendChild(overlay);
    }
    overlay.innerHTML =
      '<div style="font-size:.7rem;font-weight:700;letter-spacing:2px;text-transform:uppercase">' +
        (title || '').replace(/[<>]/g, '') +
      '</div>' +
      '<div style="font-size:.55rem;font-weight:600;letter-spacing:1.5px;color:rgba(245,200,0,.7);margin-top:2px">' +
        (sub || '').replace(/[<>]/g, '') +
      '</div>' +
      '<div data-i18n-langtag style="position:absolute;right:0;top:0;font-size:.5rem;letter-spacing:2px;color:rgba(106,13,173,.85)">' +
        lang.toUpperCase() +
      '</div>';
  }

  function _detachOverlay(container) {
    if (!container) return;
    var overlay = container.querySelector('.kfh-3d-overlay');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function _retreat3D(reason) {
    console.log('[BBF_HOLOGRAM] V3 retreat · reason=' + (reason || 'user-toggle'));
    var canvas = document.getElementById('kfh-3d-stage');
    var activeContainer = _v3ActiveContainerId
      ? document.getElementById(_v3ActiveContainerId)
      : null;

    if (window.BBF_KFH_3D_RENDERER) {
      var R = window.BBF_KFH_3D_RENDERER;
      try { if (R.stopAnimation) R.stopAnimation(); } catch (e) {}
      // Mandatory: WebGL Context Disposal on modal close.
      try { if (R.dispose) R.dispose(); } catch (e) {
        console.warn('[BBF_HOLOGRAM] dispose threw:', e && e.message);
      }
    }
    // dispose() severed the WebGL context — drop the canvas DOM
    // element entirely; a future engage will re-create it inside
    // the target card before re-init.
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);

    if (activeContainer) _detachOverlay(activeContainer);
    _v3ActiveContainerId = null;
    _v3InitInFlight = false;
  }

  function _ensureCanvasInCard(container) {
    // Each engage stands up a fresh canvas inside the active card.
    // The previous engage's renderer was disposed on retreat, which
    // killed its WebGL context — so we never reuse the prior canvas.
    var existing = document.getElementById('kfh-3d-stage');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var canvas = document.createElement('canvas');
    canvas.id = 'kfh-3d-stage';
    var w = container.offsetWidth  || 300;
    var h = container.offsetHeight || 180;
    canvas.width  = w;
    canvas.height = h;
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:10';
    container.style.position = 'relative';
    container.appendChild(canvas);
    return canvas;
  }

  function _engage3DInCard(container, entry) {
    if (!container) {
      console.warn('[BBF_HOLOGRAM] _engage3DInCard: no container');
      return false;
    }
    if (!window.BBF_KFH_3D_RENDERER) {
      console.warn('[BBF_HOLOGRAM] BBF_KFH_3D_RENDERER unavailable — V3 module not loaded');
      return false;
    }
    var R = window.BBF_KFH_3D_RENDERER;

    // Hide any V1 Sentinel canvas left in this card so they don't stack.
    var v2 = container.querySelector('.holo-canvas');
    if (v2) v2.style.display = 'none';

    var canvas = _ensureCanvasInCard(container);

    if (_v3InitInFlight) {
      console.log('[BBF_HOLOGRAM] V3 init already in flight — ignoring duplicate engage');
      return true;
    }
    _v3InitInFlight = true;

    // Trilingual overlay first — gives the user immediate feedback.
    _attachOverlay(container, entry);

    console.log('%c[BBF_HOLOGRAM] V3 engaging · ' + entry.id + ' in ' + container.id +
                ' (' + canvas.width + 'x' + canvas.height + ')',
                'color:#f5c800;font-weight:bold');

    R.init(canvas)
      .then(function () {
        _v3InitInFlight = false;
        _v3ActiveContainerId = container.id;
        if (R.resize) R.resize(canvas.width, canvas.height);
        var ok = false;
        try {
          ok = R.startAnimation(entry.animation, 'ok', {
            onFallback: function () { _retreat3D('low-fps'); }
          });
        } catch (e) {
          console.warn('[BBF_HOLOGRAM] V3 startAnimation threw:', e && e.message);
          ok = false;
        }
        if (!ok) {
          console.warn('[BBF_HOLOGRAM] V3 startAnimation returned false — retreating');
          _retreat3D('start-failed');
          return;
        }
        if (R.show) R.show();
        window.BBF_KFH_3D_READY = true;
        console.log('%c[BBF_HOLOGRAM] V3 animation running · ' + entry.id,
                    'color:#22C55E;font-weight:bold');
      })
      .catch(function (err) {
        _v3InitInFlight = false;
        console.warn('[BBF_HOLOGRAM] V3 init failed — Sentinel SVG fallback:', err && err.message);
        window.BBF_KFH_3D_READY = false;
        _retreat3D('init-failed');
        // Fall back to V1 2D so the user still sees something.
        _drawV1Sentinel(container, entry.id);
      });

    return true;
  }

  function _drawV1Sentinel(container, exerciseName) {
    var canvas = container.querySelector('.holo-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'holo-canvas';
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10';
      container.style.position = 'relative';
      container.appendChild(canvas);
    }
    canvas.style.display = 'block';
    canvas.width  = container.offsetWidth  || 300;
    canvas.height = container.offsetHeight || 200;
    canvas.dataset.exercise = exerciseName || '';
    drawKineticHologram(canvas, exerciseName);
  }

  function toggle(containerId, exerciseName) {
    console.log('[BBF_HOLOGRAM] toggle · container=' + containerId +
                ' · exercise=' + JSON.stringify(exerciseName));
    var container = document.getElementById(containerId);
    if (!container) {
      console.warn('[BBF_HOLOGRAM] container not found:', containerId);
      return;
    }

    var pilotEntry = _resolve3DEntry(exerciseName);

    // ── 3D piloted path ────────────────────────────────────
    if (pilotEntry) {
      // Same card already engaged → toggle off.
      if (_v3ActiveContainerId === containerId) {
        _retreat3D('user-toggle');
        return;
      }
      // Different card was engaged → tear down before re-engaging here.
      if (_v3ActiveContainerId) _retreat3D('switch-card');
      _engage3DInCard(container, pilotEntry);
      return;
    }

    // ── V1 2D Sentinel path · everything else ─────────────
    var canvas = container.querySelector('.holo-canvas');
    if (canvas && canvas.style.display !== 'none') {
      if (canvas.dataset.exercise === exerciseName) {
        canvas.style.display = 'none';
        return;
      }
    }
    _drawV1Sentinel(container, exerciseName);
  }

  // ═══════════════════════════════════════════════════════════════
  // TITAN BUILD 3 — PHANTOM EYE VISION PIPELINE
  // Asynchronous video check-in + coach critique renderer. Ties to
  // BBF_AUDITOR's dominant_axial_lift to auto-cue the prescribed
  // pre-hab protocol. Preserves the existing Canvas overlay exports
  // (draw, toggle, findMapping) — this is additive.
  // ═══════════════════════════════════════════════════════════════

  // Pre-Hab video prescription map — mirrors BBF_AUDITOR's mobility
  // prescriptions. Each entry names the protocol the user should film
  // themselves executing (so the coach can critique their form).
  var PREHAB_VIDEO_MAP = {
    squat: {
      lift: 'squat',
      rx_key: 'pe-rx-squat',
      en: 'Lumbar Decompression Protocol — Cat-Cow x10, Child\'s Pose 60s, Hip Flexor 30s/side',
      es: 'Protocolo de Descompresi\u00f3n Lumbar — Gato-Vaca x10, Postura del Ni\u00f1o 60s, Flexor de Cadera 30s/lado',
      pt: 'Protocolo de Descompress\u00e3o Lombar — Gato-Vaca x10, Postura da Crian\u00e7a 60s, Flexor do Quadril 30s/lado'
    },
    deadlift: {
      lift: 'deadlift',
      rx_key: 'pe-rx-deadlift',
      en: 'Thoracic Extension & Posterior Chain Reset — Foam Roll T-spine, Hamstring Floss 45s/side, Glute Bridge x15',
      es: 'Extensi\u00f3n Tor\u00e1cica y Reset de Cadena Posterior — Rodillo T-spine, Isquios Floss 45s/lado, Puente de Gl\u00fateos x15',
      pt: 'Extens\u00e3o Tor\u00e1cica e Reset de Cadeia Posterior — Foam Roll Tor\u00e1cica, Isquios Floss 45s/lado, Ponte de Gl\u00fateos x15'
    },
    ohp: {
      lift: 'ohp',
      rx_key: 'pe-rx-ohp',
      en: 'Rotator Cuff Reset & Thoracic Mobility — Wall Slides x12, Band Pull-Aparts x15, External Rotation 2×10/side',
      es: 'Reset del Manguito Rotador y Movilidad Tor\u00e1cica — Wall Slides x12, Band Pull-Aparts x15, Rotaci\u00f3n Externa 2x10/lado',
      pt: 'Reset do Manguito Rotador e Mobilidade Tor\u00e1cica — Wall Slides x12, Band Pull-Aparts x15, Rota\u00e7\u00e3o Externa 2x10/lado'
    },
    mixed: {
      lift: 'mixed',
      rx_key: 'pe-rx-mixed',
      en: 'General Mobility Flow — 6-minute full-body reset across hips, t-spine, and shoulders',
      es: 'Flujo de Movilidad General — reset completo de 6 minutos: caderas, t-spine y hombros',
      pt: 'Fluxo de Mobilidade Geral — reset completo de 6 minutos: quadris, t-spine e ombros'
    }
  };

  // Review-status colour tokens. Gold pulse for pending, sovereign
  // purple solid glow + checkmark for cleared, red for needs-revision.
  var VISION_STATE_CLASSES = {
    idle:          '',
    pending:       'is-pending',
    cleared:       'is-cleared',
    needs_revision:'is-revision'
  };

  function _visionReadProfile(uid) {
    var profile = {};
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u && d.u[uid]) profile = d.u[uid];
    } catch(_) {}
    return profile;
  }

  function _visionDominantRx(profile) {
    var lift = profile.dominant_axial_lift || 'mixed';
    return PREHAB_VIDEO_MAP[lift] || PREHAB_VIDEO_MAP.mixed;
  }

  function _paintViewport(state) {
    var wrap = document.getElementById('phantom-eye');
    if (!wrap) return;
    // Clear all state classes then add the active one.
    Object.keys(VISION_STATE_CLASSES).forEach(function(k){
      if (VISION_STATE_CLASSES[k]) wrap.classList.remove(VISION_STATE_CLASSES[k]);
    });
    var cls = VISION_STATE_CLASSES[state.review_status] || '';
    if (cls) wrap.classList.add(cls);
    wrap.style.display = 'block';

    var badge   = document.getElementById('pe-status-badge');
    var video   = document.getElementById('pe-video');
    var empty   = document.getElementById('pe-empty');
    var timeline= document.getElementById('pe-timeline');
    var pinBtn  = document.getElementById('pe-pin-btn');
    var rxLabel = document.getElementById('pe-empty-rx');

    // Badge copy: map review_status to human label via _t() if available.
    if (badge) {
      var bkey = 'pe-badge-' + (state.review_status || 'idle');
      badge.textContent = (typeof _t === 'function')
        ? _t(bkey, state.review_status || 'Idle')
        : (state.review_status || 'Idle');
    }

    if (state.video_url) {
      if (video) {
        if (video.src !== state.video_url) video.src = state.video_url;
        video.style.display = 'block';
      }
      if (empty)    empty.style.display    = 'none';
      if (timeline) timeline.style.display = 'block';
      if (pinBtn)   pinBtn.style.display   = 'inline-block';
    } else {
      if (video)    video.style.display    = 'none';
      if (empty)    empty.style.display    = 'flex';
      if (timeline) timeline.style.display = 'none';
      if (pinBtn)   pinBtn.style.display   = 'none';
      // Paint the Rx title when no video has been uploaded yet.
      if (rxLabel && state.rx) {
        var lang = getLang();
        rxLabel.textContent = state.rx[lang] || state.rx.en;
      }
    }

    // Render pins.
    _renderPins(state.pins || []);
  }

  function _renderPins(pins) {
    var pinsWrap = document.getElementById('pe-pins');
    var video    = document.getElementById('pe-video');
    if (!pinsWrap) return;
    pinsWrap.innerHTML = '';
    if (!pins.length || !video) return;
    var duration = video.duration || 1;
    if (!isFinite(duration) || duration <= 0) {
      // Duration may not be available until metadata loads; re-run then.
      video.addEventListener('loadedmetadata', function handler(){
        video.removeEventListener('loadedmetadata', handler);
        _renderPins(pins);
      });
      return;
    }
    pins.forEach(function(pin){
      if (pin.timestamp_sec == null) return;
      var pct = Math.max(0, Math.min(100, (pin.timestamp_sec / duration) * 100));
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'pe-pin';
      el.style.left = pct + '%';
      el.title = pin.note || '';
      el.setAttribute('data-ts', String(pin.timestamp_sec));
      el.addEventListener('click', function(){
        try { video.currentTime = pin.timestamp_sec; } catch(_) {}
        _showCritique(pin);
      });
      pinsWrap.appendChild(el);
    });
  }

  function _showCritique(pin) {
    var box = document.getElementById('pe-critique');
    if (!box) return;
    var lang = getLang();
    var note = (pin && (pin['note_' + lang] || pin.note_en || pin.note)) || '';
    if (!note) return;
    box.textContent = note;
    box.classList.add('on');
    clearTimeout(_showCritique._to);
    _showCritique._to = setTimeout(function(){ box.classList.remove('on'); }, 5500);
  }

  function _persistVisionState(uid, state) {
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{"u":{},"l":{},"w":{}}');
      if (!d.u) d.u = {};
      if (!d.u[uid]) d.u[uid] = {};
      d.u[uid].last_video_check_status      = state.review_status || 'idle';
      d.u[uid].last_video_check_uploaded_at = state.uploaded_at   || null;
      d.u[uid].last_video_check_exercise    = state.exercise_name || null;
      d.u[uid].video_critique_pins          = state.pins || [];
      d.u[uid].last_video_check_rx_lift     = state.rx ? state.rx.lift : null;
      localStorage.setItem('bbf_v7', JSON.stringify(d));
    } catch(_) {}
    if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.patchUserFields) {
      BBF_SYNC.patchUserFields(uid, {
        last_video_check_status:      state.review_status || 'idle',
        last_video_check_uploaded_at: state.uploaded_at   || null,
        last_video_check_exercise:    state.exercise_name || null,
        video_critique_pins:          state.pins || [],
        last_video_check_rx_lift:     state.rx ? state.rx.lift : null
      }).catch(function(){});
    }
  }

  // Session-scoped state. The video blob URL can't survive a reload
  // (object URLs are tab-local), but pins + review_status + Rx
  // binding all persist via bbf_users.
  var _vision = {
    uid:           null,
    video_url:     null,
    exercise_name: null,
    uploaded_at:   null,
    review_status: 'idle',
    reviewer_id:   null,
    reviewed_at:   null,
    pins:          [],
    rx:            null
  };

  async function initializeVision(userId) {
    _vision.uid = userId || null;
    if (!userId) { _paintViewport(_vision); return _vision; }

    var profile = _visionReadProfile(userId);
    _vision.review_status = profile.last_video_check_status   || 'idle';
    _vision.uploaded_at   = profile.last_video_check_uploaded_at || null;
    _vision.exercise_name = profile.last_video_check_exercise || null;
    _vision.pins          = Array.isArray(profile.video_critique_pins) ? profile.video_critique_pins : [];
    _vision.rx            = _visionDominantRx(profile);

    // Surface cloud-side metadata too, so a refreshed token picks up
    // the latest review status from a coach's workstation.
    try {
      if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.fetchUserProfile) {
        var cloud = await BBF_SYNC.fetchUserProfile(userId);
        if (cloud) {
          if (cloud.last_video_check_status) _vision.review_status = cloud.last_video_check_status;
          if (cloud.last_video_check_uploaded_at) _vision.uploaded_at = cloud.last_video_check_uploaded_at;
          if (cloud.last_video_check_exercise) _vision.exercise_name = cloud.last_video_check_exercise;
          if (Array.isArray(cloud.video_critique_pins)) _vision.pins = cloud.video_critique_pins;
        }
      }
    } catch(_) {}

    _paintViewport(_vision);
    return _vision;
  }

  function uploadVideo(file, meta) {
    if (!file || !file.type || file.type.indexOf('video/') !== 0) return null;
    // Revoke the prior object URL so we don't leak blobs as the user
    // iterates on check-in clips.
    if (_vision.video_url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(_vision.video_url); } catch(_) {}
    }
    _vision.video_url     = URL.createObjectURL(file);
    _vision.uploaded_at   = new Date().toISOString();
    _vision.review_status = 'pending';
    _vision.exercise_name = (meta && meta.exercise_name) ||
                             (_vision.rx && _vision.rx.lift) || null;
    _vision.pins          = [];
    _paintViewport(_vision);
    if (_vision.uid) _persistVisionState(_vision.uid, _vision);
    return _vision;
  }

  function pinCritique(timestampSec, note) {
    if (timestampSec == null || !note) return _vision.pins;
    var pin = {
      timestamp_sec: Math.max(0, parseFloat(timestampSec) || 0),
      note:          String(note),
      note_en:       String(note),
      author_id:     (typeof CU !== 'undefined') ? CU : null,
      created_at:    new Date().toISOString()
    };
    _vision.pins = (_vision.pins || []).concat([pin]);
    _renderPins(_vision.pins);
    if (_vision.uid) _persistVisionState(_vision.uid, _vision);
    return _vision.pins;
  }

  function markReviewed(status, reviewerId) {
    var valid = { cleared:1, needs_revision:1, pending:1 };
    if (!valid[status]) status = 'cleared';
    _vision.review_status = status;
    _vision.reviewer_id   = reviewerId || (typeof CU !== 'undefined' ? CU : null);
    _vision.reviewed_at   = new Date().toISOString();
    _paintViewport(_vision);
    if (_vision.uid) _persistVisionState(_vision.uid, _vision);
    return _vision;
  }

  function getVisionState() {
    return Object.assign({}, _vision, { pins: (_vision.pins || []).slice() });
  }

  return {
    /* Legacy Canvas-overlay exports — preserved untouched. */
    draw:        drawKineticHologram,
    toggle:      toggle,
    findMapping: findMapping,
    /* Titan 3 Phantom Eye exports. */
    initializeVision: initializeVision,
    uploadVideo:      uploadVideo,
    pinCritique:      pinCritique,
    markReviewed:     markReviewed,
    getVisionState:   getVisionState,
    PREHAB_VIDEO_MAP: PREHAB_VIDEO_MAP
  };

})();
