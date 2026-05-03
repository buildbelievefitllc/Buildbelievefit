// ═══════════════════════════════════════════════════════════════
// KFH-3D-RIG-BRIDGE.JS — BBF V3 Joint→Bone Mapping (ESM)
// Sovereign Gold Standard — Phase 13 / B3-2
//
// Owns the translation contract between the V2 13-joint MediaPipe
// Pose schema (used by all 33 existing Blueprints) and the YBot
// Mixamo skeleton bone names.
//
// B3-2 SCOPE
//   - Mapping table + verifyRig() helper that confirms the rig
//     contains every bone we'll target.
//   - Path A rotation derivation (Euler from existing 2D x/y
//     keyframes) lands in B3-3 — Barbell Back Squat pilot.
//   - Path B (Blueprint-authored rigPoses overrides for transverse-
//     plane exercises) lands in B3-Final.
//
// MIXAMO BONE-NAME CAVEAT
// Mixamo glTFs export bone names as either "mixamorigHips" (no
// separator) or "mixamorig:Hips" (with colon) depending on the
// pipeline. The mapping below is our day-one best-guess. The
// renderer logs the actual rig bone names on load — if any below
// mismatch, patch this table and ship a hotfix in the next cache
// bump before B3-3 animates anything.
// ═══════════════════════════════════════════════════════════════

const JOINT_TO_BONE = Object.freeze({
  head:       'mixamorigHead',
  shoulder_l: 'mixamorigLeftArm',
  shoulder_r: 'mixamorigRightArm',
  elbow_l:    'mixamorigLeftForeArm',
  elbow_r:    'mixamorigRightForeArm',
  wrist_l:    'mixamorigLeftHand',
  wrist_r:    'mixamorigRightHand',
  hip_l:      'mixamorigLeftUpLeg',
  hip_r:      'mixamorigRightUpLeg',
  knee_l:     'mixamorigLeftLeg',
  knee_r:     'mixamorigRightLeg',
  ankle_l:    'mixamorigLeftFoot',
  ankle_r:    'mixamorigRightFoot'
});

const ROOT_BONE = 'mixamorigHips';

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

const api = { JOINT_TO_BONE, ROOT_BONE, listMappings, resolveBone, verifyRig };

if (typeof window !== 'undefined') {
  window.BBF_KFH_3D_BRIDGE = api;
}

export { JOINT_TO_BONE, ROOT_BONE, listMappings, resolveBone, verifyRig };
export default api;
