// ═══════════════════════════════════════════════════════════════════
// SOMATIC-ENGINE.JS — BBF Biologic Intelligence Layer
// Titan Build 2. Brain-on-nervous-system pattern, mirroring
// auditor-engine.js. Wraps BBF_SYNC.calculateSomaticReadiness
// (Triple-Crown Phase 2, preserved as the raw signal) with:
//   · Stress as a first-class input
//   · Flow State detection (>90%)
//   · Strict override threshold (<50% instead of <60%)
//   · Cross-talk with BBF_AUDITOR — if biomechanical_redline AND
//     low readiness both fire, triggers SYSTEM EMERGENCY DELOAD.
// ═══════════════════════════════════════════════════════════════════

var BBF_SOMATIC = (function() {
  'use strict';

  // Thresholds
  var FLOW_STATE_FLOOR        = 90;   // score >= 90 → push for PR
  var DELOAD_CEILING          = 50;   // score <  50 → 70% 1RM cap
  var OVERRIDE_ONE_RM_PCT     = 70;
  var OVERRIDE_VOLUME_DELTA   = -1;

  // Component weights (sum = 100). Stress carved out of the legacy
  // weights; CNS-friction carry-over reduced but preserved so the
  // two engines continue to talk.
  var WEIGHTS = {
    sleep:     25,   // 1-10 normalised
    cognitive: 20,   // 1-10 inverted (1 = best)
    fasting:   15,   // bell-curve quality, peak 14-16h
    stress:    15,   // 1-10 inverted (1 = best)  ← NEW
    cns:       15,   // 0 if BBF_AUDITOR or BBF_SYNC cns_friction_warning
    activity:  10    // clamp(sessions_7d/4)
  };

  function fastingQuality(h) {
    if (!(h > 0)) return 0.6;
    if (h <= 12) return 0.6 + (h / 12) * 0.3;
    if (h <= 16) return 0.9 + ((h - 12) / 4) * 0.1;
    if (h <= 20) return 1.0 - ((h - 16) / 4) * 0.15;
    if (h <= 36) return 0.85 - ((h - 20) / 16) * 0.35;
    return 0.30;
  }

  function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }

  function todayKey() { return new Date().toISOString().slice(0, 10); }

  // Cognitive-load-driven gauge colour interpolation.
  // 1 → pure Sovereign Purple (#6A0DAD) — cool / optimal
  // 10 → pure Laboratory Gold (#D4AF37) — hot / high load
  function gaugeHueForCognitiveLoad(cog) {
    var c = Math.max(1, Math.min(10, numOrNull(cog) || 5));
    var t = (c - 1) / 9;   // 0..1
    // Linear interpolate between the two brand stops.
    var p = { r: 0x6A, g: 0x0D, b: 0xAD };
    var g = { r: 0xD4, g: 0xAF, b: 0x37 };
    var r = Math.round(p.r + (g.r - p.r) * t);
    var gr = Math.round(p.g + (g.g - p.g) * t);
    var b = Math.round(p.b + (g.b - p.b) * t);
    return 'rgb(' + r + ',' + gr + ',' + b + ')';
  }

  async function calculateSyncScore(userId, inputs) {
    if (!userId) return { score: 0, error: 'no uid' };
    inputs = inputs || {};
    var nowIso = new Date().toISOString();
    var dayKey = todayKey();

    // ── Load profile (cloud + localStorage) ────────────────────
    var profile = null;
    try {
      if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.fetchUserProfile) {
        profile = await BBF_SYNC.fetchUserProfile(userId);
      }
    } catch(_) {}
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u && d.u[userId]) profile = Object.assign({}, d.u[userId], profile || {});
    } catch(_) {}
    profile = profile || {};

    // ── Coalesce inputs (explicit > cached > daily_readiness > defaults) ──
    var dr = (profile.daily_readiness || {})[dayKey] || {};
    var fastingHours  = numOrNull(inputs.fasting_hours);
    var cognitiveLoad = numOrNull(inputs.cognitive_load);
    var sleepQuality  = numOrNull(inputs.sleep_quality);
    var stressLevel   = numOrNull(inputs.stress_level);

    if (fastingHours  === null) fastingHours  = numOrNull(profile.somatic_fasting_hours);
    if (cognitiveLoad === null) cognitiveLoad = numOrNull(profile.somatic_cognitive_load);
    if (sleepQuality  === null) sleepQuality  = numOrNull(profile.somatic_sleep_quality);
    if (stressLevel   === null) stressLevel   = numOrNull(profile.somatic_stress_level);
    if (sleepQuality  === null) sleepQuality  = numOrNull(dr.sleep);
    if (stressLevel   === null) stressLevel   = numOrNull(dr.stress);

    if (fastingHours  === null) fastingHours  = 0;
    if (cognitiveLoad === null) cognitiveLoad = 5;
    if (sleepQuality  === null) sleepQuality  = 5;
    if (stressLevel   === null) stressLevel   = 5;

    fastingHours  = Math.max(0, Math.min(48, fastingHours));
    cognitiveLoad = Math.max(1, Math.min(10, cognitiveLoad));
    sleepQuality  = Math.max(1, Math.min(10, sleepQuality));
    stressLevel   = Math.max(1, Math.min(10, stressLevel));

    // ── Component scoring ──────────────────────────────────────
    var sleepComp    = (sleepQuality / 10) * WEIGHTS.sleep;
    var cogComp      = ((11 - cognitiveLoad) / 10) * WEIGHTS.cognitive;
    var fastComp     = fastingQuality(fastingHours) * WEIGHTS.fasting;
    var stressComp   = ((11 - stressLevel) / 10) * WEIGHTS.stress;
    var cnsComp      = (profile.cns_friction_warning || profile.biomechanical_redline) ? 0 : WEIGHTS.cns;

    // 7-day strength-session adherence
    var sessions7d = 0;
    try {
      if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.fetchLogs) {
        var logs = await BBF_SYNC.fetchLogs(userId) || [];
        var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        var seen = {};
        for (var i = 0; i < logs.length; i++) {
          var L = logs[i];
          if (!L || !L.date) continue;
          if (L.type && L.type !== 'strength') continue;
          var ts = Date.parse(L.date);
          if (!isFinite(ts) || ts < cutoff) continue;
          seen[L.date] = true;
        }
        sessions7d = Object.keys(seen).length;
      }
    } catch(_) {}
    var activityComp = Math.max(0, Math.min(1, sessions7d / 4)) * WEIGHTS.activity;

    var score = sleepComp + cogComp + fastComp + stressComp + cnsComp + activityComp;
    score = Math.round(score * 10) / 10;
    if (score > 100) score = 100;
    if (score < 0)   score = 0;

    // ── Flags ──────────────────────────────────────────────────
    var flowState        = score >= FLOW_STATE_FLOOR;
    var overrideActive   = score <  DELOAD_CEILING;
    // Cross-talk: BBF_AUDITOR redline + low readiness = emergency.
    var redlineActive    = !!profile.biomechanical_redline;
    var emergencyDeload  = redlineActive && overrideActive;

    var tier = score >= FLOW_STATE_FLOOR ? 'flow'
             : score >= 75 ? 'optimal'
             : score >= 60 ? 'ready'
             : score >= DELOAD_CEILING ? 'caution'
             : 'depleted';

    // ── Paint colour cue for the gauge ─────────────────────────
    var gaugeStroke = gaugeHueForCognitiveLoad(cognitiveLoad);

    // ── Local mirror for instant repaint ───────────────────────
    try {
      var dL = JSON.parse(localStorage.getItem('bbf_v7') || '{"u":{},"l":{},"w":{}}');
      if (!dL.u) dL.u = {};
      if (!dL.u[userId]) dL.u[userId] = {};
      dL.u[userId].somatic_fasting_hours   = fastingHours;
      dL.u[userId].somatic_cognitive_load  = cognitiveLoad;
      dL.u[userId].somatic_sleep_quality   = sleepQuality;
      dL.u[userId].somatic_stress_level    = stressLevel;
      dL.u[userId].somatic_readiness_score = score;
      dL.u[userId].somatic_override_active = overrideActive;
      dL.u[userId].somatic_override_date   = overrideActive ? dayKey : null;
      dL.u[userId].somatic_tier            = tier;
      dL.u[userId].somatic_flow_state      = flowState;
      dL.u[userId].system_emergency_deload = emergencyDeload;
      dL.u[userId].somatic_last_logged     = nowIso;
      dL.u[userId].somatic_sync = {
        score:               score,
        tier:                tier,
        flow_state:          flowState,
        override_active:     overrideActive,
        emergency_deload:    emergencyDeload,
        inputs: {
          sleep_quality:   sleepQuality,
          cognitive_load:  cognitiveLoad,
          fasting_hours:   fastingHours,
          stress_level:    stressLevel
        },
        components: {
          sleep: sleepComp, cognition: cogComp, fasting: fastComp,
          stress: stressComp, cns: cnsComp, activity: activityComp
        },
        gauge_stroke:        gaugeStroke,
        redline_active:      redlineActive,
        computed_at:         nowIso
      };
      localStorage.setItem('bbf_v7', JSON.stringify(dL));
    } catch(_) {}

    // ── Cloud persistence (best-effort, offline-safe) ──────────
    try {
      if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.patchUserFields) {
        await BBF_SYNC.patchUserFields(userId, {
          somatic_fasting_hours:   fastingHours,
          somatic_cognitive_load:  cognitiveLoad,
          somatic_sleep_quality:   sleepQuality,
          somatic_stress_level:    stressLevel,
          somatic_readiness_score: score,
          somatic_override_active: overrideActive,
          somatic_override_date:   overrideActive ? dayKey : null,
          somatic_tier:            tier,
          somatic_flow_state:      flowState,
          system_emergency_deload: emergencyDeload,
          somatic_last_logged:     nowIso
        });
      }
    } catch(e) {
      console.warn('BBF_SOMATIC calculateSyncScore patch error:', e && e.message);
    }

    // ── History row in bbf_logs for longitudinal analysis ─────
    try {
      if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.syncLog) {
        BBF_SYNC.syncLog(userId, {
          date:      dayKey,
          type:      'somatic',
          intensity: String(score),
          notes:     'Somatic ' + tier.toUpperCase() +
                     ' | sleep=' + sleepQuality +
                     ' cog=' + cognitiveLoad +
                     ' fast=' + fastingHours + 'h' +
                     ' stress=' + stressLevel +
                     (flowState ? ' | FLOW' : '') +
                     (emergencyDeload ? ' | EMERGENCY-DELOAD' : ''),
          loggedAt:  nowIso,
          loggedBy:  userId
        });
      }
    } catch(_) {}

    return {
      score:              score,
      tier:               tier,
      flow_state:         flowState,
      override_active:    overrideActive,
      emergency_deload:   emergencyDeload,
      redline_active:     redlineActive,
      threshold_flow:     FLOW_STATE_FLOOR,
      threshold_deload:   DELOAD_CEILING,
      one_rm_override_pct: OVERRIDE_ONE_RM_PCT,
      volume_delta:       OVERRIDE_VOLUME_DELTA,
      inputs: {
        fasting_hours:  fastingHours,
        cognitive_load: cognitiveLoad,
        sleep_quality:  sleepQuality,
        stress_level:   stressLevel
      },
      components: {
        sleep: sleepComp, cognition: cogComp, fasting: fastComp,
        stress: stressComp, cns: cnsComp, activity: activityComp
      },
      sessions_7d:   sessions7d,
      gauge_stroke:  gaugeStroke,
      computed_at:   nowIso
    };
  }

  return {
    calculateSyncScore:          calculateSyncScore,
    gaugeHueForCognitiveLoad:    gaugeHueForCognitiveLoad,
    fastingQuality:              fastingQuality,
    WEIGHTS:                     WEIGHTS,
    FLOW_STATE_FLOOR:            FLOW_STATE_FLOOR,
    DELOAD_CEILING:              DELOAD_CEILING,
    OVERRIDE_ONE_RM_PCT:         OVERRIDE_ONE_RM_PCT,
    OVERRIDE_VOLUME_DELTA:       OVERRIDE_VOLUME_DELTA
  };

})();
