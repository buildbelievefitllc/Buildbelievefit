// ═══════════════════════════════════════════════════════════════
// BBF-INTELLIGENCE-ENGINE.JS — Sovereign Clinical Rules Engine
// ───────────────────────────────────────────────────────────────
// Translates the BBF Biomechanical Data Architect's 4-block clinical
// matrix into a pure-function calculator. Returns a compiled
// per-athlete protocol given (sport, position, phase, opts).
//
// CEO sign-off (2026-05-04) on schema + mapping decisions:
//   Q1  Phase mapping: off → Force Production, in → Peak Power & RFD
//   Q2  Athlete stage: hard-default 'Collegiate/Pro' (Youth backlogged)
//   Q3  Position scope: Block 1/3 sport-level profiles apply to all
//       positions within the sport (Basketball perimeter+post share
//       one profile; Volleyball outside+setter share one). Football
//       overrides per-position because Linemen vs Skill differ.
//   Q4  Sports without clinical data (soccer, baseball): coverage flag
//       set to 'partial'; UI shows a pending notice + universal Block 4
//       guardrails still surface.
//   Q5  Coach Cam stripped from UI; not relevant here.
//
// Disclaimer: this engine is a clinical reference compiler, not
// medical advice. The CEO acknowledged the "informational only" notice
// when handing over the data blocks.
// ═══════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  // ─── Block 1: Positional Energy Matrix ─────────────────────
  // Percentages are ATP-PC / Glycolytic / Aerobic shares of the
  // positional energy demand profile. Position-specific overrides
  // sit at sport[positionKey]; sport-level fallback at sport._all.
  var ENERGY_PROFILES = {
    football: {
      bigs:  { atpPc: 90, glycolytic: 5,  aerobic: 5  },
      skill: { atpPc: 80, glycolytic: 15, aerobic: 5  }
    },
    basketball: {
      _all:  { atpPc: 60, glycolytic: 20, aerobic: 20 }
    },
    volleyball: {
      _all:  { atpPc: 80, glycolytic: 5,  aerobic: 15 }
    }
    // soccer, baseball intentionally absent → coverage:'partial'
  };

  // ─── Block 2: Advanced Training Methodologies ──────────────
  // Phase-keyed (matching the portal's 'off'|'in') with a nested
  // per-stage rule. Only Collegiate/Pro is defined in the current
  // matrix — Youth is a backlog ticket per CEO Q2.
  var METHODOLOGIES = {
    off: {
      phaseLabel: 'Neuromuscular Coordination and Force Production',
      collegiate_pro: {
        load:     '85-100% 1-RM',
        volume:   '1-5 reps',
        velocity: null
      }
    },
    in: {
      phaseLabel: 'Peak Power and Rate of Force Development (RFD)',
      collegiate_pro: {
        load:     '30-70% 1-RM',
        volume:   null,
        velocity: 'High'
      }
    }
  };

  // ─── Block 3: Biomechanical Flaw & Prehab Triggers ─────────
  // Sport-level (per CEO Q3) — every position within the sport
  // inherits the same risk site + prehab pair.
  var PREHAB_TRIGGERS = {
    basketball: {
      riskSite: 'Ankle (Sprains) / Patellar (Dynamic Knee Valgus during landing)',
      drills: [
        { name: 'Ankle Circles & Toe Taps', purpose: 'Ankle mobility + dorsiflexion priming' },
        { name: 'Hip Bridges',              purpose: 'Glute Activation' }
      ]
    },
    volleyball: {
      riskSite: 'Shoulder / Ankle (Repetitive Impact and Overhead Spike)',
      drills: [
        { name: 'Band Pull-Aparts',      purpose: 'Posterior Shoulder Stability' },
        { name: 'Single-Leg Heel Raise', purpose: 'Calf and Ankle Resilience' }
      ]
    },
    football: {
      riskSite: 'Knee (ACL / Meniscus from Pivot-Heavy Tackle or Deceleration)',
      drills: [
        { name: 'Terminal Knee Extension (TKE)', purpose: 'VMO Activation' },
        { name: 'Single-Leg RDL',                purpose: 'Hamstring/Glute Imbalance Correction' }
      ]
    }
    // soccer, baseball intentionally absent → coverage:'partial'
  };

  // ─── Block 4: Recovery Guardrails (universal) ──────────────
  // Apply to every athlete regardless of sport/position. macroWeekly
  // surfaces only when athleteStage === 'Youth' (currently disabled
  // per CEO Q2 default).
  var RECOVERY_GUARDRAILS = {
    micro: {
      label:     'Micro-Recovery (Intra-Session)',
      condition: 'High-Intensity ATP-PC bouts',
      rule:      'Minimum 3 minutes rest between bouts',
      reference: 'Over 90% of muscle ATP-CP stores are restored within 3 minutes.'
    },
    macroPostMaxEffort: {
      label:     'Macro-Recovery (Post-Maximal Effort)',
      condition: 'Maximal Effort or High-Intensity Contact session',
      rule:      'Minimum 24–48 hour recovery window before next high-intensity load',
      reference: 'Creatine kinase concentrations peak 24–48 hours post-exercise.'
    },
    macroWeekly: {
      label:     'Macro-Recovery (Weekly Load)',
      condition: 'Athlete stage is Youth (8–13)',
      rule:      '2 days off per week from all structured training and competition',
      reference: 'Pediatric load management — does not apply at Collegiate/Pro stage.'
    },
    autoregulation: {
      label:     'Autoregulation (Fatigue Management)',
      condition: 'Acute:Chronic Workload Ratio (ACWR) > 1.5',
      rule:      'Mandatory Volume Reduction (Fatigue State = TRUE)',
      reference: 'ACWR threshold for elevated injury risk per accumulated workload research.'
    }
  };

  // ─── PUBLIC: calculateAthleteProtocol ──────────────────────
  // Pure function. Returns a fully-compiled protocol object or a
  // shape with coverage:'partial' when blocks are missing for this
  // sport. Never throws — unknown inputs degrade to nulls.
  function calculateAthleteProtocol(sport, position, phase, opts) {
    opts = opts || {};
    var athleteStage = opts.athleteStage || 'Collegiate/Pro';

    // Energy: per-position override beats sport-level fallback.
    var energy = null, energySource = null;
    var ep = ENERGY_PROFILES[sport];
    if (ep) {
      if (position && ep[position]) {
        energy = ep[position];
        energySource = sport + '.' + position;
      } else if (ep._all) {
        energy = ep._all;
        energySource = sport + ' (sport-level)';
      }
    }

    // Methodology: phase × athleteStage.
    var methodology = null;
    var mph = METHODOLOGIES[phase];
    if (mph) {
      var stageKey = (athleteStage === 'Collegiate/Pro') ? 'collegiate_pro' : null;
      var stagedRule = stageKey ? mph[stageKey] : null;
      methodology = {
        phaseLabel:   mph.phaseLabel,
        load:         stagedRule ? stagedRule.load     : null,
        volume:       stagedRule ? stagedRule.volume   : null,
        velocity:     stagedRule ? stagedRule.velocity : null,
        athleteStage: athleteStage
      };
    }

    // Prehab: sport-level lookup.
    var prehab = PREHAB_TRIGGERS[sport] || null;

    // Guardrails: micro + macroPostMaxEffort + autoregulation are
    // universal. macroWeekly is conditional on Youth stage.
    var guardrails = {
      micro:              RECOVERY_GUARDRAILS.micro,
      macroPostMaxEffort: RECOVERY_GUARDRAILS.macroPostMaxEffort,
      macroWeekly:        (athleteStage === 'Youth') ? RECOVERY_GUARDRAILS.macroWeekly : null,
      autoregulation:     RECOVERY_GUARDRAILS.autoregulation
    };

    // Coverage: 'full' iff sport-dependent blocks (energy + prehab)
    // both resolved. Methodology + guardrails are sport-agnostic.
    var coverage = (energy && prehab) ? 'full' : 'partial';

    return {
      energySystem: energy ? {
        atpPc:      energy.atpPc,
        glycolytic: energy.glycolytic,
        aerobic:    energy.aerobic,
        source:     energySource
      } : null,
      methodology: methodology,
      prehab:      prehab,
      guardrails:  guardrails,
      meta: {
        sport:        sport       || null,
        position:     position    || null,
        phase:        phase       || null,
        athleteStage: athleteStage,
        coverage:     coverage
      }
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 4 — Dynamic Load Auditor
  //
  // Active enforcement of Block 4 guardrails against an athlete's
  // weekly training stream. Pure math + pure validators; no DOM
  // and no I/O. The engine is fed an array of daily training-load
  // values (sRPE: session RPE × duration in minutes — the Gabbett
  // canonical model) and a list of intra-session bouts; it returns
  // a structured audit report the UI renders verbatim.
  //
  // Future: when bbf_logs/bbf_sets accumulate real-world data, we
  // swap the simulation source for a real fetch. The audit math
  // doesn't change.
  // ═══════════════════════════════════════════════════════════

  var ACUTE_WINDOW_DAYS   = 7;
  var CHRONIC_WINDOW_DAYS = 28;
  var ACWR_THRESHOLD      = 1.5;
  var ATP_PC_MIN_REST_SEC = 180;
  var ATP_PC_BOUT_TYPE    = 'High-Intensity ATP-PC';

  // ─── ACWR (Acute:Chronic Workload Ratio) ────────────────────
  // dailyLoads: array of training load (AU) per day, oldest → newest.
  // Returns null-safe shape with fatigueState + alert when threshold
  // is breached. Insufficient baseline (<28d) flagged separately —
  // ratio is still computed but UI should soften the language.
  function calculateACWR(dailyLoads, opts) {
    opts = opts || {};
    var acuteWindow   = opts.acuteWindow   || ACUTE_WINDOW_DAYS;
    var chronicWindow = opts.chronicWindow || CHRONIC_WINDOW_DAYS;
    var threshold     = (typeof opts.threshold === 'number') ? opts.threshold : ACWR_THRESHOLD;

    if (!Array.isArray(dailyLoads) || dailyLoads.length === 0) {
      return { acuteLoad: 0, chronicLoad: 0, ratio: null, threshold: threshold,
               fatigueState: false, alert: null, daysCovered: 0, insufficient: true };
    }

    var n = dailyLoads.length;
    var insufficient = n < chronicWindow;
    var chronicDays  = Math.min(n, chronicWindow);
    var acuteDays    = Math.min(n, acuteWindow);

    var acuteLoad = 0;
    for (var i = n - acuteDays; i < n; i++) acuteLoad += (+dailyLoads[i] || 0);

    var chronicTotal = 0;
    for (var j = n - chronicDays; j < n; j++) chronicTotal += (+dailyLoads[j] || 0);
    // 4-week average weekly load (Gabbett): total ÷ (window/7)
    var chronicLoad = chronicTotal / (chronicWindow / 7);

    var ratio = (chronicLoad > 0) ? (acuteLoad / chronicLoad) : null;
    var fatigueState = (ratio !== null) && (ratio > threshold);

    var alert = null;
    if (fatigueState) {
      alert = {
        severity: 'high',
        rule:     'Mandatory Volume Reduction',
        reason:   'ACWR ' + ratio.toFixed(2) + ' exceeds the ' + threshold + ' elevated-injury-risk threshold',
        source:   'Block 4 Autoregulation Guardrail'
      };
    }

    return {
      acuteLoad:    Math.round(acuteLoad),
      chronicLoad:  Math.round(chronicLoad),
      ratio:        ratio === null ? null : +ratio.toFixed(3),
      threshold:    threshold,
      fatigueState: fatigueState,
      alert:        alert,
      daysCovered:  n,
      insufficient: insufficient
    };
  }

  // ─── Micro-Recovery audit (3-min ATP-PC rule) ───────────────
  // bouts: [{ type, start: ISO string | epoch ms, durationSec }]
  // Walks consecutive ATP-PC bouts in order; flags any pair whose
  // rest gap (next.start - prev.end) is below the 180s threshold.
  function auditMicroRecovery(bouts, opts) {
    opts = opts || {};
    var minRest = opts.minRestSec || ATP_PC_MIN_REST_SEC;
    var atpType = opts.atpPcType  || ATP_PC_BOUT_TYPE;

    if (!Array.isArray(bouts) || bouts.length < 2) {
      return { violations: [], totalAtpPcBouts: bouts ? bouts.length : 0,
               pairsChecked: 0, threshold: minRest };
    }

    function tsMs(b){
      if (typeof b.start === 'number') return b.start;
      var t = Date.parse(b.start);
      return isNaN(t) ? null : t;
    }

    // Filter ATP-PC, preserve original order.
    var atp = bouts.filter(function(b){ return b && b.type === atpType; });
    var violations = [];
    var pairsChecked = 0;

    for (var i = 1; i < atp.length; i++) {
      var prev = atp[i-1];
      var curr = atp[i];
      var prevStart = tsMs(prev);
      var currStart = tsMs(curr);
      if (prevStart === null || currStart === null) continue;
      var prevEnd = prevStart + ((+prev.durationSec || 0) * 1000);
      var restSec = (currStart - prevEnd) / 1000;
      pairsChecked++;
      if (restSec < minRest) {
        violations.push({
          fromBout:  prev,
          toBout:    curr,
          restSec:   Math.round(restSec),
          threshold: minRest,
          atIso:     curr.start
        });
      }
    }
    return {
      violations:      violations,
      totalAtpPcBouts: atp.length,
      pairsChecked:    pairsChecked,
      threshold:       minRest
    };
  }

  // ─── Combined audit wrapper ─────────────────────────────────
  // Runs ACWR + micro-recovery and surfaces a flat alerts array
  // the UI can render without conditional reshuffling.
  function runLoadAudit(input) {
    input = input || {};
    var acwr  = calculateACWR(input.dailyLoads || [], input.acwrOpts);
    var micro = auditMicroRecovery(input.bouts || [], input.microOpts);
    var alerts = [];
    if (acwr.alert) alerts.push(acwr.alert);
    if (micro.violations.length > 0) {
      alerts.push({
        severity: 'medium',
        rule:     'Micro-Recovery Protocol Violation',
        reason:   micro.violations.length + ' of ' + micro.pairsChecked +
                  ' ATP-PC bout pair' + (micro.pairsChecked === 1 ? '' : 's') +
                  ' fell below the ' + (micro.threshold / 60) + '-minute rest minimum',
        source:   'Block 4 Micro-Recovery Guardrail'
      });
    }
    return {
      acwr: acwr,
      microRecovery: micro,
      alerts: alerts,
      summary: {
        fatigueState:   acwr.fatigueState,
        violationCount: micro.violations.length,
        anyAlerts:      alerts.length > 0
      }
    };
  }

  // ─── Mock microcycle simulation ─────────────────────────────
  // Deterministic 28-day microcycle for an in-season Football
  // Skill Position athlete. Days 0-20 are a steady moderate
  // baseline (~2,450 AU/week). Days 21-27 are a deliberate spike
  // (~4,750 AU/week — extra mid-week conditioning + high-RPE game)
  // designed to land ACWR cleanly above the 1.5 threshold so the
  // autoregulation alert fires end-to-end.
  //
  // The bout list contains 4 ATP-PC sprints on day 21; the 1st→2nd
  // and 2nd→3rd gaps are < 3 min (deliberate violations); the 3rd→4th
  // gap is > 3 min (passes). Lets the UI demonstrate both states.
  function simulateMicrocycle(opts) {
    opts = opts || {};
    var anchor = opts.dateAnchor || '2026-04-21T00:00:00Z'; // day 21 of the microcycle = spike start

    // Baseline week pattern (Mon→Sun): lift / practice / recovery /
    // practice / light / game / rest. Total = 2,450 AU.
    var baselineWeek = [400, 500, 200, 500, 250, 600, 0];
    // Spike week pattern: lift / practice++ / lift / practice /
    // conditioning / high-RPE game / active recovery. Total = 4,750.
    var spikeWeek    = [600, 800, 700, 750, 600, 900, 400];

    var dailyLoads = [].concat(baselineWeek, baselineWeek, baselineWeek, spikeWeek);

    // ATP-PC sprint bouts on the spike-week Tuesday morning (extra
    // conditioning that triggers the 3-min rest violations).
    // ISO timestamps: 10:30:00, 10:31:50, 10:33:30, 10:38:00 on day 22.
    var dayTwoISO = '2026-04-22T'; // day-21 anchor + 1 → day 22 of mock
    var bouts = [
      { type: ATP_PC_BOUT_TYPE, start: dayTwoISO + '10:30:00Z', durationSec:  8, label: 'Sprint 1' },
      { type: ATP_PC_BOUT_TYPE, start: dayTwoISO + '10:31:50Z', durationSec:  8, label: 'Sprint 2' },
      { type: ATP_PC_BOUT_TYPE, start: dayTwoISO + '10:33:30Z', durationSec: 10, label: 'Sprint 3' },
      { type: ATP_PC_BOUT_TYPE, start: dayTwoISO + '10:38:00Z', durationSec: 10, label: 'Sprint 4' }
    ];

    return {
      meta: {
        sport:        opts.sport       || 'football',
        position:     opts.position    || 'skill',
        phase:        opts.phase       || 'in',
        athleteStage: opts.athleteStage || 'Collegiate/Pro',
        scenario:     opts.scenario    || 'football_skill_inseason_spike',
        dateAnchor:   anchor,
        windowDays:   dailyLoads.length,
        microcycleDays: 14
      },
      dailyLoads: dailyLoads,
      bouts:      bouts,
      description: '28-day window for an in-season Football Skill Position athlete. Days 0-20: steady baseline (~2,450 AU/week). Days 21-27: deliberate load spike (~4,750 AU/week) designed to breach the ACWR > 1.5 threshold and exercise the autoregulation alert. Day-22 morning includes 4 ATP-PC sprints with 2 sub-3-min rest violations to exercise the micro-recovery guardrail.'
    };
  }

  var api = {
    ENERGY_PROFILES:     ENERGY_PROFILES,
    METHODOLOGIES:       METHODOLOGIES,
    PREHAB_TRIGGERS:     PREHAB_TRIGGERS,
    RECOVERY_GUARDRAILS: RECOVERY_GUARDRAILS,
    calculateAthleteProtocol: calculateAthleteProtocol,
    // Phase 4 — Dynamic Load Auditor
    calculateACWR:       calculateACWR,
    auditMicroRecovery:  auditMicroRecovery,
    runLoadAudit:        runLoadAudit,
    simulateMicrocycle:  simulateMicrocycle,
    ACUTE_WINDOW_DAYS:   ACUTE_WINDOW_DAYS,
    CHRONIC_WINDOW_DAYS: CHRONIC_WINDOW_DAYS,
    ACWR_THRESHOLD:      ACWR_THRESHOLD,
    ATP_PC_MIN_REST_SEC: ATP_PC_MIN_REST_SEC
  };

  // Browser global + Node test harness export.
  root.BBF_INTEL = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : this);
