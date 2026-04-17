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
