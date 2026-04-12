// ═══════════════════════════════════════════════════════════════════
// BBF-LANG.JS — Build Believe Fit LLC
// Trilingual Dictionary & Language Engine (EN / ES / PT)
// Universal Human Performance Architecture
// ═══════════════════════════════════════════════════════════════════
(function() {
'use strict';

var LANG = localStorage.getItem('bbf_lang') || 'en';

// ─── TRILINGUAL DICTIONARY ─────────────────────────────────────
var D = {

// ═══ NAV ═══
'nav-services':    { en:'Services',   es:'Servicios',   pt:'Serviços' },
'nav-programs':    { en:'Programs',   es:'Programas',   pt:'Programas' },
'nav-nutrition':   { en:'Nutrition',  es:'Nutrición',   pt:'Nutrição' },
'nav-results':     { en:'Results',    es:'Resultados',  pt:'Resultados' },
'nav-mystory':     { en:'My Story',   es:'Mi Historia', pt:'Minha História' },
'nav-about':       { en:'About',      es:'Acerca',      pt:'Sobre' },
'nav-start':       { en:'Start',      es:'Comenzar',    pt:'Começar' },
'nav-cta':         { en:'Get the App',es:'Obtener App', pt:'Baixar App' },
'mnav-services':   { en:'Services',   es:'Servicios',   pt:'Serviços' },
'mnav-programs':   { en:'Programs',   es:'Programas',   pt:'Programas' },
'mnav-nutrition':  { en:'Nutrition',  es:'Nutrición',   pt:'Nutrição' },
'mnav-results':    { en:'Results',    es:'Resultados',  pt:'Resultados' },
'mnav-about':      { en:'About',      es:'Acerca',      pt:'Sobre' },
'mnav-start':      { en:'Start My Journey', es:'Iniciar Mi Camino', pt:'Iniciar Minha Jornada' },
'mnav-app':        { en:'Client App', es:'App del Cliente', pt:'App do Cliente' },

// ═══ PLACEHOLDER — more keys injected below ═══
'_end': { en:'', es:'', pt:'' }
};

// ─── ENGINE ────────────────────────────────────────────────────
function apply() {
  var els = document.querySelectorAll('[data-lang-key]');
  for (var i = 0; i < els.length; i++) {
    var k = els[i].getAttribute('data-lang-key');
    if (D[k] && D[k][LANG] !== undefined && D[k][LANG] !== '') {
      if (D[k][LANG].indexOf('<') > -1) {
        els[i].innerHTML = D[k][LANG];
      } else {
        els[i].textContent = D[k][LANG];
      }
    }
  }
}

function setLang(l) {
  LANG = l;
  localStorage.setItem('bbf_lang', l);
  apply();
  updateToggles(l);
}

function getLang() { return LANG; }

function t(key) {
  return (D[key] && D[key][LANG]) ? D[key][LANG] : key;
}

function updateToggles(l) {
  var ids = [
    ['lt-en','lt-es','lt-pt'],
    ['mob-lt-en','mob-lt-es','mob-lt-pt']
  ];
  ids.forEach(function(set) {
    set.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var isOn = id.indexOf('-' + l) > -1;
      el.classList.toggle('lang-on', isOn);
      el.classList.toggle('lang-active', isOn);
      if (isOn) {
        el.style.background = 'var(--yel,#f5c800)';
        el.style.color = 'var(--blk,#060606)';
      } else {
        el.style.background = 'transparent';
        el.style.color = '';
      }
    });
  });
  var placeholder = document.getElementById('bbf-lang-placeholder');
  if (placeholder && !placeholder.querySelector('#bbf-lang-toggle')) {
    placeholder.innerHTML =
      '<div id="bbf-lang-toggle">' +
      '<button onclick="BBF_LANG.set(\'en\')" class="' + (l === 'en' ? 'lang-active' : '') + '">EN</button>' +
      '<button onclick="BBF_LANG.set(\'es\')" class="' + (l === 'es' ? 'lang-active' : '') + '">ES</button>' +
      '<button onclick="BBF_LANG.set(\'pt\')" class="' + (l === 'pt' ? 'lang-active' : '') + '">PT</button>' +
      '</div>';
  }
}

// ─── EXPORTS ───────────────────────────────────────────────────
window.BBF_LANG = { set: setLang, get: getLang, t: t, apply: apply, D: D };
window.BBF = { setLang: setLang, getLang: getLang, t: t };

// ─── AUTO-INIT ─────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { updateToggles(LANG); apply(); });
} else {
  updateToggles(LANG); apply();
}

})();
