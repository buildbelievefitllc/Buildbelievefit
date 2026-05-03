// ═══════════════════════════════════════════════════════════════
// KFH-3D-RIG-BRIDGE.JS — BBF V3 Joint→Bone Mapping (ESM)
// Sovereign Gold Standard — Phase 13 / B3-3
//
// Owns the translation contract between the V2 13-joint MediaPipe
// Pose schema (used by all 33 existing Blueprints) and the YBot
// Mixamo skeleton bone names.
//
// B3-2 SCOPE (shipped)
//   - Mapping table + verifyRig() helper that confirms the rig
//     contains every bone we'll target.
//
// B3-3 SCOPE (this commit) — Path A Pilot · Barbell Back Squat
//   - computeBoneRotationsForBlueprint(animation, t, mode) derives
//     THREE.Euler rotations (Z-axis dominant for sagittal-plane
//     mechanics) from the existing V2 2D parent→child vectors at
//     normalized time t. Phase-aware easing is reused from the V2
//     animator contract so eccentric / isometric / concentric / reset
//     transitions match the wireframe Sentinel one-to-one.
//   - Path B (Blueprint-authored rigPoses overrides for transverse-
//     plane exercises) lands in B3-Final.
//
// MIXAMO BONE-NAME CONVENTION (VERIFIED · B3-2.1)
// FBX2glTF v0.9.7 conversion of the Mixamo Y Bot rig produces bone
// names with the "mixamorig:" prefix (colon-separated). Manifest
// extracted server-side from the GLB JSON chunk and ratified by
// the War Room — all 13 joint targets + the root bone resolve
// cleanly against the live rig (52 unique bones across 2 skin).
// If a future model swap uses a different prefix, patch this
// table and re-run verifyRig() before animating.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

const JOINT_TO_BONE = Object.freeze({
  head:       'mixamorig:Head',
  shoulder_l: 'mixamorig:LeftArm',
  shoulder_r: 'mixamorig:RightArm',
  elbow_l:    'mixamorig:LeftForeArm',
  elbow_r:    'mixamorig:RightForeArm',
  wrist_l:    'mixamorig:LeftHand',
  wrist_r:    'mixamorig:RightHand',
  hip_l:      'mixamorig:LeftUpLeg',
  hip_r:      'mixamorig:RightUpLeg',
  knee_l:     'mixamorig:LeftLeg',
  knee_r:     'mixamorig:RightLeg',
  ankle_l:    'mixamorig:LeftFoot',
  ankle_r:    'mixamorig:RightFoot'
});

const ROOT_BONE = 'mixamorig:Hips';
const SPINE_BONE = 'mixamorig:Spine';

// ─── PATH A · SAGITTAL HIP-DROP CALIBRATION ────────────────
// V2 keyframes are normalized in a 320×200 viewBox; the standing
// figure spans roughly 0.72 of the canvas height (head y=0.20 →
// ankle y=0.92). The Mixamo Y-Bot rig is ~1.65 world units tall
// in T-pose, so 1 unit of normalized 2D y ≈ 2.3 world units of
// 3D Y. We use that ratio to translate the Hips bone down into
// the squat without needing IK on the foot anchors.
const Y2D_TO_Y3D = 2.3;

function listMappings() {
  return JOINT_TO_BONE;
}

function resolveBone(jointKey, bones) {
  const target = JOINT_TO_BONE[jointKey];
  return (target && bones && bones[target]) ? bones[target] : null;
}

function verifyRig(bones) {
  if (!bones) {
    console.warn('[KFH-3D-BRIDGE] verifyRig: no bones provided');
    return Object.keys(JOINT_TO_BONE).concat([ROOT_BONE]);
  }
  const missing = [];
  Object.values(JOINT_TO_BONE).forEach((boneName) => {
    if (!bones[boneName]) missing.push(boneName);
  });
  if (!bones[ROOT_BONE]) missing.push(ROOT_BONE);

  if (missing.length === 0) {
    console.log(
      '%c[KFH-3D-BRIDGE] all 13 joint targets + root bone resolved · Path A ready',
      'color:#22C55E;font-weight:bold'
    );
  } else {
    console.warn('[KFH-3D-BRIDGE] missing bones — patch JOINT_TO_BONE table:', missing);
    console.log('[KFH-3D-BRIDGE] actual bones available:', Object.keys(bones));
  }
  return missing;
}

// ─── EASING TABLE (mirrors kfh-animator.js V2 contract) ──
const EASING = {
  'linear':       (t) => t,
  'ease-in':      (t) => t * t,
  'ease-out':     (t) => 1 - (1 - t) * (1 - t),
  'ease-in-out':  (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
};
function _ease(name, t) { return (EASING[name] || EASING.linear)(t); }

// ─── TIMELINE BUILDER (mirrors kfh-animator._buildTimelines) ──
function _buildTimelines(animation, mode) {
  const timelines = {};
  const keyframes = animation.keyframes || [];
  keyframes.forEach((kf) => {
    const joints = kf.joints || {};
    Object.keys(joints).forEach((jk) => {
      if (!timelines[jk]) timelines[jk] = [];
      timelines[jk].push({ t: kf.t, x: joints[jk].x, y: joints[jk].y });
    });
  });

  const override = (mode === 'warn'
    && animation.forms
    && animation.forms.warn
    && animation.forms.warn.keyframesOverride) || [];
  override.forEach((kf) => {
    const joints = kf.joints || {};
    Object.keys(joints).forEach((jk) => {
      if (!timelines[jk]) timelines[jk] = [];
      let hit = null;
      for (let i = 0; i < timelines[jk].length; i++) {
        if (Math.abs(timelines[jk][i].t - kf.t) < 0.001) { hit = timelines[jk][i]; break; }
      }
      if (hit) {
        hit.x = joints[jk].x;
        hit.y = joints[jk].y;
      } else {
        timelines[jk].push({ t: kf.t, x: joints[jk].x, y: joints[jk].y });
      }
    });
  });

  Object.keys(timelines).forEach((jk) => {
    timelines[jk].sort((a, b) => a.t - b.t);
  });
  return timelines;
}

function _findPhase(animation, t) {
  const phases = animation.phases || [];
  const pct = t * 100;
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (pct >= p.start_pct && pct <= p.end_pct) return p;
  }
  return phases[0] || { easing: 'linear' };
}

function _interpJoint(timeline, t, easingName) {
  if (!timeline || !timeline.length) return null;
  if (timeline.length === 1) return { x: timeline[0].x, y: timeline[0].y };
  if (t <= timeline[0].t) return { x: timeline[0].x, y: timeline[0].y };
  const last = timeline[timeline.length - 1];
  if (t >= last.t) return { x: last.x, y: last.y };

  let prev = timeline[0], next = timeline[1];
  for (let i = 0; i < timeline.length - 1; i++) {
    if (timeline[i].t <= t && timeline[i + 1].t >= t) {
      prev = timeline[i];
      next = timeline[i + 1];
      break;
    }
  }
  const span = next.t - prev.t;
  const raw = span > 0 ? (t - prev.t) / span : 0;
  const f = _ease(easingName, raw);
  return { x: prev.x + (next.x - prev.x) * f, y: prev.y + (next.y - prev.y) * f };
}

function _midpoint(a, b) {
  return (a && b) ? { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 } : (a || b || null);
}

// 2D angle in Y-up world space (V2 SVG keyframes are Y-down, so we
// flip the y component to align with three.js / world conventions).
function _angle2D(parent, child) {
  if (!parent || !child) return null;
  return Math.atan2(-(child.y - parent.y), (child.x - parent.x));
}

// ─── PATH A · MATH BRIDGE ────────────────────────────────
// computeBoneRotationsForBlueprint
//   animation : the transpiled animation block (or full Blueprint
//               with .animation child — we accept both shapes).
//   t         : normalized time in [0..1] across the rep loop.
//   mode      : 'ok' | 'warn' — selects keyframesOverride.
// Returns:
//   {
//     rotations:  { boneName: THREE.Euler(0, 0, deltaZ) },
//     hipsOffset: { x, y, z }   // world translation for the root
//   }
// The renderer caches each bone's rest quaternion on first apply
// and post-multiplies the delta so the T-pose orientation is
// preserved across resets.
function computeBoneRotationsForBlueprint(animation, t, mode) {
  if (!animation) return { rotations: {}, hipsOffset: { x: 0, y: 0, z: 0 } };
  // Tolerate callers passing the full transpiled entry or the raw blueprint.
  const anim = animation.keyframes ? animation : (animation.animation || animation);
  const bones2D = anim.bones || [];
  const timelines = _buildTimelines(anim, mode);

  const phase = _findPhase(anim, t);
  const easingName = phase.easing || 'linear';

  const positionsT = {};
  const positionsRest = {};
  Object.keys(timelines).forEach((jk) => {
    positionsT[jk]    = _interpJoint(timelines[jk], t, easingName);
    positionsRest[jk] = _interpJoint(timelines[jk], 0, 'linear');
  });

  const rotations = {};

  // ── Limb bones · drive the parent bone of each 2D pair ──
  // For each [parentJoint, childJoint] we rotate the bone resolved
  // from parentJoint (e.g. hip_l → mixamorig:LeftUpLeg) by the
  // delta between the rest 2D angle and the current 2D angle.
  bones2D.forEach((pair) => {
    const parentJoint = pair[0];
    const childJoint  = pair[1];
    const boneName = JOINT_TO_BONE[parentJoint];
    if (!boneName) return;
    if (rotations[boneName] !== undefined) return; // first pair wins

    const restAngle = _angle2D(positionsRest[parentJoint], positionsRest[childJoint]);
    const tAngle    = _angle2D(positionsT[parentJoint],    positionsT[childJoint]);
    if (restAngle == null || tAngle == null) return;

    const deltaZ = tAngle - restAngle;
    rotations[boneName] = new THREE.Euler(0, 0, deltaZ, 'XYZ');
  });

  // ── Spine · derived from hip-midpoint → shoulder-midpoint ──
  // The 13-joint topology has no dedicated spine joint, but the
  // torso vector falls naturally out of the midpoints. We apply
  // the delta to mixamorig:Spine so the trunk pitches forward in
  // the eccentric phase exactly as the V2 wireframe does.
  const hipMidRest = _midpoint(positionsRest.hip_l, positionsRest.hip_r);
  const shoMidRest = _midpoint(positionsRest.shoulder_l, positionsRest.shoulder_r);
  const hipMidT    = _midpoint(positionsT.hip_l, positionsT.hip_r);
  const shoMidT    = _midpoint(positionsT.shoulder_l, positionsT.shoulder_r);
  const spineRest = _angle2D(hipMidRest, shoMidRest);
  const spineT    = _angle2D(hipMidT,    shoMidT);
  if (spineRest != null && spineT != null) {
    rotations[SPINE_BONE] = new THREE.Euler(0, 0, spineT - spineRest, 'XYZ');
  }

  // ── Hips translation · sink the pelvis into the squat ──
  // Without IK, simply rotating the femurs leaves the pelvis at
  // standing height while the feet lift off the floor — visually
  // wrong. We translate the Hips bone downward in proportion to
  // the V2 hip-midpoint y-drop (calibrated against Y-Bot scale).
  let hipsOffset = { x: 0, y: 0, z: 0 };
  if (hipMidRest && hipMidT) {
    const dyNorm = (hipMidT.y - hipMidRest.y); // V2 y-down: positive = sinking
    hipsOffset = { x: 0, y: -dyNorm * Y2D_TO_Y3D, z: 0 };
  }

  return { rotations, hipsOffset };
}

const api = {
  JOINT_TO_BONE,
  ROOT_BONE,
  SPINE_BONE,
  listMappings,
  resolveBone,
  verifyRig,
  computeBoneRotationsForBlueprint
};

if (typeof window !== 'undefined') {
  window.BBF_KFH_3D_BRIDGE = api;
}

export {
  JOINT_TO_BONE,
  ROOT_BONE,
  SPINE_BONE,
  listMappings,
  resolveBone,
  verifyRig,
  computeBoneRotationsForBlueprint
};
export default api;
