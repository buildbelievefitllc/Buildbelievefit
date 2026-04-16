// ═══════════════════════════════════════════════════════════════
// RPE-COMMANDER.JS — BBF Adaptive RPE Commander
// Sovereign Gold Standard — Clinical Load Prescription
// Prime Directive: 85% of 1RM = Hypertrophic Efficiency Target
// ═══════════════════════════════════════════════════════════════

var BBF_RPE = (function() {
  'use strict';

  var SOVEREIGN_TARGET = 0.85; // 85% of 1RM

  // ─── TRILINGUAL COMMAND CUES ─────────────────────────────
  var CUES = {
    increase: {
      en: 'Velocity is optimal. Increase load toward your 85% Sovereign Target.',
      es: 'La velocidad es \u00f3ptima. Aumenta la carga hacia tu Objetivo Soberano del 85%.',
      pt: 'A velocidade \u00e9 ideal. Aumente a carga em dire\u00e7\u00e3o \u00e0 sua Meta Soberana de 85%.'
    },
    hold: {
      en: 'Optimal stimulus achieved. Hold load. Master the biomechanics.',
      es: 'Est\u00edmulo \u00f3ptimo alcanzado. Mant\u00e9n la carga. Domina la biomec\u00e1nica.',
      pt: 'Est\u00edmulo ideal alcan\u00e7ado. Mantenha a carga. Domine a biomec\u00e2nica.'
    },
    decrease: {
      en: 'CNS strain detected. Reduce load to protect form and prioritize recovery.',
      es: 'Tensi\u00f3n del SNC detectada. Reduce la carga para proteger la postura y priorizar la recuperaci\u00f3n.',
      pt: 'Tens\u00e3o no SNC detectada. Reduza a carga para proteger a postura e priorizar a recupera\u00e7\u00e3o.'
    }
  };

  function getLang() {
    return (typeof BBF_LANG !== 'undefined' && BBF_LANG.get) ? BBF_LANG.get() : 'en';
  }

  // ─── SOVEREIGN LOAD CALCULATOR ───────────────────────────
  function calculateSovereignLoad(previousWeight, previousRPE, known1RM) {
    var L = getLang();
    var sovereignTarget = Math.round(known1RM * SOVEREIGN_TARGET);
    var result = { targetWeight: sovereignTarget, condition: '', cue: '', delta: 0 };

    previousWeight = parseFloat(previousWeight) || 0;
    previousRPE = parseFloat(previousRPE) || 7;
    known1RM = parseFloat(known1RM) || 0;

    if (!known1RM || known1RM <= 0) {
      // No 1RM data — estimate from previous weight and RPE
      // Epley formula variant: 1RM ≈ weight × (1 + reps/30), simplified for RPE
      known1RM = Math.round(previousWeight / (1.0278 - 0.0278 * (11 - previousRPE)));
      sovereignTarget = Math.round(known1RM * SOVEREIGN_TARGET);
      result.targetWeight = sovereignTarget;
      result.estimated1RM = known1RM;
    }

    if (previousRPE >= 1 && previousRPE <= 6) {
      // Condition A: Velocity High — increase toward 85%
      result.condition = 'increase';
      result.cue = CUES.increase[L] || CUES.increase.en;
      result.delta = sovereignTarget - previousWeight;
      // Suggest incremental increase (don't jump more than 10% at once)
      var maxJump = Math.round(previousWeight * 0.10);
      if (result.delta > maxJump && maxJump > 0) {
        result.targetWeight = previousWeight + maxJump;
        result.delta = maxJump;
      }
    } else if (previousRPE >= 7 && previousRPE <= 8) {
      // Condition B: Optimal Stimulus — hold
      result.condition = 'hold';
      result.cue = CUES.hold[L] || CUES.hold.en;
      result.targetWeight = previousWeight; // maintain
      result.delta = 0;
    } else if (previousRPE >= 9) {
      // Condition C: CNS Grind — decrease 5-10%
      result.condition = 'decrease';
      result.cue = CUES.decrease[L] || CUES.decrease.en;
      var reduction = previousRPE >= 10 ? 0.10 : 0.05;
      result.targetWeight = Math.round(previousWeight * (1 - reduction));
      result.delta = result.targetWeight - previousWeight;
    }

    result.sovereignTarget = sovereignTarget;
    result.known1RM = known1RM;
    return result;
  }

  // ─── RENDER BANNER HTML ──────────────────────────────────
  function renderBanner(result) {
    if (!result || !result.condition) return '';
    var colors = {
      increase: { bg: 'rgba(34,197,94,.08)', border: 'rgba(34,197,94,.3)', text: '#22c55e', icon: '\u2B06' },
      hold: { bg: 'rgba(212,175,55,.08)', border: 'rgba(212,175,55,.3)', text: '#D4AF37', icon: '\u2705' },
      decrease: { bg: 'rgba(239,68,68,.06)', border: 'rgba(239,68,68,.25)', text: '#ef4444', icon: '\u26A0' }
    };
    var c = colors[result.condition] || colors.hold;
    var L = getLang();
    var targetLabel = { en: 'SOVEREIGN TARGET', es: 'OBJETIVO SOBERANO', pt: 'META SOBERANA' };
    var deltaText = '';
    if (result.delta > 0) deltaText = ' (+' + result.delta + ' lbs)';
    else if (result.delta < 0) deltaText = ' (' + result.delta + ' lbs)';

    return '<div style="background:' + c.bg + ';border:1px solid ' + c.border + ';border-radius:8px;padding:.7rem 1rem;margin-bottom:.7rem;display:flex;align-items:flex-start;gap:.6rem">' +
      '<span style="font-size:1.2rem;flex-shrink:0;margin-top:2px">' + c.icon + '</span>' +
      '<div style="flex:1">' +
      '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:.7rem;letter-spacing:3px;color:' + c.text + ';margin-bottom:.2rem">' + (targetLabel[L] || targetLabel.en) + ': ' + result.targetWeight + ' LBS' + deltaText + '</div>' +
      '<div style="font-size:.8rem;color:#ccc;line-height:1.5">' + result.cue + '</div>' +
      '</div></div>';
  }

  return {
    calculate: calculateSovereignLoad,
    render: renderBanner,
    SOVEREIGN_TARGET: SOVEREIGN_TARGET,
    CUES: CUES
  };

})();
