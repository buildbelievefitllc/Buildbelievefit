// ═══════════════════════════════════════════════════════════════
// AUDITOR-ENGINE.JS — BBF Biomechanical Auditor
// Sovereign Gold Standard — Movement Quality System
// ═══════════════════════════════════════════════════════════════

const BBF_AUDITOR = (function() {
  'use strict';

  const TENSION_AREAS = [
    { id: 'lower-back', icon: '\uD83E\uDDB4', en: 'Lower Back', es: 'Espalda Baja', pt: 'Lombar' },
    { id: 'knees', icon: '\uD83E\uDDB5', en: 'Knees', es: 'Rodillas', pt: 'Joelhos' },
    { id: 'shoulders', icon: '\uD83E\uDDB6', en: 'Shoulders', es: 'Hombros', pt: 'Ombros' },
    { id: 'target-muscle', icon: '\u2705', en: 'Target Muscle', es: 'M\u00fasculo Objetivo', pt: 'M\u00fasculo Alvo' }
  ];

  // ─── FOUNDER-VERIFIED CUE MATRIX ─────────────────────────
  const CUES = {
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

  let currentExercise = null;
  let currentCallback = null;

  function getLang() {
    return (typeof BBF_LANG !== 'undefined' && BBF_LANG.get) ? BBF_LANG.get() : 'en';
  }

  // DocumentFragment + rAF paint \u2014 mirrors Sovereign guardrail.
  function paintFragment(host, html) {
    if (!host) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    const frag = tpl.content;
    const commit = function () {
      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(frag);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(commit);
    else commit();
  }

  function escapeHtmlLocal(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function triggerAuditorModal(exerciseName, onSelect) {
    currentExercise = exerciseName;
    currentCallback = onSelect || function() {};

    const L = getLang();
    const title = { en: 'Where is the primary tension?', es: '\u00bfD\u00f3nde est\u00e1 la tensi\u00f3n principal?', pt: 'Onde est\u00e1 a tens\u00e3o principal?' };
    const subtitle = { en: 'Select the area you feel working during:', es: 'Selecciona el \u00e1rea que sientes trabajar durante:', pt: 'Selecione a \u00e1rea que sente trabalhando durante:' };

    const modal = document.getElementById('auditor-modal');
    if (!modal) return;

    document.getElementById('auditor-title').textContent = title[L] || title.en;
    document.getElementById('auditor-exercise').textContent = exerciseName;
    document.getElementById('auditor-subtitle').textContent = subtitle[L] || subtitle.en;

    const grid = document.getElementById('auditor-options');
    const optsHTML = TENSION_AREAS.map(function(area) {
      return '<button class="aud-opt" data-aud-area="' + escapeHtmlLocal(area.id) + '">' +
        '<span class="aud-opt-icon">' + area.icon + '</span>' +
        '<span class="aud-opt-label">' + escapeHtmlLocal(area[L] || area.en) + '</span>' +
      '</button>';
    }).join('');
    paintFragment(grid, optsHTML);

    // Bind once the fragment is live; delegated listener avoids
    // inline onclick handlers and re-binds on every paint.
    const bind = function () {
      const g = document.getElementById('auditor-options');
      if (!g || g.__svBound) return;
      g.__svBound = true;
      g.addEventListener('click', function (ev) {
        const btn = ev.target.closest('[data-aud-area]');
        if (!btn) return;
        select(btn.getAttribute('data-aud-area'));
      });
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(bind);
    else bind();

    modal.classList.add('on');
  }

  function select(areaId) {
    const area = TENSION_AREAS.find(function(a) { return a.id === areaId; });
    const areaLabel = area ? area.en : areaId;
    const L = getLang();
    const areaDisplay = area ? (area[L] || area.en) : areaId;

    // Look up the Founder-Verified cue
    let cue = '';
    if (CUES[currentExercise] && CUES[currentExercise][areaId]) {
      cue = CUES[currentExercise][areaId];
    } else {
      // Fuzzy match — check if exercise name contains a key
      for (const movement in CUES) {
        if (currentExercise && currentExercise.toLowerCase().indexOf(movement.toLowerCase()) > -1) {
          cue = CUES[movement][areaId] || '';
          break;
        }
      }
    }

    // Display the cue in the modal instead of closing
    const grid = document.getElementById('auditor-options');
    const title = document.getElementById('auditor-title');
    const ackLabel = { en: 'ACKNOWLEDGED \u2014 BACK TO SET', es: 'RECONOCIDO \u2014 VOLVER A LA SERIE', pt: 'RECONHECIDO \u2014 VOLTAR \u00c0 S\u00c9RIE' };

    if (grid && cue) {
      title.textContent = '\uD83D\uDEE1 SOVEREIGN CUE \u2014 ' + areaDisplay;
      const cueHTML =
        '<div class="aud-cue is-active">' +
          '<div class="aud-cue-kicker">FOUNDER-VERIFIED \u2022 ' + escapeHtmlLocal(currentExercise.toUpperCase()) + '</div>' +
          '<div class="aud-cue-body">' + escapeHtmlLocal(cue) + '</div>' +
        '</div>' +
        '<div id="audit-holo-viewport" class="aud-holo-viewport"></div>' +
        '<button type="button" id="aud-cue-ack" class="aud-cue-ack">' + escapeHtmlLocal(ackLabel[L] || ackLabel.en) + '</button>';
      paintFragment(grid, cueHTML);
      const bindAck = function () {
        const ackBtn = document.getElementById('aud-cue-ack');
        if (ackBtn) ackBtn.addEventListener('click', closeModal);
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(bindAck);
      else bindAck();
      // Trigger hologram with dynamic focal point shift
      setTimeout(function() {
        try {
          if (typeof BBF_HOLOGRAM !== 'undefined' && typeof KINETIC_MAPPINGS !== 'undefined') {
            const viewport = document.getElementById('audit-holo-viewport');
            if (viewport) {
              const mapping = BBF_HOLOGRAM.findMapping(currentExercise);
              if (mapping) {
                // Shift focal point to selected tension area
                const areaCoords = {
                  'lower-back': { x: 0.5, y: 0.45 },
                  'knees': { x: 0.45, y: 0.72 },
                  'shoulders': { x: 0.42, y: 0.28 },
                  'target-muscle': mapping.focalPoint ? { x: mapping.focalPoint.x, y: mapping.focalPoint.y } : { x: 0.5, y: 0.5 }
                };
                const shifted = areaCoords[areaId] || { x: 0.5, y: 0.5 };
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
        const uid = (typeof CU !== 'undefined' && CU) ? CU : (typeof VC !== 'undefined' && VC) ? VC : 'unknown';
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
    const modal = document.getElementById('auditor-modal');
    if (modal) modal.classList.remove('on');
  }

  // ═══════════════════════════════════════════════════════════════
  // INTELLIGENCE LAYER — runKinematicAudit
  // Sits on top of BBF_SYNC.runKinematicAudit (the raw Friction Score
  // generator). Cross-references tonnage load vs recovery capacity
  // (7-day sleep avg + CNS depleted-days count + Somatic Readiness
  // Score) to flag a true biomechanical redline — high tonnage
  // accumulated WITHOUT the recovery capacity to absorb it.
  //
  // This does NOT modify the raw Friction Score. That stays the
  // canonical input signal (brain on top of the nervous system).
  // ═══════════════════════════════════════════════════════════════

  // Redline thresholds — all three conditions must fire together so
  // a bad-night-of-sleep with no training doesn't false-positive.
  const REDLINE_TONNAGE_FLOOR   = 0.80;  // friction_score >= 80 (80% of tier budget)
  const REDLINE_RECOVERY_CEIL   = 0.55;  // recovery_capacity <= 55%
  const REDLINE_DEBT_GAP        = 0.30;  // tonnage_load - recovery >= 0.30

  // Per-axial-lift mobility prescription. When a single lift drives
  // the dominant share of the 4-week axial tonnage, the Mobility CTA
  // swaps to the specific decompression protocol for that movement.
  const MOBILITY_PRESCRIPTIONS = {
    squat: {
      lift: 'squat',
      area: 'hip-lumbar',
      en: '\uD83E\uDDB5 Lumbar Decompression Protocol',
      es: '\uD83E\uDDB5 Protocolo de Descompresi\u00f3n Lumbar',
      pt: '\uD83E\uDDB5 Protocolo de Descompress\u00e3o Lombar'
    },
    deadlift: {
      lift: 'deadlift',
      area: 'posterior-chain',
      en: '\uD83E\uDDCD Thoracic Extension \u0026 Posterior Chain Reset',
      es: '\uD83E\uDDCD Extensi\u00f3n Tor\u00e1cica y Reseteo de Cadena Posterior',
      pt: '\uD83E\uDDCD Extens\u00e3o Tor\u00e1cica e Reset de Cadeia Posterior'
    },
    ohp: {
      lift: 'ohp',
      area: 'shoulder-thoracic',
      en: '\uD83D\uDCAA Rotator Cuff Reset \u0026 Thoracic Mobility',
      es: '\uD83D\uDCAA Reseteo del Manguito Rotador y Movilidad Tor\u00e1cica',
      pt: '\uD83D\uDCAA Reset do Manguito Rotador e Mobilidade Tor\u00e1cica'
    },
    mixed: {
      lift: 'mixed',
      area: 'general',
      en: '\uD83E\uDDB5 Prescribed Occupational Mobility',
      es: '\uD83E\uDDB5 Movilidad Ocupacional Prescrita',
      pt: '\uD83E\uDDB5 Mobilidade Ocupacional Prescrita'
    }
  };

  function pickDominantLift(byLift) {
    if (!byLift) return 'mixed';
    const sq = (byLift.squat    && byLift.squat.tonnage)    || 0;
    const dl = (byLift.deadlift && byLift.deadlift.tonnage) || 0;
    const oh = (byLift.ohp      && byLift.ohp.tonnage)      || 0;
    const total = sq + dl + oh;
    if (total <= 0) return 'mixed';
    // Squat or deadlift dominates if >= 55% of axial tonnage.
    if (sq / total >= 0.55) return 'squat';
    if (dl / total >= 0.55) return 'deadlift';
    // OHP uses a lower floor since pressing tonnage is inherently smaller.
    if (oh / total >= 0.40) return 'ohp';
    return 'mixed';
  }

  async function runKinematicAudit(userId) {
    if (!userId) return { biomechanical_redline: false, error: 'no uid' };
    if (typeof BBF_SYNC === 'undefined' ||
        typeof BBF_SYNC.runKinematicAudit !== 'function') {
      return { biomechanical_redline: false, error: 'BBF_SYNC unavailable' };
    }
    const nowIso   = new Date().toISOString();

    // Step 1 — raw Friction Score. Preserves the Sprint 1 engine output.
    let raw = null;
    try { raw = await BBF_SYNC.runKinematicAudit(userId); } catch(_) {}
    if (!raw) return { biomechanical_redline: false, error: 'raw audit failed' };

    // Step 2 — pull profile + readiness history from localStorage
    // (mirrored by BBF_SYNC after every sync) plus Supabase top-up.
    let profile = {};
    try {
      const d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u && d.u[userId]) profile = d.u[userId];
    } catch(_) {}
    try {
      if (BBF_SYNC.fetchUserProfile) {
        const cloud = await BBF_SYNC.fetchUserProfile(userId);
        if (cloud) profile = Object.assign({}, profile, cloud);
      }
    } catch(_) {}

    // Step 3 — recovery capacity (0..1), blended from 3 signals.
    //   0.40 × normalised sleep quality (daily_readiness 7-day mean)
    //   0.30 × (1 - depleted-days ratio over last 7)
    //   0.30 × normalised Somatic Readiness Score (0..100 -> 0..1)
    const nowMs   = Date.now();
    const DAY_MS  = 24 * 60 * 60 * 1000;
    const WEEK_MS = 7 * DAY_MS;
    const cutoff  = nowMs - WEEK_MS;

    // 7-day mean sleep. Fallback mid-value if no history.
    let sleepSum = 0, sleepCount = 0;
    const dr = profile.daily_readiness || {};
    for (const k in dr) {
      if (!Object.prototype.hasOwnProperty.call(dr, k)) continue;
      const ts = Date.parse(k);
      if (!isFinite(ts) || ts < cutoff) continue;
      const s = parseFloat((dr[k] || {}).sleep);
      if (isFinite(s) && s > 0) { sleepSum += s; sleepCount++; }
    }
    const sleepAvg = sleepCount ? (sleepSum / sleepCount) : 5;   // neutral default
    const sleepNorm = Math.max(0, Math.min(1, sleepAvg / 10));

    // CNS depleted-day count from bbf_logs type='cns-readiness' or local
    // cns_status. Supabase fetch is best-effort.
    let cnsDepletedDays = 0;
    try {
      if (BBF_SYNC.fetchLogs) {
        const logs = await BBF_SYNC.fetchLogs(userId) || [];
        const daysSeen = {};
        for (let i = 0; i < logs.length; i++) {
          const L = logs[i];
          if (!L || L.type !== 'cns-readiness') continue;
          const lts = Date.parse(L.date);
          if (!isFinite(lts) || lts < cutoff) continue;
          if (/DEPLETED/i.test(L.notes || '')) daysSeen[L.date] = true;
        }
        cnsDepletedDays = Object.keys(daysSeen).length;
      }
    } catch(_) {}
    // Also honour the live cns_status if today is DEPLETED and we have no
    // log-history coverage (offline/brand-new user).
    if (cnsDepletedDays === 0 && (profile.cns_status || '').toUpperCase() === 'DEPLETED') {
      cnsDepletedDays = 1;
    }
    const cnsRecoveryNorm = Math.max(0, Math.min(1, 1 - (cnsDepletedDays / 7)));

    // Somatic Readiness — already normalised 0..100. Neutral 55 if absent.
    let somatic = (profile.somatic_readiness_score != null)
      ? parseFloat(profile.somatic_readiness_score) : 55;
    if (!isFinite(somatic)) somatic = 55;
    const somaticNorm = Math.max(0, Math.min(1, somatic / 100));

    let recoveryCapacity =
        (sleepNorm       * 0.40) +
        (cnsRecoveryNorm * 0.30) +
        (somaticNorm     * 0.30);
    recoveryCapacity = Math.round(recoveryCapacity * 1000) / 1000;

    // Step 4 — tonnage load (friction_score / threshold -> 0..1+).
    const frictionScore = raw.friction_score || 0;
    const frictionThreshold = raw.threshold || 100;
    const tonnageLoad = Math.max(0, frictionScore / frictionThreshold);

    let recoveryDebt = Math.max(0, tonnageLoad - recoveryCapacity);
    recoveryDebt = Math.round(recoveryDebt * 1000) / 1000;

    const redline =
      tonnageLoad      >= REDLINE_TONNAGE_FLOOR &&
      recoveryCapacity <= REDLINE_RECOVERY_CEIL &&
      recoveryDebt     >= REDLINE_DEBT_GAP;

    // Step 5 — pick the dominant lift so the Mobility CTA can swap
    // to the specific decompression protocol.
    const dominant = pickDominantLift(raw.by_lift || {});
    const prescription = MOBILITY_PRESCRIPTIONS[dominant] || MOBILITY_PRESCRIPTIONS.mixed;

    // Step 6 — local mirror so the UI repaints without a round-trip.
    try {
      const dLocal = JSON.parse(localStorage.getItem('bbf_v7') || '{"u":{},"l":{},"w":{}}');
      if (!dLocal.u) dLocal.u = {};
      if (!dLocal.u[userId]) dLocal.u[userId] = {};
      dLocal.u[userId].biomechanical_redline        = !!redline;
      dLocal.u[userId].biomechanical_redline_at     = nowIso;
      dLocal.u[userId].recovery_capacity            = recoveryCapacity;
      dLocal.u[userId].recovery_debt                = recoveryDebt;
      dLocal.u[userId].dominant_axial_lift          = dominant;
      dLocal.u[userId].kinematic_audit_intelligence = {
        biomechanical_redline: !!redline,
        friction_score:        frictionScore,
        tonnage_load:          tonnageLoad,
        recovery_capacity:     recoveryCapacity,
        recovery_debt:         recoveryDebt,
        sleep_7d_avg:          Math.round(sleepAvg * 10) / 10,
        cns_depleted_days_7d:  cnsDepletedDays,
        somatic_readiness:     somatic,
        dominant_axial_lift:   dominant,
        mobility_prescription: prescription,
        computed_at:           nowIso
      };
      localStorage.setItem('bbf_v7', JSON.stringify(dLocal));
    } catch(_) {}

    // Step 7 — persist redline state to Supabase (best-effort).
    try {
      if (typeof BBF_SYNC.patchUserFields === 'function') {
        await BBF_SYNC.patchUserFields(userId, {
          biomechanical_redline:    !!redline,
          biomechanical_redline_at: nowIso,
          recovery_capacity:        recoveryCapacity,
          recovery_debt:            recoveryDebt,
          dominant_axial_lift:      dominant
        });
      }
    } catch(e) { console.warn('BBF_AUDITOR runKinematicAudit patch error:', e && e.message); }

    return {
      biomechanical_redline: !!redline,
      friction_score:        frictionScore,
      friction_threshold:    frictionThreshold,
      tonnage_load:          tonnageLoad,
      recovery_capacity:     recoveryCapacity,
      recovery_debt:         recoveryDebt,
      sleep_7d_avg:          Math.round(sleepAvg * 10) / 10,
      cns_depleted_days_7d:  cnsDepletedDays,
      somatic_readiness:     somatic,
      dominant_axial_lift:   dominant,
      mobility_prescription: prescription,
      raw_audit:             raw,
      computed_at:           nowIso
    };
  }

  return {
    trigger: triggerAuditorModal,
    select: select,
    close: closeModal,
    runKinematicAudit:      runKinematicAudit,
    pickDominantLift:       pickDominantLift,
    MOBILITY_PRESCRIPTIONS: MOBILITY_PRESCRIPTIONS,
    REDLINE_TONNAGE_FLOOR:  REDLINE_TONNAGE_FLOOR,
    REDLINE_RECOVERY_CEIL:  REDLINE_RECOVERY_CEIL,
    REDLINE_DEBT_GAP:       REDLINE_DEBT_GAP,
    TENSION_AREAS: TENSION_AREAS
  };

})();
