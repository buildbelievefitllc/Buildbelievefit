// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · src/components/ultra-instinct-layer.js
// Ultra-instinct layer IIFE
// Phase 2.1 · Extracted verbatim from the inline <script id="ultra-instinct-layer-js">
// block formerly in bbf-app.html. Loaded via <script src="src/components/ultra-instinct-layer.js">
// at the SAME document position so execution order is preserved.
// Do not hand-edit unless you also update the matching block reference.
// ═══════════════════════════════════════════════════════════════════════
/* Ultra Instinct runtime (bbf-app.html) — Command Palette + Splash Ignition + Magnetic + Kairos */
(function(){
  'use strict';
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ============ 1. VAULT SPLASH IGNITION ============ */
  try {
    document.body.classList.add('bbf-vault-igniting');
    if (!reduceMotion) {
      var beam = document.createElement('div');
      beam.className = 'bbf-vault-beam';
      beam.setAttribute('aria-hidden','true');
      document.body.appendChild(beam);
      setTimeout(function(){ if (beam.parentNode) beam.parentNode.removeChild(beam); }, 1800);
    }
    setTimeout(function(){ document.body.classList.remove('bbf-vault-igniting'); }, 2400);
  } catch(e){}

  /* ============ 2. COMMAND PALETTE ============ */
  function safeSS(id){ try { if (typeof SS === 'function') SS(id); } catch(e){} }
  function safeLang(code){ try { if (typeof BBF_LANG !== 'undefined' && BBF_LANG.set) BBF_LANG.set(code); } catch(e){} }
  function toggleAudio(){
    try {
      var b = document.querySelector('.audio-toggle');
      if (b && b.click) b.click();
    } catch(e){}
  }
  function goBack(){
    try { history.back(); } catch(e){}
  }

  var COMMANDS = [
    { group: 'Screens',  icon: '\u26A1',    name: 'Splash',       sub: 'Return to entry',       action: function(){ safeSS('splash'); } },
    { group: 'Screens',  icon: '\u{1F510}', name: 'Sign In',      sub: 'Authentication',         action: function(){ safeSS('auth'); } },
    { group: 'Screens',  icon: '\u{1F4F2}', name: 'App / Vault',  sub: 'Main interface',         action: function(){ safeSS('app'); } },
    { group: 'Actions',  icon: '\u{1F50A}', name: 'Toggle Audio', sub: 'Silent / score',         action: toggleAudio },
    { group: 'Actions',  icon: '\u{1F310}', name: 'Public Site',  sub: 'buildbelievefit.com',    action: function(){ location.href = 'index.html'; } },
    { group: 'Actions',  icon: '\u2B05',    name: 'Back',         sub: 'Previous history',       action: goBack },
    { group: 'Language', icon: 'EN', name: 'English',        sub: 'Switch to English',          action: function(){ safeLang('en'); } },
    { group: 'Language', icon: 'ES', name: 'Espa\u00F1ol',   sub: 'Cambiar a espa\u00F1ol',     action: function(){ safeLang('es'); } },
    { group: 'Language', icon: 'PT', name: 'Portugu\u00EAs', sub: 'Mudar para portugu\u00EAs',  action: function(){ safeLang('pt'); } }
  ];

  var backdrop, palette, input, list, activeIdx = 0, filtered = COMMANDS.slice();

  function buildPalette(){
    backdrop = document.createElement('div');
    backdrop.className = 'bbf-cmdk-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    document.body.appendChild(backdrop);

    palette = document.createElement('div');
    palette.className = 'bbf-cmdk';
    palette.setAttribute('role','dialog');
    palette.setAttribute('aria-modal','true');
    palette.setAttribute('aria-label','Command palette');
    palette.innerHTML =
      '<div class="bbf-cmdk-head">' +
        '<input type="text" class="bbf-cmdk-input" placeholder="Vault command — jump anywhere" aria-label="Search commands" />' +
        '<span class="bbf-cmdk-kbd">ESC</span>' +
      '</div>' +
      '<div class="bbf-cmdk-list" role="listbox"></div>' +
      '<div class="bbf-cmdk-hint"><span>\u2191\u2193 Navigate</span><span>\u23CE Select</span><span>ESC Close</span></div>';
    document.body.appendChild(palette);

    input = palette.querySelector('.bbf-cmdk-input');
    list  = palette.querySelector('.bbf-cmdk-list');

    input.addEventListener('input', function(){ render(input.value); });
    input.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', close);
    list.addEventListener('click', function(e){
      var row = e.target.closest('.bbf-cmdk-item');
      if (!row) return;
      exec(Number(row.dataset.idx));
    });
  }

  function render(q){
    q = (q || '').toLowerCase().trim();
    filtered = q
      ? COMMANDS.filter(function(c){
          return c.name.toLowerCase().indexOf(q) !== -1 ||
                 c.sub.toLowerCase().indexOf(q)  !== -1 ||
                 c.group.toLowerCase().indexOf(q) !== -1;
        })
      : COMMANDS.slice();
    activeIdx = 0;
    if (!filtered.length) {
      list.innerHTML = '<div class="bbf-cmdk-empty">No matches. Try "splash", "audio", or "english".</div>';
      return;
    }
    var html = '', lastGroup = '';
    filtered.forEach(function(c, i){
      if (c.group !== lastGroup) {
        html += '<div class="bbf-cmdk-group">' + esc(c.group) + '</div>';
        lastGroup = c.group;
      }
      html +=
        '<div class="bbf-cmdk-item' + (i === activeIdx ? ' bbf-active' : '') + '" data-idx="' + i + '" role="option">' +
          '<span class="bbf-cmdk-ico">' + esc(c.icon) + '</span>' +
          '<span class="bbf-cmdk-txt">' +
            '<span>' + esc(c.name) + '</span>' +
            '<span class="bbf-cmdk-sub">' + esc(c.sub) + '</span>' +
          '</span>' +
          '<span class="bbf-cmdk-arrow">\u23CE</span>' +
        '</div>';
    });
    list.innerHTML = html;
  }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function onKey(e){
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); move(-1); return; }
    if (e.key === 'Enter')     { e.preventDefault(); exec(activeIdx); return; }
  }
  function move(d){
    if (!filtered.length) return;
    activeIdx = (activeIdx + d + filtered.length) % filtered.length;
    var rows = list.querySelectorAll('.bbf-cmdk-item');
    rows.forEach(function(r, i){ r.classList.toggle('bbf-active', i === activeIdx); });
    var a = rows[activeIdx];
    if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
  }
  function exec(i){
    var c = filtered[i];
    if (!c) return;
    close();
    setTimeout(function(){ try { c.action(); } catch(e){} }, 80);
  }
  function open(){
    if (!palette) buildPalette();
    render(''); input.value = '';
    backdrop.classList.add('bbf-open');
    palette.classList.add('bbf-open');
    setTimeout(function(){ try { input.focus(); } catch(e){} }, 40);
  }
  function close(){
    if (!palette) return;
    backdrop.classList.remove('bbf-open');
    palette.classList.remove('bbf-open');
  }
  addEventListener('keydown', function(e){
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (palette && palette.classList.contains('bbf-open')) close(); else open();
    }
  });

  /* ============ 3. MAGNETIC SPLASH WORDMARK + 3D TILT ============ */
  if (!touch && !reduceMotion) {
    var magTargets = document.querySelectorAll('#ebtn, .tbu, .tbav');
    magTargets.forEach(function(el){
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width  / 2);
        var my = e.clientY - (r.top  + r.height / 2);
        el.style.setProperty('--bbf-mag-x', (mx * 0.22).toFixed(1) + 'px');
        el.style.setProperty('--bbf-mag-y', (my * 0.22).toFixed(1) + 'px');
      });
      el.addEventListener('mouseleave', function(){
        el.style.setProperty('--bbf-mag-x', '0px');
        el.style.setProperty('--bbf-mag-y', '0px');
      });
    });

    // Splash: tilt the wordmark + ring in 3D as cursor crosses the splash
    var splash = document.getElementById('splash');
    if (splash) {
      splash.addEventListener('mousemove', function(e){
        var r = splash.getBoundingClientRect();
        var nx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
        var ny = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
        var sw = splash.querySelector('.sw');
        var sring = splash.querySelector('.sring');
        if (sw) {
          sw.style.setProperty('--bbf-tilt-y', (nx * 5).toFixed(2) + 'deg');
          sw.style.setProperty('--bbf-tilt-x', (-ny * 4).toFixed(2) + 'deg');
        }
        if (sring) {
          sring.style.setProperty('--bbf-mag-x', (nx * 6).toFixed(1) + 'px');
          sring.style.setProperty('--bbf-mag-y', (ny * 6).toFixed(1) + 'px');
        }
      });
      splash.addEventListener('mouseleave', function(){
        var sw = splash.querySelector('.sw'); var sring = splash.querySelector('.sring');
        if (sw) { sw.style.setProperty('--bbf-tilt-y','0deg'); sw.style.setProperty('--bbf-tilt-x','0deg'); }
        if (sring) { sring.style.setProperty('--bbf-mag-x','0px'); sring.style.setProperty('--bbf-mag-y','0px'); }
      });
    }
  }

  /* ============ 4. KAIROS — TIME DILATION ON INTENT ============ */
  if (!touch && !reduceMotion) {
    var kairosTargets = document.querySelectorAll('#ebtn, #signin-btn');
    var dilateTimer = null;
    var activeTarget = null;

    function activateKairos(el){
      if (activeTarget) return;
      activeTarget = el;
      document.body.classList.add('bbf-kairos');
      el.classList.add('bbf-kairos-target');
      if (!el.querySelector('.bbf-kairos-tag')) {
        var tag = document.createElement('span');
        tag.className = 'bbf-kairos-tag';
        tag.textContent = 'Sovereign Standard';
        el.appendChild(tag);
      }
    }
    function releaseKairos(){
      if (!activeTarget) return;
      document.body.classList.remove('bbf-kairos');
      activeTarget.classList.remove('bbf-kairos-target');
      activeTarget = null;
    }

    kairosTargets.forEach(function(el){
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.addEventListener('mouseenter', function(){
        clearTimeout(dilateTimer);
        dilateTimer = setTimeout(function(){ activateKairos(el); }, 160);
      });
      el.addEventListener('mouseleave', function(){
        clearTimeout(dilateTimer);
        releaseKairos();
      });
      el.addEventListener('focus', function(){ activateKairos(el); });
      el.addEventListener('blur',  releaseKairos);
    });

    // Also kairos-activate on the Ω signet (pantheon) — the sovereign gesture
    var sig = document.querySelector('.bbf-pantheon-signet');
    if (sig) {
      sig.addEventListener('mouseenter', function(){
        clearTimeout(dilateTimer);
        dilateTimer = setTimeout(function(){ activateKairos(sig); }, 240);
      });
      sig.addEventListener('mouseleave', function(){ clearTimeout(dilateTimer); releaseKairos(); });
    }
  }

  console.log('%c\u26A1 Ultra Instinct (vault) — online (\u2318K / Ctrl+K)', 'color:#f5c800;font-family:monospace;font-weight:bold;');
})();
