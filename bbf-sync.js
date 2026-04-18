// ═══════════════════════════════════════════════════════════════
// BBF-SYNC.JS — Supabase Cloud Sync Layer
// Sovereign Gold Standard — Data Accountability Engine
// localStorage = offline cache, Supabase = source of truth
// ═══════════════════════════════════════════════════════════════

var BBF_SYNC = (function() {
  'use strict';

  var SUPA_URL = 'https://ihclbceghxpuawymlvgi.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY2xiY2VnaHhwdWF3eW1sdmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTk1MDIsImV4cCI6MjA5MTg3NTUwMn0.0f7d1aqtygMR__QiyYYUB87yrFLaSRihVQdiFaIhsP0';
  var REST = SUPA_URL + '/rest/v1';

  // ─── HTTP HELPER ─────────────────────────────────────────
  function supa(method, table, body, query) {
    var url = REST + '/' + table + (query || '');
    var opts = {
      method: method,
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : 'return=minimal'
      }
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function(r) {
      if (!r.ok) return r.text().then(function(t) { console.warn('BBF_SYNC error:', t); return null; });
      if (r.status === 204) return null;
      return r.json();
    }).catch(function(e) { console.warn('BBF_SYNC offline:', e.message); return null; });
  }

  // ─── SYNC: USER PROFILE ──────────────────────────────────
  function syncUser(uid, userData) {
    if (!uid || !userData) return Promise.resolve();
    return supa('POST', 'bbf_users', {
      id: uid,
      name: userData.name || uid,
      role: userData.role || 'client',
      type: userData.type || 'Essentials',
      goal: userData.goal || '',
      goal_weight: userData.gw || '',
      plan: userData.plan || null,
      schedule: userData.schedule || 'standard',
      stress_mode: userData.stress_mode || 'desk',
      access_status: userData.access_status || 'unlocked',
      recovery_note: userData.recovery_note || '',
      pin_hash: userData.pin_hash || null,
      auto_lock_enabled: userData.auto_lock_enabled || false,
      lock_expiry: userData.lock_expiry || null,
      updated_at: new Date().toISOString()
    });
  }

  // ─── SYNC: WORKOUT LOG ───────────────────────────────────
  function syncLog(uid, logEntry) {
    if (!uid || !logEntry) return Promise.resolve();
    return supa('POST', 'bbf_logs', {
      user_id: uid,
      date: logEntry.date,
      type: logEntry.type || 'strength',
      duration: logEntry.dur || '',
      intensity: logEntry.int || logEntry.intensity || '',
      weight: logEntry.wt || '',
      body_fat: logEntry.bf || '',
      notes: logEntry.notes || '',
      mood: logEntry.mood || '',
      exercises: logEntry.exercises || [],
      logged_at: logEntry.loggedAt || new Date().toISOString(),
      logged_by: logEntry.loggedBy || uid
    });
  }

  // ─── SYNC: WORKOUT SET ───────────────────────────────────
  function syncSet(uid, dayKey, exKey, setNum, field, value) {
    if (!uid) return Promise.resolve();
    var row = { user_id: uid, day_key: dayKey, exercise_key: exKey, set_num: setNum };
    row[field === 'r' ? 'reps' : 'weight'] = value;
    row.logged_at = new Date().toISOString();
    return supa('POST', 'bbf_sets', row);
  }

  // ─── SYNC: READINESS ─────────────────────────────────────
  function syncReadiness(uid, date, data) {
    if (!uid || !data) return Promise.resolve();
    return supa('POST', 'bbf_readiness', {
      user_id: uid,
      date: date,
      sleep: data.sleep,
      stress: data.stress,
      energy: data.energy,
      score: data.score,
      logged_at: new Date().toISOString()
    });
  }

  // ─── FETCH: ALL LOGS FOR USER ────────────────────────────
  function fetchLogs(uid) {
    return supa('GET', 'bbf_logs', null, '?user_id=eq.' + uid + '&order=date.desc&limit=100');
  }

  // ─── FETCH: ALL SETS FOR USER ────────────────────────────
  function fetchSets(uid) {
    return supa('GET', 'bbf_sets', null, '?user_id=eq.' + uid + '&order=day_key.desc&limit=500');
  }

  // ─── FETCH: ALL USERS (TRAINER VIEW) ─────────────────────
  function fetchAllUsers() {
    return supa('GET', 'bbf_users', null, '?order=name.asc');
  }

  // ─── FETCH: SINGLE USER ──────────────────────────────────
  function fetchUser(uid) {
    return supa('GET', 'bbf_users', null, '?id=eq.' + uid + '&limit=1');
  }

  // ─── FETCH: ALL LOGS (TRAINER VIEW) ──────────────────────
  function fetchAllLogs() {
    return supa('GET', 'bbf_logs', null, '?order=logged_at.desc&limit=500');
  }

  // ─── FETCH: READINESS FOR USER ───────────────────────────
  function fetchReadiness(uid) {
    return supa('GET', 'bbf_readiness', null, '?user_id=eq.' + uid + '&order=date.desc&limit=30');
  }

  // ─── BULK SYNC: Push all localStorage to Supabase ────────
  function pushAll() {
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      var promises = [];

      // Sync all users
      for (var uid in (d.u || {})) {
        promises.push(syncUser(uid, d.u[uid]));
      }

      // Sync all logs
      for (var uid2 in (d.l || {})) {
        (d.l[uid2] || []).forEach(function(log) {
          promises.push(syncLog(uid2, log));
        });
      }

      // Sync all sets
      for (var uid3 in (d.w || {})) {
        for (var dk in (d.w[uid3] || {})) {
          for (var ek in (d.w[uid3][dk] || {})) {
            (d.w[uid3][dk][ek] || []).forEach(function(set, si) {
              if (set.r || set.w) {
                promises.push(syncSet(uid3, dk, ek, si, 'r', set.r || ''));
                if (set.w) promises.push(syncSet(uid3, dk, ek, si, 'w', set.w));
              }
            });
          }
        }
      }

      return Promise.all(promises).then(function() {
        return promises.length;
      });
    } catch (e) {
      console.warn('BBF_SYNC pushAll error:', e);
      return Promise.resolve(0);
    }
  }

  // ─── SYNC: AUDIT REQUEST ──────────────────────────────────
  function logAuditRequest(uid, exerciseName, tensionArea) {
    if (!uid || !exerciseName) return Promise.resolve();
    return supa('POST', 'bbf_logs', {
      user_id: uid,
      date: new Date().toISOString().slice(0, 10),
      type: 'audit',
      notes: 'Audit: ' + exerciseName + ' — Tension: ' + tensionArea,
      logged_at: new Date().toISOString(),
      logged_by: uid
    });
  }

  // ─── ONLINE STATUS ───────────────────────────────────────
  function isOnline() { return navigator.onLine; }

  // ─── FETCH: PENDING AUDIT REQUESTS (TRAINER VIEW) ─────────
  function fetchPendingAudits() {
    return supa('GET', 'bbf_logs', null,
      '?type=eq.audit&order=logged_at.desc&limit=100'
    ).then(function(data) {
      if (!data) return [];
      return data.map(function(entry) {
        return {
          user_id: entry.user_id,
          user_name: entry.logged_by || entry.user_id,
          notes: entry.notes || '',
          date: entry.date,
          logged_at: entry.logged_at
        };
      });
    }).catch(function(e) { console.error('BBF_SYNC fetchPendingAudits error:', e); return []; });
  }

  // ─── FETCH: HISTORICAL RPE FOR EXERCISE ───────────────────
  function fetchHistoricalRPE(uid, exerciseName) {
    // Query bbf_logs for the most recent audit/strength entry matching this exercise
    return supa('GET', 'bbf_logs', null,
      '?user_id=eq.' + uid +
      '&notes=like.*' + encodeURIComponent(exerciseName) + '*' +
      '&order=logged_at.desc&limit=1'
    ).then(function(data) {
      if (data && data.length > 0) {
        var entry = data[0];
        return {
          weight: entry.weight || '',
          rpe: entry.intensity || '',
          notes: entry.notes || '',
          date: entry.date
        };
      }
      return null;
    }).catch(function(e) { console.error('BBF_SYNC fetchHistoricalRPE error:', e); return null; });
  }

  // ─── SYNC: PRE-HAB NEED ──────────────────────────────────
  function logPreHabNeed(uid, stiffnessArea) {
    if (!uid) return Promise.resolve();
    return supa('POST', 'bbf_logs', {
      user_id: uid,
      date: new Date().toISOString().slice(0, 10),
      type: 'prehab',
      notes: 'Pre-Hab: Stiffness — ' + stiffnessArea,
      logged_at: new Date().toISOString(),
      logged_by: uid
    }).catch(function(e) { console.error('BBF_SYNC logPreHabNeed error:', e); return null; });
  }

  // ─── TOGGLE: SOVEREIGN TRIAL ──────────────────────────────
  function toggleSovereignTrial(userId, isTrialActive) {
    if (!userId) return Promise.resolve(null);
    var payload = {
      id: userId,
      updated_at: new Date().toISOString()
    };
    if (isTrialActive) {
      payload.trial_status = 'active';
      payload.trial_start_date = new Date().toISOString();
    } else {
      payload.trial_status = 'inactive';
    }
    return supa('POST', 'bbf_users', payload)
      .catch(function(e) { console.error('BBF_SYNC toggleSovereignTrial error:', e); return null; });
  }

  // ─── PROCESS: TIER UPGRADE ────────────────────────────────
  function processTierUpgrade(userId) {
    if (!userId) return Promise.resolve(null);
    // Update localStorage
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u[userId]) {
        d.u[userId].type = 'All-Pro';
        d.u[userId].trial_status = 'completed';
        if (!d.u[userId].unlocked_bonuses) d.u[userId].unlocked_bonuses = [];
        if (d.u[userId].unlocked_bonuses.indexOf('Sovereign 16:8 Fasting Blueprint') === -1) {
          d.u[userId].unlocked_bonuses.push('Sovereign 16:8 Fasting Blueprint');
        }
        localStorage.setItem('bbf_v7', JSON.stringify(d));
      }
    } catch(e) { console.error('BBF_SYNC processTierUpgrade localStorage error:', e); }
    // Sync to Supabase
    return supa('POST', 'bbf_users', {
      id: userId,
      type: 'All-Pro',
      trial_status: 'completed',
      updated_at: new Date().toISOString()
    }).catch(function(e) { console.error('BBF_SYNC processTierUpgrade cloud error:', e); return null; });
  }

  // ─── HOUSEHOLD SYNC ──────────────────────────────────────
  function linkHouseholdAccounts(parentId, youthId) {
    if (!parentId || !youthId) return Promise.resolve(null);
    var householdId = parentId + '_household';
    // Update both users with the same household_id
    var p1 = supa('POST', 'bbf_users', {
      id: parentId,
      household_id: householdId,
      household_role: 'parent',
      updated_at: new Date().toISOString()
    });
    var p2 = supa('POST', 'bbf_users', {
      id: youthId,
      household_id: householdId,
      household_role: 'youth',
      updated_at: new Date().toISOString()
    });
    // Also save to localStorage
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u[parentId]) { d.u[parentId].household_id = householdId; d.u[parentId].household_role = 'parent'; }
      if (d.u[youthId]) { d.u[youthId].household_id = householdId; d.u[youthId].household_role = 'youth'; }
      localStorage.setItem('bbf_v7', JSON.stringify(d));
    } catch(e) { console.error('BBF_SYNC linkHousehold localStorage error:', e); }
    return Promise.all([p1, p2])
      .then(function() { console.log('BBF_SYNC: Household linked — ' + householdId); return householdId; })
      .catch(function(e) { console.error('BBF_SYNC linkHouseholdAccounts error:', e); return null; });
  }

  function fetchHouseholdActivity(householdId) {
    if (!householdId) return Promise.resolve([]);
    // Get all users in this household
    return supa('GET', 'bbf_users', null, '?household_id=eq.' + householdId + '&select=id,name')
      .then(function(members) {
        if (!members || !members.length) return [];
        var memberIds = members.map(function(m) { return m.id; });
        // Fetch last 48 hours of logs for all household members
        var cutoff = new Date(Date.now() - 48 * 3600000).toISOString();
        return supa('GET', 'bbf_logs', null,
          '?user_id=in.(' + memberIds.join(',') + ')&logged_at=gte.' + cutoff + '&order=logged_at.desc&limit=50'
        ).then(function(logs) {
          return {
            household_id: householdId,
            members: members,
            activity: logs || []
          };
        });
      })
      .catch(function(e) { console.error('BBF_SYNC fetchHouseholdActivity error:', e); return []; });
  }

  // ─── CNS READINESS MAP ──────────────────────────────────
  var SOVEREIGN_SHIFTS = {
    'Barbell Back Squat': 'Leg Press',
    'Barbell Squat': 'Leg Press',
    'Squat': 'Leg Press',
    'Conventional Deadlift': 'Seated Hamstring Curl / Back Extension',
    'Deadlift': 'Seated Hamstring Curl / Back Extension',
    'Romanian Deadlift': 'Lying Hamstring Curl',
    'Overhead Barbell Press': 'Seated Dumbbell Press',
    'Overhead Press': 'Seated Dumbbell Press',
    'Barbell Row': 'Seated Cable Row',
    'Bench Press': 'Machine Chest Press',
    'Power Clean': 'Lat Pulldown + DB Shrug',
    'Hang Clean': 'Lat Pulldown + DB Shrug',
    'Walking Lunges': 'Leg Extension + Leg Curl',
    'Bulgarian Split Squats': 'Single-Leg Press'
  };

  function logMorningReadiness(userId, sleepHours, stressLevel) {
    if (!userId) return Promise.resolve(null);
    var sleep = parseFloat(sleepHours) || 0;
    var stress = (stressLevel || '').toLowerCase();
    var cns_status = 'FRICTION';
    if (sleep >= 7 && (stress === 'low' || stress === 'calm')) {
      cns_status = 'TITAN';
    } else if (sleep < 5 || stress === 'high' || stress === 'severe') {
      cns_status = 'DEPLETED';
    }
    // Save to localStorage
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u[userId]) {
        d.u[userId].cns_status = cns_status;
        d.u[userId].cns_date = new Date().toISOString().slice(0, 10);
        d.u[userId].cns_sleep = sleep;
        d.u[userId].cns_stress = stressLevel;
        localStorage.setItem('bbf_v7', JSON.stringify(d));
      }
    } catch(e) {}
    // Sync to Supabase
    return supa('POST', 'bbf_logs', {
      user_id: userId,
      date: new Date().toISOString().slice(0, 10),
      type: 'cns-readiness',
      notes: 'CNS: ' + cns_status + ' | Sleep: ' + sleep + 'h | Stress: ' + stressLevel,
      logged_at: new Date().toISOString(),
      logged_by: userId
    }).then(function() { return cns_status; })
      .catch(function(e) { console.error('BBF_SYNC logMorningReadiness error:', e); return cns_status; });
  }

  function evaluateBlueprint(dailyWorkoutArray, cnsStatus) {
    if (!dailyWorkoutArray || !dailyWorkoutArray.length) return dailyWorkoutArray;
    if (cnsStatus !== 'DEPLETED') return dailyWorkoutArray;
    return dailyWorkoutArray.map(function(exercise) {
      var name = exercise.name || '';
      var shifted = false;
      var replacement = name;
      for (var key in SOVEREIGN_SHIFTS) {
        if (name.toLowerCase().indexOf(key.toLowerCase()) > -1) {
          replacement = SOVEREIGN_SHIFTS[key];
          shifted = true;
          break;
        }
      }
      return {
        name: shifted ? replacement : name,
        original_name: shifted ? name : undefined,
        is_shifted: shifted,
        sets: exercise.sets,
        reps: exercise.reps,
        equipment: exercise.equipment,
        notes: shifted ? 'CNS Sovereign Shift: ' + name + ' \u2192 ' + replacement : (exercise.notes || '')
      };
    });
  }

  // ─── YOUTH ATHLETE EVOLUTION ─────────────────────────────
  function initYouthAttributes(uid) {
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u[uid] && !d.u[uid].attributes) {
        d.u[uid].attributes = { power: 70, agility: 70, discipline: 70 };
        localStorage.setItem('bbf_v7', JSON.stringify(d));
      }
    } catch(e) {}
  }

  function processAthleteEvolution(uid, workoutType) {
    if (!uid) return;
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (!d.u[uid]) return;
      if (!d.u[uid].attributes) d.u[uid].attributes = { power: 70, agility: 70, discipline: 70 };
      var a = d.u[uid].attributes;
      var wt = (workoutType || '').toLowerCase();
      if (wt.indexOf('agility') > -1 || wt.indexOf('trench') > -1 || wt.indexOf('lateral') > -1 || wt.indexOf('speed') > -1) {
        a.agility = Math.min(99, parseFloat((a.agility + 0.5).toFixed(1)));
      }
      if (wt.indexOf('strength') > -1 || wt.indexOf('power') > -1 || wt.indexOf('squat') > -1 || wt.indexOf('press') > -1 || wt.indexOf('deadlift') > -1) {
        a.power = Math.min(99, parseFloat((a.power + 0.5).toFixed(1)));
      }
      d.u[uid].attributes = a;
      localStorage.setItem('bbf_v7', JSON.stringify(d));
    } catch(e) { console.error('BBF_SYNC processAthleteEvolution error:', e); }
  }

  function incrementDiscipline(uid) {
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (!d.u[uid]) return;
      if (!d.u[uid].attributes) d.u[uid].attributes = { power: 70, agility: 70, discipline: 70 };
      d.u[uid].attributes.discipline = Math.min(99, d.u[uid].attributes.discipline + 1);
      localStorage.setItem('bbf_v7', JSON.stringify(d));
    } catch(e) {}
  }

  // ─── HOUSEHOLD REACTION ──────────────────────────────────
  function sendHouseholdReaction(senderId, receiverId, reactionType) {
    if (!senderId || !receiverId) return Promise.resolve(null);
    var validReactions = ['FIRE', 'FLEX', 'SILVERBACK'];
    if (validReactions.indexOf(reactionType) === -1) reactionType = 'FIRE';
    // Save to localStorage for immediate display
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (!d.reactions) d.reactions = [];
      d.reactions.push({
        from: senderId,
        to: receiverId,
        type: reactionType,
        timestamp: new Date().toISOString(),
        seen: false
      });
      // Keep last 50 reactions
      if (d.reactions.length > 50) d.reactions = d.reactions.slice(-50);
      localStorage.setItem('bbf_v7', JSON.stringify(d));
    } catch(e) { console.error('BBF_SYNC reaction localStorage error:', e); }
    // Sync to cloud
    return supa('POST', 'bbf_logs', {
      user_id: receiverId,
      date: new Date().toISOString().slice(0, 10),
      type: 'reaction',
      notes: 'Reaction: ' + reactionType + ' from ' + senderId,
      logged_at: new Date().toISOString(),
      logged_by: senderId
    }).catch(function(e) { console.error('BBF_SYNC sendHouseholdReaction error:', e); return null; });
  }

  // ─── USER LANGUAGE PREFERENCE ─────────────────────────────
  // ─── SOVEREIGN GOLD SEEKER ───────────────────────────────
  var SOVEREIGN_PROTOCOLS = [
    { keywords:['knee','patella','squat pain','vmo','patellar','knee cave','valgus'],
      protocol:'Sovereign VMO Activation & Hamstring Bridge',
      movements:[{en:'Terminal Knee Extension — 3x15',es:'Extensi\u00f3n Terminal de Rodilla — 3x15',pt:'Extens\u00e3o Terminal de Joelho — 3x15'},{en:'Single-Leg Glute Bridge — 3x12/side',es:'Puente de Gl\u00fateo Unilateral — 3x12/lado',pt:'Ponte de Gl\u00fateo Unilateral — 3x12/lado'},{en:'Wall Sit ISO Hold — 3x30s',es:'Sentadilla en Pared — 3x30s',pt:'Agachamento na Parede — 3x30s'}],
      focus:{en:'Quad dominance correction and patellar tracking stabilization',es:'Correcci\u00f3n de dominancia de cu\u00e1driceps y estabilizaci\u00f3n patelar',pt:'Corre\u00e7\u00e3o de domin\u00e2ncia de quadr\u00edceps e estabiliza\u00e7\u00e3o patelar'} },
    { keywords:['shoulder','rotator','stiff','ac joint','impingement','overhead pain'],
      protocol:'Sovereign AC Joint Decompression',
      movements:[{en:'Band Pull-Apart — 3x20',es:'Separaci\u00f3n con Banda — 3x20',pt:'Separa\u00e7\u00e3o com Faixa — 3x20'},{en:'Wall Slide to Overhead — 3x10',es:'Deslizamiento en Pared — 3x10',pt:'Deslizamento na Parede — 3x10'},{en:'Side-Lying External Rotation — 3x15/arm',es:'Rotaci\u00f3n Externa Acostado — 3x15/brazo',pt:'Rota\u00e7\u00e3o Externa Deitado — 3x15/bra\u00e7o'}],
      focus:{en:'Scapular rhythm restoration and subacromial space recovery',es:'Restauraci\u00f3n del ritmo escapular y recuperaci\u00f3n subacromial',pt:'Restaura\u00e7\u00e3o do ritmo escapular e recupera\u00e7\u00e3o subacromial'} },
    { keywords:['lower back','lumbar','spine','disc','back pain','deadlift pain','hinge'],
      protocol:'Sovereign Lumbar Decompression Sequence',
      movements:[{en:'Cat-Cow Flow — 2x10 slow reps',es:'Flujo Gato-Vaca — 2x10 reps lentas',pt:'Fluxo Gato-Vaca — 2x10 reps lentas'},{en:'Child\'s Pose Breathing — 60s',es:'Postura del Ni\u00f1o — 60s',pt:'Postura da Crian\u00e7a — 60s'},{en:'Dead Bug — 3x8/side',es:'Dead Bug — 3x8/lado',pt:'Dead Bug — 3x8/lado'}],
      focus:{en:'L4-L5 decompression and intra-abdominal pressure restoration',es:'Descompresi\u00f3n L4-L5 y restauraci\u00f3n de presi\u00f3n intraabdominal',pt:'Descompress\u00e3o L4-L5 e restaura\u00e7\u00e3o de press\u00e3o intra-abdominal'} },
    { keywords:['hip','flexor','tight hips','groin','adductor','sitting','desk'],
      protocol:'Sovereign Hip Capsule Liberation',
      movements:[{en:'90/90 Hip Stretch — 45s/side',es:'Estiramiento 90/90 de Cadera — 45s/lado',pt:'Alongamento 90/90 do Quadril — 45s/lado'},{en:'Lateral Band Walk — 2x10/direction',es:'Caminata Lateral con Banda — 2x10/direcci\u00f3n',pt:'Caminhada Lateral com Faixa — 2x10/dire\u00e7\u00e3o'},{en:'Pigeon Stretch — 30s/side',es:'Estiramiento de Paloma — 30s/lado',pt:'Alongamento do Pombo — 30s/lado'}],
      focus:{en:'Hip flexor lengthening and glute reactivation for seated professionals',es:'Elongaci\u00f3n del flexor de cadera y reactivaci\u00f3n gl\u00fatea para profesionales sedentarios',pt:'Alongamento do flexor do quadril e reativa\u00e7\u00e3o gl\u00fatea para profissionais sedent\u00e1rios'} },
    { keywords:['ankle','calf','achilles','shin','plantar','foot','standing'],
      protocol:'Sovereign Ankle Mobility Restoration',
      movements:[{en:'Ankle Circles — 10 each direction/foot',es:'C\u00edrculos de Tobillo — 10 cada direcci\u00f3n/pie',pt:'C\u00edrculos de Tornozelo — 10 cada dire\u00e7\u00e3o/p\u00e9'},{en:'Calf Raise with 2s Pause — 2x15',es:'Elevaci\u00f3n de Talones con Pausa — 2x15',pt:'Eleva\u00e7\u00e3o de Panturrilha com Pausa — 2x15'},{en:'Banded Dorsiflexion — 2x12/ankle',es:'Dorsiflexsi\u00f3n con Banda — 2x12/tobillo',pt:'Dorsiflex\u00e3o com Faixa — 2x12/tornozelo'}],
      focus:{en:'Proprioception rebuilding and Achilles load tolerance for shift workers',es:'Reconstrucci\u00f3n proprioceptiva y tolerancia del Aquiles para trabajadores por turnos',pt:'Reconstru\u00e7\u00e3o proprioceptiva e toler\u00e2ncia do Aquiles para trabalhadores por turno'} },
    { keywords:['wrist','grip','forearm','typing','carpal','tendinitis'],
      protocol:'Sovereign Grip Recovery Protocol',
      movements:[{en:'Prayer Stretch — 2x20s',es:'Estiramiento de Rezo — 2x20s',pt:'Alongamento de Ora\u00e7\u00e3o — 2x20s'},{en:'Finger Extension with Band — 2x20',es:'Extensi\u00f3n de Dedos con Banda — 2x20',pt:'Extens\u00e3o de Dedos com Faixa — 2x20'},{en:'Wrist Curl + Reverse Curl — 2x15',es:'Curl de Mu\u00f1eca + Inverso — 2x15',pt:'Rosca de Punho + Inversa — 2x15'}],
      focus:{en:'Extensor/flexor balance restoration for grip-intensive or desk-bound athletes',es:'Restauraci\u00f3n del equilibrio extensor/flexor para atletas de agarre o escritorio',pt:'Restaura\u00e7\u00e3o do equil\u00edbrio extensor/flexor para atletas de pegada ou escrit\u00f3rio'} },
    { keywords:['neck','trap','headache','cervical','text neck','posture'],
      protocol:'Sovereign Cervical Reset',
      movements:[{en:'Chin Tucks — 3x10 (2s hold)',es:'Retracci\u00f3n de Barbilla — 3x10 (2s pausa)',pt:'Retra\u00e7\u00e3o de Queixo — 3x10 (2s pausa)'},{en:'Neck Lateral Tilts — 20s each side',es:'Inclinaciones Laterales de Cuello — 20s cada lado',pt:'Inclina\u00e7\u00f5es Laterais de Pesco\u00e7o — 20s cada lado'},{en:'Upper Trap Release — Lacrosse Ball 60s/side',es:'Liberaci\u00f3n de Trap Superior — Pelota 60s/lado',pt:'Libera\u00e7\u00e3o de Trap Superior — Bola 60s/lado'}],
      focus:{en:'Upper cross syndrome correction and cervicogenic tension relief',es:'Correcci\u00f3n del s\u00edndrome cruzado superior y alivio de tensi\u00f3n cervicog\u00e9nica',pt:'Corre\u00e7\u00e3o da s\u00edndrome cruzada superior e al\u00edvio de tens\u00e3o cervicog\u00eanica'} }
  ];

  function seekSovereignGold(searchQuery) {
    if (!searchQuery) return null;
    var q = searchQuery.toLowerCase().trim();
    for (var i = 0; i < SOVEREIGN_PROTOCOLS.length; i++) {
      var p = SOVEREIGN_PROTOCOLS[i];
      for (var j = 0; j < p.keywords.length; j++) {
        if (q.indexOf(p.keywords[j]) > -1) return p;
      }
    }
    return null;
  }

  function updateUserLanguage(userId, languageCode) {
    if (!userId || !languageCode) return Promise.resolve(null);
    var valid = ['en', 'es', 'pt'];
    var lang = languageCode.toLowerCase();
    if (valid.indexOf(lang) === -1) lang = 'en';
    // Save locally
    try {
      localStorage.setItem('bbf_lang', lang);
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (d.u[userId]) { d.u[userId].language = lang; localStorage.setItem('bbf_v7', JSON.stringify(d)); }
    } catch(e) {}
    // Sync to Supabase
    return supa('POST', 'bbf_users', {
      id: userId,
      language: lang,
      updated_at: new Date().toISOString()
    }).then(function() { console.log('BBF_SYNC: Language set to ' + lang); return lang; })
      .catch(function(e) { console.error('BBF_SYNC updateUserLanguage error:', e); return lang; });
  }

  // ─── PUBLIC API ──────────────────────────────────────────
  return {
    syncUser: syncUser,
    syncLog: syncLog,
    syncSet: syncSet,
    syncReadiness: syncReadiness,
    logAuditRequest: logAuditRequest,
    fetchPendingAudits: fetchPendingAudits,
    fetchHistoricalRPE: fetchHistoricalRPE,
    logPreHabNeed: logPreHabNeed,
    toggleSovereignTrial: toggleSovereignTrial,
    processTierUpgrade: processTierUpgrade,
    linkHouseholdAccounts: linkHouseholdAccounts,
    sendHouseholdReaction: sendHouseholdReaction,
    initYouthAttributes: initYouthAttributes,
    processAthleteEvolution: processAthleteEvolution,
    incrementDiscipline: incrementDiscipline,
    logMorningReadiness: logMorningReadiness,
    evaluateBlueprint: evaluateBlueprint,
    SOVEREIGN_SHIFTS: SOVEREIGN_SHIFTS,
    SOVEREIGN_PROTOCOLS: SOVEREIGN_PROTOCOLS,
    seekSovereignGold: seekSovereignGold,
    updateUserLanguage: updateUserLanguage,
    fetchHouseholdActivity: fetchHouseholdActivity,
    fetchLogs: fetchLogs,
    fetchSets: fetchSets,
    fetchAllUsers: fetchAllUsers,
    fetchAllLogs: fetchAllLogs,
    fetchReadiness: fetchReadiness,
    fetchUser: fetchUser,
    pushAll: pushAll,
    isOnline: isOnline
  };

})();
