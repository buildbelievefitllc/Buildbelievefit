// ═══════════════════════════════════════════════════════════════
// RENDER-ENGINE.JS — Sovereign Onboarding UI Orchestrator
// Wires the intake modal's Generate button to the blueprint pipeline:
//   capture → generate → deploy → fade-out → welcome notification.
// ═══════════════════════════════════════════════════════════════
var RENDER_ENGINE = (function() {

  var INTAKE_MODAL_ID  = 'sovereign-intake';
  var SUBMIT_BTN_ID    = 'si-submit-btn';
  var FADE_OUT_MS      = 450;
  var WELCOME_MESSAGE  = 'Mastermind Diagnostic Complete. Your 12-Week Sovereign Blueprint has been deployed.';

  function captureIntakeForm() {
    var ageEl      = document.getElementById('si-age');
    var goalEl     = document.querySelector('#si-goal-chips .si-chip.on');
    var expEl      = document.querySelector('#si-exp-chips .si-chip.on');
    var frictionEls = document.querySelectorAll('#si-friction-chips .si-chip.multi.on');

    if (!ageEl || !ageEl.value)           return { error: 'Enter your age' };
    if (!goalEl)                          return { error: 'Select a goal' };
    if (!expEl)                           return { error: 'Select your experience level' };

    var friction = [];
    for (var i = 0; i < frictionEls.length; i++) friction.push(frictionEls[i].dataset.v);

    return {
      intake: {
        age:        parseInt(ageEl.value, 10) || 0,
        goal:       goalEl.dataset.v,
        experience: expEl.dataset.v,
        friction:   friction,
        completed:  new Date().toISOString()
      }
    };
  }

  function resolveUserId() {
    if (typeof VC !== 'undefined' && VC) return VC;
    if (typeof CU !== 'undefined' && CU) return CU;
    return null;
  }

  function toast(msg) {
    if (typeof TOAST === 'function') { TOAST(msg); return; }
    // Fallback — render-engine stays functional even if TOAST is absent.
    try { console.log('[RENDER_ENGINE]', msg); } catch(_) {}
  }

  function fadeOutModal() {
    var modal = document.getElementById(INTAKE_MODAL_ID);
    if (!modal) return Promise.resolve();
    modal.style.transition = 'opacity ' + FADE_OUT_MS + 'ms ease-out';
    modal.style.opacity    = '0';
    return new Promise(function(resolve) {
      setTimeout(function() {
        modal.classList.remove('on');
        modal.style.opacity    = '';
        modal.style.transition = '';
        resolve();
      }, FADE_OUT_MS);
    });
  }

  function cacheIntakeLocally(uid, intake) {
    if (typeof GD !== 'function' || typeof SD !== 'function') return;
    try {
      var d = GD();
      if (!d.u) d.u = {};
      if (!d.u[uid]) d.u[uid] = {};
      d.u[uid].intake          = intake;
      d.u[uid].intake_complete = true;
      SD(d);
    } catch(e) { console.warn('[RENDER_ENGINE] intake cache error:', e.message); }
  }

  function submitSovereignIntake() {
    var captured = captureIntakeForm();
    if (captured.error) { toast(captured.error); return Promise.resolve(null); }

    var uid = resolveUserId();
    if (!uid) { toast('\u26A0 No active user. Sign in to deploy blueprint.'); return Promise.resolve(null); }

    if (typeof BBF_SYNC === 'undefined' || typeof BBF_SYNC.generateBespokeBlueprint !== 'function') {
      toast('\u26A0 Blueprint engine offline.');
      return Promise.resolve(null);
    }

    // STEP 1 (captured above) + cache so reloads don't re-trigger intake.
    cacheIntakeLocally(uid, captured.intake);

    // STEP 2 — generate the 12-week periodized blueprint.
    var blueprint;
    try {
      blueprint = BBF_SYNC.generateBespokeBlueprint(captured.intake);
    } catch(e) {
      console.error('[RENDER_ENGINE] generate error:', e);
      toast('\u26A0 Blueprint generation failed.');
      return Promise.resolve(null);
    }

    // STEP 3 — deploy to Supabase + local vault.
    var deployPromise = (typeof BBF_SYNC.deploySovereignOnboarding === 'function')
      ? BBF_SYNC.deploySovereignOnboarding(uid, blueprint)
      : Promise.resolve({ ok: false, reason: 'deploy function missing' });

    return deployPromise.then(function(result) {
      // STEP 4 — fade the intake matrix away, revealing the customized dashboard.
      return fadeOutModal().then(function() {
        // STEP 5 — welcome notification.
        toast('\uD83C\uDFAF ' + WELCOME_MESSAGE);

        // Repaint dashboard widgets that depend on blueprint/intake, if present.
        if (typeof repaintDashboard === 'function') {
          try { repaintDashboard(); } catch(_) {}
        }
        if (typeof renderHome === 'function') {
          try { renderHome(); } catch(_) {}
        }

        return { ok: true, result: result, blueprint: blueprint };
      });
    });
  }

  function init() {
    var btn = document.getElementById(SUBMIT_BTN_ID);
    if (!btn) return false;
    if (btn.dataset.reBound === '1') return true;
    btn.addEventListener('click', function(e) {
      if (e && e.preventDefault) e.preventDefault();
      submitSovereignIntake();
    });
    btn.dataset.reBound = '1';
    return true;
  }

  // Auto-wire on DOM ready; also expose init() for late-rendered DOM.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    init:                   init,
    submitSovereignIntake:  submitSovereignIntake,
    captureIntakeForm:      captureIntakeForm,
    fadeOutModal:           fadeOutModal,
    WELCOME_MESSAGE:        WELCOME_MESSAGE
  };

})();
