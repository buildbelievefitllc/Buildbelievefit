// ═══════════════════════════════════════════════════════════════
// KFH-ANIMATOR.JS — BBF Kinematic Form HUD Render Engine
// Sovereign Gold Standard — Phase 12 Full Articulation
//
// Drives the Bio-Render pane through a smooth, looping rep cycle by
// interpolating sparse-keyframed joint coordinates with rAF. Reads
// the animation contract emitted by kfh-transpiler.js (and stored
// on each Blueprint-derived exercise's `animation` block).
//
// Owns:
//   - per-joint timeline construction (sparse keyframes → dense lookup)
//   - phase-aware easing
//   - per-frame DOM updates for joints, bones, and joint-attached
//     equipment (bar/dumbbell/cable/stability_ball etc.)
//   - prefers-reduced-motion freeze at the loaded-stretch frame
//   - OK ↔ WARN sparse override merging (fault-pattern animations)
//
// Exposes BBF_KFH_ANIMATOR = { start, stop, setMode }.
// ═══════════════════════════════════════════════════════════════

var BBF_KFH_ANIMATOR = (function () {
  'use strict';

  var W = 320, H = 200;            // SVG viewBox dimensions
  var REDUCED_FREEZE_T = 0.40;     // freeze at the eccentric/loaded-stretch frame

  // ─── EASING TABLE ────────────────────────────────────────
  var EASING = {
    'linear':       function (t) { return t; },
    'ease-in':      function (t) { return t * t; },
    'ease-out':     function (t) { return 1 - (1 - t) * (1 - t); },
    'ease-in-out':  function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  };
  function ease(name, t) { return (EASING[name] || EASING.linear)(t); }

  // ─── ACTIVE STATE ────────────────────────────────────────
  var _stage     = null;
  var _anim      = null;
  var _mode      = 'ok';
  var _rafId     = null;
  var _startTs   = 0;
  var _frozen    = false;
  var _timelines = null;     // { jointKey: [ {t, x, y}, ... ] sorted by t }

  // ─── TIMELINE BUILDER ────────────────────────────────────
  // Walks every keyframe and builds a per-joint timeline. WARN-mode
  // sparse overrides land on top of OK keyframes, replacing matching
  // (t) entries or inserting new ones.
  function _buildTimelines(animation, mode) {
    var timelines = {};
    var keyframes = animation.keyframes || [];
    keyframes.forEach(function (kf) {
      var joints = kf.joints || {};
      Object.keys(joints).forEach(function (jk) {
        if (!timelines[jk]) timelines[jk] = [];
        timelines[jk].push({ t: kf.t, x: joints[jk].x, y: joints[jk].y });
      });
    });

    var override = (mode === 'warn' && animation.forms && animation.forms.warn && animation.forms.warn.keyframesOverride) || [];
    override.forEach(function (kf) {
      var joints = kf.joints || {};
      Object.keys(joints).forEach(function (jk) {
        if (!timelines[jk]) timelines[jk] = [];
        var hit = null;
        for (var i = 0; i < timelines[jk].length; i++) {
          if (Math.abs(timelines[jk][i].t - kf.t) < 0.001) { hit = timelines[jk][i]; break; }
        }
        if (hit) {
          hit.x = joints[jk].x;
          hit.y = joints[jk].y;
        } else {
          timelines[jk].push({ t: kf.t, x: joints[jk].x, y: joints[jk].y });
        }
      });
    });

    Object.keys(timelines).forEach(function (jk) {
      timelines[jk].sort(function (a, b) { return a.t - b.t; });
    });
    return timelines;
  }

  // ─── PHASE LOOKUP ────────────────────────────────────────
  function _findPhase(animation, t) {
    var phases = animation.phases || [];
    var pct = t * 100;
    for (var i = 0; i < phases.length; i++) {
      var p = phases[i];
      if (pct >= p.start_pct && pct <= p.end_pct) return p;
    }
    return phases[0] || { easing: 'linear' };
  }

  // ─── JOINT INTERPOLATION ─────────────────────────────────
  // Find the bracketing pair of keyframes for the current t and lerp.
  function _interpJoint(timeline, t, easingName) {
    if (!timeline || !timeline.length) return null;
    if (timeline.length === 1) return { x: timeline[0].x, y: timeline[0].y };
    if (t <= timeline[0].t) return { x: timeline[0].x, y: timeline[0].y };
    var last = timeline[timeline.length - 1];
    if (t >= last.t) return { x: last.x, y: last.y };

    var prev = timeline[0], next = timeline[1];
    for (var i = 0; i < timeline.length - 1; i++) {
      if (timeline[i].t <= t && timeline[i + 1].t >= t) {
        prev = timeline[i];
        next = timeline[i + 1];
        break;
      }
    }
    var span = next.t - prev.t;
    var raw = span > 0 ? (t - prev.t) / span : 0;
    var f = ease(easingName, raw);
    return { x: prev.x + (next.x - prev.x) * f, y: prev.y + (next.y - prev.y) * f };
  }

  // ─── DOM UPDATERS ────────────────────────────────────────
  function _setAttr(node, name, value) {
    if (node) node.setAttribute(name, value);
  }

  function _updateJoints(t, easingName) {
    Object.keys(_timelines).forEach(function (jk) {
      var pos = _interpJoint(_timelines[jk], t, easingName);
      if (!pos) return;
      var node = _stage.querySelector('[data-bp-joint="' + jk + '"]');
      if (!node) return;
      _setAttr(node, 'cx', (pos.x * W).toFixed(2));
      _setAttr(node, 'cy', (pos.y * H).toFixed(2));
    });
    // Halo follows its target joint
    var halo = _stage.querySelector('[data-bp-halo]');
    if (halo) {
      var jk = halo.getAttribute('data-bp-halo');
      var pos = _interpJoint(_timelines[jk], t, easingName);
      if (pos) {
        _setAttr(halo, 'cx', (pos.x * W).toFixed(2));
        _setAttr(halo, 'cy', (pos.y * H).toFixed(2));
      }
    }
  }

  function _updateBones(t, easingName) {
    var bones = _anim.bones || [];
    for (var bi = 0; bi < bones.length; bi++) {
      var node = _stage.querySelector('[data-bp-bone="' + bi + '"]');
      if (!node) continue;
      var pair = bones[bi];
      var p1 = _interpJoint(_timelines[pair[0]], t, easingName);
      var p2 = _interpJoint(_timelines[pair[1]], t, easingName);
      if (!p1 || !p2) continue;
      _setAttr(node, 'x1', (p1.x * W).toFixed(2));
      _setAttr(node, 'y1', (p1.y * H).toFixed(2));
      _setAttr(node, 'x2', (p2.x * W).toFixed(2));
      _setAttr(node, 'y2', (p2.y * H).toFixed(2));
    }
  }

  function _updateEquipment(t, easingName) {
    var eqs = _anim.equipment || [];
    for (var ei = 0; ei < eqs.length; ei++) {
      var eq = eqs[ei];
      if (!eq.attach || !eq.attach.length) continue;
      var node = _stage.querySelector('[data-bp-equip="' + ei + '"]');
      if (!node) continue;

      // Two-attach equipment (bar/trap_bar) → line endpoints + plates at midpoint
      if (eq.attach.length === 2 && (node.tagName.toLowerCase() === 'line')) {
        var a = _interpJoint(_timelines[eq.attach[0]], t, easingName);
        var b = _interpJoint(_timelines[eq.attach[1]], t, easingName);
        if (!a || !b) continue;
        _setAttr(node, 'x1', (a.x * W).toFixed(2));
        _setAttr(node, 'y1', (a.y * H).toFixed(2));
        _setAttr(node, 'x2', (b.x * W).toFixed(2));
        _setAttr(node, 'y2', (b.y * H).toFixed(2));
        var plates = _stage.querySelectorAll('[data-bp-plate="' + ei + '"]');
        if (plates && plates.length) {
          var cx = ((a.x + b.x) / 2 * W).toFixed(2);
          var cy = ((a.y + b.y) / 2 * H).toFixed(2);
          for (var p = 0; p < plates.length; p++) {
            _setAttr(plates[p], 'cx', cx);
            _setAttr(plates[p], 'cy', cy);
          }
        }
        continue;
      }

      // Single-attach (dumbbell/kettlebell circle, cable line tail)
      if (eq.attach.length >= 1) {
        var pos = _interpJoint(_timelines[eq.attach[0]], t, easingName);
        if (!pos) continue;
        if (node.tagName.toLowerCase() === 'circle') {
          _setAttr(node, 'cx', (pos.x * W).toFixed(2));
          _setAttr(node, 'cy', (pos.y * H).toFixed(2));
        } else if (node.tagName.toLowerCase() === 'line') {
          // Cable column: x2/y2 follow the wrist; x1/y1 are the static anchor (untouched).
          _setAttr(node, 'x2', (pos.x * W).toFixed(2));
          _setAttr(node, 'y2', (pos.y * H).toFixed(2));
        }
        // Stability ball: average all attach joints for the ball center
        if (node.tagName.toLowerCase() === 'circle' && eq.attach.length > 1) {
          var sumX = 0, sumY = 0, n = 0;
          for (var k = 0; k < eq.attach.length; k++) {
            var jp = _interpJoint(_timelines[eq.attach[k]], t, easingName);
            if (jp) { sumX += jp.x; sumY += jp.y; n++; }
          }
          if (n > 0) {
            _setAttr(node, 'cx', (sumX / n * W).toFixed(2));
            _setAttr(node, 'cy', (sumY / n * H).toFixed(2));
          }
        }
      }
    }
  }

  // ─── RAF FRAME ───────────────────────────────────────────
  function _frame(now) {
    if (!_anim || !_stage) { _rafId = null; return; }

    var elapsed = now - _startTs;
    var dur = _anim.duration_ms || 2400;
    var t = (elapsed % dur) / dur;
    if (_frozen) t = REDUCED_FREEZE_T;

    var phase = _findPhase(_anim, t);
    var easingName = phase.easing || 'linear';

    _updateJoints(t, easingName);
    _updateBones(t, easingName);
    _updateEquipment(t, easingName);

    if (typeof requestAnimationFrame !== 'undefined') {
      _rafId = requestAnimationFrame(_frame);
    } else {
      _rafId = null;
    }
  }

  // ─── PUBLIC API ──────────────────────────────────────────
  function start(stageEl, animation, mode) {
    stop();
    if (!stageEl || !animation) return null;
    _stage   = stageEl;
    _anim    = animation;
    _mode    = mode || 'ok';
    _timelines = _buildTimelines(animation, _mode);

    var perfNow = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    _startTs = perfNow;

    _frozen = false;
    if (typeof matchMedia === 'function') {
      try { _frozen = matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch (e) { _frozen = false; }
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      _rafId = requestAnimationFrame(_frame);
    }
    return { stop: stop, setMode: setMode };
  }

  function setMode(mode) {
    if (!_anim) return;
    _mode = mode || 'ok';
    _timelines = _buildTimelines(_anim, _mode);
  }

  function stop() {
    if (_rafId != null && typeof cancelAnimationFrame !== 'undefined') {
      try { cancelAnimationFrame(_rafId); } catch (e) {}
    }
    _rafId     = null;
    _stage     = null;
    _anim      = null;
    _timelines = null;
  }

  return {
    start:   start,
    stop:    stop,
    setMode: setMode
  };

})();
