// BBF LANGUAGE ENGINE
// Exposes window.BBF globally so buttons can call BBF.setLang()

window.BBF = {

  lang: (function() {
    try { return localStorage.getItem('bbf_lang') || 'en'; } catch(e) { return 'en'; }
  })(),

  REDIRECTS: {
    en: 'https://buildbelievefit.fitness/thank-you.html',
    es: 'https://buildbelievefit.fitness/gracias.html',
    pt: 'https://buildbelievefit.fitness/obrigado.html'
  },

  setLang: function(lang) {
    if (lang !== 'en' && lang !== 'es' && lang !== 'pt') return;
    window.BBF.lang = lang;
    try { localStorage.setItem('bbf_lang', lang); } catch(e) {}

    // Update ALL buttons that have a data-lang attribute
    document.querySelectorAll('[data-lang]').forEach(function(btn) {
      var isActive = btn.getAttribute('data-lang') === lang;
      btn.classList.remove('on', 'lang-on', 'active');
      if (isActive) btn.classList.add('on', 'lang-on');
    });

    // Update Formspree redirect hidden field
    document.querySelectorAll('input[name="_next"]').forEach(function(input) {
      input.value = window.BBF.REDIRECTS[lang];
    });

    // Update hidden language field
    document.querySelectorAll('input[name="language"]').forEach(function(input) {
      input.value = lang;
    });
  },

  toggleTrainingMode: function(active) {
    try { localStorage.setItem('bbf_train', active ? 'true' : 'false'); } catch(e) {}
    var label = document.getElementById('trainingLabel');
    var track = document.getElementById('tm-track');
    var thumb = document.getElementById('tm-thumb');
    if (label) label.textContent = active ? 'CUES:' + window.BBF.lang.toUpperCase() : 'MODE';
    if (label) label.style.color = active ? '#f5c800' : '#4a4570';
    if (track) { track.style.background = active ? '#6a0dad' : '#1a1a1a'; track.style.borderColor = active ? '#8b1abf' : '#2a2640'; }
    if (thumb) { thumb.style.left = active ? '16px' : '2px'; thumb.style.background = active ? '#f5c800' : '#4a4570'; }
  },

  init: function() {
    window.BBF.setLang(window.BBF.lang);
    var isApp = !!document.querySelector('[data-bbf-app]');
    if (isApp) {
      var wrap = document.getElementById('trainingModeWrap');
      if (wrap) wrap.style.display = 'flex';
      var saved = false;
      try { saved = localStorage.getItem('bbf_train') === 'true'; } catch(e) {}
      if (saved) window.BBF.toggleTrainingMode(true);
    }
  }

};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.BBF.init);
} else {
  window.BBF.init();
}
