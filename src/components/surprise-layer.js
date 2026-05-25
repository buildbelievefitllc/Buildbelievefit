// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · src/components/surprise-layer.js
// Surprise layer IIFE
// Phase 2.1 · Extracted verbatim from the inline <script id="surprise-layer-js">
// block formerly in bbf-app.html. Loaded via <script src="src/components/surprise-layer.js">
// at the SAME document position so execution order is preserved.
// Do not hand-edit unless you also update the matching block reference.
// ═══════════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarsePointer = matchMedia('(hover: none) and (pointer: coarse)').matches;

  // ---- 1. Click ripple — event delegation, only fires on buttons ----
  try {
    document.addEventListener('pointerdown', function(e){
      var btn = e.target.closest('button, .btn, .seq-cta, .gp-cta, .hts-cta, .prog-cta, .tab-btn, .side-item, .chip');
      if (!btn || btn.disabled) return;
      // Ensure container is ripple-ready (safe: only toggles a utility class)
      if (!btn.classList.contains('bbf-ripple-host')) {
        var cs = getComputedStyle(btn);
        if (cs.position === 'static') btn.style.position = 'relative';
        btn.classList.add('bbf-ripple-host');
      }
      var r = btn.getBoundingClientRect();
      var rip = document.createElement('span');
      rip.className = 'bbf-ripple';
      var size = Math.max(r.width, r.height) * 0.6;
      rip.style.width = rip.style.height = size + 'px';
      rip.style.left = (e.clientX - r.left) + 'px';
      rip.style.top  = (e.clientY - r.top)  + 'px';
      btn.appendChild(rip);
      setTimeout(function(){ if (rip.parentNode) rip.parentNode.removeChild(rip); }, 650);
    }, { passive: true });
  } catch(e){}

  // ---- 2. Connection status indicator ----
  try {
    var conn = document.createElement('div');
    conn.className = 'bbf-conn';
    conn.innerHTML = '<span class="bbf-conn-dot"></span><span class="bbf-conn-lbl">LIVE</span>';
    document.body.appendChild(conn);

    function setConn(online){
      conn.classList.toggle('bbf-offline', !online);
      var lbl = conn.querySelector('.bbf-conn-lbl');
      if (lbl) lbl.textContent = online ? 'LIVE' : 'OFFLINE';
      conn.classList.add('bbf-show');
      // Auto-hide LIVE after 2.5s; keep OFFLINE pinned
      if (online) {
        clearTimeout(conn._hide);
        conn._hide = setTimeout(function(){ conn.classList.remove('bbf-show'); }, 2500);
      }
    }
    setConn(navigator.onLine);
    addEventListener('online',  function(){ setConn(true); });
    addEventListener('offline', function(){ setConn(false); });
  } catch(e){}

  // ---- 3. Magnetic CTAs on desktop ----
  try {
    if (!coarsePointer && !reduceMotion) {
      var magnets = document.querySelectorAll('.seq-cta, .gp-cta, .hts-cta, .tab-btn, .hts-apply-btn');
      magnets.forEach(function(btn){
        var r;
        btn.addEventListener('pointerenter', function(){ r = btn.getBoundingClientRect(); });
        btn.addEventListener('pointermove', function(e){
          if (!r) r = btn.getBoundingClientRect();
          var x = (e.clientX - r.left - r.width/2) / (r.width/2);
          var y = (e.clientY - r.top - r.height/2) / (r.height/2);
          btn.style.transform = 'translate(' + (x*4).toFixed(1) + 'px,' + (y*3).toFixed(1) + 'px)';
        });
        btn.addEventListener('pointerleave', function(){ btn.style.transform = ''; r = null; });
      });
    }
  } catch(e){}

  // ---- 4. Entry flare — once per session, fires when #app first becomes visible ----
  try {
    if (!sessionStorage.getItem('bbf_entry_flare') && !reduceMotion) {
      var appScr = document.getElementById('app');
      if (appScr) {
        var fired = false;
        var obs = new MutationObserver(function(){
          if (fired) return;
          if (appScr.classList.contains('on')) {
            fired = true;
            var flare = document.createElement('div');
            flare.className = 'bbf-entry-flare';
            document.body.appendChild(flare);
            setTimeout(function(){ if (flare.parentNode) flare.parentNode.removeChild(flare); }, 1200);
            sessionStorage.setItem('bbf_entry_flare', '1');
            obs.disconnect();
          }
        });
        obs.observe(appScr, { attributes: true, attributeFilter: ['class'] });
        // Immediate check (in case already visible)
        if (appScr.classList.contains('on')) {
          fired = true;
          var flare = document.createElement('div');
          flare.className = 'bbf-entry-flare';
          document.body.appendChild(flare);
          setTimeout(function(){ if (flare.parentNode) flare.parentNode.removeChild(flare); }, 1200);
          sessionStorage.setItem('bbf_entry_flare', '1');
        }
      }
    }
  } catch(e){}

  console.log('%c✨ BBF vault surprise layer online', 'color:#f5c800;font-family:monospace;');
})();
