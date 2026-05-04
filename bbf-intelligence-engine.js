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

  var api = {
    ENERGY_PROFILES:     ENERGY_PROFILES,
    METHODOLOGIES:       METHODOLOGIES,
    PREHAB_TRIGGERS:     PREHAB_TRIGGERS,
    RECOVERY_GUARDRAILS: RECOVERY_GUARDRAILS,
    calculateAthleteProtocol: calculateAthleteProtocol
  };

  // Browser global + Node test harness export.
  root.BBF_INTEL = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : this);
