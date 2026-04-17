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

  // ═══════════════════════════════════════════════════════════════
  // GHOST PROTOCOL — app-load intercept + Sovereign Baseline restore
  // ═══════════════════════════════════════════════════════════════

  var GHOST_MODAL_ID = 'ghost-protocol-intercept';

  function localGhostFlag(uid) {
    try {
      var d = JSON.parse(localStorage.getItem('bbf_v7') || '{}');
      return !!((d.u && d.u[uid] && d.u[uid].ghost_intervention_needed));
    } catch(_) { return false; }
  }

  function showGhostIntercept() {
    var el = document.getElementById(GHOST_MODAL_ID);
    if (el) el.classList.add('on');
  }

  function hideGhostIntercept() {
    var el = document.getElementById(GHOST_MODAL_ID);
    if (!el) return Promise.resolve();
    el.style.transition = 'opacity 380ms ease-out';
    el.style.opacity    = '0';
    return new Promise(function(resolve) {
      setTimeout(function() {
        el.classList.remove('on');
        el.style.opacity    = '';
        el.style.transition = '';
        resolve();
      }, 380);
    });
  }

  // Called from the post-login sequence BEFORE RA()/dashboard render.
  // Resolves `true` if we intercepted (caller must not render dashboard).
  async function checkGhostAndMaybeIntercept(uid) {
    if (!uid) return false;
    var intercepted = false;

    // Fast path: local cache. Show the modal immediately if flagged.
    if (localGhostFlag(uid)) {
      showGhostIntercept();
      intercepted = true;
    }

    // Freshen from Supabase in parallel. If the cloud disagrees with the
    // cache, sync the UI accordingly.
    if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.fetchUserProfile) {
      try {
        var profile = await BBF_SYNC.fetchUserProfile(uid);
        if (profile) {
          var cloudFlag = !!profile.ghost_intervention_needed;
          if (cloudFlag && !intercepted) {
            showGhostIntercept();
            intercepted = true;
          } else if (!cloudFlag && intercepted) {
            // Cloud says cleared — drop the modal and let the caller render.
            await hideGhostIntercept();
            intercepted = false;
          }
        }
      } catch(_) {}
    }

    return intercepted;
  }

  // Wire: close ghost modal, flip Supabase flag, stamp today as mobility day,
  // then re-render the dashboard (the host page's RA() + RDW() pipeline
  // picks up the mobility_override_date and renders the Sovereign Mobility
  // protocol instead of today's standard blueprint).
  async function restoreSovereignBaseline() {
    var uid = (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || null;
    if (!uid) { toast('\u26A0 No active user.'); return { ok: false, reason: 'no uid' }; }
    if (typeof BBF_SYNC === 'undefined' || !BBF_SYNC.clearGhostIntervention) {
      toast('\u26A0 Sync engine offline.');
      return { ok: false, reason: 'no sync' };
    }

    // STEP 1 — flip the flag (Supabase + localStorage) and stamp today.
    var result = await BBF_SYNC.clearGhostIntervention(uid);

    // STEP 2 — fade the intercept modal away.
    await hideGhostIntercept();

    // STEP 3 — re-render the dashboard. RA() is the host-page repaint hook;
    // its downstream RDW() checks mobility_override_date === today() and
    // renders the Sovereign Mobility day instead of the standard blueprint.
    if (typeof RA === 'function') {
      try { RA(); } catch(_) {}
    }
    if (typeof SS === 'function') {
      try { SS('app'); } catch(_) {}
    }
    if (typeof SELDAY === 'function') {
      try { SELDAY(0); } catch(_) {}
    }

    toast('\u26A1 Sovereign Recovery active. Today is Mobility + Pre-Hab.');
    return { ok: true, result: result };
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
    init:                         init,
    submitSovereignIntake:        submitSovereignIntake,
    captureIntakeForm:            captureIntakeForm,
    fadeOutModal:                 fadeOutModal,
    checkGhostAndMaybeIntercept:  checkGhostAndMaybeIntercept,
    restoreSovereignBaseline:     restoreSovereignBaseline,
    showGhostIntercept:           showGhostIntercept,
    hideGhostIntercept:           hideGhostIntercept,
    WELCOME_MESSAGE:              WELCOME_MESSAGE
  };

})();
