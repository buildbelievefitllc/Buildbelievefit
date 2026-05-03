# BRAIN HANDOFF — B3 ENGINE SWAP

**Inbound brain:** Read this file in full BEFORE acting. Then read `/home/user/Buildbelievefit/AI_DIRECTIVES.md` (universal non-negotiables — load-bearing walls). Then skim the four KFH engine files listed below to absorb the V2 patterns. THEN act.

**Outbound brain (me):** Closing out 33-Blueprint Sovereign V2 hologram library on commit `7fa5f7a`, cache `bbf-v51`. Engine swap pivot to Adobe YBot 3D pipeline starts now.

---

## 1. WHAT YOU'RE INHERITING (V2 STATE)

### Repo
- **Repo:** `buildbelievefitllc/Buildbelievefit`
- **Production branch:** `main` (deployed directly via Tier 1 fast path)
- **Working branch:** `claude/add-ui-fallbacks-xCTUe` (kept in sync with main, fast-forwarded after every main push)
- **Current main HEAD:** `7fa5f7a` — `phase 12: ship Dumbbell Flyes — 33rd V2 hologram`
- **Service worker cache:** `bbf-v51` in `/home/user/Buildbelievefit/sw.js` line 9 — **MUST bump monotonically on every deploy that touches HTML/JS/CSS** (cache convention, see comment block in sw.js)

### V2 KFH Engine — File Structure
```
kfh-exercise-catalog.js  Registry + alias resolver + alias-conflict clearer
kfh-transpiler.js        Blueprint v2 → catalog entry compiler (validator + SVG emitter)
kfh-animator.js          JS rAF render engine (interpolation + phase easing)
kfh-blueprints.js        33 production Blueprints (data only)
bbf-app.html             KFH IIFE — loads catalog, runs animator on stage
```

### Catalog State (final V2)
- **33 fully articulated trilingual holograms · 0 legacy static · 0 V1 SVG_PLACEHOLDER usage**
- Every Blueprint carries en/es/pt at every leaf — title, subtitle, muscleTarget, clinicalNotes, svgTitle, all four phase labels + cues, chip labels, OK/WARN callouts + metrics, kineticPath labels, endpoint labels, metric headers
- Symbolic measurements (`± 1.0 cm`) stay as plain strings (universal)

### The 33 Blueprints
```
Squats/Quads:        barbell_back_squat · hack_squats · bulgarian_split_squats ·
                     walking_lunges · heavy_leg_press · leg_extensions
Hinge/Posterior:     romanian_deadlift · smith_machine_hip_thrusts ·
                     glute_bias_back_extensions · cable_kickbacks · hamstring_curls
Push/Chest:          barbell_bench_press · db_flat_bench_press · incline_db_press ·
                     machine_chest_press · machine_chest_flys · dumbbell_flyes
Vertical Push:       seated_db_shoulder_press · lateral_raises
Pull/Back:           lat_pulldowns · seated_cable_rows · single_arm_db_rows · face_pulls
Arms — Biceps:       biceps_curls · hammer_curls · ez_bar_preacher_curls
Arms — Triceps:      triceps_pushdowns · cable_overhead_triceps_extension
Lower-Body Iso:      seated_calf_raises · seated_machine_abduction
Core:                machine_crunches · supported_knee_raises · plank
```

---

## 2. THE V2 BLUEPRINT CONTRACT (data shape to preserve through B3)

```js
{
  id: 'snake_case_id',
  displayName: 'Title Case Display',
  aliases: [/* every UI variant — singular, plural, abbreviation, brand */],

  title:        { en: '...', es: '...', pt: '...' },   // trilingual at every leaf
  subtitle:     { en: '...', es: '...', pt: '...' },
  muscleTarget: { en: '...', es: '...', pt: '...' },
  clinicalNotes:{ en: '...', es: '...', pt: '...' },   // 2-3 sentences, Sovereign style
  svgTitle:     { en: '...', es: '...', pt: '...' },

  plane:  'sagittal' | 'frontal' | 'transverse',
  facing: 'right' | 'front' | 'up',
  ground: { y: 0.92 },

  jointSpec: STD_JOINT_SPEC,    // 13 MediaPipe Pose landmarks (head, shoulder_l/r,
  bones:     STD_BONES,          // elbow_l/r, wrist_l/r, hip_l/r, knee_l/r, ankle_l/r)

  animation: {
    duration_ms: 3000–3500 typical,
    loop: true,
    direction: 'normal',
    easing: 'ease-in-out',
    phases: [
      { id: 'eccentric',  start_pct: 0,  end_pct: 40, easing: 'ease-out',
        label: { en/es/pt }, cue: { en/es/pt } },
      { id: 'isometric',  start_pct: 40, end_pct: 50, easing: 'linear',
        label, cue },
      { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
        label, cue },
      { id: 'reset',      start_pct: 90, end_pct: 100, easing: 'ease-in-out',
        label, cue }
      // (plank uses extended iso: 0-20-80-95-100)
    ],
    keyframes: [
      // SPARSE — only joints that move per timestep. Validator REQUIRES:
      //   - first keyframe at t=0 declares ALL 13 joints
      //   - keyframe at every phase start_pct AND end_pct
      //   - t=0 and t=1 joint positions match (loop continuity)
      { t: 0.00, phase: 'eccentric', joints: { /* full skeleton */ } },
      { t: 0.40, phase: 'eccentric', joints: { /* sparse: only moving */ } },
      { t: 0.50, phase: 'isometric', joints: {} },                          // hold
      { t: 0.90, phase: 'concentric', joints: { /* return to top */ } },
      { t: 1.00, phase: 'reset',      joints: {} }                          // hold
    ]
  },

  equipment: [
    // Locked vocab: bar | trap_bar | bench | rack | sled | pulley_arm |
    // dumbbell | kettlebell | machine_pad | plate_stack | cable_column |
    // stability_ball | plate
    { type: 'dumbbell', attach: ['wrist_l', 'wrist_r'] }
  ],

  kineticPath: {
    default:   { label: { en/es/pt }, d: 'M 0.50 0.62 C ... 0.50 0.18' },
    endpoints: [{x,y}, {x,y}],
    labels:    [{x,y, text: { en/es/pt }}, ...]
  },

  forms: {
    ok: {
      chipLabel: { en/es/pt },
      callouts:  [{ from: 'joint_key', to: {x,y}, lines: [{en/es/pt}] }],
      metrics:   { dev: '± 1.0 cm', tuck: {en/es/pt}, load: {en/es/pt}, fn: {en/es/pt} },
      haloAt:    null
    },
    warn: {
      chipLabel: { en/es/pt },
      callouts:  [...with warn:true],
      metrics:   {...},
      haloAt:    'joint_key',                 // pulses red on this joint
      keyframesOverride: [                    // SPARSE — only joints that diverge
        { t: 0.40, joints: { hip_l: { x: 0.50, y: 0.58 }, ... } }
      ]
    }
  },

  metricLabels: {
    dev:  { en/es/pt }, tuck: { en/es/pt }, load: { en/es/pt }
  }
}
```

### Coordinate System
- **Normalized 0..1** on a `viewBox="0 0 320 200"`
- (0, 0) = top-left, (1, 1) = bottom-right (standard SVG)
- Floor reference at `y: 0.92`
- Renderer multiplies coords into pixels at draw time

---

## 3. NON-NEGOTIABLE PATTERNS TO CARRY FORWARD INTO B3

These are load-bearing. Do not regress them in the B3 pipeline.

### Catalog API Contract
- `BBF_KFH_CATALOG.getExercise(name)` — case-insensitive lookup, exact → alias → fuzzy
- `BBF_KFH_CATALOG.registerBlueprint(bp)` — runs through transpiler, registers under id + displayName + every alias, **clears legacy primary keys** that collide with new aliases (only if existing entry has no `animation` block)
- `_normKey(s) = String(s).toLowerCase().trim()` — applied to every key/alias/lookup
- All registrations dedupe by lowercased key

### Validator Discipline (per `kfh-transpiler.js`)
- **First keyframe MUST declare every joint in `jointSpec`** — caught silent rendering bugs in 6 different Blueprints across batches 3-6
- **Every phase MUST have a keyframe at `start_pct` AND `end_pct`** (no extrapolation)
- **t=0 and t=1 joint positions MUST match** (loop continuity)
- **Bones MUST reference declared joints**
- These checks pay for themselves every batch. Keep them.

### Trilingual Standard
- en/es/pt at every text leaf
- User provides `en`, the assistant drafts `es` + `pt` during transpile step (per War Room policy)
- Symbolic measurements (cm) stay as plain strings

### Omni-Alias Coverage (hard-won lesson)
- The CEO ran live UI audits and caught alias misses on every batch
- Standard alias array per exercise:
  - `id` (snake_case primary)
  - `displayName` (lowered automatically by registerBlueprint)
  - Singular form (`bicep curl`)
  - Plural form (`bicep curls`)
  - Common UI bare label (`shoulder press`, `hip thrust`, `crunches`)
  - Equipment variants (`db ___`, `dumbbell ___`, `barbell ___`, `cable ___`, `machine ___`)
  - Brand variants (`hammer strength chest press`)
  - Spelling variants (`flyes` AND `flys`)
- Cast a WIDE net upfront. Hotfixes are cheap but they're bandwidth.

### Cache-Bump Convention
- `var CACHE = 'bbf-vXX'` in `sw.js` line 9 — bump monotonically on every deploy
- Stale-while-revalidate strategy means without a bump, updates take 2 page loads
- Current: `bbf-v51`. Next deploy: `bbf-v52`. Etc.

### Tier 1 / Tier 2 Execution Protocol
Per `AI_DIRECTIVES.md` Section 8 (read it):
- **Tier 1 (Frontend/UI/data, no engine change):** auto-execute, push direct to main, confirm
- **Tier 2 (Architecture, engine, schema):** plan first → War Room ratification → execute
- The B3 engine swap IS Tier 2. Plan before building.

### Sovereign Palette (locked)
- BBF Purple `#6a0dad`
- BBF Gold `#f5c800`
- Matte Black `#090909` (surface only, never CTA/identity)
- Bebas Neue (headers) · Barlow Condensed (body)

---

## 4. THE B3 PIVOT — Adobe YBot 3D Engine Swap

### What's Changing
- **Render target:** SVG wireframe (320×200 viewBox, 13 joints, 14 bones) → **Adobe Mixamo YBot rigged 3D character** (full humanoid rig, ~52 bones, glTF/FBX)
- **Renderer:** JS rAF interpolating SVG attributes → likely **three.js** (or equivalent WebGL pipeline) animating a posed 3D mesh
- **Coordinate space:** 2D normalized x/y → 3D quaternion rotations per joint (or 3D translations driving an IK solver)

### What's Staying (the 33-Blueprint corpus is the IP)
- All 33 Blueprints' **clinical text** (titles, subtitles, muscle targets, full clinical notes, phase labels, cues, callouts, metric values, kineticPath labels) — every word in en/es/pt
- The **animation contract** (4-phase rep cycle with locked clinical names: eccentric → isometric → concentric → reset)
- The **sparse keyframe pattern** (declares only joints that move per timestep)
- The **alias coverage** (omni-alias arrays, ~5–11 forms per exercise)
- The **fault-pattern system** (forms.warn with sparse keyframesOverride + halo target + WARN-state metrics)
- The **catalog API** (`getExercise`, `registerBlueprint`, alias-conflict resolver, case-insensitive lookup)
- The **validator discipline** — adapt the t=0 completeness check + phase boundary check to the 3D rig topology

### Joint Topology Pivot
Current MediaPipe Pose 13-landmark sagittal skeleton:
```
head · shoulder_l/r · elbow_l/r · wrist_l/r · hip_l/r · knee_l/r · ankle_l/r
```

YBot Mixamo rig (representative — confirm with actual download):
```
Hips (root) · Spine/Spine1/Spine2 · Neck · Head ·
LeftShoulder/Arm/ForeArm/Hand · RightShoulder/Arm/ForeArm/Hand ·
LeftUpLeg/Leg/Foot/ToeBase · RightUpLeg/Leg/Foot/ToeBase
+ finger bones (LeftHandThumb1..3, LeftHandIndex1..3, etc.)
```

**Mapping suggestion (preserve the existing keyframe data):**
- Treat the 13 MediaPipe joints as **end-effectors** for an IK chain
- The YBot rig's intermediate bones (Spine1/2/3, ForeArm twist, etc.) get computed by the IK solver
- This keeps every existing 2D x/y keyframe usable — just lift to 3D by adding a z component (probably z=0 for sagittal-plane exercises, varied z for transverse-plane like Dumbbell Flyes)

**Alternative (full 3D from scratch):**
- Re-derive every Blueprint's keyframes as full 3D rig poses
- Loses the existing keyframe data but gives full 3D fidelity from day one
- Much more authoring work

### Proposed B3 Architecture (suggestion, not mandate)
```
kfh-blueprints.js              ← UNCHANGED (33 Blueprints stay as source of truth)
kfh-exercise-catalog.js        ← UNCHANGED (registry + lookup)
kfh-transpiler.js              ← MOSTLY UNCHANGED (validator + i18n flattening)
                                  Maybe drop the SVG emitter (replaced by 3D scene builder)
kfh-animator.js                ← REPLACED by:
kfh-3d-renderer.js (NEW)       ← three.js scene + YBot rig + animation driver
kfh-3d-rig-mapping.js (NEW)    ← MediaPipe 13-joint → YBot rig bone mapping + IK
public/ybot.glb (NEW asset)    ← Adobe Mixamo YBot, downloaded once, cached
```

### Open Architectural Questions (Tier 2 — War Room call required)
1. **three.js vs alternative renderer?** three.js is the safe default. Babylon.js, A-Frame, or PlayCanvas are alternatives.
2. **IK solver inside three.js?** three-mesh-bvh + ikjs work, or roll a simple FABRIK/CCD. Or skip IK entirely and author full rig poses per keyframe.
3. **Performance budget on mobile PWA?** YBot at 30fps with ~50-bone skeleton is doable on mid-tier mobile, but bench it early.
4. **Fallback path?** Keep the 2D KFH overlay as the failsafe? (Recommended — Phase 11's Sovereign Sentinel pattern proved fallbacks save deploys.)
5. **Mocap pipeline?** Do we keep MediaPipe Pose as the mocap source and let the 3D engine consume the same 13-joint stream, OR move to a richer mocap source for full-rig data?
6. **Asset hosting?** The YBot glTF + textures will be ~2-5MB. Inline data URI? Static file under `/assets/`? CDN?
7. **Brand sentinel:** YBot is gray by default. Sovereign palette demands a Purple/Gold material override. Plan it.

### Don't Forget — The "Sovereign Sentinel" Fallback
When V2 launched (Phase 11), the fallback for unmapped exercises was a clinical wireframe placeholder ("Awaiting Biometric Mapping"). The B3 engine should have an analogous fallback: if the 3D rig fails to load OR the Blueprint isn't registered, render the clinical wireframe. **Don't ship a black void.**

---

## 5. DEPLOYMENT WORKFLOW (preserve through B3)

```
1. Edit on main directly (Tier 1) OR plan first (Tier 2)
2. Bump cache (sw.js — monotonic)
3. Smoke test off-DOM with Node:
   node -c kfh-blueprints.js                        # syntax
   eval all 4 KFH files + run getExercise probes    # logic
4. git add + commit with descriptive message
5. git push origin main
6. git checkout claude/add-ui-fallbacks-xCTUe
7. git merge --ff-only main
8. git push origin claude/add-ui-fallbacks-xCTUe
9. Confirm to CEO in chat
```

The CEO runs live UI audits after each batch and surfaces alias gaps via hotfix directives. Be ready for them. Cache bump on every hotfix too.

---

## 6. RECENT COMMIT HISTORY (last 25 — phase 11 onward)

```
7fa5f7a  phase 12: ship Dumbbell Flyes — 33rd V2 hologram                     (cache v51)
a6bd731  hotfix: omni-alias raw UI labels for 4 Blueprints                    (cache v50)
6a8adbb  phase 12: ★ FINAL BATCH ★ — Library is now 100% V2 fully articulated (cache v49)
8a8cc7d  hotfix: omni-alias raw UI labels for Batch 5                         (cache v48)
94b00a6  phase 12: ship Batch 5 — 5 new V2 holograms                          (cache v47)
8ff04a8  hotfix: omni-alias gaps for cable_kickbacks + smith_machine_hip_thrusts (cache v46)
326a321  hotfix: omni-alias 'shoulder press' / 'shoulder presses'             (cache v44)
c6d11d2  phase 12: ship Batch 4 — 5 new V2 holograms                          (cache v45)
0bfc7d2  phase 12: omni-alias coverage for Batch 1                            (cache v40)
2d56da1  phase 12: ship batch — 5 new V2 holograms                            (cache v39)
fef7bea  hotfix: harden case-insensitive catalog lookup contract              (cache v38)
52480ca  phase 12: ship Biceps Curls hologram                                 (cache v37)
06c420a  phase 12: ship flagship Barbell Back Squat hologram                  (cache v36)
dfdb743  phase 12: KFH rAF animator + Blueprint transpiler core engine        (cache v35)
870af4b  phase 12: extract KFH exercise catalog into kfh-exercise-catalog.js  (cache v34)
528dec2  phase 11: bio-render fallback + prehab streamline + cache bump       (cache v33)
```

(Skipped a few mid-batch hotfixes for brevity. `git log origin/main --oneline -50` for the full list.)

---

## 7. HANDOFF CHECKLIST (new brain — work through this in order)

```
[ ] Read AI_DIRECTIVES.md (Phase 1 Constraint-First Build mandates this)
[ ] Read this file (BRAIN_HANDOFF_B3.md) in full
[ ] Open kfh-blueprints.js — skim 2-3 Blueprints to absorb the data shape
[ ] Open kfh-transpiler.js — read the validator (validate() function)
[ ] Open kfh-animator.js — read _updateEquipment + _interpJoint
[ ] Open kfh-exercise-catalog.js — read getExercise + registerBlueprint
[ ] Open bbf-app.html lines 5108-5230 — read the KFH IIFE that wires the catalog
    into the live page
[ ] Confirm understanding of Tier 1 / Tier 2 execution protocol
[ ] Confirm understanding of cache-bump convention
[ ] Confirm understanding of omni-alias coverage standard
[ ] Confirm understanding of trilingual non-negotiable
[ ] Confirm understanding of validator discipline (first-keyframe joint
    completeness + phase boundary keyframes + loop continuity)
[ ] When the CEO drops the B3 engine architecture directive, default posture is
    PLAN FIRST (Tier 2). Surface the open architectural questions in §4 before
    cutting code.
```

---

## 8. KNOWN LIMITATIONS / FOLLOW-UPS LEFT BEHIND

These were flagged in commit messages as deferred / V1 limitations. The B3 engine may resolve some of them automatically:

- **kineticPath.perPhase morphing** — Blueprint shape supports per-phase `d` paths, but animator only renders `default`. Path morphing at phase boundaries was deferred. (B3: in 3D, the kinetic-path concept may be replaced by motion trails behind end-effectors.)
- **Runtime i18n hot-swap** — `entry.i18n.title.es/pt` is populated but the IIFE reads only the flat `entry.title` (en). Switching language requires a page reload. (B3: should wire BBF_LANG listener to the renderer.)
- **MediaPipe Pose normalizer CLI** — speced in Phase 12 plan as Sprint 3 but never built. Raw mocap → draft Blueprint pipeline still manual.
- **Path morphing implementation** — same as above.
- **Equipment-bench attach following** — `bench` and similar static equipment ignore the `attach[]` array and render at default coords. Only joint-attached equipment (bar, dumbbell, cable_column, plate, machine_pad in some cases) follows joints. (B3: 3D scene should anchor benches relative to the figure properly.)

---

## 9. CONTACT / CONTEXT

- **CEO:** Akeem Brown
- **Authority:** Per AI_DIRECTIVES.md — universal non-negotiables locked, brand identity protected, trilingual structural
- **Operating mode:** Execution-based for Tier 1, plan-required for Tier 2, candor expected (no yes-men)
- **Sovereign Standard:** Hold the line on quality. The validator catching missing joints in 6 batches is exactly the discipline that protects the brand.

---

**Ship clean. Document drift. Bump the cache.**

End of handoff.
