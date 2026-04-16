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

  // ─── FOUNDER-VERIFIED CUE MATRIX ─────────────────────────
  var CUES = {
    'Squat':{
      'lower-back':'Core bracing compromised. Do not let your chest collapse. Drive the floor away. If your hips rise faster than your shoulders, the load is shifting to the spine.',
      'knees':'Check your shin angle. Ensure your front knee isn\u2019t tracking too far past your toes. Stabilize through the mid-foot. Widen stance if valgus collapse is present.',
      'shoulders':'Bar placement may be too high or too narrow. Adjust grip width and ensure thoracic extension. Shoulder mobility drill required pre-set.',
      'target-muscle':'Tension confirmed in the quads and glutes. Maintain depth and tempo. Drive through the heels and squeeze at the top.'
    },
    'Deadlift':{
      'lower-back':'Engage your lats to pull the slack out of the bar. Hinge at the hips; do not pull with the spine. If your back rounds, the weight exceeds your current bracing capacity.',
      'knees':'Knee tracking is likely too far forward at the start. Set your shins vertical before the pull. Push the floor away rather than pulling the bar up.',
      'shoulders':'Upper back rounding detected. Depress and retract the scapulae before initiating the pull. Strengthen your upper back with rows and face pulls.',
      'target-muscle':'Posterior chain engaged correctly. Hamstrings and glutes are the primary movers. Maintain the hip hinge pattern and lock out with the glutes.'
    },
    'Bench Press':{
      'lower-back':'Excessive lumbar arch. Maintain a natural arch but plant your feet firmly. If your lower back lifts off the bench, reduce the load and brace harder.',
      'knees':'Unlikely tension point for bench. Check foot position \u2014 feet should be flat or firmly planted to create leg drive without knee strain.',
      'shoulders':'Scapular retraction lost. Pin your shoulder blades to the bench and protect the AC joint. If the bar path drifts too far toward the neck, widen your grip.',
      'target-muscle':'Pec and tricep activation confirmed. Focus on the eccentric \u2014 control the descent to maximize time under tension.'
    },
    'Row':{
      'lower-back':'Torso angle is leaking power. Hinge deeper and brace the core. Pull to the hip crease, not the chest. If your torso rises during the pull, the weight is too heavy.',
      'knees':'Slight knee bend is correct. If you feel knee strain, check that you\u2019re hinging at the hips and not squatting the row.',
      'shoulders':'Ensure you\u2019re initiating the pull with the scapulae, not the biceps. Retract first, then pull. Elbows should track close to the body.',
      'target-muscle':'Lat and rhomboid engagement confirmed. Squeeze at peak contraction for 1 second. Control the eccentric to build thickness.'
    },
    'Overhead Press':{
      'lower-back':'Ribcage is flaring. Squeeze the glutes and lock the pelvis to protect the lumbar spine. If you\u2019re arching, reduce the load and press strict.',
      'knees':'Minimal knee involvement. Ensure you\u2019re not using leg drive unless performing a push press. Lock the knees and stabilize.',
      'shoulders':'Check for impingement. If pain is present at the top of the ROM, switch to a neutral grip or landmine press. Warm up the rotator cuff before pressing.',
      'target-muscle':'Anterior and lateral delts engaged. Press the bar in a slight arc around the face and lock out directly overhead. Straight bar path is the goal.'
    },
    'Lunge':{
      'lower-back':'Trunk is leaning forward excessively. Stay vertical through the torso. Engage the core and keep your eyes forward, not down.',
      'knees':'Step-length may be too short, forcing shear stress on the patella. Widen the stance and drop straight down. Ensure the front shin stays near vertical.',
      'shoulders':'If holding dumbbells, check grip fatigue. For barbell lunges, ensure the bar sits on the upper traps, not the cervical spine.',
      'target-muscle':'Quad and glute activation confirmed. For more glute emphasis, take a longer stride. For quad emphasis, keep the step shorter and more upright.'
    },
    'Plank':{
      'lower-back':'Hips are sagging. Tuck the pelvis under (posterior tilt) and squeeze the glutes. If you cannot hold without lower back pain, elevate your hands to reduce load.',
      'knees':'Knees should be locked and quads engaged. If knee discomfort persists, place a pad under the knees or switch to an incline plank.',
      'shoulders':'Shoulder blades are winging. Push the floor away (protraction) and externally rotate the hands slightly. Ensure elbows are directly under the shoulders.',
      'target-muscle':'Core engagement confirmed. Breathe through the brace \u2014 do not hold your breath. Aim for quality time, not maximum time.'
    },
    'Pull-up':{
      'lower-back':'Excessive extension (swinging). Engage the core and cross the ankles. If you\u2019re kipping, switch to a dead hang strict pull for true lat development.',
      'knees':'Minimal involvement. If knee discomfort occurs during hanging, check for hip flexor tightness pulling on the pelvis.',
      'shoulders':'Initiate the pull by depressing the scapulae first \u2014 pull your shoulder blades into your back pockets before bending the elbows. Protect the labrum.',
      'target-muscle':'Lat engagement confirmed. Drive the elbows down and back. Chin over bar with control. Eccentric should be 2-3 seconds minimum.'
    },
    'Dip':{
      'lower-back':'Maintain a slight forward lean for chest emphasis, but do not hyperextend the lumbar. Keep the core tight throughout.',
      'knees':'Knees should be bent and tucked. If using a dip belt with weight, ensure the chain isn\u2019t swinging \u2014 control the load.',
      'shoulders':'Do not descend past 90 degrees at the elbow if you have anterior shoulder instability. Stop at parallel. Retract the scapulae at the top.',
      'target-muscle':'Chest and tricep engagement confirmed. For more chest, lean forward. For more tricep, stay upright. Lock out at the top for full contraction.'
    },
    'Bicep Curl':{
      'lower-back':'You\u2019re using momentum. If the lower back is arching to swing the weight, reduce the load immediately. Strict form or use a preacher bench.',
      'knees':'Minimal involvement. Ensure you\u2019re standing with soft knees, not locking them out. Stabilize through the core.',
      'shoulders':'Anterior deltoid is compensating. Pin the elbows to your sides and do not let them drift forward during the curl. Isolate the biceps.',
      'target-muscle':'Bicep engagement confirmed. Control the eccentric \u2014 3 seconds down. Supinate at the top for peak contraction. No swinging.'
    }
  };

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
    var areaLabel = area ? area.en : areaId;
    var L = getLang();
    var areaDisplay = area ? (area[L] || area.en) : areaId;

    // Look up the Founder-Verified cue
    var cue = '';
    if (CUES[currentExercise] && CUES[currentExercise][areaId]) {
      cue = CUES[currentExercise][areaId];
    } else {
      // Fuzzy match — check if exercise name contains a key
      for (var movement in CUES) {
        if (currentExercise && currentExercise.toLowerCase().indexOf(movement.toLowerCase()) > -1) {
          cue = CUES[movement][areaId] || '';
          break;
        }
      }
    }

    // Display the cue in the modal instead of closing
    var grid = document.getElementById('auditor-options');
    var title = document.getElementById('auditor-title');
    var ackLabel = { en: 'ACKNOWLEDGED \u2014 BACK TO SET', es: 'RECONOCIDO \u2014 VOLVER A LA SERIE', pt: 'RECONHECIDO \u2014 VOLTAR \u00c0 S\u00c9RIE' };

    if (grid && cue) {
      title.textContent = '\uD83D\uDEE1 SOVEREIGN CUE \u2014 ' + areaDisplay;
      grid.innerHTML =
        '<div style="grid-column:span 2;background:#0a0a0a;border-left:3px solid #D4AF37;border-radius:0 8px 8px 0;padding:1rem">' +
        '<div style="font-size:.65rem;font-weight:700;letter-spacing:3px;color:#D4AF37;margin-bottom:.5rem">FOUNDER-VERIFIED \u2022 ' + currentExercise.toUpperCase() + '</div>' +
        '<div style="font-size:.92rem;color:#ddd;line-height:1.7">' + cue + '</div>' +
        '</div>' +
        '<div id="audit-holo-viewport" style="grid-column:span 2;position:relative;width:100%;height:160px;background:#060606;border:1px solid #1e1e1e;border-radius:8px;margin-top:.5rem;overflow:hidden"></div>' +
        '<button onclick="BBF_AUDITOR.close()" style="grid-column:span 2;margin-top:.5rem;padding:.8rem;background:#D4AF37;color:#0a0a0a;font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;letter-spacing:2px;border:none;border-radius:6px;cursor:pointer">' + (ackLabel[L] || ackLabel.en) + '</button>';
      // Trigger hologram with dynamic focal point shift
      setTimeout(function() {
        try {
          if (typeof BBF_HOLOGRAM !== 'undefined' && typeof KINETIC_MAPPINGS !== 'undefined') {
            var viewport = document.getElementById('audit-holo-viewport');
            if (viewport) {
              var mapping = BBF_HOLOGRAM.findMapping(currentExercise);
              if (mapping) {
                // Shift focal point to selected tension area
                var areaCoords = {
                  'lower-back': { x: 0.5, y: 0.45 },
                  'knees': { x: 0.45, y: 0.72 },
                  'shoulders': { x: 0.42, y: 0.28 },
                  'target-muscle': mapping.focalPoint ? { x: mapping.focalPoint.x, y: mapping.focalPoint.y } : { x: 0.5, y: 0.5 }
                };
                var shifted = areaCoords[areaId] || { x: 0.5, y: 0.5 };
                mapping._overrideFocal = { x: shifted.x, y: shifted.y, radius: 0.09, label: { en: areaLabel, es: areaDisplay, pt: areaDisplay } };
              }
              BBF_HOLOGRAM.toggle('audit-holo-viewport', currentExercise);
              if (mapping) delete mapping._overrideFocal;
            }
          }
        } catch (e) { console.error('Hologram bridge error:', e); }
      }, 100);
    } else {
      closeModal();
    }

    // Push to Supabase cloud
    try {
      if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.logAuditRequest) {
        var uid = (typeof CU !== 'undefined' && CU) ? CU : (typeof VC !== 'undefined' && VC) ? VC : 'unknown';
        BBF_SYNC.logAuditRequest(uid, currentExercise, areaLabel)
          .then(function() { console.log('BBF_AUDITOR: Synced to cloud \u2014 ' + currentExercise + ' / ' + areaLabel); })
          .catch(function(e) { console.error('BBF_AUDITOR: Cloud sync failed \u2014', e); });
      }
    } catch (e) { console.error('BBF_AUDITOR: Sync error \u2014', e); }

    if (currentCallback) {
      currentCallback({
        exercise: currentExercise,
        tensionArea: areaId,
        areaLabel: areaLabel,
        cue: cue,
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
