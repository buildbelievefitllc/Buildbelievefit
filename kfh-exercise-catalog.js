// ═══════════════════════════════════════════════════════════════
// KFH-EXERCISE-CATALOG.JS — BBF Kinematic Form HUD Exercise Catalog
// Sovereign Gold Standard — Phase 12 Architecture
//
// Owns: SVG markup templates, exercise definitions, default fallback,
//       lookup + alias resolution. The Bio-Render pane in
//       bbf-app.html reads this module via window.BBF_KFH_CATALOG
//       and renders into #kfh-svg-stage.
//
// Future: register(blueprint) accepts the standardized Phase 12
// Blueprint shape (joints / bones / equipment / kineticPath / forms)
// and transpiles it into the legacy svgMarkup string at registration
// time. Transpiler arrives in the next sprint after this refactor.
// ═══════════════════════════════════════════════════════════════

var BBF_KFH_CATALOG = (function () {
  'use strict';

  // ─── SOVEREIGN SENTINEL FALLBACK ─────────────────────────
  // High-tech "Awaiting Biometric Mapping" wireframe shown when an
  // exercise has no specific kinetic SVG. Maintains the Sovereign
  // Standard aesthetic (glowing grid, dashed kinetic axis, nominal
  // joints) and includes both #kfh-callout-ok / #kfh-callout-warn
  // groups so KFH_SET_FORM can toggle without breaking.
  var SVG_PLACEHOLDER = [
    '<g class="kfh-wf-grid">',
      '<line x1="28" y1="18" x2="28" y2="188"/>',
      '<line x1="292" y1="18" x2="292" y2="188"/>',
      '<line x1="28" y1="60" x2="292" y2="60"/>',
      '<line x1="28" y1="160" x2="292" y2="160"/>',
      '<line x1="160" y1="18" x2="160" y2="188"/>',
    '</g>',
    '<line class="kfh-wf kfh-wf-bench" x1="28" y1="180" x2="292" y2="180"/>',
    '<g class="kfh-wf">',
      '<circle cx="160" cy="40" r="11"/>',
      '<line x1="160" y1="51" x2="160" y2="118"/>',
      '<line x1="138" y1="68" x2="182" y2="68"/>',
      '<line x1="138" y1="68" x2="120" y2="120"/>',
      '<line x1="120" y1="120" x2="116" y2="148"/>',
      '<line x1="182" y1="68" x2="200" y2="120"/>',
      '<line x1="200" y1="120" x2="204" y2="148"/>',
      '<line x1="146" y1="118" x2="174" y2="118"/>',
      '<line x1="148" y1="118" x2="142" y2="150"/>',
      '<line x1="142" y1="150" x2="140" y2="180"/>',
      '<line x1="172" y1="118" x2="178" y2="150"/>',
      '<line x1="178" y1="150" x2="180" y2="180"/>',
      '<line x1="130" y1="180" x2="150" y2="180"/>',
      '<line x1="170" y1="180" x2="190" y2="180"/>',
    '</g>',
    '<path class="kfh-path-j" d="M160 180 C 160 140, 160 100, 160 60"/>',
    '<circle cx="160" cy="180" r="2.5" fill="#00E5FF"/>',
    '<circle cx="160" cy="60" r="2.5" fill="#00E5FF"/>',
    '<text class="kfh-bar-label" x="166" y="124">Sentinel Axis</text>',
    '<circle class="kfh-joint j-shoulder" cx="138" cy="68" r="3.6"/>',
    '<circle class="kfh-joint j-shoulder" cx="182" cy="68" r="3.6"/>',
    '<circle class="kfh-joint j-elbow" cx="120" cy="120" r="3.2"/>',
    '<circle class="kfh-joint j-elbow" cx="200" cy="120" r="3.2"/>',
    '<circle class="kfh-joint j-wrist" cx="116" cy="148" r="2.8"/>',
    '<circle class="kfh-joint j-wrist" cx="204" cy="148" r="2.8"/>',
    '<circle class="kfh-joint j-hip" cx="148" cy="118" r="3.4"/>',
    '<circle class="kfh-joint j-hip" cx="172" cy="118" r="3.4"/>',
    '<circle class="kfh-joint j-knee" cx="142" cy="150" r="3.2"/>',
    '<circle class="kfh-joint j-knee" cx="178" cy="150" r="3.2"/>',
    '<circle class="kfh-halo" cx="160" cy="118" r="7"/>',
    '<text class="kfh-bar-label" x="34" y="30">Sovereign Sentinel</text>',
    '<text class="kfh-bar-label" x="34" y="40" opacity=".55">Clinical Wireframe</text>',
    '<text class="kfh-bar-label" x="218" y="30" opacity=".7">Status</text>',
    '<text class="kfh-bar-label" x="218" y="40" opacity=".55">Awaiting Biometric</text>',
    '<text class="kfh-bar-label" x="218" y="50" opacity=".55">Mapping</text>',
    '<g id="kfh-callout-ok">',
      '<line class="kfh-leader ok" x1="160" y1="118" x2="60" y2="158"/>',
      '<text class="kfh-label-box ok" x="30" y="160">Nominal Posture &middot; Ready</text>',
      '<text class="kfh-label-box ok" x="30" y="172">Standard Reference</text>',
    '</g>',
    '<g id="kfh-callout-warn" style="display:none">',
      '<line class="kfh-leader warn" x1="160" y1="118" x2="60" y2="158"/>',
      '<text class="kfh-label-box warn" x="30" y="160">Pending Classification</text>',
      '<text class="kfh-label-box warn" x="30" y="172">Form Reference Only</text>',
    '</g>'
  ].join('');

  // ─── BENCH PRESS WIREFRAME ───────────────────────────────
  // Sagittal wireframe: bench, lifter, J-curve bar path, joints,
  // standard/fault callout groups.
  var BENCH_PRESS_SVG = [
    '<g class="kfh-wf-grid">',
      '<line x1="28" y1="18" x2="28" y2="188"/>',
      '<line x1="292" y1="18" x2="292" y2="188"/>',
      '<line x1="28" y1="160" x2="292" y2="160"/>',
    '</g>',
    '<line class="kfh-wf kfh-wf-bench" x1="28" y1="180" x2="292" y2="180"/>',
    '<g class="kfh-wf kfh-wf-bench">',
      '<rect x="80" y="130" width="170" height="10" rx="2"/>',
      '<line x1="92" y1="140" x2="92" y2="180"/>',
      '<line x1="238" y1="140" x2="238" y2="180"/>',
      '<line x1="85" y1="180" x2="100" y2="180"/>',
      '<line x1="230" y1="180" x2="246" y2="180"/>',
      '<line x1="262" y1="180" x2="262" y2="56"/>',
      '<line x1="262" y1="56" x2="272" y2="56"/>',
    '</g>',
    '<g class="kfh-wf">',
      '<circle cx="92" cy="120" r="8"/>',
      '<path d="M100 126 Q140 116 180 122 Q210 127 232 130"/>',
      '<line x1="232" y1="130" x2="244" y2="152"/>',
      '<line x1="244" y1="152" x2="228" y2="180"/>',
      '<line x1="220" y1="180" x2="240" y2="180"/>',
      '<line id="kfh-upperarm" x1="155" y1="120" x2="170" y2="86"/>',
      '<line id="kfh-forearm" x1="170" y1="86" x2="175" y2="60"/>',
    '</g>',
    '<g>',
      '<line class="kfh-wf kfh-wf-bar" x1="158" y1="60" x2="192" y2="60"/>',
      '<circle class="kfh-wf-plate" cx="175" cy="60" r="10"/>',
      '<circle class="kfh-wf-plate" cx="175" cy="60" r="4"/>',
    '</g>',
    '<path class="kfh-path-j" d="M175 118 C 180 98, 190 78, 198 58"/>',
    '<circle cx="175" cy="118" r="2.5" fill="#00E5FF"/>',
    '<circle cx="198" cy="58" r="2.5" fill="#00E5FF"/>',
    '<text class="kfh-bar-label" x="120" y="112">Touch · Sternum</text>',
    '<text class="kfh-bar-label" x="204" y="52">Lockout</text>',
    '<text class="kfh-bar-label" x="208" y="92">J-Curve Path</text>',
    '<circle class="kfh-joint j-shoulder" cx="155" cy="120" r="4.2"/>',
    '<circle class="kfh-halo" cx="155" cy="120" r="6"/>',
    '<circle class="kfh-joint j-elbow" cx="170" cy="86" r="3.6"/>',
    '<circle class="kfh-joint j-wrist" cx="175" cy="60" r="3.6"/>',
    '<circle class="kfh-joint j-hip" cx="232" cy="130" r="3.4"/>',
    '<circle class="kfh-joint j-knee" cx="244" cy="152" r="3.4"/>',
    '<g id="kfh-callout-ok">',
      '<line class="kfh-leader ok" x1="155" y1="120" x2="60" y2="150"/>',
      '<text class="kfh-label-box ok" x="30" y="162">Scap Retracted · 45°</text>',
    '</g>',
    '<g id="kfh-callout-warn" style="display:none">',
      '<line class="kfh-leader warn" x1="155" y1="120" x2="60" y2="150"/>',
      '<text class="kfh-label-box warn" x="30" y="156">Elbow Flare 85°</text>',
      '<text class="kfh-label-box warn" x="30" y="168">Impingement Risk</text>',
    '</g>'
  ].join('');

  // ─── DEFAULT EXERCISE (FALLBACK) ─────────────────────────
  // Loaded when lookupExercise misses; renders the Sovereign
  // Sentinel wireframe so the Bio-Render pane never paints blank.
  var DEFAULT_EXERCISE = {
    title: 'Clinical Protocol: Laboratory Reference',
    subtitle: 'Sovereign Rig · Biomechanical Overlay',
    muscleTarget: 'Awaiting Classification',
    clinicalNotes: 'Protocol data pending. The Sovereign Clinical Intake will populate this panel once this exercise is registered in the laboratory database.',
    mediaSrc: '', mediaType: 'image',
    svgTitle: 'Laboratory Reference — Sagittal Wireframe',
    svgMarkup: SVG_PLACEHOLDER,
    chipOkLabel: 'Reference Standard',
    chipWarnLabel: 'Reference Fault',
    metricLabels: { dev: 'Path Dev.', tuck: 'Joint Angle', load: 'Joint Load' },
    formStates: {
      ok:   { dev: '—', tuck: '—', load: 'Pending', fn: 'Clinical reference · Awaiting classification' },
      warn: { dev: '—', tuck: '—', load: 'Pending', fn: 'Reference overlay · Awaiting classification' }
    }
  };

  // ─── EXERCISE CATALOG ────────────────────────────────────
  // Each entry owns its full presentation contract:
  //   title, subtitle, muscleTarget, clinicalNotes, media{Src,Type},
  //   svgTitle, svgMarkup,
  //   chipOkLabel, chipWarnLabel,
  //   metricLabels{dev, tuck, load},
  //   formStates{ok, warn} → {dev, tuck, load, fn}
  // Drop laboratory asset URLs into mediaSrc (mediaType = image|video).
  var EXERCISES = {
    'bench press': {
      title: 'Clinical Protocol: Bench Press',
      subtitle: 'Sagittal Plane · Barbell · Sovereign Rig',
      muscleTarget: 'Pectoralis Major / Anterior Deltoid / Triceps Brachii',
      clinicalNotes: 'Horizontal push patterning. Scapular retraction + J-curve bar path loads pectoralis fibers through 45° adduction. Drive through the mid-foot to stack ATP-PCr output for top-end tonnage.',
      mediaSrc: '', mediaType: 'image',
      svgTitle: 'Bench Press Sagittal Wireframe with J-Curve Bar Path',
      svgMarkup: BENCH_PRESS_SVG,
      chipOkLabel: 'Standard Form',
      chipWarnLabel: 'Common Fault: Elbow Flare',
      metricLabels: { dev: 'Bar Path Dev.', tuck: 'Tuck Angle', load: 'Shoulder Load' },
      formStates: {
        ok:   { dev: '± 1.2 cm', tuck: '65°', load: 'Nominal',  fn: 'Clinical reference · Non-diagnostic overlay' },
        warn: { dev: '± 4.8 cm', tuck: '85°', load: 'Elevated', fn: 'Fault pattern · Elbow flare · Impingement risk' }
      }
    },
    'bicep curl': {
      title: 'Clinical Protocol: Bicep Curl',
      subtitle: 'Sagittal Plane · Dumbbell · Isolation',
      muscleTarget: 'Biceps Brachii (Short + Long Head) / Brachialis / Brachioradialis',
      clinicalNotes: 'Elbow flexion in supination. Strict 3-second eccentric maximizes sarcoplasmic hypertrophy of the short head and spares the bicipital tendon. Glycolytic-dominant — keep rest under 90 seconds.',
      mediaSrc: '', mediaType: 'image',
      svgTitle: 'Bicep Curl Sagittal Wireframe with Strict Curl Arc',
      svgMarkup: SVG_PLACEHOLDER,
      chipOkLabel: 'Strict Form',
      chipWarnLabel: 'Common Fault: Elbow Drift',
      metricLabels: { dev: 'Elbow Drift', tuck: 'Supination', load: 'Bicep Tension' },
      formStates: {
        ok:   { dev: '0.4 cm', tuck: 'Full', load: 'Optimal',  fn: 'Clinical reference · Strict curl pattern' },
        warn: { dev: '3.6 cm', tuck: 'Lost', load: 'Diffused', fn: 'Fault pattern · Elbow drift · Tension lost' }
      }
    },
    'hack squat': {
      title: 'Clinical Protocol: Hack Squat',
      subtitle: 'Sagittal Plane · Machine · Fixed Rail',
      muscleTarget: 'Vastus Lateralis / Vastus Medialis / Gluteus Maximus',
      clinicalNotes: 'Machine-guided squat. The fixed rail isolates the quadriceps at depth with minimal axial spinal load — ideal for intensity stacking and hypertrophy work without CNS fatigue penalty.',
      mediaSrc: '', mediaType: 'image',
      svgTitle: 'Hack Squat Sagittal Wireframe with Sled Path',
      svgMarkup: SVG_PLACEHOLDER,
      chipOkLabel: 'Standard Form',
      chipWarnLabel: 'Common Fault: Knee Valgus',
      metricLabels: { dev: 'Knee Track', tuck: 'Depth', load: 'Patellar Load' },
      formStates: {
        ok:   { dev: 'Aligned',   tuck: 'Parallel', load: 'Nominal',  fn: 'Clinical reference · Quad-dominant pattern' },
        warn: { dev: 'Caved 12°', tuck: 'Shallow',  load: 'Elevated', fn: 'Fault pattern · Knee valgus · Patellar stress' }
      }
    },
    'romanian deadlift': {
      title: 'Clinical Protocol: Romanian Deadlift',
      subtitle: 'Sagittal Plane · Barbell · Hip Hinge',
      muscleTarget: 'Biceps Femoris / Semitendinosus / Gluteus Maximus / Erector Spinae',
      clinicalNotes: 'Hip-dominant hinge. Soft-knee, neutral spine, bar tracks mid-thigh. Eccentric loads the posterior chain through stretch-mediated hypertrophy — critical anti-extension protection for heavy squatters.',
      mediaSrc: '', mediaType: 'image',
      svgTitle: 'Romanian Deadlift Sagittal Wireframe with Vertical Bar Path',
      svgMarkup: SVG_PLACEHOLDER,
      chipOkLabel: 'Neutral Spine',
      chipWarnLabel: 'Common Fault: Lumbar Flexion',
      metricLabels: { dev: 'Bar Path', tuck: 'Hip Hinge', load: 'Spinal Load' },
      formStates: {
        ok:   { dev: 'Vertical',    tuck: '90°', load: 'Distributed', fn: 'Clinical reference · Posterior chain pattern' },
        warn: { dev: 'Drift +3 cm', tuck: 'Stiff',  load: 'Shear Risk',  fn: 'Fault pattern · Lumbar flexion · Disc shear risk' }
      }
    }
  };

  // Alias index — additional names that resolve to a primary key.
  // Empty for the legacy entries; future Blueprint-based registrations
  // will populate this via register(key, entry, aliases).
  var ALIASES = {};

  // ─── LOOKUP ──────────────────────────────────────────────
  // Resolution order:
  //   1. Exact match on primary key (lowercased)
  //   2. Exact match on registered alias
  //   3. Substring fuzzy match against any primary key
  // Mirrors the Phase 11 behavior so existing callers (e.g. the
  // exercise-row click handler) keep hitting the same entries.
  function getExercise(name) {
    if (!name) return null;
    var raw = String(name).toLowerCase().trim();
    if (EXERCISES[raw]) return EXERCISES[raw];
    if (ALIASES[raw] && EXERCISES[ALIASES[raw]]) return EXERCISES[ALIASES[raw]];
    for (var key in EXERCISES) {
      if (Object.prototype.hasOwnProperty.call(EXERCISES, key)) {
        if (raw.indexOf(key) !== -1) return EXERCISES[key];
      }
    }
    return null;
  }

  function getDefault() { return DEFAULT_EXERCISE; }

  // ─── REGISTER (Phase 12 hook for Blueprint transpiler) ───
  // register(key, entry, aliases) accepts a pre-baked catalog entry —
  // either a legacy static one or a transpiled Phase 12 entry.
  // registerBlueprint(bp) runs the Blueprint through BBF_KFH_TRANSPILER
  // first, then registers the resulting entry under bp.id + bp.aliases.
  function register(key, entry, aliases) {
    if (!key || !entry) return false;
    var primary = String(key).toLowerCase().trim();
    EXERCISES[primary] = entry;
    if (aliases && aliases.length) {
      aliases.forEach(function (a) {
        if (!a) return;
        ALIASES[String(a).toLowerCase().trim()] = primary;
      });
    }
    return true;
  }

  function registerBlueprint(bp) {
    if (!bp || !bp.id) return false;
    if (typeof BBF_KFH_TRANSPILER === 'undefined' || !BBF_KFH_TRANSPILER.transpile) {
      console.warn('[BBF_KFH_CATALOG] BBF_KFH_TRANSPILER unavailable — cannot register blueprint:', bp.id);
      return false;
    }
    try {
      var entry = BBF_KFH_TRANSPILER.transpile(bp);
      var aliases = (bp.aliases || []).slice();
      if (bp.displayName) aliases.push(bp.displayName);

      // A Blueprint that claims an alias matching a legacy static entry
      // takes precedence — the animated hologram replaces the static
      // placeholder. We only clear LEGACY entries (no animation block);
      // existing Blueprint primaries are left alone so two Blueprints
      // with overlapping aliases don't silently delete each other.
      var primaryKey = String(bp.id).toLowerCase().trim();
      aliases.forEach(function (a) {
        if (!a) return;
        var aliasKey = String(a).toLowerCase().trim();
        if (aliasKey === primaryKey) return;
        var existing = EXERCISES[aliasKey];
        if (existing && !existing.animation) {
          delete EXERCISES[aliasKey];
        }
      });

      return register(bp.id, entry, aliases);
    } catch (e) {
      console.warn('[BBF_KFH_CATALOG] Blueprint transpile failed for', bp.id, '-', e && e.message);
      return false;
    }
  }

  // Mirror the catalog onto window.KFH_EXERCISES for any console-
  // side debugging or legacy reader that still expects the global.
  // The IIFE in bbf-app.html now goes through getExercise() but the
  // mirror is cheap and keeps the dev-tools workflow intact.
  if (typeof window !== 'undefined') {
    window.KFH_EXERCISES = EXERCISES;
  }

  return {
    SVG_PLACEHOLDER:    SVG_PLACEHOLDER,
    BENCH_PRESS_SVG:    BENCH_PRESS_SVG,
    EXERCISES:          EXERCISES,
    DEFAULT_EXERCISE:   DEFAULT_EXERCISE,
    getExercise:        getExercise,
    getDefault:         getDefault,
    register:           register,
    registerBlueprint:  registerBlueprint
  };

})();
