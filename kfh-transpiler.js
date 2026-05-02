// ═══════════════════════════════════════════════════════════════
// KFH-TRANSPILER.JS — BBF Blueprint v2 → Catalog Entry Compiler
// Sovereign Gold Standard — Phase 12 Full Articulation
//
// Consumes a fully-populated Phase 12 Blueprint (joints / bones /
// equipment / kineticPath / forms / animation) and emits a catalog
// entry compatible with kfh-exercise-catalog.js. The entry's
// `svgMarkup` is the static skeleton (with addressable joint, bone,
// equipment, halo, and callout IDs). Its `animation` block carries
// the keyframes + phase contract for kfh-animator.js to drive.
//
// Translation policy (locked by War Room):
//   - Blueprint must arrive with all three languages populated
//     (en / es / pt). The Claude conversation handles the en → es+pt
//     drafting BEFORE this transpiler runs. The transpiler is purely
//     mechanical — it picks `en` for the flat catalog display fields
//     and stores the trilingual maps under entry.i18n for future
//     runtime language switching.
//
// Equipment vocab (V1):
//   bar | trap_bar | bench | rack | sled | pulley_arm | dumbbell |
//   kettlebell | machine_pad | plate_stack | cable_column |
//   stability_ball
//
// V1 limitation: kineticPath.perPhase is preserved on the entry but
// not yet morphed at phase boundaries. The animator renders only
// kineticPath.default. Path morphing lands in a follow-up sprint
// once we settle on a path-interpolation library or hand-rolled
// bezier diff approach.
// ═══════════════════════════════════════════════════════════════

var BBF_KFH_TRANSPILER = (function () {
  'use strict';

  var W = 320, H = 200;

  // ─── HELPERS ─────────────────────────────────────────────
  function pickLang(node, lang) {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (typeof node !== 'object') return String(node);
    return node[lang || 'en'] || node.en || '';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function num(n, dp) { return Number(n || 0).toFixed(dp == null ? 2 : dp); }

  function _initialPos(bp, jk) {
    var kf0 = (bp.animation && bp.animation.keyframes && bp.animation.keyframes[0]) || null;
    if (kf0 && kf0.joints && kf0.joints[jk]) return kf0.joints[jk];
    return { x: 0.5, y: 0.5 };
  }

  // Scale an SVG path 'd' attribute whose coordinates are 0..1 normalized.
  // Naive parser: alternating x/y for every numeric token. Author-controlled
  // input — sufficient for V1.
  function _scalePath(d) {
    if (!d) return '';
    var tokens = String(d).split(/[\s,]+/);
    var out = [], coordIdx = 0;
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (!tk) continue;
      if (/^[a-zA-Z]$/.test(tk)) { out.push(tk); continue; }
      var n = parseFloat(tk);
      if (isNaN(n)) { out.push(tk); continue; }
      var scaled = (coordIdx % 2 === 0) ? n * W : n * H;
      out.push(scaled.toFixed(2));
      coordIdx++;
    }
    return out.join(' ');
  }

  // ─── VALIDATION ──────────────────────────────────────────
  function validate(bp) {
    if (!bp || !bp.id) throw new Error('Blueprint missing id');
    if (!bp.animation) throw new Error('Blueprint missing animation block');
    if (!bp.jointSpec) throw new Error('Blueprint missing jointSpec');
    if (!bp.forms || !bp.forms.ok || !bp.forms.warn) {
      throw new Error('Blueprint missing forms.ok / forms.warn');
    }

    var phases = bp.animation.phases || [];
    var keyframes = bp.animation.keyframes || [];
    if (!phases.length) throw new Error('Blueprint animation.phases is empty');
    if (!keyframes.length) throw new Error('Blueprint animation.keyframes is empty');

    // Every phase must have a keyframe at its start_pct AND end_pct.
    phases.forEach(function (p) {
      var startT = p.start_pct / 100, endT = p.end_pct / 100;
      var hasStart = keyframes.some(function (kf) { return Math.abs(kf.t - startT) < 0.001; });
      var hasEnd   = keyframes.some(function (kf) { return Math.abs(kf.t - endT)   < 0.001; });
      if (!hasStart) throw new Error('Phase "' + p.id + '" missing keyframe at t=' + startT);
      if (!hasEnd)   throw new Error('Phase "' + p.id + '" missing keyframe at t=' + endT);
    });

    // First keyframe (t=0) must declare every joint so initial positions are known.
    var first = keyframes[0];
    var jointKeys = Object.keys(bp.jointSpec);
    if (!first || first.t !== 0) throw new Error('First keyframe must be at t=0');
    jointKeys.forEach(function (jk) {
      if (!first.joints || !first.joints[jk]) {
        throw new Error('Joint "' + jk + '" missing initial position at t=0');
      }
    });

    // Loop continuity: t=0 and t=1 joints (where both declared) must match.
    var last = keyframes[keyframes.length - 1];
    if (last && Math.abs(last.t - 1) < 0.001 && last.joints) {
      Object.keys(last.joints).forEach(function (jk) {
        var f = (first.joints || {})[jk];
        var l = last.joints[jk];
        if (f && l && (Math.abs(f.x - l.x) > 0.005 || Math.abs(f.y - l.y) > 0.005)) {
          throw new Error('Loop discontinuity at joint "' + jk + '": t=0 and t=1 differ');
        }
      });
    }

    // Bones must reference declared joints.
    (bp.bones || []).forEach(function (pair) {
      pair.forEach(function (jk) {
        if (jointKeys.indexOf(jk) === -1) {
          throw new Error('Bone references undeclared joint: ' + jk);
        }
      });
    });

    return true;
  }

  // ─── EQUIPMENT EMITTERS ──────────────────────────────────
  function _emitEquipment(parts, eq, ei, bp) {
    var t = eq.type || '';

    if (t === 'bar' || t === 'trap_bar') {
      var p1, p2;
      if (eq.attach && eq.attach.length === 2) {
        p1 = _initialPos(bp, eq.attach[0]);
        p2 = _initialPos(bp, eq.attach[1]);
      } else {
        p1 = { x: eq.x1 || 0.4, y: eq.y1 || 0.5 };
        p2 = { x: eq.x2 || 0.6, y: eq.y2 || 0.5 };
      }
      var midX = (p1.x + p2.x) / 2 * W;
      var midY = (p1.y + p2.y) / 2 * H;
      parts.push('<g>');
      parts.push(
        '<line class="kfh-wf kfh-wf-bar" data-bp-equip="' + ei + '" ' +
          'x1="' + num(p1.x * W) + '" y1="' + num(p1.y * H) + '" ' +
          'x2="' + num(p2.x * W) + '" y2="' + num(p2.y * H) + '"/>'
      );
      if (eq.plates) {
        parts.push('<circle class="kfh-wf-plate" data-bp-plate="' + ei + '" cx="' + num(midX) + '" cy="' + num(midY) + '" r="10"/>');
        parts.push('<circle class="kfh-wf-plate" data-bp-plate="' + ei + '" cx="' + num(midX) + '" cy="' + num(midY) + '" r="4"/>');
      }
      parts.push('</g>');
      return;
    }

    if (t === 'cable_column') {
      var ax = (eq.x != null ? eq.x : 0.05) * W;
      var topY = (eq.y_top != null ? eq.y_top : 0.10) * H;
      var botY = (eq.y_bottom != null ? eq.y_bottom : 0.92) * H;
      parts.push('<g class="kfh-wf kfh-wf-bench">');
      parts.push('<line x1="' + num(ax) + '" y1="' + num(topY) + '" x2="' + num(ax) + '" y2="' + num(botY) + '"/>');
      parts.push('<circle cx="' + num(ax) + '" cy="' + num(topY) + '" r="3" fill="none"/>');
      parts.push('</g>');
      if (eq.attach && eq.attach.length) {
        var wp = _initialPos(bp, eq.attach[0]);
        parts.push(
          '<line class="kfh-wf" data-bp-equip="' + ei + '" ' +
            'x1="' + num(ax) + '" y1="' + num(topY) + '" ' +
            'x2="' + num(wp.x * W) + '" y2="' + num(wp.y * H) + '"/>'
        );
      }
      return;
    }

    if (t === 'plate') {
      // Stacked weight plates anchored to attach joints (e.g. leg press
      // foot platform between the two ankles, or a single weight clamped
      // to one wrist). Sovereign-styled concentric discs — outer disc is
      // the platform / primary plate (data-bp-equip — animator updates
      // cx/cy each frame from the attach-joint midpoint), inner discs
      // are the loaded plate stack (data-bp-plate — animator updates
      // them via the shared plates loop). Reuses kfh-wf-plate styling.
      var pp1, pp2;
      if (eq.attach && eq.attach.length === 2) {
        pp1 = _initialPos(bp, eq.attach[0]);
        pp2 = _initialPos(bp, eq.attach[1]);
      } else if (eq.attach && eq.attach.length === 1) {
        pp1 = pp2 = _initialPos(bp, eq.attach[0]);
      } else {
        pp1 = pp2 = { x: eq.x != null ? eq.x : 0.5, y: eq.y != null ? eq.y : 0.5 };
      }
      var pmidX = (pp1.x + pp2.x) / 2 * W;
      var pmidY = (pp1.y + pp2.y) / 2 * H;
      var pOuterR = eq.radius != null ? (eq.radius * Math.min(W, H)) : 14;
      parts.push(
        '<circle class="kfh-wf-plate" data-bp-equip="' + ei + '" ' +
          'cx="' + num(pmidX) + '" cy="' + num(pmidY) + '" r="' + num(pOuterR, 1) + '"/>'
      );
      parts.push(
        '<circle class="kfh-wf-plate" data-bp-plate="' + ei + '" ' +
          'cx="' + num(pmidX) + '" cy="' + num(pmidY) + '" r="' + num(pOuterR * 0.65, 1) + '"/>'
      );
      parts.push(
        '<circle class="kfh-wf-plate" data-bp-plate="' + ei + '" ' +
          'cx="' + num(pmidX) + '" cy="' + num(pmidY) + '" r="' + num(pOuterR * 0.30, 1) + '"/>'
      );
      return;
    }

    if (t === 'stability_ball') {
      var radius = (eq.radius != null ? eq.radius : 0.10) * Math.min(W, H);
      var center;
      if (eq.attach && eq.attach.length) {
        var sX = 0, sY = 0;
        eq.attach.forEach(function (jk) {
          var p = _initialPos(bp, jk);
          sX += p.x; sY += p.y;
        });
        center = { x: sX / eq.attach.length, y: sY / eq.attach.length };
      } else {
        center = { x: eq.x != null ? eq.x : 0.5, y: eq.y != null ? eq.y : 0.7 };
      }
      parts.push(
        '<circle class="kfh-wf" data-bp-equip="' + ei + '" ' +
          'cx="' + num(center.x * W) + '" cy="' + num(center.y * H) + '" ' +
          'r="' + num(radius, 1) + '" fill="none"/>'
      );
      return;
    }

    if (t === 'bench' || t === 'machine_pad') {
      var bx = (eq.x1 != null ? eq.x1 : 0.25) * W;
      var by = (eq.y1 != null ? eq.y1 : 0.65) * H;
      var bw = ((eq.x2 != null ? eq.x2 : 0.78) - (eq.x1 != null ? eq.x1 : 0.25)) * W;
      var bh = ((eq.y2 != null ? eq.y2 : 0.70) - (eq.y1 != null ? eq.y1 : 0.65)) * H;
      parts.push('<rect class="kfh-wf kfh-wf-bench" x="' + num(bx, 1) + '" y="' + num(by, 1) + '" width="' + num(bw, 1) + '" height="' + num(bh, 1) + '" rx="2"/>');
      return;
    }

    if (t === 'rack') {
      var lx = (eq.x_left != null ? eq.x_left : 0.18) * W;
      var rx = (eq.x_right != null ? eq.x_right : 0.82) * W;
      var rTop = (eq.y_top != null ? eq.y_top : 0.20) * H;
      var rBot = (eq.y_bottom != null ? eq.y_bottom : 0.92) * H;
      parts.push('<g class="kfh-wf kfh-wf-bench">');
      parts.push('<line x1="' + num(lx) + '" y1="' + num(rTop) + '" x2="' + num(lx) + '" y2="' + num(rBot) + '"/>');
      parts.push('<line x1="' + num(rx) + '" y1="' + num(rTop) + '" x2="' + num(rx) + '" y2="' + num(rBot) + '"/>');
      parts.push('</g>');
      return;
    }

    if (t === 'dumbbell' || t === 'kettlebell') {
      if (eq.attach && eq.attach.length) {
        var dp = _initialPos(bp, eq.attach[0]);
        parts.push(
          '<circle class="kfh-wf-plate" data-bp-equip="' + ei + '" ' +
            'cx="' + num(dp.x * W) + '" cy="' + num(dp.y * H) + '" r="6"/>'
        );
      }
      return;
    }

    if (t === 'sled' || t === 'plate_stack' || t === 'pulley_arm') {
      // Generic boxy placeholder for V1 — a thin horizontal bar at y_anchor.
      var sx1 = (eq.x1 != null ? eq.x1 : 0.30) * W;
      var sx2 = (eq.x2 != null ? eq.x2 : 0.70) * W;
      var sy  = (eq.y  != null ? eq.y  : 0.55) * H;
      parts.push('<line class="kfh-wf kfh-wf-bench" x1="' + num(sx1) + '" y1="' + num(sy) + '" x2="' + num(sx2) + '" y2="' + num(sy) + '"/>');
      return;
    }
  }

  // ─── CALLOUT EMITTER ─────────────────────────────────────
  function _emitCallout(parts, co, mode, bp) {
    var fp = _initialPos(bp, co.from);
    var to = co.to || { x: 0.10, y: 0.80 };
    parts.push(
      '<line class="kfh-leader ' + mode + '" ' +
        'x1="' + num(fp.x * W) + '" y1="' + num(fp.y * H) + '" ' +
        'x2="' + num(to.x * W) + '" y2="' + num(to.y * H) + '"/>'
    );
    var lines = co.lines || [];
    for (var li = 0; li < lines.length; li++) {
      var txt = pickLang(lines[li], 'en');
      var lx = (to.x * W - 16);
      var ly = (to.y * H + 12 + li * 12);
      parts.push(
        '<text class="kfh-label-box ' + mode + '" x="' + num(lx, 1) + '" y="' + num(ly, 1) + '">' + esc(txt) + '</text>'
      );
    }
  }

  // ─── SVG SKELETON EMITTER ────────────────────────────────
  function _emitSVG(bp) {
    var parts = [];
    var jointSpec = bp.jointSpec || {};

    // Grid
    parts.push(
      '<g class="kfh-wf-grid">',
        '<line x1="28" y1="18" x2="28" y2="188"/>',
        '<line x1="292" y1="18" x2="292" y2="188"/>',
        '<line x1="28" y1="160" x2="292" y2="160"/>',
      '</g>'
    );

    // Ground reference
    if (bp.ground && bp.ground.y != null) {
      var gy = num(bp.ground.y * H, 1);
      parts.push('<line class="kfh-wf kfh-wf-bench" x1="28" y1="' + gy + '" x2="292" y2="' + gy + '"/>');
    }

    // Equipment
    (bp.equipment || []).forEach(function (eq, ei) {
      _emitEquipment(parts, eq, ei, bp);
    });

    // Bones (animator updates endpoints each frame)
    (bp.bones || []).forEach(function (pair, bi) {
      var p1 = _initialPos(bp, pair[0]);
      var p2 = _initialPos(bp, pair[1]);
      parts.push(
        '<line class="kfh-wf" data-bp-bone="' + bi + '" ' +
          'x1="' + num(p1.x * W) + '" y1="' + num(p1.y * H) + '" ' +
          'x2="' + num(p2.x * W) + '" y2="' + num(p2.y * H) + '"/>'
      );
    });

    // Kinetic path (default only — perPhase morphing is V2)
    if (bp.kineticPath && bp.kineticPath.default) {
      var kp = bp.kineticPath.default;
      var dpath = _scalePath(kp.d);
      parts.push('<path class="kfh-path-j" d="' + dpath + '"/>');
      (bp.kineticPath.endpoints || []).forEach(function (ep) {
        parts.push('<circle cx="' + num(ep.x * W) + '" cy="' + num(ep.y * H) + '" r="2.5" fill="#00E5FF"/>');
      });
      var kpLabel = pickLang(kp.label, 'en');
      if (kpLabel && bp.kineticPath.endpoints && bp.kineticPath.endpoints.length) {
        var mid = bp.kineticPath.endpoints[Math.floor(bp.kineticPath.endpoints.length / 2)];
        parts.push(
          '<text class="kfh-bar-label" x="' + num(mid.x * W + 6, 1) + '" y="' + num(mid.y * H, 1) + '">' + esc(kpLabel) + '</text>'
        );
      }
      (bp.kineticPath.labels || []).forEach(function (lb) {
        var t = pickLang(lb.text, 'en');
        parts.push(
          '<text class="kfh-bar-label" x="' + num(lb.x * W, 1) + '" y="' + num(lb.y * H, 1) + '">' + esc(t) + '</text>'
        );
      });
    }

    // Joints (animator updates cx/cy each frame)
    Object.keys(jointSpec).forEach(function (jk) {
      var spec = jointSpec[jk];
      var pos = _initialPos(bp, jk);
      var r = spec.r != null ? spec.r : 3.4;
      if (jk === 'head') {
        parts.push(
          '<circle class="kfh-wf" data-bp-joint="' + esc(jk) + '" fill="none" ' +
            'cx="' + num(pos.x * W) + '" cy="' + num(pos.y * H) + '" r="' + r + '"/>'
        );
        return;
      }
      var cls = spec.joint ? ('kfh-joint j-' + spec.joint) : 'kfh-joint';
      parts.push(
        '<circle class="' + cls + '" data-bp-joint="' + esc(jk) + '" ' +
          'cx="' + num(pos.x * W) + '" cy="' + num(pos.y * H) + '" r="' + r + '"/>'
      );
    });

    // Halo (anchored to forms.warn.haloAt, follows that joint at runtime)
    var haloAt = bp.forms.warn && bp.forms.warn.haloAt;
    if (haloAt && jointSpec[haloAt]) {
      var hp = _initialPos(bp, haloAt);
      parts.push(
        '<circle class="kfh-halo" data-bp-halo="' + esc(haloAt) + '" ' +
          'cx="' + num(hp.x * W) + '" cy="' + num(hp.y * H) + '" r="6"/>'
      );
    }

    // Callouts (preserve legacy id="kfh-callout-ok|warn" for KFH_SET_FORM toggle)
    parts.push('<g id="kfh-callout-ok">');
    ((bp.forms.ok && bp.forms.ok.callouts) || []).forEach(function (co) {
      _emitCallout(parts, co, 'ok', bp);
    });
    parts.push('</g>');
    parts.push('<g id="kfh-callout-warn" style="display:none">');
    ((bp.forms.warn && bp.forms.warn.callouts) || []).forEach(function (co) {
      _emitCallout(parts, co, 'warn', bp);
    });
    parts.push('</g>');

    return parts.join('');
  }

  // ─── METRIC + I18N FLATTENERS ────────────────────────────
  function _flatMetrics(metrics, lang) {
    metrics = metrics || {};
    return {
      dev:  pickLang(metrics.dev,  lang),
      tuck: pickLang(metrics.tuck, lang),
      load: pickLang(metrics.load, lang),
      fn:   pickLang(metrics.fn,   lang)
    };
  }

  function _i18nMetrics(metrics) {
    metrics = metrics || {};
    var pack = function (m) {
      if (m == null) return { en: '', es: '', pt: '' };
      if (typeof m === 'string') return { en: m, es: m, pt: m };
      return { en: m.en || '', es: m.es || m.en || '', pt: m.pt || m.en || '' };
    };
    return {
      dev:  pack(metrics.dev),
      tuck: pack(metrics.tuck),
      load: pack(metrics.load),
      fn:   pack(metrics.fn)
    };
  }

  // ─── TRANSPILE ───────────────────────────────────────────
  function transpile(bp) {
    validate(bp);
    var lang = 'en';

    var entry = {
      // Flat display fields (en — used by the IIFE today)
      title:         pickLang(bp.title,        lang),
      subtitle:      pickLang(bp.subtitle,     lang),
      muscleTarget:  pickLang(bp.muscleTarget, lang),
      clinicalNotes: pickLang(bp.clinicalNotes,lang),
      svgTitle:      pickLang(bp.svgTitle,     lang),

      mediaSrc:  '',
      mediaType: 'image',

      svgMarkup: _emitSVG(bp),

      chipOkLabel:   pickLang(bp.forms.ok.chipLabel,   lang),
      chipWarnLabel: pickLang(bp.forms.warn.chipLabel, lang),

      metricLabels: {
        dev:  pickLang((bp.metricLabels || {}).dev,  lang),
        tuck: pickLang((bp.metricLabels || {}).tuck, lang),
        load: pickLang((bp.metricLabels || {}).load, lang)
      },

      formStates: {
        ok:   _flatMetrics(bp.forms.ok.metrics,   lang),
        warn: _flatMetrics(bp.forms.warn.metrics, lang)
      },

      // Trilingual copy preserved for future runtime language switching.
      i18n: {
        title:         bp.title         || {},
        subtitle:      bp.subtitle      || {},
        muscleTarget:  bp.muscleTarget  || {},
        clinicalNotes: bp.clinicalNotes || {},
        svgTitle:      bp.svgTitle      || {},
        chipOkLabel:   (bp.forms.ok   && bp.forms.ok.chipLabel)   || {},
        chipWarnLabel: (bp.forms.warn && bp.forms.warn.chipLabel) || {},
        metricLabels: {
          dev:  (bp.metricLabels || {}).dev  || {},
          tuck: (bp.metricLabels || {}).tuck || {},
          load: (bp.metricLabels || {}).load || {}
        },
        formStates: {
          ok:   _i18nMetrics(bp.forms.ok.metrics),
          warn: _i18nMetrics(bp.forms.warn.metrics)
        }
      },

      // Animation contract — consumed by BBF_KFH_ANIMATOR
      animation: {
        duration_ms: bp.animation.duration_ms || 2400,
        loop:        bp.animation.loop !== false,
        phases:      bp.animation.phases     || [],
        keyframes:   bp.animation.keyframes  || [],
        bones:       bp.bones                || [],
        jointSpec:   bp.jointSpec            || {},
        equipment:   bp.equipment            || [],
        kineticPath: bp.kineticPath          || null,
        forms: {
          ok:   { keyframesOverride: null,
                  haloAt:           bp.forms.ok.haloAt   || null },
          warn: { keyframesOverride: bp.forms.warn.keyframesOverride || null,
                  haloAt:           bp.forms.warn.haloAt || null }
        }
      }
    };

    return entry;
  }

  return {
    transpile: transpile,
    validate:  validate
  };

})();
