// ═══════════════════════════════════════════════════════════════
// ARE-ENGINE.JS — Autonomic Readiness Engine
// Sovereign Gold Standard — Volume / Sequencing / Concurrent Audit
// Logic Matrix:
//   Volume:     MV=6, MEV>6, MAV=10-19, MRV=20+
//               (<5 sets=5.4% gain, 5-9=6.6%, 10+=9.8%)
//   Sequence:   Large before Small, Multi-Joint before Single-Joint,
//               High Intensity before Low Intensity
//   Concurrent: Zone 2 = 60-70% HR, 80/20 Z2/Z4 ratio
//               If goal='Maximize 1RM' AND Zone 4 HIIT logged → interference
// ═══════════════════════════════════════════════════════════════

const ARE_ENGINE = (function() {
  'use strict';

  // ─── VOLUME LANDMARKS ────────────────────────────────────
  const VOLUME = {
    MV: 6,           // Maintenance Volume
    MEV: 6,          // Minimum Effective Volume (> MV)
    MAV_MIN: 10,     // Maximum Adaptive Volume (lower bound)
    MAV_MAX: 19,     // Maximum Adaptive Volume (upper bound)
    MRV: 20,         // Maximum Recoverable Volume
    YIELD_LOW:  5.4, // <5 sets/wk
    YIELD_MID:  6.6, // 5-9 sets/wk
    YIELD_HIGH: 9.8  // 10+ sets/wk (MAV territory)
  };

  // ─── EXERCISE CLASSIFIER ─────────────────────────────────
  // Keyword-based — no muscleGroup flags exist in the data model.
  const MULTI_JOINT_KEYS = [
    'squat','deadlift','rdl','romanian','bench','press','row','pull-up','pullup','chin-up','chinup',
    'dip','lunge','split squat','clean','snatch','jerk','thruster','push press','hip thrust','good morning',
    'leg press','hack squat','trap bar','landmine','ohp','overhead','incline press','decline press',
    'front squat','back squat','zercher','sumo'
  ];
  const SINGLE_JOINT_KEYS = [
    'curl','pushdown','extension','kickback','raise','fly','flye','pullover','pull-over','shrug',
    'calf raise','calf press','leg curl','leg extension','lateral raise','front raise','rear delt',
    'concentration','preacher','hammer curl','spider curl','tricep extension','skullcrusher','skull crusher',
    'cable crossover','pec deck','reverse fly','wrist curl'
  ];
  const LARGE_MUSCLE_KEYS = [
    'squat','deadlift','bench','row','press','pull-up','pullup','chin-up','chinup','lunge','leg press',
    'hip thrust','hack squat','romanian','rdl','good morning','clean','snatch','jerk','thruster',
    'trap bar','front squat','back squat','incline press','decline press','ohp','overhead'
  ];
  const MUSCLE_GROUPS = [
    { key:'chest',     terms:['bench','chest','fly','flye','pec','push-up','pushup','dip','crossover'] },
    { key:'back',      terms:['row','pull-up','pullup','chin-up','chinup','pulldown','deadlift','rdl','romanian','pullover','shrug','face pull','lat'] },
    { key:'shoulders', terms:['press','ohp','overhead','lateral raise','front raise','rear delt','shoulder','arnold','upright row'] },
    { key:'biceps',    terms:['curl','chin-up','chinup','preacher','hammer','spider','concentration'] },
    { key:'triceps',   terms:['pushdown','skullcrusher','skull crusher','tricep','dip','kickback','close grip','close-grip'] },
    { key:'quads',     terms:['squat','leg press','hack squat','lunge','leg extension','split squat','step-up','stepup','front squat','zercher'] },
    { key:'hamstrings',terms:['deadlift','rdl','romanian','leg curl','hamstring','good morning','glute ham','ghr','nordic'] },
    { key:'glutes',    terms:['hip thrust','glute bridge','kickback','sumo','glute','frog pump','clam'] },
    { key:'calves',    terms:['calf raise','calf press','seated calf','standing calf','tibialis'] },
    { key:'core',      terms:['plank','crunch','sit-up','situp','hollow','ab ','abs ','cable crunch','leg raise','hanging knee','hanging leg','dead bug','bird dog','pallof','woodchop','russian twist'] }
  ];

  // ─── NAME PARSING ────────────────────────────────────────
  // Accepts raw string ("Bench Press 3x10 @ 185lbs") or {name} object.
  function exerciseName(ex) {
    if (!ex) return '';
    if (typeof ex === 'string') return ex;
    if (ex.name) {
      if (typeof ex.name === 'string') return ex.name;
      if (typeof ex.name === 'object') return ex.name.en || ex.name.es || ex.name.pt || '';
    }
    return '';
  }
  function normalize(n) { return String(n || '').toLowerCase().trim(); }
  function matchAny(n, keys) {
    const lc = normalize(n);
    for (let i = 0; i < keys.length; i++) if (lc.indexOf(keys[i]) !== -1) return true;
    return false;
  }

  function classify(ex) {
    const n = exerciseName(ex);
    const lc = normalize(n);
    const single = matchAny(lc, SINGLE_JOINT_KEYS);
    const multi  = !single && matchAny(lc, MULTI_JOINT_KEYS);
    let group = null;
    for (let i = 0; i < MUSCLE_GROUPS.length; i++) {
      if (matchAny(lc, MUSCLE_GROUPS[i].terms)) { group = MUSCLE_GROUPS[i].key; break; }
    }
    return {
      name: n,
      isMultiJoint: multi,
      isSingleJoint: single,
      isLargeMuscle: matchAny(lc, LARGE_MUSCLE_KEYS),
      muscleGroup: group
    };
  }

  // Parse "3x10" → 3 sets. "4x8/side" → 4. Default 1.
  function parseSets(ex) {
    let s = '';
    if (typeof ex === 'string') s = ex;
    else if (ex && ex.sets) s = String(ex.sets);
    else if (ex && ex.name)  s = exerciseName(ex) + ' ' + (ex.sets || '');
    const m = /(\d+)\s*x\s*\d+/i.exec(s);
    if (m) return parseInt(m[1], 10);
    const m2 = /(\d+)\s*sets?/i.exec(s);
    if (m2) return parseInt(m2[1], 10);
    return 1;
  }

  // ═══════════════════════════════════════════════════════════
  // 1. auditVolume — weekly sets per muscle vs MV/MEV/MAV/MRV
  // ═══════════════════════════════════════════════════════════
  // Input: { chest: 12, back: 22, ... }
  // Output: { groups: [{ muscle, sets, tier, tierLabel, yieldPct, message }], violations }
  function auditVolume(setsByMuscle) {
    const groups = [];
    const violations = [];
    const map = setsByMuscle || {};
    Object.keys(map).forEach(function(m) {
      const sets = map[m] || 0;
      let tier, tierLabel, yieldPct, message;
      if (sets >= VOLUME.MRV) {
        tier = 'mrv';
        tierLabel = 'MRV Exceeded';
        yieldPct = VOLUME.YIELD_HIGH;
        message = 'MRV Exceeded: CNS Burnout Risk';
        violations.push({ muscle: m, sets: sets, tier: 'mrv' });
      } else if (sets >= VOLUME.MAV_MIN) {
        tier = 'mav';
        tierLabel = 'MAV Achieved';
        yieldPct = VOLUME.YIELD_HIGH;
        message = 'MAV Achieved: ' + VOLUME.YIELD_HIGH + '% Hypertrophy Yield';
      } else if (sets >= 5) {
        tier = 'mev';
        tierLabel = 'MEV Zone';
        yieldPct = VOLUME.YIELD_MID;
        message = 'MEV Zone: ' + VOLUME.YIELD_MID + '% Hypertrophy Yield';
      } else if (sets > 0) {
        tier = 'mv';
        tierLabel = 'Sub-MV';
        yieldPct = VOLUME.YIELD_LOW;
        message = 'Sub-Maintenance: ' + VOLUME.YIELD_LOW + '% Yield — Increase Volume';
      } else {
        tier = 'none';
        tierLabel = 'Untrained';
        yieldPct = 0;
        message = 'No weekly volume logged';
      }
      groups.push({
        muscle: m, sets: sets, tier: tier, tierLabel: tierLabel,
        yieldPct: yieldPct, message: message
      });
    });
    return { groups: groups, violations: violations };
  }

  // ═══════════════════════════════════════════════════════════
  // 2. auditSequence — multi-joint BEFORE single-joint
  // ═══════════════════════════════════════════════════════════
  // Input: array of exercises (strings or objects)
  // Output: { ok, violations:[{index, name, reason}], message }
  function auditSequence(exercises) {
    const list = (exercises || []).map(classify);
    const violations = [];
    let seenSingleJointAt = -1;
    for (let i = 0; i < list.length; i++) {
      const ex = list[i];
      if (ex.isSingleJoint && seenSingleJointAt === -1) seenSingleJointAt = i;
      if (ex.isMultiJoint && seenSingleJointAt !== -1 && i > seenSingleJointAt) {
        violations.push({
          index: i,
          name: ex.name,
          reason: 'Multi-joint "' + ex.name + '" placed after single-joint at slot ' + (seenSingleJointAt + 1)
        });
      }
    }
    const ok = violations.length === 0;
    return {
      ok: ok,
      violations: violations,
      message: ok
        ? 'Sequence validated: strength curve intact.'
        : 'ARE Warning: Blunted Strength Curve Detected. Move multi-joint exercises to the start.'
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 3. auditConcurrent — Zone 4 HIIT vs 1RM goal interference
  // ═══════════════════════════════════════════════════════════
  // Input: userGoal (string), sessionLog ({type, intensity, zone, hr, notes})
  // Output: { interference, tier, message, reason }
  function auditConcurrent(userGoal, sessionLog) {
    const goal = normalize(userGoal);
    const log  = sessionLog || {};
    const isStrengthGoal =
      goal.indexOf('1rm') !== -1 ||
      goal.indexOf('maximize') !== -1 ||
      goal.indexOf('max strength') !== -1 ||
      goal.indexOf('powerlift') !== -1 ||
      goal.indexOf('strength') !== -1;

    const type = normalize(log.type);
    const intensity = parseFloat(log.intensity) || 0;
    const zone = normalize(log.zone);
    const hr = parseFloat(log.hr) || 0;

    // Zone 4: HIIT type OR intensity >= 8/10 OR explicit zone 4 OR HR > 85% (assume max ~190 → >161)
    const isZone4 =
      type === 'hiit' ||
      intensity >= 8 ||
      zone === 'z4' || zone === 'zone 4' || zone === '4' ||
      hr >= 162;

    if (isStrengthGoal && isZone4) {
      return {
        interference: true,
        tier: 'red',
        reason: 'Zone 4 HIIT logged against a Maximize 1RM directive.',
        message: 'ARE Interference Warning: Zone 4 HIIT blunts 1RM adaptation. '
               + 'Concurrent protocol dictates 80% Zone 2 / 20% Zone 4 — '
               + 'your strength goal is being compromised.'
      };
    }
    return {
      interference: false,
      tier: 'green',
      reason: '',
      message: 'Concurrent load within 80/20 envelope.'
    };
  }

  // ═══════════════════════════════════════════════════════════
  // WEEKLY VOLUME EXTRACTION (helper for dashboard hook)
  // ═══════════════════════════════════════════════════════════
  // Scans session logs from the last 7 days, parses exercises, sums sets per muscle group.
  function weeklySetsByMuscle(logs) {
    const out = {};
    const cutoff = Date.now() - 7 * 86400000;
    (logs || []).forEach(function(l) {
      if (!l || !l.date || l.type === 'note' || l.type === 'rest') return;
      const t = new Date(l.date + 'T12:00:00').getTime();
      if (isNaN(t) || t < cutoff) return;
      const exs = l.exercises || [];
      exs.forEach(function(e) {
        const c = classify(e);
        if (!c.muscleGroup) return;
        const sets = parseSets(e);
        out[c.muscleGroup] = (out[c.muscleGroup] || 0) + sets;
      });
    });
    return out;
  }

  // ═══════════════════════════════════════════════════════════
  // SOVEREIGN UI RENDERERS
  // ═══════════════════════════════════════════════════════════
  // Matte Black / Yellow warning card for sequencing.
  function renderSequenceWarning(audit) {
    if (!audit || audit.ok) return '';
    const items = audit.violations.map(function(v) {
      return '<li class="are-warn-li">' + escapeHtml(v.reason) + '</li>';
    }).join('');
    return ''
      + '<div class="are-warn" role="alert" data-are-severity="caution">'
      +   '<div class="are-warn-bar"></div>'
      +   '<div class="are-warn-body">'
      +     '<div class="are-warn-tag">ARE WARNING</div>'
      +     '<div class="are-warn-title">Blunted Strength Curve Detected</div>'
      +     '<div class="are-warn-msg">Move multi-joint exercises to the start.</div>'
      +     (items ? '<ul class="are-warn-list">' + items + '</ul>' : '')
      +   '</div>'
      + '</div>';
  }

  // MAV achieved badge / MRV exceeded red banner per muscle.
  function renderVolumeBadge(group) {
    if (!group) return '';
    if (group.tier === 'mav') {
      return '<div class="are-badge are-badge-mav" title="' + escapeAttr(group.message) + '">'
           +   '<span class="are-badge-ico">&#x2713;</span>'
           +   '<span class="are-badge-txt">MAV · ' + VOLUME.YIELD_HIGH + '% YIELD</span>'
           + '</div>';
    }
    if (group.tier === 'mrv') {
      return '<div class="are-badge are-badge-mrv" title="' + escapeAttr(group.message) + '">'
           +   '<span class="are-badge-ico">&#x26A0;</span>'
           +   '<span class="are-badge-txt">MRV · CNS BURNOUT RISK</span>'
           + '</div>';
    }
    return '';
  }

  function renderInterferenceWarning(audit) {
    if (!audit || !audit.interference) return '';
    return ''
      + '<div class="are-warn are-warn-red" role="alert" data-are-severity="interference">'
      +   '<div class="are-warn-bar"></div>'
      +   '<div class="are-warn-body">'
      +     '<div class="are-warn-tag">ARE INTERFERENCE</div>'
      +     '<div class="are-warn-title">Concurrent Training Conflict</div>'
      +     '<div class="are-warn-msg">' + escapeHtml(audit.message) + '</div>'
      +   '</div>'
      + '</div>';
  }

  // Injection helper — mount warning HTML into a container.
  function injectSequenceWarning(containerId, exercises) {
    const host = (typeof containerId === 'string')
      ? document.getElementById(containerId)
      : containerId;
    if (!host) return null;
    const audit = auditSequence(exercises);
    let wrap = host.querySelector('.are-warn-slot');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'are-warn-slot';
      host.parentNode.insertBefore(wrap, host);
    }
    wrap.innerHTML = audit.ok ? '' : renderSequenceWarning(audit);
    return audit;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  return {
    // constants
    VOLUME: VOLUME,
    // core audits
    auditVolume:     auditVolume,
    auditSequence:   auditSequence,
    auditConcurrent: auditConcurrent,
    // utilities
    classify:            classify,
    parseSets:           parseSets,
    exerciseName:        exerciseName,
    weeklySetsByMuscle:  weeklySetsByMuscle,
    // renderers
    renderSequenceWarning:     renderSequenceWarning,
    renderVolumeBadge:         renderVolumeBadge,
    renderInterferenceWarning: renderInterferenceWarning,
    injectSequenceWarning:     injectSequenceWarning
  };
})();

if (typeof window !== 'undefined') window.ARE_ENGINE = ARE_ENGINE;
if (typeof module !== 'undefined' && module.exports) module.exports = ARE_ENGINE;
