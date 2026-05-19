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
  // Phase 13 Path A · Anatomical side profile (replaces stick figure).
  // Recognizable human silhouette of a supine lifter on a bench with
  // visible anatomical landmarks (skull, throat, ribcage curve, pec,
  // anterior hip). Preserves every addressable ID the animator and
  // form-state callouts depend on:
  //   #kfh-upperarm, #kfh-forearm, #kfh-callout-ok, #kfh-callout-warn,
  //   .kfh-joint.j-shoulder/-elbow/-wrist/-hip/-knee, .kfh-path-j,
  //   .kfh-wf-bar / .kfh-wf-plate / .kfh-wf-bench / .kfh-wf-grid.
  // J-curve bar path retained (clinically meaningful — sternum touch
  // to lockout). Sovereign palette: cyan body outline, gold muscle
  // bellies, purple spine indicator.
  var BENCH_PRESS_SVG = [
    // ── Grid + floor (preserved) ────────────────────────────
    '<g class="kfh-wf-grid">',
      '<line x1="28" y1="18" x2="28" y2="188"/>',
      '<line x1="292" y1="18" x2="292" y2="188"/>',
      '<line x1="28" y1="160" x2="292" y2="160"/>',
    '</g>',
    '<line class="kfh-wf kfh-wf-bench" x1="28" y1="180" x2="292" y2="180"/>',
    // ── Bench + rack (preserved) ────────────────────────────
    '<g class="kfh-wf kfh-wf-bench">',
      '<rect x="80" y="130" width="170" height="10" rx="2"/>',
      '<line x1="92" y1="140" x2="92" y2="180"/>',
      '<line x1="238" y1="140" x2="238" y2="180"/>',
      '<line x1="85" y1="180" x2="100" y2="180"/>',
      '<line x1="230" y1="180" x2="246" y2="180"/>',
      '<line x1="262" y1="180" x2="262" y2="56"/>',
      '<line x1="262" y1="56" x2="272" y2="56"/>',
    '</g>',
    // ── Anatomy gradients (cyan body fill + gold muscle belly hint) ─
    '<defs>',
      '<linearGradient id="kfh-bp-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">',
        '<stop offset="0%" stop-color="#00E5FF" stop-opacity="0.22"/>',
        '<stop offset="100%" stop-color="#00E5FF" stop-opacity="0.05"/>',
      '</linearGradient>',
      '<linearGradient id="kfh-bp-pec-grad" x1="0%" y1="0%" x2="100%" y2="0%">',
        '<stop offset="0%" stop-color="#F5C800" stop-opacity="0.34"/>',
        '<stop offset="100%" stop-color="#F5C800" stop-opacity="0.08"/>',
      '</linearGradient>',
    '</defs>',
    // ── Body silhouette: head + supine torso (recognizable human profile) ─
    //   Trace: back of skull → cranium → forehead → face → throat →
    //   supine torso top (chest peaks ~y=121, hip plateaus ~y=129) →
    //   anterior hip → flat bottom along bench line → close.
    '<path class="kfh-anatomy-body" d="M 86,118 C 78,114 76,104 84,100 C 94,96 108,98 114,108 L 115,116 L 118,122 L 113,127 L 126,128 C 142,124 160,122 178,123 C 195,124 211,126 226,129 L 240,131 L 244,138 L 86,138 Z" fill="url(#kfh-bp-body-grad)" stroke="#00E5FF" stroke-width="1.4" stroke-linejoin="round"/>',
    // ── Pec major belly (gold gradient hint at upper chest) ─
    '<ellipse cx="150" cy="124" rx="24" ry="5.5" fill="url(#kfh-bp-pec-grad)"/>',
    // ── Spine + ribcage indicator (faint dashed purple) ─
    '<path d="M 102,128 Q 150,134 200,135 Q 225,135 240,134" stroke="rgba(139,26,191,0.55)" stroke-width="0.9" fill="none" stroke-dasharray="2.5,2"/>',
    // ── Eye / facial landmark ─
    '<circle cx="98" cy="112" r="1.4" fill="#00E5FF" opacity="0.65"/>',
    // ── Legs (preserved skeletal lines — anatomy focus is torso/arms) ─
    '<g class="kfh-wf">',
      '<line x1="232" y1="130" x2="244" y2="152"/>',
      '<line x1="244" y1="152" x2="228" y2="180"/>',
      '<line x1="220" y1="180" x2="240" y2="180"/>',
    '</g>',
    // ── Arms (preserved IDs — animator targets these) ─
    '<line id="kfh-upperarm" x1="152" y1="121" x2="170" y2="86" stroke="#00E5FF" stroke-width="3.5" stroke-linecap="round"/>',
    '<line id="kfh-forearm" x1="170" y1="86" x2="175" y2="60" stroke="#00E5FF" stroke-width="3" stroke-linecap="round"/>',
    // ── Bicep belly hint (oblique ellipse along upper arm) ─
    '<ellipse cx="161" cy="104" rx="3.5" ry="9" fill="url(#kfh-bp-pec-grad)" transform="rotate(-28 161 104)"/>',
    // ── Hand grip on bar ─
    '<rect x="170" y="55" width="10" height="9" rx="2" fill="none" stroke="#F5C800" stroke-width="1.4"/>',
    // ── Bar + plates (preserved) ─
    '<g>',
      '<line class="kfh-wf kfh-wf-bar" x1="158" y1="60" x2="192" y2="60"/>',
      '<circle class="kfh-wf-plate" cx="175" cy="60" r="10"/>',
      '<circle class="kfh-wf-plate" cx="175" cy="60" r="4"/>',
    '</g>',
    // ── J-curve bar path (preserved — clinically meaningful) ─
    '<path class="kfh-path-j" d="M175 118 C 180 98, 190 78, 198 58"/>',
    '<circle cx="175" cy="118" r="2.5" fill="#00E5FF"/>',
    '<circle cx="198" cy="58" r="2.5" fill="#00E5FF"/>',
    // ── Bar path labels (preserved) ─
    '<text class="kfh-bar-label" x="120" y="112">Touch · Sternum</text>',
    '<text class="kfh-bar-label" x="204" y="52">Lockout</text>',
    '<text class="kfh-bar-label" x="208" y="92">J-Curve Path</text>',
    // ── Joints (preserved IDs + classes — animator + callouts depend on these) ─
    '<circle class="kfh-joint j-shoulder" cx="152" cy="121" r="4.2"/>',
    '<circle class="kfh-halo" cx="152" cy="121" r="7"/>',
    '<circle class="kfh-joint j-elbow" cx="170" cy="86" r="3.6"/>',
    '<circle class="kfh-joint j-wrist" cx="175" cy="60" r="3.6"/>',
    '<circle class="kfh-joint j-hip" cx="232" cy="130" r="3.4"/>',
    '<circle class="kfh-joint j-knee" cx="244" cy="152" r="3.4"/>',
    // ── OK callout (preserved — scap retraction reference) ─
    '<g id="kfh-callout-ok">',
      '<line class="kfh-leader ok" x1="155" y1="121" x2="60" y2="150"/>',
      '<text class="kfh-label-box ok" x="30" y="162">Scap Retracted · 45°</text>',
    '</g>',
    // ── Warn callout (preserved — elbow flare fault) ─
    '<g id="kfh-callout-warn" style="display:none">',
      '<line class="kfh-leader warn" x1="155" y1="121" x2="60" y2="150"/>',
      '<text class="kfh-label-box warn" x="30" y="156">Elbow Flare 85°</text>',
      '<text class="kfh-label-box warn" x="30" y="168">Impingement Risk</text>',
    '</g>'
  ].join('');

  // ─── BICEP CURL WIREFRAME (Phase 13 Path A) ──────────────
  // Standing side profile, dumbbell at mid-curl. Anatomical body
  // silhouette with quad / hamstring legs filled in (legs are
  // visible since the lifter is upright, unlike bench press).
  var BICEP_CURL_SVG = [
    // Grid + floor
    '<g class="kfh-wf-grid">',
      '<line x1="28" y1="18" x2="28" y2="188"/>',
      '<line x1="292" y1="18" x2="292" y2="188"/>',
      '<line x1="28" y1="160" x2="292" y2="160"/>',
    '</g>',
    '<line class="kfh-wf kfh-wf-bench" x1="28" y1="180" x2="292" y2="180"/>',
    // Anatomy gradients
    '<defs>',
      '<linearGradient id="kfh-bc-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">',
        '<stop offset="0%" stop-color="#00E5FF" stop-opacity="0.22"/>',
        '<stop offset="100%" stop-color="#00E5FF" stop-opacity="0.05"/>',
      '</linearGradient>',
      '<linearGradient id="kfh-bc-muscle-grad" x1="0%" y1="0%" x2="100%" y2="100%">',
        '<stop offset="0%" stop-color="#F5C800" stop-opacity="0.40"/>',
        '<stop offset="100%" stop-color="#F5C800" stop-opacity="0.08"/>',
      '</linearGradient>',
    '</defs>',
    // Body silhouette: standing side profile, head facing right, feet planted
    //   head → neck → shoulder → torso → hip → thigh → knee → shin → foot
    '<path class="kfh-anatomy-body" d="M 168,38 C 162,32 162,22 170,20 C 180,18 188,22 188,30 C 188,38 184,42 180,42 L 178,50 L 176,58 L 184,66 L 192,72 L 196,82 L 198,98 L 196,114 L 198,128 L 196,142 L 192,155 L 188,168 L 184,178 L 182,180 L 168,180 L 168,178 L 170,170 L 172,158 L 170,142 L 168,128 L 166,114 L 164,98 L 160,82 L 162,70 L 168,58 Z" fill="url(#kfh-bc-body-grad)" stroke="#00E5FF" stroke-width="1.4" stroke-linejoin="round"/>',
    // Quad belly highlight on visible thigh
    '<ellipse cx="180" cy="124" rx="7" ry="14" fill="url(#kfh-bc-muscle-grad)" transform="rotate(-3 180 124)"/>',
    // Spine indicator (faint dashed purple along torso)
    '<path d="M 180,42 Q 184,70 184,100 Q 184,118 184,130" stroke="rgba(139,26,191,0.55)" stroke-width="0.9" fill="none" stroke-dasharray="2.5,2"/>',
    // Eye landmark
    '<circle cx="175" cy="28" r="1.4" fill="#00E5FF" opacity="0.65"/>',
    // Upper arm — vertical from shoulder hanging slightly forward to elbow at hip
    '<line id="kfh-upperarm" x1="184" y1="68" x2="178" y2="112" stroke="#00E5FF" stroke-width="3.5" stroke-linecap="round"/>',
    // Forearm — CURLED UP from elbow to dumbbell at chest height
    '<line id="kfh-forearm" x1="178" y1="112" x2="200" y2="78" stroke="#00E5FF" stroke-width="3.2" stroke-linecap="round"/>',
    // Bicep belly — prominent gold ellipse on upper arm at peak contraction
    '<ellipse cx="184" cy="88" rx="5" ry="11" fill="url(#kfh-bc-muscle-grad)" transform="rotate(15 184 88)"/>',
    // Dumbbell — two stacked plates with handle
    '<g>',
      '<line class="kfh-wf kfh-wf-bar" x1="194" y1="78" x2="206" y2="78"/>',
      '<rect x="196" y="71" width="4" height="14" rx="1" fill="rgba(245,200,0,0.4)" stroke="#F5C800" stroke-width="1.2"/>',
      '<rect x="200" y="73" width="4" height="10" rx="1" fill="rgba(245,200,0,0.4)" stroke="#F5C800" stroke-width="1.2"/>',
    '</g>',
    // Curl arc path (start at hip-hanging start → mid-curl → peak at shoulder)
    '<path class="kfh-path-j" d="M 178,140 Q 220,110 200,78"/>',
    '<circle cx="178" cy="140" r="2.5" fill="#00E5FF"/>',
    '<circle cx="200" cy="78"  r="2.5" fill="#00E5FF"/>',
    // Bar path labels
    '<text class="kfh-bar-label" x="148" y="148">Start · Full Ext</text>',
    '<text class="kfh-bar-label" x="208" y="74">Peak Contract</text>',
    '<text class="kfh-bar-label" x="222" y="106">Strict Curl Arc</text>',
    // Joints
    '<circle class="kfh-joint j-shoulder" cx="184" cy="68" r="4.2"/>',
    '<circle class="kfh-halo" cx="178" cy="112" r="7"/>',
    '<circle class="kfh-joint j-elbow" cx="178" cy="112" r="4.2"/>',
    '<circle class="kfh-joint j-wrist" cx="200" cy="78" r="3.6"/>',
    '<circle class="kfh-joint j-hip" cx="178" cy="128" r="3.4"/>',
    '<circle class="kfh-joint j-knee" cx="174" cy="158" r="3.4"/>',
    // OK callout
    '<g id="kfh-callout-ok">',
      '<line class="kfh-leader ok" x1="178" y1="112" x2="60" y2="142"/>',
      '<text class="kfh-label-box ok" x="30" y="154">Elbow Pinned · 8° drift</text>',
    '</g>',
    // Warn callout — elbow drift
    '<g id="kfh-callout-warn" style="display:none">',
      '<line class="kfh-leader warn" x1="178" y1="112" x2="60" y2="142"/>',
      '<text class="kfh-label-box warn" x="30" y="148">Elbow Drift Fwd 22°</text>',
      '<text class="kfh-label-box warn" x="30" y="160">Tension Diffused</text>',
    '</g>'
  ].join('');

  // ─── HACK SQUAT WIREFRAME (Phase 13 Path A) ──────────────
  // Side profile on the hack squat machine. Body lies on the
  // angled pad (~35° from vertical). Legs descend off the
  // platform with knees forward at depth.
  var HACK_SQUAT_SVG = [
    // Grid + floor
    '<g class="kfh-wf-grid">',
      '<line x1="28" y1="18" x2="28" y2="188"/>',
      '<line x1="292" y1="18" x2="292" y2="188"/>',
      '<line x1="28" y1="160" x2="292" y2="160"/>',
    '</g>',
    '<line class="kfh-wf kfh-wf-bench" x1="28" y1="180" x2="292" y2="180"/>',
    // Hack squat machine — angled back pad + foot platform + sled rails
    '<g class="kfh-wf kfh-wf-bench">',
      '<line x1="60" y1="180" x2="135" y2="55"/>',
      '<line x1="74" y1="180" x2="149" y2="55"/>',
      '<line x1="60" y1="180" x2="74" y2="180"/>',
      '<line x1="135" y1="55" x2="149" y2="55"/>',
      '<rect x="180" y="178" width="80" height="6" rx="1"/>',
      '<line x1="46" y1="180" x2="56" y2="155"/>',
      '<line x1="56" y1="155" x2="58" y2="180"/>',
      '<rect x="38" y="158" width="14" height="22" rx="1" fill="rgba(245,200,0,0.12)" stroke="rgba(245,200,0,0.55)" stroke-width="1"/>',
      '<rect x="40" y="148" width="10" height="10" rx="1" fill="rgba(245,200,0,0.12)" stroke="rgba(245,200,0,0.55)" stroke-width="1"/>',
    '</g>',
    // Anatomy gradients
    '<defs>',
      '<linearGradient id="kfh-hs-body-grad" x1="0%" y1="0%" x2="100%" y2="0%">',
        '<stop offset="0%" stop-color="#00E5FF" stop-opacity="0.20"/>',
        '<stop offset="100%" stop-color="#00E5FF" stop-opacity="0.06"/>',
      '</linearGradient>',
      '<linearGradient id="kfh-hs-quad-grad" x1="0%" y1="0%" x2="100%" y2="0%">',
        '<stop offset="0%" stop-color="#F5C800" stop-opacity="0.42"/>',
        '<stop offset="100%" stop-color="#F5C800" stop-opacity="0.10"/>',
      '</linearGradient>',
    '</defs>',
    // Torso + head reclined against the pad (head top-left at pad top)
    '<path class="kfh-anatomy-body" d="M 124,52 C 118,46 116,38 122,34 C 130,30 140,32 144,40 L 146,50 L 152,58 L 162,68 L 175,80 L 188,94 L 200,110 L 204,118 L 196,122 L 184,108 L 170,94 L 156,82 L 144,72 L 134,64 Z" fill="url(#kfh-hs-body-grad)" stroke="#00E5FF" stroke-width="1.4" stroke-linejoin="round"/>',
    // Thigh — descending forward from hip on pad, knee bent past 90° at depth
    '<path class="kfh-anatomy-thigh" d="M 200,108 L 224,128 L 248,150 L 254,156 L 250,164 L 240,158 L 220,140 L 200,122 Z" fill="url(#kfh-hs-quad-grad)" stroke="#F5C800" stroke-width="1.2" stroke-linejoin="round" opacity="0.85"/>',
    // Shin — from knee back to platform
    '<path class="kfh-anatomy-shin" d="M 248,148 L 232,172 L 228,178 L 226,178 L 240,148 Z" fill="url(#kfh-hs-body-grad)" stroke="#00E5FF" stroke-width="1.2" stroke-linejoin="round"/>',
    // Foot on platform
    '<rect x="220" y="174" width="22" height="5" rx="1" fill="rgba(0,229,255,0.15)" stroke="#00E5FF" stroke-width="1.2"/>',
    // Spine indicator running through reclined torso
    '<path d="M 142,52 Q 165,72 188,92 Q 196,100 200,108" stroke="rgba(139,26,191,0.55)" stroke-width="0.9" fill="none" stroke-dasharray="2.5,2"/>',
    // Eye landmark
    '<circle cx="135" cy="40" r="1.4" fill="#00E5FF" opacity="0.65"/>',
    // Sled bar across shoulders
    '<g>',
      '<line class="kfh-wf kfh-wf-bar" x1="118" y1="58" x2="158" y2="58" stroke-width="3"/>',
      '<circle class="kfh-wf-plate" cx="124" cy="58" r="7"/>',
      '<circle class="kfh-wf-plate" cx="152" cy="58" r="7"/>',
    '</g>',
    // Vertical depth path — shows knee descent track (the sled path)
    '<path class="kfh-path-j" d="M 230,80 C 240,110 248,130 248,150"/>',
    '<circle cx="230" cy="80" r="2.5" fill="#00E5FF"/>',
    '<circle cx="248" cy="150" r="2.5" fill="#00E5FF"/>',
    // Depth reference line (parallel)
    '<line x1="200" y1="148" x2="260" y2="148" stroke="rgba(34,197,94,0.55)" stroke-width="0.9" stroke-dasharray="3,2"/>',
    '<text class="kfh-bar-label" x="266" y="151" fill="#22c55e">Parallel</text>',
    // Path labels
    '<text class="kfh-bar-label" x="60" y="50">Sled Top</text>',
    '<text class="kfh-bar-label" x="218" y="74">Sled Path</text>',
    '<text class="kfh-bar-label" x="220" y="166">Depth · Quad Bias</text>',
    // Joints
    '<circle class="kfh-joint j-shoulder" cx="142" cy="60" r="4.2"/>',
    '<circle class="kfh-joint j-elbow" cx="156" cy="84" r="3.6"/>',
    '<circle class="kfh-joint j-wrist" cx="170" cy="100" r="3.6"/>',
    '<circle class="kfh-joint j-hip" cx="200" cy="112" r="4.2"/>',
    '<circle class="kfh-halo" cx="248" cy="148" r="8"/>',
    '<circle class="kfh-joint j-knee" cx="248" cy="148" r="4.2"/>',
    // OK callout
    '<g id="kfh-callout-ok">',
      '<line class="kfh-leader ok" x1="248" y1="148" x2="60" y2="120"/>',
      '<text class="kfh-label-box ok" x="30" y="132">Knee Tracks · Mid-Foot</text>',
    '</g>',
    // Warn callout — knee valgus
    '<g id="kfh-callout-warn" style="display:none">',
      '<line class="kfh-leader warn" x1="248" y1="148" x2="60" y2="120"/>',
      '<text class="kfh-label-box warn" x="30" y="124">Knee Valgus 12°</text>',
      '<text class="kfh-label-box warn" x="30" y="136">Patellar Stress</text>',
    '</g>'
  ].join('');

  // ─── ROMANIAN DEADLIFT WIREFRAME (Phase 13 Path A) ───────
  // Standing side profile mid-hinge. Bar tracks vertical down
  // the thighs. Spine NEUTRAL — the green dashed reference line
  // is the cue. Hip apex is the addressed halo joint.
  var RDL_SVG = [
    // Grid + floor
    '<g class="kfh-wf-grid">',
      '<line x1="28" y1="18" x2="28" y2="188"/>',
      '<line x1="292" y1="18" x2="292" y2="188"/>',
      '<line x1="28" y1="160" x2="292" y2="160"/>',
    '</g>',
    '<line class="kfh-wf kfh-wf-bench" x1="28" y1="180" x2="292" y2="180"/>',
    // Anatomy gradients
    '<defs>',
      '<linearGradient id="kfh-rdl-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">',
        '<stop offset="0%" stop-color="#00E5FF" stop-opacity="0.22"/>',
        '<stop offset="100%" stop-color="#00E5FF" stop-opacity="0.05"/>',
      '</linearGradient>',
      '<linearGradient id="kfh-rdl-ham-grad" x1="0%" y1="0%" x2="100%" y2="0%">',
        '<stop offset="0%" stop-color="#F5C800" stop-opacity="0.40"/>',
        '<stop offset="100%" stop-color="#F5C800" stop-opacity="0.10"/>',
      '</linearGradient>',
    '</defs>',
    // Body silhouette — hinged forward at hip, head + torso angled, legs vertical
    //   Head at upper right, hinged torso descends to hip apex, legs straight down
    '<path class="kfh-anatomy-body" d="M 218,68 C 222,62 230,60 236,66 C 242,72 240,82 232,84 L 226,84 L 218,90 L 200,98 L 178,108 L 158,116 L 142,124 L 138,130 L 144,134 L 162,128 L 184,120 L 206,110 L 224,102 L 232,94 Z" fill="url(#kfh-rdl-body-grad)" stroke="#00E5FF" stroke-width="1.4" stroke-linejoin="round"/>',
    // Legs (visible standing legs — left leg slightly more forward)
    '<path class="kfh-anatomy-leg" d="M 132,128 L 152,128 L 156,148 L 158,170 L 162,180 L 144,180 L 142,170 L 140,150 L 134,140 Z" fill="url(#kfh-rdl-body-grad)" stroke="#00E5FF" stroke-width="1.4" stroke-linejoin="round"/>',
    // Hamstring belly highlight on back of thigh
    '<ellipse cx="150" cy="148" rx="6" ry="14" fill="url(#kfh-rdl-ham-grad)" transform="rotate(-2 150 148)"/>',
    // Spine indicator — NEUTRAL through hinged torso (the critical cue)
    '<path d="M 230,72 Q 200,90 165,110 Q 148,120 142,128" stroke="rgba(139,26,191,0.55)" stroke-width="0.9" fill="none" stroke-dasharray="2.5,2"/>',
    // Eye landmark
    '<circle cx="228" cy="71" r="1.4" fill="#00E5FF" opacity="0.65"/>',
    // Arms hanging straight down from shoulder holding the bar at thigh level
    '<line id="kfh-upperarm" x1="200" y1="100" x2="178" y2="120" stroke="#00E5FF" stroke-width="3.5" stroke-linecap="round"/>',
    '<line id="kfh-forearm" x1="178" y1="120" x2="150" y2="135" stroke="#00E5FF" stroke-width="3" stroke-linecap="round"/>',
    // Bar held at thigh level (horizontal across both hands)
    '<g>',
      '<line class="kfh-wf kfh-wf-bar" x1="120" y1="138" x2="172" y2="138" stroke-width="3"/>',
      '<circle class="kfh-wf-plate" cx="126" cy="138" r="9"/>',
      '<circle class="kfh-wf-plate" cx="166" cy="138" r="9"/>',
      '<circle class="kfh-wf-plate" cx="126" cy="138" r="3" fill="rgba(245,200,0,0.5)"/>',
      '<circle class="kfh-wf-plate" cx="166" cy="138" r="3" fill="rgba(245,200,0,0.5)"/>',
    '</g>',
    // Vertical bar path — straight line UP/DOWN along the thigh
    '<path class="kfh-path-j" d="M 146,138 L 146,178" stroke-dasharray="4,3"/>',
    '<circle cx="146" cy="138" r="2.5" fill="#00E5FF"/>',
    '<circle cx="146" cy="178" r="2.5" fill="#00E5FF"/>',
    // Path labels
    '<text class="kfh-bar-label" x="156" y="148">Bar · Mid-Thigh</text>',
    '<text class="kfh-bar-label" x="156" y="172">Vertical Path</text>',
    // Spine neutrality reference (the OK signal)
    '<text class="kfh-bar-label" x="228" y="60" fill="rgba(245,200,0,0.85)">Neutral Spine</text>',
    // Joints
    '<circle class="kfh-joint j-shoulder" cx="200" cy="100" r="4.2"/>',
    '<circle class="kfh-joint j-elbow" cx="178" cy="120" r="3.6"/>',
    '<circle class="kfh-joint j-wrist" cx="150" cy="135" r="3.6"/>',
    '<circle class="kfh-halo" cx="138" cy="130" r="8"/>',
    '<circle class="kfh-joint j-hip" cx="138" cy="130" r="4.2"/>',
    '<circle class="kfh-joint j-knee" cx="148" cy="160" r="3.4"/>',
    // OK callout — neutral spine
    '<g id="kfh-callout-ok">',
      '<line class="kfh-leader ok" x1="200" y1="100" x2="270" y2="80"/>',
      '<text class="kfh-label-box ok" x="240" y="92" text-anchor="start">Neutral · 0° Flex</text>',
    '</g>',
    // Warn callout — lumbar flexion
    '<g id="kfh-callout-warn" style="display:none">',
      '<line class="kfh-leader warn" x1="200" y1="100" x2="270" y2="80"/>',
      '<text class="kfh-label-box warn" x="240" y="86" text-anchor="start">Lumbar Flex 15°</text>',
      '<text class="kfh-label-box warn" x="240" y="98" text-anchor="start">Disc Shear Risk</text>',
    '</g>'
  ].join('');

  // ─── OVERHEAD PRESS WIREFRAME (Phase 13 Path A) ──────────
  // Standing side profile mid-press, bar above head at lockout.
  // Vertical bar path is the critical cue — bar stacked over
  // mid-foot through full ROM.
  var OHP_SVG = [
    // Grid + floor
    '<g class="kfh-wf-grid">',
      '<line x1="28" y1="18" x2="28" y2="188"/>',
      '<line x1="292" y1="18" x2="292" y2="188"/>',
      '<line x1="28" y1="160" x2="292" y2="160"/>',
    '</g>',
    '<line class="kfh-wf kfh-wf-bench" x1="28" y1="180" x2="292" y2="180"/>',
    // Anatomy gradients
    '<defs>',
      '<linearGradient id="kfh-ohp-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">',
        '<stop offset="0%" stop-color="#00E5FF" stop-opacity="0.22"/>',
        '<stop offset="100%" stop-color="#00E5FF" stop-opacity="0.05"/>',
      '</linearGradient>',
      '<linearGradient id="kfh-ohp-delt-grad" x1="0%" y1="0%" x2="0%" y2="100%">',
        '<stop offset="0%" stop-color="#F5C800" stop-opacity="0.44"/>',
        '<stop offset="100%" stop-color="#F5C800" stop-opacity="0.08"/>',
      '</linearGradient>',
    '</defs>',
    // Body silhouette: head + neck + torso + visible leg from side
    '<path class="kfh-anatomy-body" d="M 160,72 C 152,66 152,54 162,52 C 174,50 184,54 184,64 C 184,72 178,76 172,76 L 170,86 L 168,94 L 178,104 L 188,114 L 192,128 L 192,144 L 188,158 L 184,170 L 182,180 L 168,180 L 168,178 L 170,170 L 172,156 L 168,140 L 162,124 L 156,108 L 152,94 L 156,82 Z" fill="url(#kfh-ohp-body-grad)" stroke="#00E5FF" stroke-width="1.4" stroke-linejoin="round"/>',
    // Deltoid belly highlight — the prime mover
    '<ellipse cx="178" cy="84" rx="7" ry="9" fill="url(#kfh-ohp-delt-grad)"/>',
    // Spine indicator
    '<path d="M 174,74 Q 178,100 178,130 Q 178,150 176,165" stroke="rgba(139,26,191,0.55)" stroke-width="0.9" fill="none" stroke-dasharray="2.5,2"/>',
    // Eye landmark
    '<circle cx="168" cy="62" r="1.4" fill="#00E5FF" opacity="0.65"/>',
    // Upper arm — extended UP from shoulder
    '<line id="kfh-upperarm" x1="178" y1="78" x2="180" y2="48" stroke="#00E5FF" stroke-width="3.5" stroke-linecap="round"/>',
    // Forearm — continuing UP to lockout (slight outward bow to show the press path mid-rep)
    '<line id="kfh-forearm" x1="180" y1="48" x2="186" y2="22" stroke="#00E5FF" stroke-width="3" stroke-linecap="round"/>',
    // Tricep belly highlight on upper arm (visible from this angle during press)
    '<ellipse cx="180" cy="62" rx="3.5" ry="9" fill="url(#kfh-ohp-delt-grad)" transform="rotate(2 180 62)" opacity="0.8"/>',
    // Bar at lockout (overhead, above head)
    '<g>',
      '<line class="kfh-wf kfh-wf-bar" x1="160" y1="22" x2="212" y2="22" stroke-width="3"/>',
      '<circle class="kfh-wf-plate" cx="168" cy="22" r="9"/>',
      '<circle class="kfh-wf-plate" cx="204" cy="22" r="9"/>',
      '<circle class="kfh-wf-plate" cx="168" cy="22" r="3" fill="rgba(245,200,0,0.5)"/>',
      '<circle class="kfh-wf-plate" cx="204" cy="22" r="3" fill="rgba(245,200,0,0.5)"/>',
    '</g>',
    // Hand grip on bar
    '<rect x="180" y="18" width="10" height="8" rx="2" fill="none" stroke="#F5C800" stroke-width="1.4"/>',
    // VERTICAL bar path — the critical clinical cue (bar stacked over mid-foot)
    '<path class="kfh-path-j" d="M 186,22 L 186,72"/>',
    '<circle cx="186" cy="22" r="2.5" fill="#00E5FF"/>',
    '<circle cx="186" cy="72" r="2.5" fill="#00E5FF"/>',
    // Mid-foot reference plumb line (continues from bar down to floor)
    '<line x1="186" y1="80" x2="174" y2="180" stroke="rgba(34,197,94,0.45)" stroke-width="0.8" stroke-dasharray="2,3"/>',
    '<text class="kfh-bar-label" x="118" y="178" fill="#22c55e">Stacked · Mid-Foot</text>',
    // Path labels
    '<text class="kfh-bar-label" x="218" y="20">Lockout</text>',
    '<text class="kfh-bar-label" x="140" y="76">Rack</text>',
    '<text class="kfh-bar-label" x="194" y="52">Vertical Path</text>',
    // Joints
    '<circle class="kfh-halo" cx="178" cy="78" r="8"/>',
    '<circle class="kfh-joint j-shoulder" cx="178" cy="78" r="4.2"/>',
    '<circle class="kfh-joint j-elbow" cx="180" cy="48" r="3.6"/>',
    '<circle class="kfh-joint j-wrist" cx="186" cy="22" r="3.6"/>',
    '<circle class="kfh-joint j-hip" cx="178" cy="132" r="3.4"/>',
    '<circle class="kfh-joint j-knee" cx="176" cy="158" r="3.4"/>',
    // OK callout — bar stacked
    '<g id="kfh-callout-ok">',
      '<line class="kfh-leader ok" x1="186" y1="46" x2="60" y2="80"/>',
      '<text class="kfh-label-box ok" x="30" y="92">Bar · Mid-Foot Stack</text>',
    '</g>',
    // Warn callout — bar forward / hip lean
    '<g id="kfh-callout-warn" style="display:none">',
      '<line class="kfh-leader warn" x1="186" y1="46" x2="60" y2="80"/>',
      '<text class="kfh-label-box warn" x="30" y="86">Bar Fwd of Foot 8 cm</text>',
      '<text class="kfh-label-box warn" x="30" y="98">Hip Lean · Shear Risk</text>',
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
      svgMarkup: BICEP_CURL_SVG,
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
      svgMarkup: HACK_SQUAT_SVG,
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
      svgMarkup: RDL_SVG,
      chipOkLabel: 'Neutral Spine',
      chipWarnLabel: 'Common Fault: Lumbar Flexion',
      metricLabels: { dev: 'Bar Path', tuck: 'Hip Hinge', load: 'Spinal Load' },
      formStates: {
        ok:   { dev: 'Vertical',    tuck: '90°', load: 'Distributed', fn: 'Clinical reference · Posterior chain pattern' },
        warn: { dev: 'Drift +3 cm', tuck: 'Stiff',  load: 'Shear Risk',  fn: 'Fault pattern · Lumbar flexion · Disc shear risk' }
      }
    },
    'overhead press': {
      title: 'Clinical Protocol: Overhead Press',
      subtitle: 'Sagittal Plane · Barbell · Vertical Push',
      muscleTarget: 'Anterior Deltoid / Medial Deltoid / Triceps Brachii / Upper Trapezius',
      clinicalNotes: 'Vertical pressing pattern. Bar must stack over mid-foot through the full ROM — drift forward of mid-foot loads the lumbar in extension. Clavicular pec assists at the start; deltoid + triceps own the lockout. Brace through 360° trunk tension to spare the spine.',
      mediaSrc: '', mediaType: 'image',
      svgTitle: 'Overhead Press Sagittal Wireframe with Vertical Bar Path',
      svgMarkup: OHP_SVG,
      chipOkLabel: 'Standard Form',
      chipWarnLabel: 'Common Fault: Bar Forward of Mid-Foot',
      metricLabels: { dev: 'Bar Stack Dev.', tuck: 'Hip Lean', load: 'Lumbar Load' },
      formStates: {
        ok:   { dev: '± 1.0 cm', tuck: '0°',  load: 'Distributed', fn: 'Clinical reference · Stacked vertical pattern' },
        warn: { dev: '+8 cm fwd', tuck: '12°', load: 'Shear Risk',  fn: 'Fault pattern · Bar fwd of foot · Hip lean shear' }
      }
    }
  };

  // Path A v3 PLAN-VARIANT SHORTCUTS were rolled back — they were
  // blocking the kfh-blueprints animations that the CEO wants to keep.
  // Bicep Curl, Romanian Deadlift, Shoulder Press, and other
  // blueprint-covered exercises now flow through the V2 transpiler
  // again (animated stick figures). Static anatomical SVGs in this
  // file only render for exercises that no blueprint claims:
  //   - 'bench press' (no blueprint)
  //   - 'hack squat' (no blueprint)
  //   - 'overhead press' (blueprints claim 'shoulder press' variants
  //     but not 'overhead press' literal — only that exact name hits
  //     this static anatomy)
  //
  // The right architectural fix to combine anatomy + animation is to
  // extend the transpiler (kfh-transpiler.js _emitSVG) with a
  // `bodyOutline` SVG path field on each blueprint. That ships in a
  // follow-up commit as Path B.

  // Alias index — additional names that resolve to a primary key.
  // Empty for the legacy entries; future Blueprint-based registrations
  // will populate this via register(key, entry, aliases).
  var ALIASES = {};

  // ─── KEY NORMALIZATION ───────────────────────────────────
  // STRICT case-insensitive contract: every key, alias, and lookup
  // query goes through _normKey() before touching EXERCISES /
  // ALIASES. UI payloads like "Biceps curls" / "BICEP CURL" /
  // "  back squat  " all collapse to the same canonical form, so
  // a single registered alias serves every casing the UI sends.
  function _normKey(s) {
    return s == null ? '' : String(s).toLowerCase().trim();
  }

  // ─── LOOKUP ──────────────────────────────────────────────
  // Resolution order (all comparisons case-insensitive):
  //   1. Exact match on primary key
  //   2. Exact match on registered alias
  //   3. Substring fuzzy match against any primary key
  // Mirrors the Phase 11 behavior so existing callers (e.g. the
  // exercise-row click handler) keep hitting the same entries.
  function getExercise(name) {
    var raw = _normKey(name);
    if (!raw) return null;
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
  // All keys + aliases are case-insensitive (see _normKey).
  function register(key, entry, aliases) {
    if (!entry) return false;
    var primary = _normKey(key);
    if (!primary) return false;
    EXERCISES[primary] = entry;
    if (aliases && aliases.length) {
      aliases.forEach(function (a) {
        var aliasKey = _normKey(a);
        if (!aliasKey) return;
        ALIASES[aliasKey] = primary;
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
      var primaryKey = _normKey(bp.id);
      aliases.forEach(function (a) {
        var aliasKey = _normKey(a);
        if (!aliasKey || aliasKey === primaryKey) return;
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
