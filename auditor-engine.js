// ═══════════════════════════════════════════════════════════════
// AUDITOR-ENGINE.JS — BBF Biomechanical Auditor
// Sovereign Gold Standard — Movement Quality System
// ═══════════════════════════════════════════════════════════════

var BBF_AUDITOR = (function() {
  'use strict';

  var TENSION_AREAS = [
    { id: 'lower-back', icon: '\uD83E\uDDB4', en: 'Lower Back', es: 'Espalda Baja', pt: 'Lombar' },
    { id: 'knees', icon: '\uD83E\uDDB5', en: 'Knees', es: 'Rodillas', pt: 'Joelhos' },
    { id: 'shoulders', icon: '\uD83E\uDDB6', en: 'Shoulders', es: 'Hombros', pt: 'Ombros' },
    { id: 'target-muscle', icon: '\u2705', en: 'Target Muscle', es: 'M\u00fasculo Objetivo', pt: 'M\u00fasculo Alvo' }
  ];

  var currentExercise = null;
  var currentCallback = null;

  function getLang() {
    return (typeof BBF_LANG !== 'undefined' && BBF_LANG.get) ? BBF_LANG.get() : 'en';
  }

  function triggerAuditorModal(exerciseName, onSelect) {
    currentExercise = exerciseName;
    currentCallback = onSelect || function() {};

    var L = getLang();
    var title = { en: 'Where is the primary tension?', es: '\u00bfD\u00f3nde est\u00e1 la tensi\u00f3n principal?', pt: 'Onde est\u00e1 a tens\u00e3o principal?' };
    var subtitle = { en: 'Select the area you feel working during:', es: 'Selecciona el \u00e1rea que sientes trabajar durante:', pt: 'Selecione a \u00e1rea que sente trabalhando durante:' };

    var modal = document.getElementById('auditor-modal');
    if (!modal) return;

    document.getElementById('auditor-title').textContent = title[L] || title.en;
    document.getElementById('auditor-exercise').textContent = exerciseName;
    document.getElementById('auditor-subtitle').textContent = subtitle[L] || subtitle.en;

    var grid = document.getElementById('auditor-options');
    grid.innerHTML = TENSION_AREAS.map(function(area) {
      return '<button class="aud-opt" onclick="BBF_AUDITOR.select(\'' + area.id + '\')">' +
        '<span class="aud-opt-icon">' + area.icon + '</span>' +
        '<span class="aud-opt-label">' + (area[L] || area.en) + '</span>' +
      '</button>';
    }).join('');

    modal.classList.add('on');
  }

  function select(areaId) {
    var area = TENSION_AREAS.find(function(a) { return a.id === areaId; });
    closeModal();
    if (currentCallback) {
      currentCallback({
        exercise: currentExercise,
        tensionArea: areaId,
        areaLabel: area ? area.en : areaId,
        timestamp: new Date().toISOString()
      });
    }
  }

  function closeModal() {
    var modal = document.getElementById('auditor-modal');
    if (modal) modal.classList.remove('on');
  }

  return {
    trigger: triggerAuditorModal,
    select: select,
    close: closeModal,
    TENSION_AREAS: TENSION_AREAS
  };

})();
