// ═══════════════════════════════════════════════════════════════
// PREHAB-AUDITOR.JS — BBF Pre-Hab Stiffness Assessment
// Sovereign Gold Standard — Corrective Protocol Router
// ═══════════════════════════════════════════════════════════════

var BBF_PREHAB = (function() {
  'use strict';

  var AREAS = [
    { id:'hips', icon:'\uD83E\uDDBF', en:'Hips / Pelvis', es:'Caderas / Pelvis', pt:'Quadril / Pelve' },
    { id:'shoulders', icon:'\uD83E\uDDB4', en:'Shoulders / Upper Back', es:'Hombros / Espalda Alta', pt:'Ombros / Costas Superiores' },
    { id:'lower-back', icon:'\uD83E\uDDB5', en:'Lower Back', es:'Espalda Baja', pt:'Lombar' },
    { id:'knees', icon:'\uD83E\uDDB6', en:'Knees / Ankles', es:'Rodillas / Tobillos', pt:'Joelhos / Tornozelos' }
  ];

  // ─── 3-MINUTE CORRECTIVE PROTOCOLS (3 movements each) ────
  var PROTOCOLS = {
    'hips': [
      { en:'90/90 Hip Stretch — 30s each side', es:'Estiramiento 90/90 de Cadera — 30s cada lado', pt:'Alongamento 90/90 do Quadril — 30s cada lado' },
      { en:'Glute Bridge with 2s pause — 15 reps', es:'Puente de Glúteos con pausa de 2s — 15 reps', pt:'Ponte de Glúteos com pausa de 2s — 15 reps' },
      { en:'Lateral Band Walk — 10 steps each direction', es:'Caminata Lateral con Banda — 10 pasos cada dirección', pt:'Caminhada Lateral com Faixa — 10 passos cada direção' }
    ],
    'shoulders': [
      { en:'Wall Slides — 10 slow reps', es:'Deslizamientos en Pared — 10 reps lentas', pt:'Deslizamentos na Parede — 10 reps lentas' },
      { en:'Band External Rotation — 15 reps each arm', es:'Rotación Externa con Banda — 15 reps cada brazo', pt:'Rotação Externa com Faixa — 15 reps cada braço' },
      { en:'Cat-Cow Thoracic Focus — 10 reps', es:'Gato-Vaca con Enfoque Torácico — 10 reps', pt:'Gato-Vaca com Foco Torácico — 10 reps' }
    ],
    'lower-back': [
      { en:'Cat-Cow Mobilization — 10 controlled reps', es:'Movilización Gato-Vaca — 10 reps controladas', pt:'Mobilização Gato-Vaca — 10 reps controladas' },
      { en:'Child\'s Pose Hold — 45 seconds', es:'Postura del Niño — 45 segundos', pt:'Postura da Criança — 45 segundos' },
      { en:'Dead Bug — 8 reps each side', es:'Dead Bug — 8 reps cada lado', pt:'Dead Bug — 8 reps cada lado' }
    ],
    'knees': [
      { en:'Single-Leg Balance — 30s each foot', es:'Equilibrio en Una Pierna — 30s cada pie', pt:'Equilíbrio em Uma Perna — 30s cada pé' },
      { en:'Calf Raise with 2s Pause — 15 reps', es:'Elevación de Talones con Pausa de 2s — 15 reps', pt:'Elevação de Panturrilha com Pausa de 2s — 15 reps' },
      { en:'Ankle Circles — 10 each direction per foot', es:'Círculos de Tobillo — 10 cada dirección por pie', pt:'Círculos de Tornozelo — 10 cada direção por pé' }
    ]
  };

  var currentCallback = null;

  function getLang() {
    return (typeof BBF_LANG !== 'undefined' && BBF_LANG.get) ? BBF_LANG.get() : 'en';
  }

  function triggerPreHabAudit(onComplete) {
    currentCallback = onComplete || function() {};
    var L = getLang();
    var title = { en:'Sovereign System Check', es:'Verificación del Sistema Soberano', pt:'Verificação do Sistema Soberano' };
    var subtitle = { en:'Identify your primary area of stiffness today.', es:'Identifica tu área principal de rigidez hoy.', pt:'Identifique sua área principal de rigidez hoje.' };

    var modal = document.getElementById('prehab-audit-modal');
    if (!modal) return;

    document.getElementById('prehab-audit-title').textContent = title[L] || title.en;
    document.getElementById('prehab-audit-sub').textContent = subtitle[L] || subtitle.en;

    var grid = document.getElementById('prehab-audit-options');
    grid.innerHTML = AREAS.map(function(a) {
      return '<button class="aud-opt" onclick="BBF_PREHAB.selectArea(\'' + a.id + '\')">' +
        '<span class="aud-opt-icon">' + a.icon + '</span>' +
        '<span class="aud-opt-label">' + (a[L] || a.en) + '</span>' +
      '</button>';
    }).join('');

    modal.classList.add('on');
  }

  function selectArea(areaId) {
    var L = getLang();
    var area = AREAS.find(function(a) { return a.id === areaId; });
    var protocol = PROTOCOLS[areaId] || [];
    var areaLabel = area ? (area[L] || area.en) : areaId;

    var protocolTitle = { en:'3-MINUTE CORRECTIVE PROTOCOL', es:'PROTOCOLO CORRECTIVO DE 3 MINUTOS', pt:'PROTOCOLO CORRETIVO DE 3 MINUTOS' };
    var ackLabel = { en:'BEGIN WORKOUT \u2192', es:'INICIAR ENTRENAMIENTO \u2192', pt:'INICIAR TREINO \u2192' };

    var grid = document.getElementById('prehab-audit-options');
    var title = document.getElementById('prehab-audit-title');

    title.textContent = '\uD83D\uDEE1 ' + areaLabel;
    grid.innerHTML =
      '<div style="grid-column:span 2;background:#0a0a0a;border-left:3px solid #D4AF37;border-radius:0 8px 8px 0;padding:1rem">' +
      '<div style="font-size:.62rem;font-weight:700;letter-spacing:3px;color:#D4AF37;margin-bottom:.8rem">' + (protocolTitle[L] || protocolTitle.en) + '</div>' +
      protocol.map(function(p, i) {
        return '<div style="display:flex;gap:.8rem;align-items:flex-start;margin-bottom:.6rem">' +
          '<span style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:#D4AF37;min-width:24px">' + (i + 1) + '</span>' +
          '<span style="font-size:.88rem;color:#ddd;line-height:1.5">' + (p[L] || p.en) + '</span></div>';
      }).join('') +
      '</div>' +
      '<button onclick="BBF_PREHAB.acknowledge(\'' + areaId + '\')" style="grid-column:span 2;margin-top:.5rem;padding:.8rem;background:#D4AF37;color:#0a0a0a;font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;letter-spacing:2px;border:none;border-radius:6px;cursor:pointer">' + (ackLabel[L] || ackLabel.en) + '</button>';

    // Cloud sync
    try {
      if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.logAuditRequest) {
        var uid = (typeof CU !== 'undefined' && CU) ? CU : 'unknown';
        BBF_SYNC.logAuditRequest(uid, 'Pre-Hab Audit', areaId);
      }
    } catch (e) { console.error('BBF_PREHAB: Sync error', e); }
  }

  function acknowledge(areaId) {
    closeModal();
    if (currentCallback) currentCallback({ area: areaId, timestamp: new Date().toISOString() });
  }

  function closeModal() {
    var modal = document.getElementById('prehab-audit-modal');
    if (modal) modal.classList.remove('on');
  }

  return {
    trigger: triggerPreHabAudit,
    selectArea: selectArea,
    acknowledge: acknowledge,
    close: closeModal,
    AREAS: AREAS,
    PROTOCOLS: PROTOCOLS
  };

})();
