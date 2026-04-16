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
        var parts = (a.notes || '').replace('Audit: ', '').split(' \u2014 Tension: ');
        var exercise = parts[0] || 'Unknown';
        var tension = parts[1] || 'Not specified';
        var time = a.logged_at ? new Date(a.logged_at).toLocaleString() : a.date || '';
        return '<div style="background:#111;border:1px solid #1e1e1e;border-left:3px solid #D4AF37;border-radius:0 10px 10px 0;padding:1.2rem;margin-bottom:.8rem">' +
          '<div style="display:flex;align-items:flex-start;gap:1rem;margin-bottom:.8rem">' +
          '<div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#6a0dad;border:2px solid #D4AF37;display:flex;align-items:center;justify-content:center;font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:#D4AF37">' + (a.user_name || '?')[0].toUpperCase() + '</div>' +
          '<div style="flex:1">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;letter-spacing:2px;color:#fff">' + (a.user_name || a.user_id) + '</div>' +
          '<div style="font-size:.68rem;font-weight:700;letter-spacing:2px;color:#D4AF37;margin-top:.2rem">CLINICAL ALERT</div>' +
          '</div>' +
          '<div style="font-size:.6rem;color:#555;text-align:right;min-width:80px">' + time + '</div>' +
          '</div>' +
          '<div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:6px;padding:.8rem;margin-bottom:.8rem">' +
          '<div style="display:flex;gap:.6rem;align-items:center;margin-bottom:.4rem"><span style="font-size:1rem">\uD83C\uDFCB</span><span style="font-size:.9rem;font-weight:700;color:#fff">' + exercise + '</span></div>' +
          '<div style="display:flex;gap:.6rem;align-items:center"><span style="font-size:1rem">\u26A0</span><span style="font-size:.85rem;color:#D4AF37">Tension Area: <strong>' + tension + '</strong></span></div>' +
          '</div>' +
          '<div style="display:flex;gap:.5rem">' +
          '<button onclick="BBF_PORTAL.reviewProfile(\'' + (a.user_id || '') + '\')" style="flex:1;font-family:\'Bebas Neue\',sans-serif;font-size:.75rem;letter-spacing:2px;background:transparent;border:1px solid #6a0dad;color:#8b1abf;padding:8px;border-radius:6px;cursor:pointer;transition:all .2s">\uD83D\uDCCB REVIEW PROFILE</button>' +
          '<button onclick="BBF_PORTAL.resolve(' + i + ')" style="flex:1;font-family:\'Bebas Neue\',sans-serif;font-size:.75rem;letter-spacing:2px;background:rgba(34,197,94,.1);border:1px solid #22c55e;color:#22c55e;padding:8px;border-radius:6px;cursor:pointer;transition:all .2s">\u2705 MARK RESOLVED</button>' +
          '</div></div>';
      }).join('');
  }

  function resolve(index) {
    if (pendingAudits[index]) {
      var audit = pendingAudits[index];
      pendingAudits.splice(index, 1);
      renderTriageBoard();
      // Update stat counter
      var statEl = document.getElementById('stat-pending');
      if (statEl) statEl.textContent = pendingAudits.length;
      // Sync resolution to Supabase
      try {
        if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.syncLog) {
          BBF_SYNC.syncLog(audit.user_id || 'akeem', {
            date: new Date().toISOString().slice(0,10),
            type: 'audit-resolved',
            notes: 'Resolved: ' + (audit.notes || ''),
            loggedAt: new Date().toISOString(),
            loggedBy: 'akeem'
          });
        }
      } catch(e) { console.error('Resolve sync error:', e); }
    }
  }

  function reviewProfile(uid) {
    if (!uid) return;
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      var u = d.u[uid] || {};
      var logs = (d.l[uid] || []).filter(function(l) { return l.type !== 'note'; });
      var recentLogs = logs.slice(-5).reverse();
      var modal = document.createElement('div');
      modal.id = 'profile-review-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:300;display:flex;align-items:center;justify-content:center;padding:24px';
      modal.innerHTML = '<div style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:2rem;max-width:500px;width:100%;max-height:80vh;overflow-y:auto">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.5rem;letter-spacing:2px;color:#fff">' + (u.name || uid) + '</div><button onclick="this.closest(\'#profile-review-modal\').remove()" style="background:none;border:none;color:#888;font-size:1.5rem;cursor:pointer">\u2715</button></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">' +
        '<div style="background:#0a0a0a;border-radius:6px;padding:.6rem;text-align:center"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#D4AF37">' + logs.length + '</div><div style="font-size:.6rem;color:#888;letter-spacing:1px">SESSIONS</div></div>' +
        '<div style="background:#0a0a0a;border-radius:6px;padding:.6rem;text-align:center"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#D4AF37">' + (u.type || 'Client') + '</div><div style="font-size:.6rem;color:#888;letter-spacing:1px">TIER</div></div></div>' +
        '<div style="font-size:.65rem;font-weight:700;letter-spacing:2px;color:#D4AF37;margin-bottom:.5rem">RECENT SESSIONS</div>' +
        (recentLogs.length ? recentLogs.map(function(l) {
          return '<div style="background:#0a0a0a;border-left:2px solid #6a0dad;border-radius:0 6px 6px 0;padding:.5rem .8rem;margin-bottom:.4rem"><div style="font-size:.78rem;color:#fff">' + (l.notes || l.type) + '</div><div style="font-size:.6rem;color:#555">' + (l.date || '') + '</div></div>';
        }).join('') : '<div style="font-size:.8rem;color:#555;padding:.5rem">No sessions logged yet.</div>') +
        '<div style="font-size:.65rem;font-weight:700;letter-spacing:2px;color:#888;margin-top:1rem">Goal: ' + (u.goal || 'Not set') + '</div>' +
        '</div>';
      modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
      document.body.appendChild(modal);
    } catch(e) { console.error('Profile review error:', e); }
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
    reviewProfile: reviewProfile,
    stats: getStats
  };

})();
