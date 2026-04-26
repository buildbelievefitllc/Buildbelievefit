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
