// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · src/components/pantheon-layer.js
// Pantheon layer IIFE
// Phase 2.1 · Extracted verbatim from the inline <script id="pantheon-layer-js">
// block formerly in bbf-app.html. Loaded via <script src="src/components/pantheon-layer.js">
// at the SAME document position so execution order is preserved.
// Do not hand-edit unless you also update the matching block reference.
// ═══════════════════════════════════════════════════════════════════════
/* Pantheon runtime (bbf-app.html) — ceremonial signet + splash dust + screen-aware visibility */
(function(){
  'use strict';
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Mount signet + tooltip (hidden until a ceremonial screen is active) ----
  var sig, tip;
  try {
    sig = document.createElement('button');
    sig.className = 'bbf-pantheon-signet';
    sig.setAttribute('type','button');
    sig.setAttribute('aria-label','Pantheon Mode — Sovereign Standard active');
    sig.setAttribute('title','Pantheon Mode');
    document.body.appendChild(sig);

    tip = document.createElement('div');
    tip.className = 'bbf-pantheon-tip';
    tip.textContent = 'Pantheon — Active';
    document.body.appendChild(tip);

    sig.addEventListener('mouseenter', function(){ tip.classList.add('bbf-show'); });
    sig.addEventListener('mouseleave', function(){ tip.classList.remove('bbf-show'); });
    sig.addEventListener('focus',      function(){ tip.classList.add('bbf-show'); });
    sig.addEventListener('blur',       function(){ tip.classList.remove('bbf-show'); });

    // Click: ceremonial flash + scroll splash into view if present
    sig.addEventListener('click', function(){
      sig.animate([
        { transform: 'scale(1)',    filter: 'brightness(1)' },
        { transform: 'scale(1.2)',  filter: 'brightness(1.7)' },
        { transform: 'scale(1)',    filter: 'brightness(1)' }
      ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  } catch(e){}

  // ---- Ceremonial dust field (mounted once, visible only on ceremonial screens) ----
  var dust;
  try {
    if (!reduceMotion) {
      dust = document.createElement('div');
      dust.className = 'bbf-dust';
      dust.setAttribute('aria-hidden','true');
      document.body.appendChild(dust);
      var MOTE_COUNT = 12;
      for (var i = 0; i < MOTE_COUNT; i++) {
        var m = document.createElement('span');
        m.className = 'bbf-dust-mote';
        m.style.left = (Math.random() * 100) + 'vw';
        m.style.setProperty('--dx', ((Math.random() - .5) * 120).toFixed(0) + 'px');
        m.style.animationDelay    = (Math.random() * 14).toFixed(1) + 's';
        m.style.animationDuration = (10 + Math.random() * 8).toFixed(1) + 's';
        m.style.width = m.style.height = (2 + Math.random() * 2).toFixed(1) + 'px';
        dust.appendChild(m);
      }
    }
  } catch(e){}

  // ---- Screen-aware visibility: Pantheon UI only on splash / auth / restricted ----
  function syncPantheonVisibility(){
    try {
      var active = document.querySelector('.scr.on');
      var id = active ? active.id : '';
      var ceremonial = (id === 'splash' || id === 'auth' || id === 'restricted');
      document.body.classList.toggle('bbf-pantheon-ok', ceremonial);
      if (sig) {
        if (ceremonial) {
          // Reveal with slight delay so the screen transition completes first
          setTimeout(function(){ sig.classList.add('bbf-visible'); }, 180);
        } else {
          sig.classList.remove('bbf-visible');
          if (tip) tip.classList.remove('bbf-show');
        }
      }
    } catch(e){}
  }

  // Initial sync + observe .scr class changes
  try {
    syncPantheonVisibility();
    var scrs = document.querySelectorAll('.scr');
    if (scrs.length && 'MutationObserver' in window) {
      var obs = new MutationObserver(syncPantheonVisibility);
      scrs.forEach(function(s){ obs.observe(s, { attributes: true, attributeFilter: ['class'] }); });
    }
  } catch(e){}

  console.log('%c\u03A9 Pantheon Mode (vault) — active', 'color:#f5c800;font-family:monospace;font-weight:bold;');
})();
