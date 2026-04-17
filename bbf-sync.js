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
        console.log('BBF_SYNC: Full push complete (' + promises.length + ' operations)');
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

  // ─── SOVEREIGN BLUEPRINT GENERATOR ───────────────────────
  // Which friction types activate which exercise substitutions.
  var FRICTION_SHIFT_MAP = {
    'knee':       ['Barbell Back Squat', 'Barbell Squat', 'Squat', 'Walking Lunges', 'Bulgarian Split Squats'],
    'lower-back': ['Conventional Deadlift', 'Deadlift', 'Romanian Deadlift', 'Barbell Row', 'Power Clean', 'Hang Clean'],
    'shoulder':   ['Overhead Barbell Press', 'Overhead Press', 'Bench Press'],
    'hip':        ['Walking Lunges', 'Bulgarian Split Squats', 'Barbell Back Squat'],
    'ankle':      ['Barbell Back Squat', 'Walking Lunges', 'Bulgarian Split Squats']
  };

  // Volume/intensity envelope keyed to training experience.
  var EXPERIENCE_VOLUME = {
    'beginner':     { days_per_week: 3, sets: 3, reps: '10-12', rpe: 6, progression_pct: 2.5 },
    'intermediate': { days_per_week: 4, sets: 4, reps: '8-10',  rpe: 7, progression_pct: 5.0 },
    'allpro':       { days_per_week: 5, sets: 5, reps: '5-8',   rpe: 8, progression_pct: 7.5 }
  };

  // Goal-driven rep range, rest, and working intensity.
  var GOAL_PROFILE = {
    'hypertrophy': { rep_range: '8-12',  rest_sec: 75,  intensity_pct: 70 },
    'fat-loss':    { rep_range: '12-15', rest_sec: 45,  intensity_pct: 60 },
    'longevity':   { rep_range: '10-12', rest_sec: 60,  intensity_pct: 65 },
    'performance': { rep_range: '3-6',   rest_sec: 180, intensity_pct: 85 },
    'recomp':      { rep_range: '8-10',  rest_sec: 60,  intensity_pct: 72 }
  };

  // 5 base day templates; truncated to days_per_week by experience tier.
  var BASE_DAY_TEMPLATES = [
    { label: 'Lower — Quad Dominant', exercises: [
      { name: 'Barbell Back Squat',   equipment: 'Barbell' },
      { name: 'Romanian Deadlift',    equipment: 'Barbell' },
      { name: 'Walking Lunges',       equipment: 'DB'      },
      { name: 'Leg Extension',        equipment: 'Machine' },
      { name: 'Standing Calf Raise',  equipment: 'Machine' }
    ]},
    { label: 'Upper — Push', exercises: [
      { name: 'Bench Press',            equipment: 'Barbell' },
      { name: 'Overhead Barbell Press', equipment: 'Barbell' },
      { name: 'Incline DB Press',       equipment: 'DB'      },
      { name: 'Lateral Raise',          equipment: 'DB'      },
      { name: 'Triceps Pushdown',       equipment: 'Cable'   }
    ]},
    { label: 'Lower — Posterior', exercises: [
      { name: 'Conventional Deadlift',  equipment: 'Barbell' },
      { name: 'Bulgarian Split Squats', equipment: 'DB'      },
      { name: 'Hip Thrust',             equipment: 'Barbell' },
      { name: 'Lying Hamstring Curl',   equipment: 'Machine' },
      { name: 'Seated Calf Raise',      equipment: 'Machine' }
    ]},
    { label: 'Upper — Pull', exercises: [
      { name: 'Barbell Row',   equipment: 'Barbell' },
      { name: 'Pull-Up',       equipment: 'BW'      },
      { name: 'Lat Pulldown',  equipment: 'Cable'   },
      { name: 'Face Pull',     equipment: 'Cable'   },
      { name: 'Biceps Curl',   equipment: 'DB'      }
    ]},
    { label: 'Power / Conditioning', exercises: [
      { name: 'Power Clean',     equipment: 'Barbell' },
      { name: 'Box Jump',        equipment: 'Box'     },
      { name: 'Med-Ball Slam',   equipment: 'Med Ball'},
      { name: 'Sled Push',       equipment: 'Sled'    },
      { name: 'Farmer Carry',    equipment: 'DB/KB'   }
    ]}
  ];

  function applyFrictionShifts(exerciseName, frictionList) {
    if (!frictionList || !frictionList.length) return null;
    for (var i = 0; i < frictionList.length; i++) {
      var f = frictionList[i];
      if (!f || f === 'none') continue;
      var targets = FRICTION_SHIFT_MAP[f];
      if (!targets) continue;
      for (var j = 0; j < targets.length; j++) {
        if (exerciseName === targets[j] && SOVEREIGN_SHIFTS[targets[j]]) {
          return { replacement: SOVEREIGN_SHIFTS[targets[j]], friction: f };
        }
      }
    }
    return null;
  }

  function generateBespokeBlueprint(intakeData) {
    intakeData = intakeData || {};
    var goal     = intakeData.goal || 'hypertrophy';
    var exp      = intakeData.experience || 'beginner';
    var friction = Array.isArray(intakeData.friction) ? intakeData.friction : [];
    var age      = parseInt(intakeData.age, 10) || 30;

    var volume   = EXPERIENCE_VOLUME[exp]  || EXPERIENCE_VOLUME.beginner;
    var profile  = GOAL_PROFILE[goal]      || GOAL_PROFILE.hypertrophy;
    var templates = BASE_DAY_TEMPLATES.slice(0, volume.days_per_week);

    var phases = [
      { name: 'Accumulation',    weeks: [1,2,3,4],    set_mod: 0,  intensity_mod: 0    },
      { name: 'Intensification', weeks: [5,6,7,8],    set_mod: 0,  intensity_mod: 7.5  },
      { name: 'Realization',     weeks: [9,10,11,12], set_mod: -1, intensity_mod: 12.0 }
    ];

    var blueprint = {
      generated_at: new Date().toISOString(),
      intake: { age: age, goal: goal, experience: exp, friction: friction.slice() },
      profile: {
        goal_rep_range:         profile.rep_range,
        rest_seconds:           profile.rest_sec,
        base_intensity_pct:     profile.intensity_pct,
        base_sets:              volume.sets,
        base_reps:              volume.reps,
        target_rpe:             volume.rpe,
        days_per_week:          volume.days_per_week,
        weekly_progression_pct: volume.progression_pct
      },
      weeks: []
    };

    for (var w = 1; w <= 12; w++) {
      var phase = phases[0];
      for (var p = 0; p < phases.length; p++) {
        if (phases[p].weeks.indexOf(w) > -1) { phase = phases[p]; break; }
      }
      var weekSets      = Math.max(2, volume.sets + phase.set_mod);
      var weekInPhase   = ((w - 1) % 4) + 1;
      var weekIntensity = profile.intensity_pct + phase.intensity_mod + (weekInPhase - 1) * (volume.progression_pct / 4);
      weekIntensity     = Math.min(95, Math.round(weekIntensity * 10) / 10);

      var days = [];
      for (var di = 0; di < templates.length; di++) {
        var tmpl = templates[di];
        var exercises = [];
        for (var e = 0; e < tmpl.exercises.length; e++) {
          var ex = tmpl.exercises[e];
          var shift = applyFrictionShifts(ex.name, friction);
          var finalName = shift ? shift.replacement : ex.name;
          var entry = {
            name:           finalName,
            is_shifted:     !!shift,
            sets:           weekSets,
            reps:           profile.rep_range,
            rest_seconds:   profile.rest_sec,
            intensity_pct:  weekIntensity,
            rpe_target:     volume.rpe,
            equipment:      ex.equipment,
            notes:          shift
              ? 'Biomechanical Friction (' + shift.friction + '): ' + ex.name + ' \u2192 ' + shift.replacement
              : ''
          };
          if (shift) {
            entry.original_name  = ex.name;
            entry.friction_cause = shift.friction;
          }
          exercises.push(entry);
        }
        days.push({ day: di + 1, label: tmpl.label, exercises: exercises });
      }

      blueprint.weeks.push({
        week:          w,
        phase:         phase.name,
        intensity_pct: weekIntensity,
        sets:          weekSets,
        days:          days
      });
    }

    return blueprint;
  }

  // ─── VAULT SAVE: DEPLOY ONBOARDING BLUEPRINT ─────────────
  function deploySovereignOnboarding(userId, blueprintData) {
    if (!userId || !blueprintData) return Promise.resolve(null);
    var now = new Date().toISOString();

    // 1. Mirror to localStorage so the dashboard renders instantly, even offline.
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{"u":{},"l":{},"w":{}}');
      if (!d.u) d.u = {};
      if (!d.u[userId]) d.u[userId] = {};
      d.u[userId].blueprint           = blueprintData;
      d.u[userId].onboarding_complete = true;
      d.u[userId].onboarded_at        = now;
      d.u[userId].intake_complete     = true;
      localStorage.setItem('bbf_v7', JSON.stringify(d));
    } catch(e) { console.warn('BBF_SYNC deploySovereignOnboarding local cache error:', e.message); }

    // 2. Persist to Supabase user profile.
    return supa('PATCH', 'bbf_users', {
      blueprint:           blueprintData,
      intake:              blueprintData.intake || null,
      onboarding_complete: true,
      onboarded_at:        now,
      updated_at:          now
    }, '?id=eq.' + encodeURIComponent(userId)).then(function(res) {
      return { ok: true, userId: userId, onboarded_at: now, remote: res };
    }).catch(function(e) {
      console.warn('BBF_SYNC deploySovereignOnboarding remote error:', e && e.message);
      return { ok: false, userId: userId, onboarded_at: now, error: e && e.message };
    });
  }

  // ─── GHOST PROTOCOL SCANNER ──────────────────────────────
  // Flags any user whose last activity is older than the inactivity window
  // (default 72h) so downstream interventions can be triggered. Reads
  // last_active_timestamp when present, falling back to updated_at then
  // created_at for forward-compat with older rows.
  var GHOST_INACTIVITY_MS = 72 * 60 * 60 * 1000;

  async function runGhostProtocolScan(options) {
    options = options || {};
    var cutoffMs   = options.inactivity_ms || GHOST_INACTIVITY_MS;
    var cutoffIso  = new Date(Date.now() - cutoffMs).toISOString();
    var cutoffTime = Date.now() - cutoffMs;
    var now        = new Date().toISOString();

    try {
      var users = await supa(
        'GET',
        'bbf_users',
        null,
        '?select=id,name,last_active_timestamp,updated_at,created_at,ghost_intervention_needed'
      );
      if (!Array.isArray(users)) users = [];

      var ghosts = users.filter(function(u) {
        var iso = u.last_active_timestamp || u.updated_at || u.created_at;
        if (!iso) return false;
        var t = Date.parse(iso);
        return !isNaN(t) && t < cutoffTime;
      });

      var results = [];
      for (var i = 0; i < ghosts.length; i++) {
        var u = ghosts[i];
        try {
          await supa('PATCH', 'bbf_users', {
            ghost_intervention_needed: true,
            ghost_flagged_at:          now,
            updated_at:                now
          }, '?id=eq.' + encodeURIComponent(u.id));
          results.push({ id: u.id, name: u.name || u.id, flagged: true });
        } catch (err) {
          console.warn('BBF_SYNC runGhostProtocolScan patch error for ' + u.id + ':', err && err.message);
          results.push({ id: u.id, name: u.name || u.id, flagged: false, error: err && err.message });
        }
      }

      var flaggedCount = 0;
      for (var j = 0; j < results.length; j++) if (results[j].flagged) flaggedCount++;

      return {
        scanned:   users.length,
        flagged:   flaggedCount,
        cutoff:    cutoffIso,
        inactivity_hours: cutoffMs / (60 * 60 * 1000),
        users:     results,
        scanned_at: now
      };
    } catch (e) {
      console.error('BBF_SYNC runGhostProtocolScan fatal:', e && e.message);
      return { scanned: 0, flagged: 0, cutoff: cutoffIso, error: e && e.message, scanned_at: now };
    }
  }

  // Fetch a single user profile row from Supabase (ghost flag, blueprint, onboarding status).
  async function fetchUserProfile(uid) {
    if (!uid) return null;
    try {
      var rows = await supa(
        'GET',
        'bbf_users',
        null,
        '?id=eq.' + encodeURIComponent(uid) +
          '&select=id,name,ghost_intervention_needed,ghost_flagged_at,ghost_cleared_at,mobility_override_date,onboarding_complete,blueprint,intake,last_active_timestamp,updated_at&limit=1'
      );
      if (!Array.isArray(rows) || !rows.length) return null;
      var profile = rows[0];
      // Mirror flags to localStorage so the dashboard can fall back offline.
      try {
        var d = JSON.parse(localStorage.getItem('bbf_v7') || '{"u":{},"l":{},"w":{}}');
        if (!d.u) d.u = {};
        if (!d.u[uid]) d.u[uid] = {};
        d.u[uid].ghost_intervention_needed = !!profile.ghost_intervention_needed;
        if (profile.mobility_override_date) d.u[uid].mobility_override_date = profile.mobility_override_date;
        if (profile.blueprint) d.u[uid].blueprint = profile.blueprint;
        if (profile.onboarding_complete) d.u[uid].onboarding_complete = true;
        localStorage.setItem('bbf_v7', JSON.stringify(d));
      } catch(_) {}
      return profile;
    } catch(e) {
      console.warn('BBF_SYNC fetchUserProfile error:', e && e.message);
      return null;
    }
  }

  // Clear the ghost intervention flag and stamp today as a mobility override day.
  async function clearGhostIntervention(uid) {
    if (!uid) return { ok: false, error: 'no uid' };
    var now = new Date().toISOString();
    var todayKey = now.slice(0, 10);

    // Local mirror first — dashboard reacts instantly.
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{"u":{},"l":{},"w":{}}');
      if (!d.u) d.u = {};
      if (!d.u[uid]) d.u[uid] = {};
      d.u[uid].ghost_intervention_needed = false;
      d.u[uid].ghost_cleared_at          = now;
      d.u[uid].mobility_override_date    = todayKey;
      d.u[uid].last_active_timestamp     = now;
      localStorage.setItem('bbf_v7', JSON.stringify(d));
    } catch(_) {}

    try {
      await supa('PATCH', 'bbf_users', {
        ghost_intervention_needed: false,
        ghost_cleared_at:          now,
        mobility_override_date:    todayKey,
        last_active_timestamp:     now,
        updated_at:                now
      }, '?id=eq.' + encodeURIComponent(uid));
      return { ok: true, uid: uid, mobility_override_date: todayKey, cleared_at: now };
    } catch(e) {
      console.warn('BBF_SYNC clearGhostIntervention error:', e && e.message);
      return { ok: false, uid: uid, mobility_override_date: todayKey, cleared_at: now, error: e && e.message };
    }
  }

  // ─── HIGH-TICKET SNIPER ──────────────────────────────────
  // Canonical core axial lifts: loaded-spine compound barbell movements.
  // Names chosen to match the Sovereign blueprint's BASE_DAY_TEMPLATES.
  // Friction-shifted alternatives (Leg Press, Machine Chest Press, etc.) are
  // intentionally EXCLUDED — a plateau on a substitute is not the same signal.
  var AXIAL_LIFTS_EXACT = {
    'Barbell Back Squat':     'squat',
    'Barbell Squat':          'squat',
    'Squat':                  'squat',
    'Front Squat':            'squat',
    'Conventional Deadlift':  'deadlift',
    'Deadlift':               'deadlift',
    'Sumo Deadlift':          'deadlift',
    'Bench Press':            'bench',
    'Barbell Bench Press':    'bench',
    'Overhead Barbell Press': 'ohp',
    'Overhead Press':         'ohp',
    'Military Press':         'ohp',
    'Strict Press':           'ohp'
  };

  function classifyAxialLift(name) {
    if (!name) return null;
    if (AXIAL_LIFTS_EXACT[name]) return AXIAL_LIFTS_EXACT[name];
    var l = String(name).toLowerCase();
    // Defensive substring match — excludes variants that are NOT axial
    if (/\b(barbell |back |front )?squat\b/.test(l) &&
        l.indexOf('split') === -1 && l.indexOf('goblet') === -1 &&
        l.indexOf('single-leg') === -1 && l.indexOf('leg press') === -1 &&
        l.indexOf('hack') === -1) return 'squat';
    if (/\bdeadlift\b/.test(l) &&
        l.indexOf('romanian') === -1 && l.indexOf('stiff') === -1 &&
        l.indexOf('single') === -1 && l.indexOf('trap bar') === -1) return 'deadlift';
    if (/\bbench press\b/.test(l) &&
        l.indexOf('machine') === -1 && l.indexOf('dumbbell') === -1 &&
        l.indexOf(' db ') === -1) return 'bench';
    if (/(overhead|military|strict)\s+(barbell\s+)?press\b/.test(l) &&
        l.indexOf('dumbbell') === -1 && l.indexOf('seated') === -1 &&
        l.indexOf('machine') === -1 && l.indexOf(' db ') === -1) return 'ohp';
    return null;
  }

  // Diagnostic for the High-Ticket Sniper. Returns one of:
  //   { trigger_upsell: true,  reason: 'graduate', diagnostic: {...} }
  //   { trigger_upsell: true,  reason: 'plateau',  diagnostic: {...} }
  //   { trigger_upsell: false, reason: null,       diagnostic: {...} }
  //
  // Graduate wins over Plateau when both fire — graduation is the higher-
  // value narrative for the 1-on-1 pitch.
  async function evaluateSniperCriteria(userId) {
    if (!userId) return { trigger_upsell: false, reason: null, diagnostic: { error: 'no uid' } };
    var nowMs   = Date.now();
    var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    // Load profile — cloud preferred, merge with localStorage for offline resilience.
    var profile = null;
    try { profile = await fetchUserProfile(userId); } catch(_) {}
    try {
      var cached = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (cached.u && cached.u[userId]) {
        profile = Object.assign({}, cached.u[userId], profile || {});
      }
    } catch(_) {}
    if (!profile) return { trigger_upsell: false, reason: null, diagnostic: { error: 'no profile' } };

    var onboardedAt = profile.onboarded_at ? Date.parse(profile.onboarded_at) : null;
    var blueprint   = profile.blueprint || null;
    var daysPerWeek = (blueprint && blueprint.profile && blueprint.profile.days_per_week) || 3;

    // ── TRIGGER A: GRADUATE ─────────────────────────────────
    // Requires: 12-week blueprint exists, ≥ 84 days since onboarded_at,
    // and workout-session adherence ≥ 75% of expected (days_per_week × 12).
    var graduate = null;
    if (blueprint && Array.isArray(blueprint.weeks) && blueprint.weeks.length >= 12 &&
        onboardedAt && isFinite(onboardedAt)) {
      var elapsedMs   = nowMs - onboardedAt;
      var weeksElapsed = Math.floor(elapsedMs / WEEK_MS);
      if (elapsedMs >= 12 * WEEK_MS) {
        var logs = [];
        try { logs = await fetchLogs(userId) || []; } catch(_) {}
        var onboardedIso = new Date(onboardedAt).toISOString().slice(0, 10);
        var seenDates = {};
        for (var i = 0; i < logs.length; i++) {
          var L = logs[i];
          if (!L || !L.date) continue;
          if (L.type && L.type !== 'strength') continue;
          if (L.date < onboardedIso) continue;
          seenDates[L.date] = true;
        }
        var completedSessions = Object.keys(seenDates).length;
        var expectedSessions  = Math.max(1, Math.floor(daysPerWeek * 12 * 0.75));
        if (completedSessions >= expectedSessions) {
          graduate = {
            weeks_elapsed:      weeksElapsed,
            completed_sessions: completedSessions,
            expected_sessions:  expectedSessions,
            days_per_week:      daysPerWeek,
            adherence_pct:      Math.round((completedSessions / (daysPerWeek * 12)) * 1000) / 10
          };
        }
      }
    }
    if (graduate) return { trigger_upsell: true, reason: 'graduate', diagnostic: graduate };

    // ── TRIGGER B: PLATEAU ──────────────────────────────────
    // Per axial lift, build { week_number: max_weight } over the user's
    // training history. If the most recent 3 CONSECUTIVE training weeks for
    // that lift show non-increasing max weight (zero progression across
    // both week-to-week transitions), flag plateau on that lift.
    if (!blueprint || !onboardedAt) {
      return { trigger_upsell: false, reason: null, diagnostic: { graduate_checked: true, plateau_checkable: false, cause: 'missing blueprint or onboarded_at' } };
    }

    var sets = [];
    try { sets = await fetchSets(userId) || []; } catch(_) {}
    if (!sets.length) {
      return { trigger_upsell: false, reason: null, diagnostic: { graduate_checked: true, plateau_checked: true, cause: 'no set history' } };
    }

    var weeklyMax = {}; // { axialId: { weekNum: maxWeight } }
    for (var k = 0; k < sets.length; k++) {
      var S = sets[k];
      if (!S || !S.day_key || S.weight == null) continue;
      var w = parseFloat(S.weight);
      if (!isFinite(w) || w <= 0) continue;

      var m = /^(\d{4}-\d{2}-\d{2})_d(\d+)$/.exec(S.day_key);
      if (!m) continue;
      var dateIso = m[1];
      var dayIdx  = parseInt(m[2], 10);
      var dateMs  = Date.parse(dateIso);
      if (!isFinite(dateMs)) continue;
      var weekNum = Math.floor((dateMs - onboardedAt) / WEEK_MS) + 1;
      if (weekNum < 1) continue;

      // Map exercise_key -> exercise name via the bespoke blueprint.
      var bpWeekIdx = Math.min(weekNum, blueprint.weeks.length) - 1;
      var bpWeek    = blueprint.weeks[bpWeekIdx];
      if (!bpWeek || !bpWeek.days) continue;
      var bpDay = bpWeek.days[dayIdx];
      if (!bpDay || !bpDay.exercises) continue;
      var exMatch = /^ex_(\d+)$/.exec(S.exercise_key || '');
      if (!exMatch) continue;
      var exIdx = parseInt(exMatch[1], 10);
      var ex    = bpDay.exercises[exIdx];
      if (!ex || !ex.name) continue;

      var axialId = classifyAxialLift(ex.name);
      // Honor original_name when the lift was friction-shifted — we still
      // want to see plateau on the *canonical* movement the user would have
      // trained without friction.
      if (!axialId && ex.original_name) axialId = classifyAxialLift(ex.original_name);
      if (!axialId) continue;

      if (!weeklyMax[axialId]) weeklyMax[axialId] = {};
      if (!(weekNum in weeklyMax[axialId]) || w > weeklyMax[axialId][weekNum]) {
        weeklyMax[axialId][weekNum] = w;
      }
    }

    var plateauDetail = null;
    var axialIds = Object.keys(weeklyMax);
    for (var a = 0; a < axialIds.length; a++) {
      var id       = axialIds[a];
      var weeksMap = weeklyMax[id];
      var weekNums = Object.keys(weeksMap).map(Number).sort(function(x, y){ return x - y; });
      // Scan from most-recent backwards, looking for 3 consecutive training
      // weeks (delta === 1) with non-increasing max weight.
      for (var n = weekNums.length - 1; n >= 2; n--) {
        var w3 = weekNums[n], w2 = weekNums[n-1], w1 = weekNums[n-2];
        if (w3 - w2 !== 1 || w2 - w1 !== 1) continue;
        var m3 = weeksMap[w3], m2 = weeksMap[w2], m1 = weeksMap[w1];
        if (m2 <= m1 && m3 <= m2) {
          plateauDetail = {
            lift:    id,
            weeks:   [w1, w2, w3],
            weights: [m1, m2, m3]
          };
          break;
        }
      }
      if (plateauDetail) break;
    }

    if (plateauDetail) {
      return { trigger_upsell: true, reason: 'plateau', diagnostic: plateauDetail };
    }

    return {
      trigger_upsell: false,
      reason:         null,
      diagnostic:     { graduate_checked: true, plateau_checked: true, axial_lifts_observed: axialIds }
    };
  }

  // Lead capture for the High-Ticket Sniper. Updates the user's bbf_users
  // row with 1on1_lead_status='pending' plus the trigger reason. Local
  // mirror first so the UI reflects the pending state instantly.
  async function submitMastermindApplication(userId, reason) {
    if (!userId) return { ok: false, error: 'no uid' };
    var now        = new Date().toISOString();
    var safeReason = (reason === 'graduate' || reason === 'plateau') ? reason : (reason || 'unspecified');

    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{"u":{},"l":{},"w":{}}');
      if (!d.u) d.u = {};
      if (!d.u[userId]) d.u[userId] = {};
      d.u[userId]['1on1_lead_status']       = 'pending';
      d.u[userId]['1on1_lead_reason']       = safeReason;
      d.u[userId]['1on1_lead_submitted_at'] = now;
      localStorage.setItem('bbf_v7', JSON.stringify(d));
    } catch(_) {}

    try {
      await supa('PATCH', 'bbf_users', {
        '1on1_lead_status':       'pending',
        '1on1_lead_reason':       safeReason,
        '1on1_lead_submitted_at': now,
        updated_at:               now
      }, '?id=eq.' + encodeURIComponent(userId));
      return { ok: true, uid: userId, reason: safeReason, submitted_at: now };
    } catch(e) {
      console.warn('BBF_SYNC submitMastermindApplication error:', e && e.message);
      return { ok: false, uid: userId, reason: safeReason, submitted_at: now, error: e && e.message };
    }
  }

  // ─── KINEMATIC AUDITOR ───────────────────────────────────
  // Biomechanical Friction Score — 4-week rolling analysis of axial load
  // (back squat, conventional/sumo deadlift, strict OHP). Score 0–100+
  // with a threshold of 100 (exceeding the user's tier budget). A
  // progression ramp or OHP-heavy distribution adds further pressure.
  //
  // Tier budgets (lb-reps per 4-week block):
  //   beginner     30,000
  //   intermediate 75,000
  //   allpro       150,000
  var KINEMATIC_TIER_BUDGET = {
    beginner:     30000,
    intermediate: 75000,
    allpro:       150000
  };
  var KINEMATIC_THRESHOLD = 100;
  var KINEMATIC_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;

  async function runKinematicAudit(userId) {
    if (!userId) return { friction_score: 0, warning: false, error: 'no uid' };

    var nowMs  = Date.now();
    var start  = new Date(nowMs - KINEMATIC_WINDOW_MS);
    var endIso = new Date(nowMs).toISOString();

    // Load profile (cloud + local fallback).
    var profile = null;
    try { profile = await fetchUserProfile(userId); } catch(_) {}
    try {
      var cached = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (cached.u && cached.u[userId]) profile = Object.assign({}, cached.u[userId], profile || {});
    } catch(_) {}
    if (!profile) return { friction_score: 0, warning: false, error: 'no profile' };

    var blueprint = profile.blueprint || null;
    var experience = (blueprint && blueprint.profile && blueprint.intake && blueprint.intake.experience) ||
                     (blueprint && blueprint.intake && blueprint.intake.experience) ||
                     (profile.intake && profile.intake.experience) ||
                     'intermediate';
    var tierBudget = KINEMATIC_TIER_BUDGET[experience] || KINEMATIC_TIER_BUDGET.intermediate;

    var sets = [];
    try { sets = await fetchSets(userId) || []; } catch(_) {}

    var byLift = { squat: { tonnage: 0, sets: 0 }, deadlift: { tonnage: 0, sets: 0 }, ohp: { tonnage: 0, sets: 0 } };
    var byWeek = [0, 0, 0, 0]; // index 0 = oldest week, 3 = newest
    var byWeekLift = {
      squat:    [0,0,0,0],
      deadlift: [0,0,0,0],
      ohp:      [0,0,0,0]
    };
    var sessionKeys = {};
    var axialWorkingSets = 0;
    var onboardedMs = profile.onboarded_at ? Date.parse(profile.onboarded_at) : null;

    for (var i = 0; i < sets.length; i++) {
      var S = sets[i];
      if (!S || !S.day_key || S.weight == null) continue;
      var w = parseFloat(S.weight);
      var r = parseFloat(S.reps || 0);
      if (!isFinite(w) || w <= 0 || !isFinite(r) || r <= 0) continue;

      var m = /^(\d{4}-\d{2}-\d{2})_d(\d+)$/.exec(S.day_key);
      if (!m) continue;
      var dateMs = Date.parse(m[1]);
      if (!isFinite(dateMs)) continue;
      if (dateMs < nowMs - KINEMATIC_WINDOW_MS) continue; // outside 4-week window
      if (dateMs > nowMs) continue;

      // Map exercise_key -> exercise name. Prefer blueprint.weeks[week-1].days[d].exercises[e].
      var dayIdx = parseInt(m[2], 10);
      var exMatch = /^ex_(\d+)$/.exec(S.exercise_key || '');
      if (!exMatch) continue;
      var exIdx = parseInt(exMatch[1], 10);

      var exName = null;
      if (blueprint && Array.isArray(blueprint.weeks) && onboardedMs) {
        var wkNum = Math.floor((dateMs - onboardedMs) / (7 * 24 * 60 * 60 * 1000)) + 1;
        var bpWeek = blueprint.weeks[Math.min(Math.max(wkNum, 1), blueprint.weeks.length) - 1];
        var bpDay  = bpWeek && bpWeek.days && bpWeek.days[dayIdx];
        var ex     = bpDay && bpDay.exercises && bpDay.exercises[exIdx];
        if (ex) exName = ex.original_name || ex.name;
      }
      if (!exName) continue;

      var axialId = classifyAxialLift(exName);
      if (axialId === 'bench') continue; // bench is sagittal, not axial for this audit
      if (!axialId) continue;
      if (!byLift[axialId]) continue;

      // Heavy-OHP gate: only count OHP sets at >= 40 lb (filters warm-up / band work).
      if (axialId === 'ohp' && w < 40) continue;

      var tonnage = w * r;
      byLift[axialId].tonnage += tonnage;
      byLift[axialId].sets    += 1;
      axialWorkingSets        += 1;
      sessionKeys[S.day_key]   = true;

      // Bucket into 4 equal 7-day windows from oldest→newest.
      var ageMs = nowMs - dateMs;
      var weekBucket = 3 - Math.min(3, Math.floor(ageMs / (7 * 24 * 60 * 60 * 1000)));
      if (weekBucket < 0 || weekBucket > 3) continue;
      byWeek[weekBucket]           += tonnage;
      byWeekLift[axialId][weekBucket] += tonnage;
    }

    var totalTonnage = byLift.squat.tonnage + byLift.deadlift.tonnage + byLift.ohp.tonnage;
    var sessionsWithAxial = Object.keys(sessionKeys).length;

    // Base Friction Score — share of the tier's axial budget consumed.
    var score = (totalTonnage / tierBudget) * 100;

    // Progression-ramp bump: recent half vs earlier half tonnage.
    var earlier = byWeek[0] + byWeek[1];
    var recent  = byWeek[2] + byWeek[3];
    var rampApplied = false;
    if (earlier > 0 && recent > earlier * 1.15) {
      score *= 1.15;
      rampApplied = true;
    }

    // Heavy-OHP distribution bump — pressing-dominant weeks strain CNS disproportionately.
    var ohpHeavy = false;
    if (totalTonnage > 0 && (byLift.ohp.tonnage / totalTonnage) > 0.20) {
      score *= 1.08;
      ohpHeavy = true;
    }

    score = Math.round(score * 10) / 10;
    var warning = score >= KINEMATIC_THRESHOLD;
    var nowIso = new Date(nowMs).toISOString();

    // Mirror to localStorage first so the heat-map UI can paint without a round-trip.
    try {
      var dLocal = JSON.parse(localStorage.getItem('bbf_v7') || '{"u":{},"l":{},"w":{}}');
      if (!dLocal.u) dLocal.u = {};
      if (!dLocal.u[userId]) dLocal.u[userId] = {};
      dLocal.u[userId].cns_friction_warning    = !!warning;
      dLocal.u[userId].cns_friction_score      = score;
      dLocal.u[userId].cns_friction_updated_at = nowIso;
      dLocal.u[userId].kinematic_audit = {
        friction_score: score,
        warning:        warning,
        threshold:      KINEMATIC_THRESHOLD,
        by_lift:        byLift,
        by_week:        byWeek,
        by_week_lift:   byWeekLift,
        sessions_with_axial: sessionsWithAxial,
        axial_working_sets:  axialWorkingSets,
        tier_budget:    tierBudget,
        experience:     experience,
        ramp_applied:   rampApplied,
        ohp_heavy:      ohpHeavy,
        window_start:   start.toISOString(),
        window_end:     endIso,
        computed_at:    nowIso
      };
      localStorage.setItem('bbf_v7', JSON.stringify(dLocal));
    } catch(_) {}

    // Persist warning state to Supabase (always write so stale warnings clear).
    try {
      await supa('PATCH', 'bbf_users', {
        cns_friction_warning:    !!warning,
        cns_friction_score:      score,
        cns_friction_updated_at: nowIso,
        updated_at:              nowIso
      }, '?id=eq.' + encodeURIComponent(userId));
    } catch(e) {
      console.warn('BBF_SYNC runKinematicAudit patch error:', e && e.message);
    }

    return {
      friction_score:      score,
      warning:             warning,
      threshold:           KINEMATIC_THRESHOLD,
      by_lift:             byLift,
      by_week:             byWeek,
      by_week_lift:        byWeekLift,
      sessions_with_axial: sessionsWithAxial,
      axial_working_sets:  axialWorkingSets,
      tier_budget:         tierBudget,
      experience:          experience,
      ramp_applied:        rampApplied,
      ohp_heavy:           ohpHeavy,
      window_start:        start.toISOString(),
      window_end:          endIso,
      computed_at:         nowIso
    };
  }

  // ─── SOMATIC SYNC ────────────────────────────────────────
  // Cross-reference lifestyle inputs (sleep, cognitive load, fasting
  // window) with the Kinematic Auditor's CNS-friction state and the
  // user's recent session cadence. Produces a 0–100 Somatic Readiness
  // Score. If < 60, somatic_override_active is flipped, prescribing a
  // 70% (vs 85%) intensity cap and a -1 set volume cut for the day.
  //
  // Component weights (sum 100):
  //   sleep_quality   1–10  → 30 pts
  //   cognitive_load  1–10  → 25 pts  (inverted; 1=best)
  //   fasting_hours   0–36+ → 20 pts  (bell curve, peak 14–16h)
  //   CNS friction                → 15 pts (0 if Phase 1 warning active)
  //   7-day adherence             → 10 pts
  var SOMATIC_OVERRIDE_THRESHOLD = 60;
  var SOMATIC_ONE_RM_OVERRIDE_PCT = 70; // caps 85% prescription
  var SOMATIC_VOLUME_DELTA = -1;        // drop 1 working set per exercise

  function somaticFastingQuality(h) {
    if (!(h > 0)) return 0.6;
    if (h <= 12) return 0.6 + (h / 12) * 0.3;       // 0.6 → 0.9
    if (h <= 16) return 0.9 + ((h - 12) / 4) * 0.1; // 0.9 → 1.0
    if (h <= 20) return 1.0 - ((h - 16) / 4) * 0.15; // 1.0 → 0.85
    if (h <= 36) return 0.85 - ((h - 20) / 16) * 0.35; // 0.85 → 0.50
    return 0.30;
  }

  async function calculateSomaticReadiness(userId, inputs) {
    if (!userId) return { score: 0, override_active: false, error: 'no uid' };
    inputs = inputs || {};
    var nowIso   = new Date().toISOString();
    var todayKey = nowIso.slice(0, 10);

    // Load profile (cloud + localStorage merge).
    var profile = null;
    try { profile = await fetchUserProfile(userId); } catch(_) {}
    try {
      var cached = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (cached.u && cached.u[userId]) profile = Object.assign({}, cached.u[userId], profile || {});
    } catch(_) {}
    profile = profile || {};

    // Coalesce inputs: explicit > cached > today's readiness sleep > defaults.
    var existingReadiness = (profile.daily_readiness || {})[todayKey] || {};
    var fastingHours    = numOrNull(inputs.fasting_hours);
    var cognitiveLoad   = numOrNull(inputs.cognitive_load);
    var sleepQuality    = numOrNull(inputs.sleep_quality);
    if (fastingHours  === null) fastingHours  = numOrNull(profile.somatic_fasting_hours);
    if (cognitiveLoad === null) cognitiveLoad = numOrNull(profile.somatic_cognitive_load);
    if (sleepQuality  === null) sleepQuality  = numOrNull(profile.somatic_sleep_quality);
    if (sleepQuality  === null) sleepQuality  = numOrNull(existingReadiness.sleep);
    if (fastingHours  === null) fastingHours  = 0;
    if (cognitiveLoad === null) cognitiveLoad = 5;
    if (sleepQuality  === null) sleepQuality  = 5;

    fastingHours  = Math.max(0, Math.min(48, fastingHours));
    cognitiveLoad = Math.max(1, Math.min(10, cognitiveLoad));
    sleepQuality  = Math.max(1, Math.min(10, sleepQuality));

    // Component scoring.
    var sleepComp = (sleepQuality / 10) * 30;
    var cogComp   = ((11 - cognitiveLoad) / 10) * 25;
    var fastComp  = somaticFastingQuality(fastingHours) * 20;
    var cnsComp   = profile.cns_friction_warning ? 0 : 15;

    // 7-day adherence component.
    var sessions7d = 0;
    try {
      var logs = await fetchLogs(userId) || [];
      var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      var seenDates = {};
      for (var i = 0; i < logs.length; i++) {
        var L = logs[i];
        if (!L || !L.date) continue;
        if (L.type && L.type !== 'strength') continue;
        var ms = Date.parse(L.date);
        if (!isFinite(ms) || ms < cutoff) continue;
        seenDates[L.date] = true;
      }
      sessions7d = Object.keys(seenDates).length;
    } catch(_) {}
    var activityComp = Math.max(0, Math.min(1, sessions7d / 4)) * 10;

    var score = sleepComp + cogComp + fastComp + cnsComp + activityComp;
    score = Math.round(score * 10) / 10;
    if (score > 100) score = 100;
    if (score < 0)   score = 0;

    var overrideActive = score < SOMATIC_OVERRIDE_THRESHOLD;
    var tier = score >= 80 ? 'optimal'
             : score >= 60 ? 'ready'
             : score >= 40 ? 'caution'
             : 'depleted';

    // Mirror to localStorage for instant UI repaint.
    try {
      var dLocal = JSON.parse(localStorage.getItem('bbf_v7') || '{"u":{},"l":{},"w":{}}');
      if (!dLocal.u) dLocal.u = {};
      if (!dLocal.u[userId]) dLocal.u[userId] = {};
      dLocal.u[userId].somatic_fasting_hours   = fastingHours;
      dLocal.u[userId].somatic_cognitive_load  = cognitiveLoad;
      dLocal.u[userId].somatic_sleep_quality   = sleepQuality;
      dLocal.u[userId].somatic_readiness_score = score;
      dLocal.u[userId].somatic_override_active = overrideActive;
      dLocal.u[userId].somatic_override_date   = overrideActive ? todayKey : null;
      dLocal.u[userId].somatic_tier            = tier;
      dLocal.u[userId].somatic_last_logged     = nowIso;
      dLocal.u[userId].somatic_components      = {
        sleep: sleepComp, cognition: cogComp, fasting: fastComp,
        cns: cnsComp, activity: activityComp
      };
      localStorage.setItem('bbf_v7', JSON.stringify(dLocal));
    } catch(_) {}

    // Persist to Supabase.
    try {
      await supa('PATCH', 'bbf_users', {
        somatic_fasting_hours:   fastingHours,
        somatic_cognitive_load:  cognitiveLoad,
        somatic_sleep_quality:   sleepQuality,
        somatic_readiness_score: score,
        somatic_override_active: overrideActive,
        somatic_override_date:   overrideActive ? todayKey : null,
        somatic_tier:            tier,
        somatic_last_logged:     nowIso,
        updated_at:              nowIso
      }, '?id=eq.' + encodeURIComponent(userId));
    } catch(e) {
      console.warn('BBF_SYNC calculateSomaticReadiness patch error:', e && e.message);
    }

    // Also log a history row in bbf_logs for longitudinal analysis.
    try {
      await supa('POST', 'bbf_logs', {
        user_id:   userId,
        date:      todayKey,
        type:      'somatic',
        intensity: String(score),
        notes:     'Somatic ' + tier.toUpperCase() + ' | sleep=' + sleepQuality + ' cog=' + cognitiveLoad + ' fast=' + fastingHours + 'h',
        logged_at: nowIso,
        logged_by: userId
      });
    } catch(_) {}

    return {
      score:             score,
      override_active:   overrideActive,
      override_date:     overrideActive ? todayKey : null,
      threshold:         SOMATIC_OVERRIDE_THRESHOLD,
      tier:              tier,
      one_rm_override_pct: SOMATIC_ONE_RM_OVERRIDE_PCT,
      volume_delta:      SOMATIC_VOLUME_DELTA,
      inputs: {
        fasting_hours:   fastingHours,
        cognitive_load:  cognitiveLoad,
        sleep_quality:   sleepQuality
      },
      components: {
        sleep:     sleepComp,
        cognition: cogComp,
        fasting:   fastComp,
        cns:       cnsComp,
        activity:  activityComp
      },
      sessions_7d:       sessions7d,
      computed_at:       nowIso
    };
  }

  function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
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
    generateBespokeBlueprint: generateBespokeBlueprint,
    deploySovereignOnboarding: deploySovereignOnboarding,
    runGhostProtocolScan: runGhostProtocolScan,
    fetchUserProfile: fetchUserProfile,
    clearGhostIntervention: clearGhostIntervention,
    evaluateSniperCriteria: evaluateSniperCriteria,
    submitMastermindApplication: submitMastermindApplication,
    runKinematicAudit: runKinematicAudit,
    calculateSomaticReadiness: calculateSomaticReadiness,
    somaticFastingQuality: somaticFastingQuality,
    KINEMATIC_TIER_BUDGET: KINEMATIC_TIER_BUDGET,
    KINEMATIC_THRESHOLD: KINEMATIC_THRESHOLD,
    SOMATIC_OVERRIDE_THRESHOLD: SOMATIC_OVERRIDE_THRESHOLD,
    SOMATIC_ONE_RM_OVERRIDE_PCT: SOMATIC_ONE_RM_OVERRIDE_PCT,
    SOMATIC_VOLUME_DELTA: SOMATIC_VOLUME_DELTA,
    classifyAxialLift: classifyAxialLift,
    AXIAL_LIFTS_EXACT: AXIAL_LIFTS_EXACT,
    GHOST_INACTIVITY_MS: GHOST_INACTIVITY_MS,
    SOVEREIGN_SHIFTS: SOVEREIGN_SHIFTS,
    FRICTION_SHIFT_MAP: FRICTION_SHIFT_MAP,
    EXPERIENCE_VOLUME: EXPERIENCE_VOLUME,
    GOAL_PROFILE: GOAL_PROFILE,
    SOVEREIGN_PROTOCOLS: SOVEREIGN_PROTOCOLS,
    seekSovereignGold: seekSovereignGold,
    updateUserLanguage: updateUserLanguage,
    fetchHouseholdActivity: fetchHouseholdActivity,
    fetchLogs: fetchLogs,
    fetchSets: fetchSets,
    fetchAllUsers: fetchAllUsers,
    fetchAllLogs: fetchAllLogs,
    fetchReadiness: fetchReadiness,
    pushAll: pushAll,
    isOnline: isOnline
  };

})();
