// ═══════════════════════════════════════════════════════════════════
// ROI-SYNTHESIS-ENGINE.JS — Weekly Biometric Yield Executive Brief
// Sovereign-tier intelligence layer. Reads the 11 clinical markers
// from the Titan caches (BBF_AUDITOR kinematic_audit_intelligence,
// BBF_SOMATIC somatic_sync, daily_readiness history) and generates
// a 3-section Executive Summary:
//   Section 1 — Systemic State (Autonomic)
//   Section 2 — Kinematic Integrity (Biomechanical)
//   Section 3 — Architect's Directive (Actionable ROI)
//
// Lockbox rule: only generates on Sundays. Non-Sunday renders a
// clinical-tone lock notification. Architect override via:
//   - options.forceGenerate === true (code path)
//   - three consecutive taps on the readout element within 1.5s
//     (mobile / live-page dev path)
// ═══════════════════════════════════════════════════════════════════

var BBF_ROI = (function() {
  'use strict';

  var LOCKED_MESSAGE_EN = 'SYSTEM NOTIFICATION: Biomarkers actively compiling. Next Executive Yield Brief unlocks on Sunday.';
  var DEV_UNLOCK_TTL_MS = 2 * 60 * 60 * 1000; // dev-override stays hot 2h once tripped
  var TAP_WINDOW_MS     = 1500;
  var TAP_COUNT_REQUIRED = 3;

  // ── CLINICAL LEXICON ─────────────────────────────────────────────
  // Phrases grouped by severity (peak / high / mid / low / critical)
  // and by section. 2-3 variants per cell so weekly drops don't read
  // identically. Wired through _pick() to rotate deterministically
  // against the ISO week number.
  var LEXICON = {
    systemic: {
      peak: [
        'Autonomic baseline is optimal. Seven-day sleep architecture indicates full CNS recovery with parasympathetic dominance intact. HRV index is reading in the sovereign band.',
        'Systemic state reads clear. Sleep quality is consolidated deep across the 7-day window; cortisol rhythm tracking nominal. CNS readiness locked above the 85% threshold.'
      ],
      high: [
        'Autonomic state operating within optimal bounds. Sleep architecture is consolidated, with CNS readiness trending above baseline. Stress tolerance verified.',
        'Systemic biomarkers are reading green. HRV and sleep efficiency both hold in the premium corridor; stress load is within compensated range.'
      ],
      mid: [
        'Autonomic baseline is functional. Sleep architecture shows moderate depth; stress tolerance operating at compensated output. No acute deficit detected.',
        'Systemic state registers as nominal. Sleep quality and HRV indicate partial recovery; stress load is elevated but within the sovereign recovery envelope.'
      ],
      low: [
        'Autonomic deficit detected. Sleep architecture is fragmenting; HRV trending below the sovereign band. Stress tolerance attenuated.',
        'Systemic state is drifting. 7-day sleep mean has decayed; cortisol signature is trending toward saturation. CNS readiness operating at reduced capacity.'
      ],
      critical: [
        'Autonomic redline. Sleep architecture critically compromised; HRV flatlined below threshold. Parasympathetic drive suppressed. Further systemic load is contraindicated.',
        'Systemic state at critical deficit. Sleep deprivation compounding stress saturation. CNS readiness has dropped beneath the clinical intervention line.'
      ]
    },
    kinematic: {
      peak: [
        'Bilateral asymmetry resolved. Axial load tolerance functioning at {axial}% capacity. Joint ROM holds within sovereign range; movement quality is clean through full kinematic chain.',
        'Kinematic integrity is peak. Axial load tolerance clears {axial}%; recovery capacity is restocked to {recovery}%. The motor cortex is primed for heavy output.'
      ],
      high: [
        'Kinematic chain verified. Axial load tolerance at {axial}% with joint ROM within operational bounds. No asymmetry or movement drift detected this block.',
        'Biomechanical integrity is locked. Axial load tolerance reads {axial}%; recovery capacity at {recovery}%. Progressive overload adaptation confirmed.'
      ],
      mid: [
        'Kinematic chain operating at compensated output. Axial load tolerance at {axial}% with marginal recovery debt. Movement quality is holding but beginning to drift.',
        'Biomechanical state is functional but sub-optimal. Axial load tolerance reads {axial}%; joint ROM flagged for mid-week mobility intervention.'
      ],
      low: [
        'Kinematic drift detected. Axial load tolerance attenuated to {axial}%. Movement quality has fallen below clinical threshold. Bilateral asymmetry re-emerging.',
        'Biomechanical deficit flagged. Axial load tolerance at {axial}%; recovery capacity at {recovery}%. Joint ROM is contracting; tonnage exposure must be capped.'
      ],
      critical: [
        'Biomechanical redline. Axial load tolerance critically compromised at {axial}%. Kinematic chain cannot safely absorb progressive overload. Protocol suspension recommended.',
        'Kinematic integrity at critical deficit. Axial load tolerance {axial}%; recovery capacity {recovery}%. All spinal-loaded movement patterns must be withheld.'
      ]
    },
    directive: {
      peak: [
        'Systemic readiness is cleared for high-yield output. Initiating Phase 4 Explosive Load. Protocol adherence has unlocked peak kinematic output.',
        'All markers confirm sovereign clearance. Phase 4 Explosive Load is authorized for the coming seven-day block. Optimal yield target: volume × intensity compound.'
      ],
      high: [
        'Protocol adherence has earned Phase 3 Hypertrophy Block clearance. Progressive overload is green-lit for the 7-day cycle at the prescribed 85% 1RM ceiling.',
        'Systemic readiness supports Phase 3 Hypertrophy Block. Tonnage budget is approved at full allotment; accessory volume may scale upward with RPE tracking.'
      ],
      mid: [
        'The system recommends Phase 2 Volume Accumulation. Progressive overload proceeds at 75% 1RM until systemic markers confirm return to optimal yield.',
        'Clinical output supports a conservative block. Prescribe Phase 2 Volume Accumulation at reduced intensity; re-evaluate at next weekly drop for Phase 3 clearance.'
      ],
      low: [
        'Recommend Phase 2 Recovery Block. Progressive overload is suspended; prescribe mobility, sleep consolidation, and submaximal output until autonomic + kinematic markers normalize.',
        'Systemic fatigue is compounding kinematic drift. Initiate Phase 2 Recovery Block for the 7-day window. Intensity cap 70% 1RM; emphasize parasympathetic recovery work.'
      ],
      critical: [
        'REDLINE: Phase 2 Deload Protocol mandatory. All progressive overload suspended. Route the client into the Prescribed Occupational Mobility pathway immediately.',
        'Emergency deload clearance. All axial loading is withheld for the 7-day cycle. Execute full Mobility + Recovery Protocol; re-audit markers mid-week.'
      ]
    }
  };

  // ── HELPERS ──────────────────────────────────────────────────────
  function _clamp(v) {
    if (!isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  function _classify(score) {
    if (score >= 85) return 'peak';
    if (score >= 70) return 'high';
    if (score >= 55) return 'mid';
    if (score >= 40) return 'low';
    return 'critical';
  }

  // Deterministic phrase rotation — same ISO week always picks the
  // same variant, so a given Sunday's brief is stable if regenerated.
  function _isoWeekNumber(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function _pick(bank, severity, weekSeed) {
    var arr = bank[severity] || bank.mid || [];
    if (!arr.length) return '';
    return arr[weekSeed % arr.length];
  }

  function _fill(template, tokens) {
    return String(template).replace(/\{(\w+)\}/g, function(_, k){
      return tokens[k] != null ? String(tokens[k]) : '';
    });
  }

  // ── DATA READ ────────────────────────────────────────────────────
  // Reuses the BYR marker computation if available (it's the
  // canonical source), otherwise reads directly from the profile.
  function _computeMarkers(uid) {
    // Prefer the BYR computer which already blends all 11 markers.
    if (typeof _byrComputeMarkers === 'function') {
      try { return _byrComputeMarkers(uid); } catch(_) {}
    }
    // Fallback: minimal direct read
    var profile = {};
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u && d.u[uid]) profile = d.u[uid];
    } catch(_) {}
    var intel = profile.kinematic_audit_intelligence || {};
    var somatic = isFinite(profile.somatic_readiness_score) ? profile.somatic_readiness_score : 60;
    return {
      hrv:      70,
      sleep:    60,
      cns:      somatic,
      stress:   60,
      rom:      70,
      recovery: _clamp((intel.recovery_capacity || 0.65) * 100),
      movement: profile.biomechanical_redline ? 55 : 78,
      axial:    _clamp(100 - Math.min(100, intel.friction_score || 50)),
      overload: _clamp((intel.tonnage_load || 0.55) * 60),
      fast:     60,
      neural:   somatic
    };
  }

  function _readProfile(uid) {
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u && d.u[uid]) return d.u[uid];
    } catch(_) {}
    return {};
  }

  // ── LOCKBOX ──────────────────────────────────────────────────────
  function isUnlocked(options) {
    options = options || {};
    if (options.forceGenerate) return true;
    // Dev-bypass TTL: once tripped via 3-tap, stays unlocked for 2h.
    try {
      var uid = (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || 'anon';
      var devAt = parseInt(localStorage.getItem('bbf_roi_dev_' + uid) || '0', 10);
      if (devAt && (Date.now() - devAt) < DEV_UNLOCK_TTL_MS) return true;
    } catch(_) {}
    return new Date().getDay() === 0; // 0 === Sunday
  }

  function lockedMessage() {
    if (typeof _t === 'function') return _t('roi-locked', LOCKED_MESSAGE_EN);
    return LOCKED_MESSAGE_EN;
  }

  // ── GENERATION ──────────────────────────────────────────────────
  function _buildSections(values, profile) {
    var autonomicComposite = (values.hrv + values.sleep + values.cns + values.stress) / 4;
    var kinematicComposite = (values.rom + values.recovery + values.movement + values.axial) / 4;
    var systemicSev   = _classify(autonomicComposite);
    var kinematicSev  = _classify(kinematicComposite);

    // Directive severity is the MIN of the two composites — if either
    // half of the body is depleted, the overall directive reflects
    // the weaker half. A redline flag forces 'critical' regardless.
    var directiveScore = Math.min(autonomicComposite, kinematicComposite);
    var directiveSev   = _classify(directiveScore);
    if (profile.biomechanical_redline || profile.system_emergency_deload) {
      directiveSev = 'critical';
    }

    var weekSeed = _isoWeekNumber(new Date());
    var tokens = {
      axial:    Math.round(values.axial),
      recovery: Math.round(values.recovery),
      cns:      Math.round(values.cns),
      sleep:    Math.round(values.sleep)
    };

    return {
      systemic:   _fill(_pick(LEXICON.systemic,  systemicSev,  weekSeed),     tokens),
      kinematic:  _fill(_pick(LEXICON.kinematic, kinematicSev, weekSeed + 1), tokens),
      directive:  _fill(_pick(LEXICON.directive, directiveSev, weekSeed + 2), tokens),
      meta: {
        autonomic_composite:  Math.round(autonomicComposite * 10) / 10,
        kinematic_composite:  Math.round(kinematicComposite * 10) / 10,
        systemic_severity:    systemicSev,
        kinematic_severity:   kinematicSev,
        directive_severity:   directiveSev,
        week_iso:             weekSeed,
        redline:              !!profile.biomechanical_redline,
        emergency_deload:     !!profile.system_emergency_deload
      }
    };
  }

  function _composeHtml(sections) {
    return (
      '<div class="roi-sec roi-sec--systemic">' +
        '<span class="roi-sec-tag">Systemic State</span>' +
        '<span class="roi-sec-body">' + sections.systemic + '</span>' +
      '</div>' +
      '<div class="roi-sec roi-sec--kinematic">' +
        '<span class="roi-sec-tag">Kinematic Integrity</span>' +
        '<span class="roi-sec-body">' + sections.kinematic + '</span>' +
      '</div>' +
      '<div class="roi-sec roi-sec--directive">' +
        '<span class="roi-sec-tag">Architect\u2019s Directive</span>' +
        '<span class="roi-sec-body">' + sections.directive + '</span>' +
      '</div>' +
      '<span class="byr-readout-caret" aria-hidden="true"></span>'
    );
  }

  function generate(userId, options) {
    options = options || {};
    var unlocked = isUnlocked(options);
    if (!unlocked) {
      return {
        locked: true,
        html:   lockedMessage() + '<span class="byr-readout-caret" aria-hidden="true"></span>'
      };
    }
    userId = userId || (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || null;
    var values   = _computeMarkers(userId);
    var profile  = _readProfile(userId);
    var sections = _buildSections(values, profile);
    return {
      locked:   false,
      sections: sections,
      html:     _composeHtml(sections)
    };
  }

  // ── UI INJECTION ─────────────────────────────────────────────────
  function injectIntoReadout(userId, options) {
    var el = document.getElementById('byr-readout-body');
    if (!el) return null;
    var result = generate(userId, options);
    el.innerHTML = result.html;
    el.classList.toggle('roi-unlocked', !result.locked);
    return result;
  }

  // ── 3-TAP DEV OVERRIDE (hidden bypass for architect testing) ───
  var _tapState = { count: 0, last: 0 };
  function _registerTap() {
    var now = Date.now();
    if (now - _tapState.last > TAP_WINDOW_MS) _tapState.count = 0;
    _tapState.last = now;
    _tapState.count += 1;
    if (_tapState.count >= TAP_COUNT_REQUIRED) {
      _tapState.count = 0;
      _tripDevOverride();
    }
  }

  function _tripDevOverride() {
    try {
      var uid = (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || 'anon';
      localStorage.setItem('bbf_roi_dev_' + uid, String(Date.now()));
    } catch(_) {}
    injectIntoReadout(null, { forceGenerate: true });
    if (typeof TOAST === 'function') {
      TOAST('\uD83D\uDD13 Architect override: weekly ROI brief generated.');
    }
  }

  function clearDevOverride() {
    try {
      var uid = (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || 'anon';
      localStorage.removeItem('bbf_roi_dev_' + uid);
    } catch(_) {}
  }

  function wireTapBypass() {
    var el = document.getElementById('byr-readout-body');
    if (!el || el.dataset.roiTapBound === '1') return;
    el.dataset.roiTapBound = '1';
    el.addEventListener('click', _registerTap);
  }

  return {
    generate:          generate,
    injectIntoReadout: injectIntoReadout,
    isUnlocked:        isUnlocked,
    lockedMessage:     lockedMessage,
    wireTapBypass:     wireTapBypass,
    clearDevOverride:  clearDevOverride,
    LEXICON:           LEXICON,
    LOCKED_MESSAGE_EN: LOCKED_MESSAGE_EN
  };

})();
