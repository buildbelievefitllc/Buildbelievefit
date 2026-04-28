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
          '<button onclick="var a = BBF_PORTAL.stats().audits[' + i + ']; var parts = (a.notes || \'\').replace(\'Audit: \', \'\').split(\' \\u2014 Tension: \'); var m = BBF_PORTAL.reviewProfile({profile:{full_name:a.user_name || a.user_id}, exercise: parts[0] || \'Unknown\', notes: a.notes, videoUrl: a.videoUrl}); document.body.appendChild(m);" style="flex:1;font-family:\'Bebas Neue\',sans-serif;font-size:.75rem;letter-spacing:2px;background:transparent;border:1px solid #6a0dad;color:#8b1abf;padding:8px;border-radius:6px;cursor:pointer;transition:all .2s">\uD83D\uDCCB REVIEW PROFILE</button>' +
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

// BIG JIM SECURE DOM BUILDER
const reviewProfile = (audit) => {
    const modal = document.createElement('div');
    modal.id = 'audit-review-modal';
    // Basic modal overlay styling
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:1000;";

    const container = document.createElement('div');
    container.style.cssText = "background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:2rem;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;";

    // --- HEADER ---
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;";

    const title = document.createElement('h3');
    title.style.cssText = "margin:0;font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:1px;color:#fff;";
    // SECURE: textContent prevents HTML injection. Optional chaining prevents null crashes.
    title.textContent = 'AUDIT REVIEW: ' + (audit.profile?.full_name || 'Unknown Athlete');

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = "background:none;border:none;color:#888;cursor:pointer;font-size:1.5rem;";
    closeBtn.innerHTML = '&times;'; // Safe literal
    // SECURE: Event listener instead of inline onclick
    closeBtn.addEventListener('click', () => {
        if (document.body.contains(modal)) document.body.removeChild(modal);
    });

    headerDiv.appendChild(title);
    headerDiv.appendChild(closeBtn);
    container.appendChild(headerDiv);

    // --- MODULE ---
    const moduleDiv = document.createElement('div');
    moduleDiv.style.marginBottom = '1rem';

    const moduleLabel = document.createElement('strong');
    moduleLabel.style.cssText = "color:#888;font-size:.75rem;letter-spacing:1px;display:block;";
    moduleLabel.textContent = "MODULE:";

    const moduleValue = document.createElement('span');
    moduleValue.style.cssText = "font-size:1.1rem;";
    moduleValue.textContent = audit.exercise || 'Pre-Hab Assessment'; // SECURE

    moduleDiv.appendChild(moduleLabel);
    moduleDiv.appendChild(moduleValue);
    container.appendChild(moduleDiv);

    // --- NOTES ---
    const notesDiv = document.createElement('div');
    notesDiv.style.marginBottom = '1.5rem';

    const notesLabel = document.createElement('strong');
    notesLabel.style.cssText = "color:#888;font-size:.75rem;letter-spacing:1px;display:block;";
    notesLabel.textContent = "NOTES:";

    const notesValue = document.createElement('div');
    notesValue.style.cssText = "background:#1a1a1a;padding:.8rem;border-radius:6px;font-size:.9rem;color:#ccc;margin-top:0.5rem;";
    notesValue.textContent = audit.notes || 'No notes provided.'; // SECURE: textContent neutralizes XSS payloads

    notesDiv.appendChild(notesLabel);
    notesDiv.appendChild(notesValue);
    container.appendChild(notesDiv);

    // --- KINETIC CAPTURE (VIDEO URL) ---
    if (audit.videoUrl) {
        try {
            const urlObj = new URL(audit.videoUrl);
            // SECURE: Prevent javascript: or data: URL execution
            if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                const videoDiv = document.createElement('div');
                videoDiv.style.marginBottom = '1.5rem';

                const videoLabel = document.createElement('strong');
                videoLabel.style.cssText = "color:#888;font-size:.75rem;letter-spacing:1px;display:block;";
                videoLabel.textContent = "KINETIC CAPTURE:";

                const videoLink = document.createElement('a');
                videoLink.href = urlObj.href;
                videoLink.target = "_blank";
                videoLink.rel = "noopener noreferrer"; // SECURE: Prevents reverse tab hijacking
                videoLink.style.cssText = "display:inline-block;margin-top:.5rem;padding:.5rem 1rem;background:#222;color:#D4AF37;text-decoration:none;border:1px solid #333;border-radius:6px;font-size:.85rem;";
                videoLink.textContent = "📹 View Footage";

                videoDiv.appendChild(videoLabel);
                videoDiv.appendChild(videoLink);
                container.appendChild(videoDiv);
            }
        } catch (e) {
            // Fails silently for invalid URLs instead of rendering malicious links
        }
    }

    modal.appendChild(container);
    return modal;
};

  function getStats() {
    return {
      total: pendingAudits.length,
      audits: pendingAudits
    };
  }

  function toggleTrialAccess(uid, toggleEl) {
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      if (!d.u[uid]) return;
      var isNowActive = d.u[uid].trial_status !== 'active';
      d.u[uid].trial_status = isNowActive ? 'active' : 'inactive';
      if (isNowActive) d.u[uid].trial_start_date = new Date().toISOString();
      localStorage.setItem('bbf_v7', JSON.stringify(d));
      // UI feedback
      if (toggleEl) toggleEl.classList.toggle('on', isNowActive);
      var status = document.getElementById('trial-status-' + uid);
      if (status) {
        status.textContent = isNowActive ? 'TRIAL AUTHORIZED' : 'ACCESS REVOKED';
        status.style.color = isNowActive ? '#22c55e' : '#ef4444';
        setTimeout(function() {
          status.textContent = isNowActive ? 'ACTIVE' : 'OFF';
          status.style.color = isNowActive ? '#D4AF37' : '#555';
        }, 2000);
      }
      // Supabase sync
      if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.toggleSovereignTrial) {
        BBF_SYNC.toggleSovereignTrial(uid, isNowActive)
          .then(function() { console.log('BBF_PORTAL: Trial ' + (isNowActive ? 'activated' : 'revoked') + ' for ' + uid); })
          .catch(function(e) { console.error('BBF_PORTAL: Trial sync error:', e); });
      }
    } catch(e) { console.error('Toggle trial error:', e); }
  }

  return {
    verify: verifyMastermindAccess,
    redirect: redirectUnauthorized,
    load: loadTriageBoard,
    resolve: resolve,
    reviewProfile: reviewProfile,
    toggleTrial: toggleTrialAccess,
    stats: getStats
  };

})();
