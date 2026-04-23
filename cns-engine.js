// ═══════════════════════════════════════════════════════════════
// CNS-ENGINE.JS — Sovereign Neurological Engine
// Clinical CNS Readiness Matrix (79-source distillation):
// HRV / RMSSD deviation × Sleep Architecture × Acute:Chronic
// Workload Ratio → Sovereign Readiness Score (SRS) & Lockout.
// ───────────────────────────────────────────────────────────────
//   HRV  GREEN  > -5%          YELLOW  -5 to -15%   RED  < -15%
//   SLP  Total < 7.0h  OR  Deep < 1.0h        → Lockout (RFD)
//   ACWR 0.8-1.3 Sweet   1.3-1.5 Caution   >1.5 Lockout (Injury)
//   SRS  = 0.45·HRV + 0.25·Sleep + 0.15·Deep + 0.15·ACWR
//         − 15 (penalty if ACWR > 1.5)
// ═══════════════════════════════════════════════════════════════

const CNS_ENGINE = (function () {
  'use strict';

  const STORE_KEY = 'bbf_cns_state_v1';

  const DEFAULTS = {
    hrvDeviation: 0,   // % deviation from 7-day RMSSD baseline
    totalSleep:   8.0, // hours
    deepSleep:    1.5, // hours (N3 slow-wave)
    acwr:         1.0  // Acute:Chronic Workload Ratio (Banister)
  };

  // ─── STATE IO ────────────────────────────────────────────
  function readState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      const p = JSON.parse(raw) || {};
      return {
        hrvDeviation: num(p.hrvDeviation, DEFAULTS.hrvDeviation),
        totalSleep:   num(p.totalSleep,   DEFAULTS.totalSleep),
        deepSleep:    num(p.deepSleep,    DEFAULTS.deepSleep),
        acwr:         num(p.acwr,         DEFAULTS.acwr)
      };
    } catch (_) { return Object.assign({}, DEFAULTS); }
  }

  function writeState(patch) {
    try {
      const next = Object.assign(readState(), patch || {});
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
      return next;
    } catch (_) { return readState(); }
  }

  function num(v, fb) {
    const n = parseFloat(v);
    return isFinite(n) ? n : fb;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ─── COMPONENT SCORES (0–100) ────────────────────────────
  function hrvScore(dev) {
    // dev in %; 0 → 100, -5 → 80, -15 → 40, ≤ -25 → 0
    return clamp(100 + 4 * dev, 0, 100);
  }
  function totalSleepScore(h) {
    // 8h caps at 100; 7h → 87.5; 6h → 75; 0 → 0
    return clamp((h / 8) * 100, 0, 100);
  }
  function deepSleepScore(h) {
    // 2h caps at 100; 1h → 50; 0 → 0
    return clamp((h / 2) * 100, 0, 100);
  }
  function acwrScore(r) {
    if (r >= 0.8 && r <= 1.3) return 100;
    if (r < 0.8)              return clamp((r / 0.8) * 100, 0, 100);
    if (r <= 1.5)             return 100 - ((r - 1.3) / 0.2) * 60; // 100 → 40
    return 0;
  }

  // ─── SRS CALCULATION ─────────────────────────────────────
  function calculateSRS(s) {
    const state = Object.assign(readState(), s || {});
    const comp = {
      hrv:   hrvScore(state.hrvDeviation),
      total: totalSleepScore(state.totalSleep),
      deep:  deepSleepScore(state.deepSleep),
      acwr:  acwrScore(state.acwr)
    };
    const weighted =
      comp.hrv   * 0.45 +
      comp.total * 0.25 +
      comp.deep  * 0.15 +
      comp.acwr  * 0.15;
    const penalty = (state.acwr > 1.5) ? 15 : 0;
    const score = Math.round(clamp(weighted - penalty, 0, 100));
    return { score: score, components: comp, penalty: penalty, inputs: state };
  }

  // ─── BIOMETRIC AUDIT → GREEN / YELLOW / RED ──────────────
  function auditBiometrics(s) {
    const srs = calculateSRS(s);
    const st  = srs.inputs;
    const lockReasons = [];
    const yellowReasons = [];

    if (st.hrvDeviation < -15) {
      lockReasons.push({
        code: 'HRV_RED',
        headline: 'HRV COLLAPSE',
        detail: 'RMSSD deviation ' + st.hrvDeviation.toFixed(1) + '% — sympathetic override. Parasympathetic tone insufficient for max-effort loading.'
      });
    } else if (st.hrvDeviation <= -5) {
      yellowReasons.push({
        code: 'HRV_YELLOW',
        headline: 'HRV TAPER',
        detail: 'RMSSD ' + st.hrvDeviation.toFixed(1) + '% below baseline — auto-regulate volume −20%.'
      });
    }

    if (st.totalSleep < 7.0 || st.deepSleep < 1.0) {
      lockReasons.push({
        code: 'SLEEP_RED',
        headline: 'SLEEP ARCHITECTURE LOCKOUT',
        detail: 'CNS Restoration Incomplete. Rate of Force Development (RFD) will be blunted. ' +
                'Total ' + st.totalSleep.toFixed(1) + 'h / Deep ' + st.deepSleep.toFixed(1) + 'h.'
      });
    }

    if (st.acwr > 1.5) {
      lockReasons.push({
        code: 'ACWR_RED',
        headline: 'EXPONENTIAL INJURY RISK DETECTED',
        detail: 'Acute:Chronic Workload Ratio ' + st.acwr.toFixed(2) + ' — tissue load outpacing adaptation reserve.'
      });
    } else if (st.acwr > 1.3) {
      yellowReasons.push({
        code: 'ACWR_YELLOW',
        headline: 'WORKLOAD CAUTION',
        detail: 'ACWR ' + st.acwr.toFixed(2) + ' — watch tissue accrual.'
      });
    }

    const state = lockReasons.length ? 'RED'
                : yellowReasons.length ? 'YELLOW'
                : 'GREEN';

    return {
      state: state,
      srs: srs,
      lockout: {
        active: lockReasons.length > 0,
        reasons: lockReasons,
        primary: lockReasons[0] || null
      },
      taper: state === 'YELLOW',
      yellowReasons: yellowReasons,
      inputs: st
    };
  }

  // ─── SAVELOG LOCKOUT ENFORCEMENT ─────────────────────────
  //   Block save IF audit === RED AND (intensity > 7 OR 1-RM work)
  function enforceLockout(entry) {
    const audit = auditBiometrics();
    if (!audit.lockout.active) return { block: false, audit: audit };

    const intensity = parseFloat(entry && entry.intensity);
    const highIntensity = isFinite(intensity) && intensity > 7;
    const hasOneRM = entry && Array.isArray(entry.exercises) &&
      entry.exercises.some(function (ex) {
        return /1[\s-]?rm\b/i.test(String(ex || ''));
      });

    const trigger = highIntensity || hasOneRM;
    if (!trigger) return { block: false, audit: audit };

    return {
      block: true,
      audit: audit,
      trigger: highIntensity ? 'INTENSITY>7' : 'ONE_REP_MAX',
      headline: 'SOVEREIGN LOCKOUT',
      reasons: audit.lockout.reasons
    };
  }

  // ─── DOCUMENT FRAGMENT + rAF PAINT ───────────────────────
  // CLS-safe render — parse HTML off-DOM, commit in one frame.
  function paintFragment(host, html) {
    if (!host) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    const frag = tpl.content;
    const commit = function () {
      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(frag);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(commit);
    else commit();
  }

  function stateClassForTier(tier) {
    if (tier === 'RED')    return 'is-critical-lockout';
    if (tier === 'YELLOW') return 'is-caution';
    return 'is-ok';
  }

  // ─── DASHBOARD UI (Sovereign Matte Black) ────────────────
  function renderDashboardBlock() {
    const host = document.getElementById('cns-engine-block');
    if (!host) return null;
    host.classList.remove('is-hidden');
    const audit = auditBiometrics();
    const st = audit.inputs;
    const tier = audit.state;
    const stateClass = stateClassForTier(tier);
    const srs = audit.srs.score;

    const tierLine = tier === 'RED'    ? 'LOCKOUT ACTIVE'
                   : tier === 'YELLOW' ? 'VOLUME TAPER −20%'
                   :                     'CLEARED FOR MAX EFFORT';

    const reasonsHTML = buildReasonsHTML(audit);

    const html =
      '<div class="sv-glass sv-block cns-card ' + stateClass + '" data-tier="' + tier + '">' +
        '<div class="sv-block-head">' +
          '<div>' +
            '<div class="sv-block-kicker">SOVEREIGN NEUROLOGICAL ENGINE</div>' +
            '<div class="sv-block-title">SOVEREIGN READINESS</div>' +
            '<div class="cns-tier-line"><span class="mono">' + tier + '</span> &middot; ' + tierLine + '</div>' +
          '</div>' +
          buildGauge(srs) +
        '</div>' +
        reasonsHTML +
        buildSliderGrid(st) +
        '<div class="cns-foot">HRV &middot; SLEEP &middot; ACWR &middot; <span class="mono">79</span> CLINICAL SOURCES &middot; MOCK WEARABLE FEED</div>' +
      '</div>';

    paintFragment(host, html);
    // Listeners bind after the rAF commit lands.
    const bind = function () { attachSliderHandlers(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(bind);
    else bind();
    return audit;
  }

  // SVG gauge — stroke color picks up the current state color via
  // `var(--state-color)`, which is set by .is-ok / .is-caution /
  // .is-critical-lockout on the parent.
  function buildGauge(score) {
    const circumference = (2 * Math.PI * 30).toFixed(2);
    const dashoffset   = ((1 - score / 100) * 2 * Math.PI * 30).toFixed(2);
    return (
      '<div class="sv-gauge">' +
        '<svg viewBox="0 0 72 72" aria-hidden="true">' +
          '<circle cx="36" cy="36" r="30" fill="none" stroke="var(--sv-surface-1)" stroke-width="6"/>' +
          '<circle class="sv-gauge-progress" cx="36" cy="36" r="30" fill="none" ' +
            'stroke="var(--state-color, var(--sv-cta))" stroke-width="6" stroke-linecap="round" ' +
            'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + dashoffset + '"/>' +
        '</svg>' +
        '<div class="sv-gauge-inner">' +
          '<div class="sv-gauge-score mono">' + score + '</div>' +
          '<div class="sv-gauge-label">SRS</div>' +
        '</div>' +
      '</div>'
    );
  }

  function buildReasonsHTML(audit) {
    const items = audit.lockout.active ? audit.lockout.reasons : audit.yellowReasons;
    if (!items || !items.length) return '';
    const stateClass = audit.lockout.active ? 'is-critical-lockout' : 'is-caution';
    return (
      '<div class="sv-reasons ' + stateClass + '">' +
        items.map(function (r) {
          return (
            '<div class="sv-reason-row">' +
              '<div class="sv-reason-bar"></div>' +
              '<div>' +
                '<div class="sv-reason-head">' + escapeHtml(r.headline) + '</div>' +
                '<div class="sv-reason-body">' + escapeHtml(r.detail) + '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  function buildSliderGrid(st) {
    const rows = [
      { key: 'hrvDeviation', label: 'HRV DEVIATION', unit: '%', min: -30, max: 10,  step: 0.5,  val: st.hrvDeviation, fmt: function(v){return (v>=0?'+':'')+v.toFixed(1);} },
      { key: 'totalSleep',   label: 'TOTAL SLEEP',   unit: 'h', min: 0,   max: 12,  step: 0.1,  val: st.totalSleep,   fmt: function(v){return v.toFixed(1);} },
      { key: 'deepSleep',    label: 'DEEP SLEEP',    unit: 'h', min: 0,   max: 3,   step: 0.1,  val: st.deepSleep,    fmt: function(v){return v.toFixed(1);} },
      { key: 'acwr',         label: 'ACWR',          unit: '',  min: 0,   max: 2.5, step: 0.05, val: st.acwr,         fmt: function(v){return v.toFixed(2);} }
    ];
    return (
      '<div class="sv-slider-grid">' +
        rows.map(function (r) {
          return (
            '<div class="sv-slider-row" data-cns-row="' + r.key + '">' +
              '<div class="sv-slider-head">' +
                '<div class="sv-slider-label">' + r.label + '</div>' +
                '<div class="sv-slider-value mono">' +
                  '<span id="cns-val-' + r.key + '">' + r.fmt(r.val) + '</span>' +
                  '<span class="sv-slider-unit">' + r.unit + '</span>' +
                '</div>' +
              '</div>' +
              '<input type="range" class="sv-range cns-range" data-cns-key="' + r.key + '" ' +
                'min="' + r.min + '" max="' + r.max + '" step="' + r.step + '" value="' + r.val + '">' +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  // Slider handlers — updates are coalesced into a single
  // requestAnimationFrame so rapid drags don't thrash the DOM.
  function attachSliderHandlers() {
    const inputs = document.querySelectorAll('#cns-engine-block input.cns-range');
    let pending = null;
    let rafId = 0;
    const flush = function () {
      rafId = 0;
      if (!pending) return;
      writeState(pending);
      pending = null;
      renderDashboardBlock();
    };
    inputs.forEach(function (inp) {
      inp.addEventListener('input', function () {
        const key = inp.getAttribute('data-cns-key');
        const v = parseFloat(inp.value);
        // Optimistic update of the visible number (no full repaint).
        const readout = document.getElementById('cns-val-' + key);
        if (readout) {
          const r = { hrvDeviation: function(x){return (x>=0?'+':'')+x.toFixed(1);},
                      totalSleep:   function(x){return x.toFixed(1);},
                      deepSleep:    function(x){return x.toFixed(1);},
                      acwr:         function(x){return x.toFixed(2);} };
          readout.textContent = (r[key] || function(x){return x;})(v);
        }
        pending = pending || {};
        pending[key] = v;
        if (!rafId && typeof requestAnimationFrame === 'function') {
          rafId = requestAnimationFrame(flush);
        } else if (!rafId) {
          flush();
        }
      });
    });
  }

  // ─── SOVEREIGN LOCKOUT ERROR (SAVELOG hook) ──────────────
  // State-class driven — all visuals live in #sovereign-ui-layer.
  function renderLockoutError(targetId, enforcement) {
    const reasons = (enforcement && enforcement.reasons) || [];
    const trigger = (enforcement && enforcement.trigger) === 'ONE_REP_MAX'
      ? '1-RM attempt blocked'
      : 'Intensity > 7 blocked';
    const srsScore = (enforcement && enforcement.audit && enforcement.audit.srs)
      ? enforcement.audit.srs.score : 0;

    const html =
      '<div class="cns-lockout is-critical-lockout" role="alert">' +
        '<div class="cns-lockout-head">' +
          '<div class="cns-lockout-icon">&#x26D4;</div>' +
          '<div>' +
            '<div class="cns-lockout-kicker">SOVEREIGN LOCKOUT</div>' +
            '<div class="cns-lockout-title">Physical Clearance REVOKED</div>' +
            '<div class="cns-lockout-meta">' + escapeHtml(trigger) + ' &middot; SRS <span class="mono">' + srsScore + '/100</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="cns-lockout-body">' +
          reasons.map(function (r) {
            return (
              '<div class="sv-reason-row">' +
                '<div class="sv-reason-bar"></div>' +
                '<div>' +
                  '<div class="sv-reason-head">' + escapeHtml(r.headline) + '</div>' +
                  '<div class="sv-reason-body">' + escapeHtml(r.detail) + '</div>' +
                '</div>' +
              '</div>'
            );
          }).join('') +
          '<div class="cns-lockout-foot">' +
            'Save blocked until CNS state resolves to GREEN. Log a mobility / Z2 session, or lower intensity &le; 7 and remove 1-RM work.' +
          '</div>' +
        '</div>' +
      '</div>';

    const target = targetId ? document.getElementById(targetId) : null;
    if (target) {
      let slot = document.getElementById('cns-lockout-slot');
      if (!slot) {
        slot = document.createElement('div');
        slot.id = 'cns-lockout-slot';
        target.insertBefore(slot, target.firstChild);
      }
      paintFragment(slot, html);
      // Scroll on the next frame so paint and scroll don't collide.
      const scrollIn = function () {
        const s = document.getElementById('cns-lockout-slot');
        if (s) s.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(scrollIn);
      else scrollIn();
      setTimeout(function () {
        const s = document.getElementById('cns-lockout-slot');
        if (s) paintFragment(s, '');
      }, 9000);
    }
    return html;
  }

  // Legacy ensureStyles — kept as a no-op for back-compat.
  // All Sovereign animations now live in #sovereign-ui-layer.
  function ensureStyles() { /* Sovereign UI layer owns this now. */ }

  // ─── HTML SAFETY ─────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ─── BOOT ────────────────────────────────────────────────
  function init() {
    renderDashboardBlock();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 0);
    }
  }

  return {
    // core matrix
    calculateSRS:     calculateSRS,
    auditBiometrics:  auditBiometrics,
    enforceLockout:   enforceLockout,
    // state
    readState:        readState,
    writeState:       writeState,
    // ui
    renderDashboardBlock: renderDashboardBlock,
    renderLockoutError:   renderLockoutError,
    init:             init
  };
})();

if (typeof window !== 'undefined') window.CNS_ENGINE = CNS_ENGINE;
if (typeof module !== 'undefined' && module.exports) module.exports = CNS_ENGINE;
