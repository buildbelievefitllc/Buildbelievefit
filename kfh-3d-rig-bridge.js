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
// MIXAMO BONE-NAME CONVENTION (VERIFIED · B3-2.1)
// FBX2glTF v0.9.7 conversion of the Mixamo Y Bot rig produces bone
// names with the "mixamorig:" prefix (colon-separated). Manifest
// extracted server-side from the GLB JSON chunk and ratified by
// the War Room — all 13 joint targets + the root bone resolve
// cleanly against the live rig (52 unique bones across 2 skin).
// If a future model swap uses a different prefix, patch this
// table and re-run verifyRig() before animating.
// ═══════════════════════════════════════════════════════════════

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
