// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · src/state/bbf-auth-engine.js
// Auth engine (login/session/PIN flow)
// Phase 2.1 · Extracted verbatim from the inline <script id="bbf-auth-engine">
// block formerly in bbf-app.html. Loaded via <script src="src/state/bbf-auth-engine.js">
// at the SAME document position so execution order is preserved.
// Do not hand-edit unless you also update the matching block reference.
// ═══════════════════════════════════════════════════════════════════════
// ═══ BBF AUTH ENGINE — Self-contained, zero dependencies ═══
var K='bbf_v7';
var CU=null,VC=null;

// Phase 8 — Global Admin (Architect-everywhere) bypass.
// Returns true whenever the logged-in user is the Architect (akeem),
// regardless of any active "view as <client>" admin session. Gates that
// OR with this stay open for the Architect across all client-facing content.
window.BBF_IS_ADMIN = function() {
  return typeof CU !== 'undefined' && CU === 'akeem';
};

// Phase 14 — Nutrition-only role derivation (RBAC, no DB migration).
// Tier propagates from the Pathfinder form via localStorage.bbf_pathfinder
// → ENTER() lifts it to d.u[uid].tier. Any tier slug starting with
// "nutrition_" (essentials/platinum) suppresses the Workouts surface so
// the Nutrition Portal user never sees an empty Program tab. Admin
// always wins — Akeem still sees everything.
window.BBF_IS_NUTRITION_ONLY = function() {
  try {
    if (window.BBF_IS_ADMIN && window.BBF_IS_ADMIN()) return false;
    var uid = (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || null;
    if (!uid) return false;
    var d = (typeof GD === 'function') ? GD() : null;
    var u = d && d.u && d.u[uid];
    var tier = (u && u.tier) || '';
    return typeof tier === 'string' && tier.indexOf('nutrition_') === 0;
  } catch(_) { return false; }
};
// Apply the Workouts-tab suppression DOM mutation. Idempotent — safe to
// call repeatedly (e.g. after login, on tab activation, after tier writeback).
window.BBF_APPLY_NUTRITION_GATE = function() {
  try {
    var hide = !!(window.BBF_IS_NUTRITION_ONLY && window.BBF_IS_NUTRITION_ONLY());
    var navBtn = document.querySelector('button.nv[data-tab="workout"]');
    if (navBtn) navBtn.hidden = hide;
    var qaW = document.getElementById('qa-w');
    if (qaW) qaW.style.display = hide ? 'none' : '';
    // If the user is currently sitting on the workout tab and we just
    // hid it, bounce them to the nutrition tab.
    if (hide && typeof TAB === 'function') {
      var workoutPane = document.getElementById('tp-workout');
      if (workoutPane && workoutPane.classList.contains('on')) TAB('nutrition');
    }
  } catch(_) {}
};

// ─── Phase 16 — IRON VAULT V2 frontend gate ───────────────────────
// Three-state mirror of the server-side bbf_users.trial_expires_at /
// subscription_tier. Display-only — server's WS upgrade gate is the
// source of truth. Admin (BBF_IS_ADMIN) short-circuits everything.
//
//   'null'    → no trial ever started → blur + Sovereign Trial CTA
//   'active'  → trial running OR sovereign tier → unblurred, full access
//   'expired' → trial_expires_at <= NOW() → greyed + lock + paywall click
//
// BBF_APPLY_TRIAL_GATE() is idempotent. Hooked at login and on tab
// focus (visibilitychange) so cross-device flips reflect within one
// tab activation. localStorage cache is mirrored from fetchTrialState
// in bbf-sync.js — never trusted across the WS upgrade boundary.
window.BBF_TRIAL_STATE = function() {
  try {
    if (window.BBF_IS_ADMIN && window.BBF_IS_ADMIN()) return 'active';
    var uid = (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || null;
    if (!uid) return 'null';
    var d = (typeof GD === 'function') ? GD() : null;
    var u = d && d.u && d.u[uid];
    if (!u) return 'null';
    if (u.subscription_tier === 'sovereign') return 'active';
    if (!u.trial_expires_at) return 'null';
    var ms = new Date(u.trial_expires_at).getTime();
    if (!isFinite(ms)) return 'null';
    return ms > Date.now() ? 'active' : 'expired';
  } catch(_) { return 'null'; }
};

// WAR ROOM Phase 5 — gate logic refactored to walk both (frame, voice-btn)
// pairs: the original Program-tab Phantom Eye + Virtual Coach, and the
// cloned Nutrition-tab Nutrition Vision + Virtual Chef. Same trial flow,
// same overlay markup; trial state propagates to both surfaces in one pass.
function _bbfGateFrame(frame, state) {
  if (!frame) return;
  frame.classList.remove('iv-state-null', 'iv-state-active', 'iv-state-expired');
  // Strip any previously-injected overlay so we don't stack them.
  var existingCta = frame.querySelector('.iv-trial-cta');
  if (existingCta) existingCta.remove();
  var existingExp = frame.querySelector('.iv-expired-overlay');
  if (existingExp) existingExp.remove();
  if (state === 'active') {
    frame.classList.add('iv-state-active');
  } else if (state === 'null') {
    frame.classList.add('iv-state-null');
    var cta = document.createElement('div');
    cta.className = 'iv-trial-cta';
    cta.innerHTML =
      '<div class="iv-trial-cta-kicker">SOVEREIGN COACH LOCKED</div>' +
      '<div class="iv-trial-cta-title">Unlock 7 days of AI voice + camera coaching.</div>' +
      '<button type="button" class="iv-trial-cta-btn iv-trial-cta-btn--gate">Unlock 7-Day Sovereign Trial</button>';
    frame.appendChild(cta);
    var btn = cta.querySelector('.iv-trial-cta-btn--gate');
    if (btn) btn.addEventListener('click', function() { window.BBF_START_TRIAL(); });
  } else {
    // expired
    frame.classList.add('iv-state-expired');
    var exp = document.createElement('div');
    exp.className = 'iv-expired-overlay';
    exp.innerHTML =
      '<div class="iv-expired-icon">&#x1F512;</div>' +
      '<div class="iv-expired-title">Your Sovereign Trial has ended.</div>' +
      '<button type="button" class="iv-expired-btn">Upgrade to Premium</button>';
    frame.appendChild(exp);
    var ebtn = exp.querySelector('.iv-expired-btn');
    if (ebtn) ebtn.addEventListener('click', function() { window.BBF_SHOW_PAYWALL_MODAL(); });
  }
}

function _bbfGateVoiceBtn(vcBtn, state) {
  if (!vcBtn) return;
  vcBtn.classList.remove('iv-vc-state-null', 'iv-vc-state-active', 'iv-vc-state-expired');
  if (state === 'null') {
    vcBtn.classList.add('iv-vc-state-null');
    vcBtn.setAttribute('aria-disabled', 'true');
    vcBtn.onclick = function(e) { if (e) e.preventDefault(); window.BBF_START_TRIAL(); };
  } else if (state === 'expired') {
    vcBtn.classList.add('iv-vc-state-expired');
    vcBtn.setAttribute('aria-disabled', 'true');
    vcBtn.onclick = function(e) { if (e) e.preventDefault(); window.BBF_SHOW_PAYWALL_MODAL(); };
  } else {
    vcBtn.classList.add('iv-vc-state-active');
    vcBtn.removeAttribute('aria-disabled');
    vcBtn.onclick = function() { initLiveCoach('voice'); };
  }
}

// Surfaces gated by trial state. Each entry is {frame-id, voice-btn-id}.
// Program tab originals first, Nutrition tab clones second (Phase 5).
var _BBF_TRIAL_SURFACES = [
  { frameId: 'pe-frame', vcBtnId: 'pe-init-voice-btn' },
  { frameId: 'nv-frame', vcBtnId: 'nv-init-chef-btn'  }
];

window.BBF_APPLY_TRIAL_GATE = function() {
  try {
    var state = window.BBF_TRIAL_STATE();
    for (var i = 0; i < _BBF_TRIAL_SURFACES.length; i++) {
      var s = _BBF_TRIAL_SURFACES[i];
      _bbfGateFrame(document.getElementById(s.frameId), state);
      _bbfGateVoiceBtn(document.getElementById(s.vcBtnId), state);
    }
  } catch(_) {}
  // Phase 9 — tier feature gate runs after every trial-state apply so
  // a trial flip (off -> on or expired) immediately repaints the
  // entitlement-restricted DOM.
  if (typeof window.BBF_APPLY_TIER_GATE === 'function') {
    try { window.BBF_APPLY_TIER_GATE(); } catch (_) {}
  }
};

// ═════════════════════════════════════════════════════════════════════
// Phase 9 — Tier-based feature gate.
//
// CEO directive: keep the existing Sovereign Command Center entitlement
// architecture intact, just teach the app to enforce per-tier visibility
// on the four new monetized tiers.
//
//   gateway / youth_athlete  → Program tab (Standard Workouts) + Profile.
//                              Hide: Phantom Eye module (AI Vision+Coach),
//                              entire Nutrition tab, Log (Free Log) tab,
//                              Prehab (Somatic Readiness) tab, Somatic
//                              widget on Home, Home quick-action shortcuts
//                              for Nutrition & Free Log.
//   architect                → Standard Macros/Meal Plan + Somatic +
//                              Program + Log + Profile. Hide: Phantom Eye
//                              module + Nutrition tools stack (Virtual
//                              Chef + Nutrition Vision) + Scan Meal btn.
//   sovereign                → Everything unlocked.
//   default / unknown        → Most restrictive (Gateway treatment).
//
// Trial-active overrides tier to give Sovereign-equivalent UI access
// while the 7-day trial is live (mirrors the server-side trial gate
// on the WS upgrade path).
// ═════════════════════════════════════════════════════════════════════
// Element-IDs and nav-tab slugs the gate touches. Listed centrally so
// the gate can reset (un-lock) all of them before re-applying the per-
// tier subset — guarantees a tier upgrade in the Command Center
// immediately reveals previously-hidden features without a refresh.
var _BBF_TIER_GATE_ELS = [
  'phantom-eye-module',     // Program-tab AI block (Phantom Eye + Virtual Coach)
  'virtual-chef-module',    // Nutrition-tab Virtual Chef button
  'nutrition-vision-module',// Nutrition-tab Nutrition Vision widget
  'nutrition-tools-stack',  // Wrapper around chef + vision modules (Architect-locks the whole stack)
  'audioMealScannerBtn',    // Nutrition-tab Scan Meal CTA (dynamically rendered in #ncon)
  'mealScannerContainer',   // Hidden WebRTC capture container (dynamic)
  'somatic-map',            // Home-tab Somatic Readiness widget
  'qa-l',                   // Home quick-action: Free Log
  'qa-n'                    // Home quick-action: Nutrition
];
var _BBF_TIER_GATE_NAVS = ['nutrition', 'prehab'];

var _BBF_TIER_LOCKS = {
  // Each tier names the elements / nav tabs it must HIDE.
  // Phase 5 audible: Prehab is now a GLOBAL CORE FEATURE (Live Library
  // Recovery Matrix) — removed from gateway/youth_athlete lock list.
  // Phase 10: Smart Cardio (replacing legacy Log tab) is also global —
  // removed 'log' from every tier's nav-lock list. 'log' slug is dead.
  gateway: {
    els:  ['phantom-eye-module','virtual-chef-module','nutrition-vision-module','nutrition-tools-stack','audioMealScannerBtn','mealScannerContainer','somatic-map','qa-l','qa-n'],
    navs: ['nutrition']
  },
  youth_athlete: {
    els:  ['phantom-eye-module','virtual-chef-module','nutrition-vision-module','nutrition-tools-stack','audioMealScannerBtn','mealScannerContainer','somatic-map','qa-l','qa-n'],
    navs: ['nutrition']
  },
  architect: {
    els:  ['phantom-eye-module','virtual-chef-module','nutrition-vision-module','nutrition-tools-stack','audioMealScannerBtn','mealScannerContainer'],
    navs: []
  },
  sovereign: {
    els:  [],
    navs: []
  }
};

window.BBF_APPLY_TIER_GATE = function() {
  try {
    var uid = (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || null;
    if (!uid) return;
    var d = GD();
    var user = (d.u && d.u[uid]) || {};
    var tier = String(user.subscription_tier || '').toLowerCase();
    // Trial-active = Sovereign UI access regardless of base tier.
    var trialActive = user.trial_expires_at && new Date(user.trial_expires_at).getTime() > Date.now();
    var effectiveTier = trialActive ? 'sovereign' : tier;
    var lock = _BBF_TIER_LOCKS[effectiveTier] || _BBF_TIER_LOCKS.gateway; // safest default

    // Reset: clear lock class on every gate-aware element + nav button
    // first, so a tier upgrade reveals previously-hidden surfaces.
    _BBF_TIER_GATE_ELS.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('bbf-tier-locked');
    });
    _BBF_TIER_GATE_NAVS.forEach(function(slug) {
      var btn = document.querySelector('.nv[data-tab="' + slug + '"]');
      if (btn) btn.classList.remove('bbf-tier-locked');
    });

    // Apply this tier's locks.
    lock.els.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('bbf-tier-locked');
    });
    lock.navs.forEach(function(slug) {
      var btn = document.querySelector('.nv[data-tab="' + slug + '"]');
      if (btn) btn.classList.add('bbf-tier-locked');
      // If the currently-active tab is one we just locked, bounce to Home.
      var pane = document.getElementById('tp-' + slug);
      if (pane && pane.classList.contains('on') && typeof TAB === 'function') {
        TAB('home');
      }
    });
  } catch(_) {}
};

// Wearables "Coming Soon" — always-on greyed overlay regardless of trial
// state. Targets the Somatic Readiness wearable button only — the ARE
// sync / resync controls were amputated with the mock-slider eradication,
// replaced by the Sovereign Intelligence Brief. CEO directive: do not
// build the Open Wearables backends at this time.
window.BBF_APPLY_WEARABLES_COMING_SOON = function() {
  try {
    var ids = ['som-wearable-btn'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      // Wrap the button in a positioned shell so the badge anchors right.
      var wrap = el.parentElement;
      if (!wrap) return;
      if (!wrap.classList.contains('iv-wearables-coming-soon')) {
        // Safety: if the wrapper hosts other unrelated children, scope the
        // class on a fresh inline-block span around the button instead.
        if (wrap.children.length > 1) {
          if (el.dataset._ivWrapped === '1') return;
          var shell = document.createElement('span');
          shell.className = 'iv-wearables-coming-soon';
          shell.style.display = 'inline-block';
          shell.style.position = 'relative';
          el.parentNode.insertBefore(shell, el);
          shell.appendChild(el);
          el.dataset._ivWrapped = '1';
        } else {
          wrap.classList.add('iv-wearables-coming-soon');
        }
      }
      el.disabled = true;
    });
  } catch(_) {}
};

window.BBF_START_TRIAL = function() {
  try {
    // WAR ROOM Phase 5 — gate CTA now lives on both Program (#pe-frame) and
    // Nutrition (#nv-frame) surfaces, so it's class-keyed instead of ID-keyed
    // to avoid duplicate-ID DOM. Iterate every gate button on the page.
    var gateBtns = document.querySelectorAll('.iv-trial-cta-btn--gate');
    function _setGate(text, disabled) {
      for (var i = 0; i < gateBtns.length; i++) {
        gateBtns[i].disabled = disabled;
        gateBtns[i].textContent = text;
      }
    }
    _setGate('Starting…', true);
    var uid = (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || null;
    if (!uid) return;
    var sync = (typeof BBF_SYNC !== 'undefined') ? BBF_SYNC : null;
    if (!sync || !sync.startTrial) {
      console.error('[Iron Vault] BBF_SYNC.startTrial unavailable');
      _setGate('Unlock 7-Day Sovereign Trial', false);
      return;
    }
    sync.startTrial(uid).then(function(res) {
      if (res && res.ok && res.trial_expires_at) {
        var d = GD();
        if (!d.u[uid]) d.u[uid] = {};
        d.u[uid].trial_expires_at = res.trial_expires_at;
        SD(d);
        if (typeof TOAST === 'function') TOAST('Sovereign Trial activated — 7 days unlocked.');
        window.BBF_APPLY_TRIAL_GATE();
        return;
      }
      _setGate('Unlock 7-Day Sovereign Trial', false);
      var msg = (res && res.error) || 'unknown';
      if (msg === 'trial_already_consumed') {
        if (typeof TOAST === 'function') TOAST('Trial already used — refresh to see latest state.');
        if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.fetchTrialState) {
          BBF_SYNC.fetchTrialState(uid).then(function(s) {
            if (s) {
              var d2 = GD();
              if (!d2.u[uid]) d2.u[uid] = {};
              d2.u[uid].subscription_tier = s.subscription_tier || null;
              d2.u[uid].trial_expires_at  = s.trial_expires_at  || null;
              SD(d2);
              window.BBF_APPLY_TRIAL_GATE();
            }
          });
        }
      } else if (msg === 'rate_limited') {
        if (typeof TOAST === 'function') TOAST('Too many attempts — wait an hour and try again.');
      } else {
        if (typeof TOAST === 'function') TOAST('Trial activation failed (' + msg + ').');
      }
    });
  } catch(e) { console.error('[Iron Vault] BBF_START_TRIAL threw:', e && e.message); }
};

window.BBF_SHOW_PAYWALL_MODAL = function() {
  try {
    var existing = document.getElementById('iv-paywall-root');
    if (existing) existing.remove();
    var root = document.createElement('div');
    root.id = 'iv-paywall-root';
    root.className = 'iv-paywall-backdrop';
    root.innerHTML =
      '<div class="iv-paywall-card" role="dialog" aria-modal="true">' +
        '<div class="iv-paywall-kicker">SOVEREIGN VAULT</div>' +
        '<div class="iv-paywall-title">Upgrade to Premium</div>' +
        '<div class="iv-paywall-body">' +
          'Your Sovereign Trial has ended. Upgrade to keep AI voice + camera coaching, ' +
          'wearable sync, and the full Sovereign protocol stack.' +
        '</div>' +
        '<button type="button" class="iv-paywall-btn" id="iv-paywall-go">Continue to Checkout</button>' +
        '<div><button type="button" class="iv-paywall-close" id="iv-paywall-close">Not now</button></div>' +
      '</div>';
    document.body.appendChild(root);
    document.getElementById('iv-paywall-go').addEventListener('click', function() {
      // Placeholder Stripe wiring per CEO directive — uses the existing
      // Sovereign tier checkout URL. Real Stripe paywall hook is a future slice.
      var url = (typeof BBF_STRIPE_BY_TIER !== 'undefined' && BBF_STRIPE_BY_TIER && BBF_STRIPE_BY_TIER.sovereign)
        ? BBF_STRIPE_BY_TIER.sovereign
        : 'sms:6233409254?body=Upgrade%20me%20to%20Sovereign';
      try { window.location.href = url; } catch(_) {}
    });
    document.getElementById('iv-paywall-close').addEventListener('click', function() { root.remove(); });
    root.addEventListener('click', function(ev) { if (ev.target === root) root.remove(); });
  } catch(_) {}
};

// Cross-device fresh-fetch (Q4): on tab focus, pull subscription_tier +
// trial_expires_at from Supabase and re-apply the gate. localStorage is
// strictly display; server is truth.
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState !== 'visible') return;
  try {
    var uid = (typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU) || null;
    if (!uid) return;
    if (typeof BBF_SYNC === 'undefined' || !BBF_SYNC.fetchTrialState) return;
    BBF_SYNC.fetchTrialState(uid).then(function(s) {
      if (!s) return;
      var d = GD();
      if (!d.u[uid]) d.u[uid] = {};
      d.u[uid].subscription_tier = s.subscription_tier || null;
      d.u[uid].trial_expires_at  = s.trial_expires_at  || null;
      SD(d);
      window.BBF_APPLY_TRIAL_GATE();
    });
  } catch(_) {}
});

function GD(){try{return JSON.parse(localStorage.getItem(K))||{u:{},l:{},w:{}};}catch(e){return{u:{},l:{},w:{}};}}
function SD(d){localStorage.setItem(K,JSON.stringify(d));}

function SS(id){
  document.querySelectorAll('.scr').forEach(function(s){s.classList.remove('on');});
  var t=document.getElementById(id);
  if(t)t.classList.add('on');
}

var _lockoutInt = null;
var _loginInFlight = false;
async function LOGIN(){
  if(_loginInFlight) return;
  _loginInFlight = true;
  try {
    var uEl=document.getElementById('u')||document.getElementById('un');
    var pEl=document.getElementById('p')||document.getElementById('pw');
    var btn = document.getElementById('signin-btn');
    if(pEl && pEl.disabled) return;
    var msg=document.getElementById('lmsg');
    if(!uEl||!pEl){if(msg)msg.textContent='Form error. Reload page.';return;}
    var user=uEl.value.trim().toLowerCase();
    var pin=pEl.value.trim();
    if(!user||!pin){if(msg){msg.textContent='Enter username and PIN.';msg.style.color='';}return;}

    if (msg) {
      msg.textContent = 'Authenticating via Sovereign Layer...';
      msg.style.color = 'var(--yel)';
    }

    try {
      var _ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var _to  = _ctl ? setTimeout(function(){ _ctl.abort(); }, 10000) : null;
      var _opts = {
        method: 'POST',
        headers: {
          'apikey': window.ENV_SUPABASE_KEY,
          'Authorization': 'Bearer ' + window.ENV_SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid: user, pin_attempt: pin })
      };
      if (_ctl) _opts.signal = _ctl.signal;
      var res = await fetch(window.ENV_SUPABASE_URL + '/rest/v1/rpc/bbf_verify_user_pin', _opts);
      if (_to) clearTimeout(_to);
      var data = await res.json();
      if(!data.ok){
        if(data.lockout_active){
          uEl.disabled = true;
          pEl.disabled = true;
          if(btn) btn.disabled = true;
          if(data.retry_after_seconds <= 0) {
            uEl.disabled = false; pEl.disabled = false; if(btn) btn.disabled = false;
            if(msg){msg.textContent='Incorrect username or PIN.';msg.style.color='#ef4444';}
            return;
          }
          var remaining = data.retry_after_seconds;
          if(msg){msg.style.color='#ef4444'; msg.textContent = 'Locked. Try again in ' + Math.floor(remaining/60) + 'm ' + (remaining%60).toString().padStart(2,'0') + 's';}
          clearInterval(_lockoutInt);
          _lockoutInt = setInterval(function(){
            remaining--;
            if(remaining <= 0) {
              clearInterval(_lockoutInt);
              uEl.disabled = false; pEl.disabled = false; if(btn) btn.disabled = false;
              if(msg){msg.textContent='';msg.style.color='';}
            } else {
              if(msg) msg.textContent = 'Locked. Try again in ' + Math.floor(remaining/60) + 'm ' + (remaining%60).toString().padStart(2,'0') + 's';
            }
          }, 1000);
        } else {
          if(msg){msg.textContent='Incorrect username or PIN.';msg.style.color='#ef4444';}
        }
        return;
      }
    } catch(e) {
      if(msg){msg.textContent='Authentication error. Check connection.';msg.style.color='#ef4444';}
      return;
    }

    // Phase 4 D: capture plans returned by bbf_verify_user_pin (if any).
    // Stored on window so LP() and Markdown fallback paths in RW/RN can
    // read them after ENTER(). The home-tab YOUR PLAN summary panel was
    // removed in Phase 5+ once the dedicated PROGRAM and NUTRITION tabs
    // started rendering the polished UI from these same fields.
    window._bbfPlans = (data && data.plans_available) ? {
      workout_plan: data.workout_plan || '',
      meal_plan: data.meal_plan || '',
      plans_generated_at: data.plans_generated_at || null
    } : null;

    // Phase 5+ : if the cloud plans came back as JSON in the legacy WP/MP
    // shapes (Anthropic outputs JSON since the system-prompt rewrite),
    // populate PLAN and MP[user] so the existing polished RW()/RN() render
    // functions display them identically to legacy seeded clients (Ana etc).
    // Falls through to the Markdown <pre> fallback in RW/RN if the strings
    // aren't valid JSON (backward-compat with older content).
    if (window._bbfPlans) {
      try {
        if (window._bbfPlans.workout_plan) {
          var workoutParsed = JSON.parse(window._bbfPlans.workout_plan);
          if (Array.isArray(workoutParsed) && workoutParsed.length) {
            PLAN = workoutParsed;
            // Cache on window so LP() can re-apply this when called later
            // (LP() runs after LOGIN and would otherwise reset PLAN to null
            // for users without a legacy u.plan key).
            window._bbfPlans._cloudPlanArray = workoutParsed;
          }
        }
      } catch(e) { /* legacy Markdown content — RW will render as <pre> */ }
      try {
        if (window._bbfPlans.meal_plan) {
          var mealParsed = JSON.parse(window._bbfPlans.meal_plan);
          if (mealParsed && Array.isArray(mealParsed.days) && mealParsed.days.length) {
            MP[user] = mealParsed;
            // Phase 7.x · async catalog decoration so checkbox-check
            // can log real {kcal, p, c, f} to bbf_meal_logs.
            try {
              if (typeof BBF_MEAL_CATALOG !== 'undefined') {
                BBF_MEAL_CATALOG.decorateAsync(MP[user]).then(function() {
                  if (typeof RN === 'function') {
                    var pane = document.getElementById('tp-nutrition');
                    if (pane && pane.classList.contains('on')) RN();
                  }
                });
              }
            } catch (_) {}
          }
        }
      } catch(e) { /* legacy Markdown content — RN will render as <pre> */ }
    }

    var d=GD();
    if(!d.u[user]){
      var SEEDS={
        'akeem':      {name:'Akeem Brown',  pin:null, role:'trainer',type:'Trainer',  goal:'Head Coach',       gw:'',  plan:'akeem_ceo'},
        'ana_bbf':    {name:'Ana',          pin:null, role:'client', type:'Essentials',goal:'Lean & Toned',    gw:'135',plan:'ana_spring'},
        'jacky_bbf':  {name:'Jacky',        pin:null, role:'client', type:'Essentials',goal:'Strength',        gw:'',  plan:'jacky_plan'},
        'jacque_bbf':{name:'Jacquelyn',      pin:null, role:'client', type:'Essentials',goal:'4-Day Postpartum Recomp', gw:'',  plan:'jacque_plan'},
        'jordan_bbf': {name:'Jordan',       pin:null, role:'client', type:'Platinum',  goal:'Weight Loss',     gw:'185',plan:'jordan_wayne'},
        'wayne_bbf':  {name:'Wayne',        pin:null, role:'client', type:'Platinum',  goal:'Lean Muscle',     gw:'175',plan:'jordan_wayne'},
        'test_bbf':   {name:'Test Sovereign',pin:null, role:'client', type:'Sovereign', goal:'Smoke Test · Tour Walkthrough', gw:'',  plan:null}
      };
      d.u[user]=SEEDS[user]||{name:user,pin:null,role:'client',type:'Essentials',goal:'',gw:'',plan:null};
      if(!d.l[user])d.l[user]=[];
      if(!d.w[user])d.w[user]={};
      SD(d);
    }
    // Phase 18 — daily_brief hydration kept in the data layer for
    // backend/admin consumers (Midnight Haiku Engine writes it
    // nightly; bbf_verify_user_pin returns it on success). The
    // Sovereign Readiness UI that surfaced this string was NUKED
    // per CEO directive — mirror is retained for future server-side
    // consumers and admin dashboards only. Always write (even when
    // null/undefined) so a stale local value never ghosts a cleared
    // server value.
    if (data && Object.prototype.hasOwnProperty.call(data, 'daily_brief')) {
      d.u[user].daily_brief = data.daily_brief || null;
      SD(d);
    }
    CU=user;
    VC=(user==='akeem')?null:user;
    if(msg)msg.textContent='';

    // ─── Phase 7.x · Founder Bootstrap Token ────────────────────
    // If the verified user is a founder/admin role, fetch the agent
    // token from the Render proxy and cache in sessionStorage so the
    // 11 _adminToken() helpers short-circuit at the env.js →
    // sessionStorage step, never reaching the role-gated prompt.
    // Fire-and-forget · non-blocking · ENTER() proceeds immediately.
    // Token never lives in static JS · Render proxy validates the
    // PIN (lockout-aware) + reads role from bbf_users service-side
    // before releasing.
    try {
      var _bbfBootUser = (d && d.u && d.u[user]) || null;
      if (_bbfBootUser && (_bbfBootUser.role === 'trainer' || _bbfBootUser.role === 'admin')) {
        fetch('https://buildbelievefit.onrender.com/api/founder-bootstrap-token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ uid: user, pin: pin })
        }).then(function(r) {
          return r.json().catch(function() { return null; });
        }).then(function(body) {
          if (body && body.ok && body.token) {
            // Persist in BOTH storages · localStorage so subsequent
            // sessions on this device skip the bootstrap race entirely
            // (token already cached at _adminToken() time on next login).
            try { localStorage.setItem('BBF_COACH_AGENT_TOKEN', body.token); } catch(_) {}
            try { sessionStorage.setItem('BBF_COACH_AGENT_TOKEN', body.token); } catch(_) {}
            console.log('[BBF Bootstrap] founder agent token cached in localStorage + sessionStorage');
          } else {
            console.warn('[BBF Bootstrap] release failed:', (body && body.error) || 'unknown');
          }
        }).catch(function(e) {
          console.warn('[BBF Bootstrap] fetch threw:', e && e.message);
        });
      }
    } catch (e) { console.warn('[BBF Bootstrap] init threw:', e && e.message); }

    // Phase 17 — The Bouncer. PIN verified, but before we hand the user
    // to the dashboard we check subscription_tier + trial_expires_at.
    // Admin (akeem) short-circuits straight to ENTER. Anyone with
    // tier IS NULL OR 'lite' AND no active trial gets the Vault Access
    // Denied screen with Upgrade / Trial CTAs. Active trial OR tier in
    // (gateway, architect, sovereign, youth_athlete, nutrition_*)
    // proceeds normally.
    if (user === 'akeem') {
      if (typeof ENTER === 'function') { ENTER(); } else { SS('app'); }
      return;
    }
    var _proceedToApp = function _proceedToApp(){
      if (typeof ENTER === 'function') { ENTER(); } else { SS('app'); }
    };
    var _gatedAtBouncer = function _gatedAtBouncer(tier, expIso){
      var ms = expIso ? new Date(expIso).getTime() : 0;
      var trialActive = isFinite(ms) && ms > Date.now();
      var lockedTier = (tier === null || typeof tier === 'undefined' || tier === '' || tier === 'lite');
      return lockedTier && !trialActive;
    };
    try {
      if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.fetchTrialState) {
        BBF_SYNC.fetchTrialState(user).then(function(state){
          var tier = state && state.subscription_tier;
          var exp  = state && state.trial_expires_at;
          // Mirror to localStorage so the inside-app gates and visibility
          // refresh see the same state without an extra round trip.
          try {
            var d2 = GD();
            if (!d2.u[user]) d2.u[user] = {};
            d2.u[user].subscription_tier = tier || null;
            d2.u[user].trial_expires_at  = exp  || null;
            SD(d2);
          } catch(_) {}
          if (_gatedAtBouncer(tier, exp)) {
            window._bouncerUid = user;
            _paintBouncer(/*alreadyConsumed*/ exp != null);
            SS('bouncer');
            return;
          }
          _proceedToApp();
        }).catch(function(){
          // Fail-open on network error — the inside-app gate remains the
          // backstop. (Iron Vault V2 ws-ticket gate still enforces server-
          // side for AI/camera surfaces.)
          _proceedToApp();
        });
      } else {
        _proceedToApp();
      }
    } catch(_) { _proceedToApp(); }
    return;
  } finally {
    _loginInFlight = false;
  }
}

// Phase 17 — Bouncer screen handlers. Painted when LOGIN finds the
// just-authenticated user is NULL/lite-tier with no active trial.
// Wires the Upgrade and Trial CTAs to live network calls; the trial
// path resumes the dashboard transition on success so the user lands
// in-app one click later. Idempotent — safe to call repeatedly.
var BBF_GATEWAY_STRIPE_URL = 'https://buy.stripe.com/14A7sNb7143x1F02AFaZi0c';

function _paintBouncer(alreadyConsumed) {
  try {
    var copyEl    = document.getElementById('bouncer-copy');
    var trialBtn  = document.getElementById('bouncer-trial-btn');
    var upgradeBtn= document.getElementById('bouncer-upgrade-btn');
    if (alreadyConsumed && copyEl) {
      copyEl.textContent = 'Your trial has already been used. Upgrade to the Gateway or Sovereign tier to enter the Vault.';
    } else if (copyEl) {
      copyEl.textContent = 'Your account currently has no active app access. Please upgrade to the Gateway or Sovereign tier to enter the vault.';
    }
    if (trialBtn) {
      trialBtn.style.display = alreadyConsumed ? 'none' : '';
      trialBtn.disabled = false;
      trialBtn.textContent = 'UNLOCK 7-DAY SOVEREIGN TRIAL';
      trialBtn.onclick = function(){ _bouncerStartTrial(); };
    }
    if (upgradeBtn) {
      upgradeBtn.onclick = function(){
        try { window.location.href = BBF_GATEWAY_STRIPE_URL; } catch(_) {}
      };
    }
  } catch(_) {}
}

function _bouncerStartTrial() {
  var btn = document.getElementById('bouncer-trial-btn');
  var uid = window._bouncerUid;
  if (!uid) return;
  if (btn) { btn.disabled = true; btn.textContent = 'UNLOCKING…'; }
  if (typeof BBF_SYNC === 'undefined' || !BBF_SYNC.startTrial) {
    if (btn) { btn.disabled = false; btn.textContent = 'UNLOCK 7-DAY SOVEREIGN TRIAL'; }
    if (typeof TOAST === 'function') TOAST('Trial unavailable — sync layer offline.');
    return;
  }
  BBF_SYNC.startTrial(uid).then(function(res) {
    if (res && res.ok && res.trial_expires_at) {
      try {
        var d = GD();
        if (!d.u[uid]) d.u[uid] = {};
        d.u[uid].trial_expires_at = res.trial_expires_at;
        SD(d);
      } catch(_) {}
      if (typeof TOAST === 'function') TOAST('Sovereign Trial activated — 7 days unlocked.');
      // Resume the dashboard transition the bouncer interrupted.
      if (typeof ENTER === 'function') { ENTER(); } else { SS('app'); }
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = 'UNLOCK 7-DAY SOVEREIGN TRIAL'; }
    var err = (res && res.error) || 'unknown';
    if (err === 'trial_already_consumed') {
      _paintBouncer(true);
      if (typeof TOAST === 'function') TOAST('Trial already used — upgrade to continue.');
    } else if (err === 'rate_limited') {
      if (typeof TOAST === 'function') TOAST('Too many attempts — wait an hour and try again.');
    } else {
      if (typeof TOAST === 'function') TOAST('Trial activation failed (' + err + ').');
    }
  });
}

function exitBouncer() {
  try {
    window._bouncerUid = null;
    CU = null;
    VC = null;
  } catch(_) {}
  SS('auth');
}

function REGISTER(){
  // ─── IRON GATE (Phase 11 · paywall enforcement) ──────────────
  // CEO directive: only the trainer (Akeem) may create new client
  // accounts. The public "New Client" tab is removed from the auth
  // screen, but this function-level guard is defense-in-depth — a
  // bypass via DevTools (unhide the pane, click Create Profile)
  // still fails here. Legitimate admin-initiated creation flows
  // through ADMIN_CREATE_CLIENT() which sets _bbfAdminProvisioning
  // before invoking the create path.
  var _msg = document.getElementById('rmsg') || document.getElementById('admin-create-msg');
  var _isAkeem = (CU === 'akeem');
  var _adminFlag = !!window._bbfAdminProvisioning;
  if (!_isAkeem || !_adminFlag) {
    if (_msg) {
      _msg.textContent = 'Account creation is restricted. Contact Akeem (akeem@buildbelievefit.fitness) to provision your access after payment.';
      _msg.style.color = '#ef4444';
    }
    console.warn('[BBF] REGISTER blocked — admin-only path. CU=' + (CU || 'null') + ' adminFlag=' + _adminFlag);
    return;
  }
  // ─── END IRON GATE ───────────────────────────────────────────
  var nameEl=document.getElementById('rn')||document.getElementById('admin-create-name');
  var userEl=document.getElementById('ru')||document.getElementById('admin-create-user');
  var pinEl =document.getElementById('rp')||document.getElementById('admin-create-pin');
  var typeEl=document.getElementById('rt')||document.getElementById('admin-create-type');
  var goalEl=document.getElementById('rg')||document.getElementById('admin-create-goal');
  var msg   =_msg;
  if(!nameEl||!userEl||!pinEl){if(msg)msg.textContent='Form error.';return;}
  var name=nameEl.value.trim();
  var user=userEl.value.trim().toLowerCase().replace(/\s+/g,'_');
  var pin =pinEl.value.trim();
  var type=typeEl?typeEl.value:'Online / Remote';
  var goal=goalEl?goalEl.value.trim():'';
  if(!name||!user||pin.length!==6){
    if(msg){msg.textContent='Please fill all fields. PIN must be 6 digits.';msg.style.color='#ef4444';}
    return;
  }
  var d=GD();
  if(d.u[user]){if(msg){msg.textContent='Username taken. Choose another.';msg.style.color='#ef4444';}return;}
  // Audit trail — every admin-provisioned profile is stamped so we can
  // distinguish from any legacy self-signups in the data.
  d.u[user]={
    name:name, pin:pin, role:'client',
    type:type, goal:goal, gw:'', plan:null,
    created_by:'akeem', created_at:(typeof today==='function'?today():new Date().toISOString().slice(0,10)),
    provisioning:'admin_override'
  };
  if(!d.l[user])d.l[user]=[];
  if(!d.w[user])d.w[user]={};
  SD(d);
  // Admin-provisioning path: do NOT auto-login as the new client.
  // Akeem stays signed in and gets a confirmation toast + roster
  // refresh. The new client signs in themselves with their PIN.
  if (msg) {
    msg.textContent = 'Profile created for ' + name + ' (' + user + '). Share their PIN.';
    msg.style.color = '#22c55e';
  }
  if (typeof TOAST === 'function') TOAST('🔐 Client profile created: ' + name);
  // Refresh the trainer dashboard so the new client appears in the roster.
  if (typeof renderTrainerDashboard === 'function') {
    try { renderTrainerDashboard(d); } catch (_) {}
  }
  // Clear form fields after success for the next provisioning.
  try { nameEl.value=''; userEl.value=''; pinEl.value=''; if(goalEl)goalEl.value=''; } catch(_){}
}

// ─── ADMIN-ONLY CLIENT PROVISIONING (Phase 11) ──────────────────
// Trainer-side override for the iron-gated REGISTER() function. Used
// when Akeem needs to create a profile manually after a client pays
// but cannot get access through the normal flow (failed sync, lost
// PIN at sign-up, in-person paid client, etc.).
//
// UI: hidden modal #admin-create-modal. Trainer dashboard renders a
// "+ Create Client Profile" button that opens it. Submission flips
// window._bbfAdminProvisioning so REGISTER()'s iron gate allows the
// call, then unflips in finally.
window.openAdminCreateClient = function openAdminCreateClient(){
  if (CU !== 'akeem') {
    console.warn('[BBF] openAdminCreateClient blocked — only Akeem can open this modal.');
    return;
  }
  var modal = document.getElementById('admin-create-modal');
  if (modal) modal.classList.add('on');
};
window.closeAdminCreateClient = function closeAdminCreateClient(){
  var modal = document.getElementById('admin-create-modal');
  if (modal) modal.classList.remove('on');
  var msg = document.getElementById('admin-create-msg');
  if (msg) { msg.textContent = ''; msg.style.color = ''; }
};
window.ADMIN_CREATE_CLIENT = function ADMIN_CREATE_CLIENT(){
  // Trainer-initiated. Flip the iron-gate bypass flag JUST for this
  // call; REGISTER's guard checks CU==='akeem' AND this flag, so a
  // call without both fails. try/finally guarantees the flag clears
  // even if REGISTER throws.
  if (CU !== 'akeem') {
    console.warn('[BBF] ADMIN_CREATE_CLIENT blocked — current user is not Akeem.');
    return;
  }
  // Capture Sovereign Intake fields BEFORE REGISTER (they live in the
  // admin-create-modal DOM, separate from REGISTER's auth-pane inputs).
  var userField  = document.getElementById('admin-create-user');
  var intakeUser = userField ? String(userField.value || '').trim().toLowerCase() : '';
  var intake     = (typeof _readAdminCreateIntake === 'function') ? _readAdminCreateIntake() : null;

  window._bbfAdminProvisioning = true;
  try {
    REGISTER();
  } finally {
    window._bbfAdminProvisioning = false;
  }

  // After REGISTER, if a new user record exists, stamp the dietary
  // intake fields onto it and persist. REGISTER may set the username
  // to a slug variant — if intakeUser isn't found, look for the most
  // recent freshly-created provisioned record.
  try {
    if (!intake) return;
    var d2 = GD();
    if (!d2 || !d2.u) return;
    var target = null;
    if (intakeUser && d2.u[intakeUser]) {
      target = d2.u[intakeUser];
    } else {
      // Fallback: find a record stamped with admin_override that
      // doesn't yet have a dietary_profile attached.
      Object.keys(d2.u).forEach(function(k) {
        var u = d2.u[k] || {};
        if (u.provisioning === 'admin_override' && !u.dietary_profile && !target) target = u;
      });
    }
    if (!target) return;
    target.dietary_profile = intake.dietary_profile || 'Omnivore';
    target.allergens       = intake.allergens || [];
    target.food_likes      = intake.food_likes || [];
    target.food_dislikes   = intake.food_dislikes || [];
    SD(d2);
    console.log('[BBF] dietary intake stamped on new client:', target.name || '(no name)', JSON.stringify({
      diet: target.dietary_profile, allergens: target.allergens.length, likes: target.food_likes.length, dislikes: target.food_dislikes.length
    }));

    // Cloud sync · the previous flow never created a bbf_users row, so
    // a client created here could not sign in on their own device.
    // Fixed by /api/admin-upsert-client.
    if (window.BBF_CLOUDSYNC) {
      var targetUid = intakeUser;
      if (!targetUid) {
        // Fallback · find the slug key for `target` in d2.u
        Object.keys(d2.u).forEach(function(k){ if (d2.u[k] === target) targetUid = k; });
      }
      if (targetUid) {
        BBF_CLOUDSYNC.upsert(targetUid, {
          name:            target.name || targetUid,
          role:            target.role || 'client',
          dietary_profile: target.dietary_profile,
          allergens:       target.allergens,
          food_likes:      target.food_likes,
          food_dislikes:   target.food_dislikes
        }).then(function(r) {
          var msgEl = document.getElementById('admin-create-msg');
          if (r.ok) {
            console.log('[BBF] cloud row created for ' + targetUid);
            if (msgEl) { msgEl.textContent = '◇ Provisioned · cloud row created · client can sign in on their device.'; msgEl.style.color = 'var(--yel)'; }
          } else {
            console.warn('[BBF] cloud row creation FAILED for ' + targetUid + ' · ' + r.error);
            if (msgEl) { msgEl.textContent = '⚠ Local saved · cloud sync failed (' + r.error + ') · client will not see their plan on their device until you re-push from the Dietary Profile editor.'; msgEl.style.color = 'var(--red,#ef4444)'; }
          }
        });
      }
    }
  } catch (e) {
    console.warn('[BBF] admin-create intake stamp failed:', e && e.message);
  }
};

// Helper · reads the Sovereign Intake fields out of admin-create-modal
// and normalizes them (comma-split, trim, lowercase keys for allergens).
function _readAdminCreateIntake() {
  function parseCsv(id) {
    var el = document.getElementById(id);
    var raw = el ? String(el.value || '').trim() : '';
    if (!raw) return [];
    return raw.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  }
  function gatherChecked(containerId) {
    var c = document.getElementById(containerId);
    if (!c) return [];
    return Array.from(c.querySelectorAll('input[type="checkbox"]:checked')).map(function(i){ return i.value; });
  }
  var dietEl = document.getElementById('admin-create-diet');
  return {
    dietary_profile: dietEl ? dietEl.value : 'Omnivore',
    allergens:       gatherChecked('admin-create-allergens'),
    food_likes:      parseCsv('admin-create-likes'),
    food_dislikes:   parseCsv('admin-create-dislikes')
  };
}

// Wire buttons immediately
document.addEventListener('DOMContentLoaded',function(){
  var sbtn=document.getElementById('signin-btn');
  var rbtn=document.getElementById('register-btn');
  var ebtn=document.getElementById('ebtn');
  var pFld=document.getElementById('p')||document.getElementById('pw');
  var uFld=document.getElementById('u')||document.getElementById('un');
  if(sbtn)sbtn.onclick=LOGIN;
  if(rbtn)rbtn.onclick=REGISTER;
  if(ebtn)ebtn.onclick=function(){SS('auth');};
  if(pFld)pFld.addEventListener('keydown',function(e){if(e.key==='Enter')LOGIN();});
  if(uFld)uFld.addEventListener('keydown',function(e){if(e.key==='Enter'){var p=document.getElementById('p')||document.getElementById('pw');if(p)p.focus();}});
  // Phase 7.x · preload the meal catalog so by the time the user reaches
  // the Nutrition tab the macro lookup is in memory and pills render on
  // the first paint (no decorate-then-rerender flash).
  try { if (typeof BBF_MEAL_CATALOG !== 'undefined') BBF_MEAL_CATALOG.load(); } catch (_) {}
});
window.onload=function(){
  var ebtn=document.getElementById('ebtn');
  if(ebtn)ebtn.onclick=function(){SS('auth');};
  var sbtn=document.getElementById('signin-btn');
  if(sbtn)sbtn.onclick=LOGIN;
};
