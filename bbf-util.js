// ═══════════════════════════════════════════════════════════════════
// BBF-UTIL.JS — Shared Utilities
// ═══════════════════════════════════════════════════════════════════

function TOAST(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(function() { t.classList.remove('on'); }, 2800);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TOAST };
}
