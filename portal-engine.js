// ═══════════════════════════════════════════════════════════════
// PORTAL-ENGINE.JS — BBF Mastermind Dashboard Engine
// Sovereign Command Center — Trainer Intelligence Layer
// ═══════════════════════════════════════════════════════════════

var BBF_PORTAL = (function() {
  'use strict';

  var pendingAudits = [];

  function verifyMastermindAccess() {
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      var users = d.u || {};
      for (var uid in users) {
        if (users[uid].role === 'trainer') return true;
      }
    } catch (e) {}
    return false;
  }

  function redirectUnauthorized() {
    window.location.href = 'bbf-app.html';
  }

  function loadTriageBoard() {
    var board = document.getElementById('audit-triage-board');
    if (!board) return;
    board.innerHTML = '<div style="text-align:center;padding:2rem;color:#555;font-size:.85rem;letter-spacing:2px">LOADING INTELLIGENCE...</div>';

    if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.fetchPendingAudits) {
      BBF_SYNC.fetchPendingAudits().then(function(data) {
        pendingAudits = data || [];
        renderTriageBoard();
      }).catch(function(e) {
        console.error('Portal fetch error:', e);
        board.innerHTML = '<div style="text-align:center;padding:2rem;color:#ef4444;font-size:.85rem">Cloud connection failed. Check Supabase status.</div>';
      });
    } else {
      // Fallback: load from localStorage
      loadFromLocal();
      renderTriageBoard();
    }
  }

  function loadFromLocal() {
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      pendingAudits = [];
      for (var uid in (d.l || {})) {
        (d.l[uid] || []).forEach(function(log) {
          if (log.type === 'audit' || (log.notes && log.notes.indexOf('Audit:') === 0)) {
            pendingAudits.push({
              user_id: uid,
              user_name: (d.u[uid] && d.u[uid].name) || uid,
              notes: log.notes || '',
              date: log.date || '',
              logged_at: log.loggedAt || '',
              resolved: log.resolved || false
            });
          }
        });
      }
      pendingAudits.sort(function(a, b) { return (b.logged_at || '').localeCompare(a.logged_at || ''); });
    } catch (e) { pendingAudits = []; }
  }

  function renderTriageBoard() {
    var board = document.getElementById('audit-triage-board');
    if (!board) return;

    if (!pendingAudits.length) {
      board.innerHTML = '<div style="text-align:center;padding:3rem"><div style="font-size:3rem;margin-bottom:1rem">\u2705</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;letter-spacing:2px;color:#22c55e">ALL CLEAR</div><div style="font-size:.82rem;color:#888;margin-top:.3rem">No pending audit requests from your roster.</div></div>';
      return;
    }

    board.innerHTML = '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:.75rem;letter-spacing:3px;color:#D4AF37;margin-bottom:1rem">' + pendingAudits.length + ' AUDIT REQUEST' + (pendingAudits.length > 1 ? 'S' : '') + ' PENDING</div>' +
      pendingAudits.map(function(a, i) {
        var parts = (a.notes || '').replace('Audit: ', '').split(' — Tension: ');
        var exercise = parts[0] || 'Unknown';
        var tension = parts[1] || 'Not specified';
        return '<div style="background:#111;border:1px solid #1e1e1e;border-left:3px solid #D4AF37;border-radius:0 8px 8px 0;padding:1rem;margin-bottom:.6rem;display:flex;align-items:flex-start;gap:1rem">' +
          '<div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#6a0dad;border:2px solid #D4AF37;display:flex;align-items:center;justify-content:center;font-family:\'Bebas Neue\',sans-serif;font-size:.85rem;color:#D4AF37">' + (a.user_name || '?')[0].toUpperCase() + '</div>' +
          '<div style="flex:1">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;letter-spacing:2px;color:#fff">' + (a.user_name || a.user_id) + '</div>' +
          '<div style="font-size:.78rem;color:#D4AF37;margin-top:.15rem">' + exercise + ' \u2014 ' + tension + '</div>' +
          '<div style="font-size:.65rem;color:#555;margin-top:.2rem">' + (a.date || '') + '</div>' +
          '</div>' +
          '<button onclick="BBF_PORTAL.resolve(' + i + ')" style="font-family:\'Bebas Neue\',sans-serif;font-size:.65rem;letter-spacing:2px;background:transparent;border:1px solid #22c55e;color:#22c55e;padding:4px 10px;border-radius:4px;cursor:pointer;flex-shrink:0">RESOLVE</button>' +
          '</div>';
      }).join('');
  }

  function resolve(index) {
    if (pendingAudits[index]) {
      pendingAudits.splice(index, 1);
      renderTriageBoard();
    }
  }

  function getStats() {
    return {
      total: pendingAudits.length,
      audits: pendingAudits
    };
  }

  return {
    verify: verifyMastermindAccess,
    redirect: redirectUnauthorized,
    load: loadTriageBoard,
    resolve: resolve,
    stats: getStats
  };

})();
