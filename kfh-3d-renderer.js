// ═══════════════════════════════════════════════════════════════
// KFH-3D-RENDERER.JS — BBF Kinematic Form HUD V3 Renderer (ESM)
// Sovereign Gold Standard — Phase 13 / B3-3
//
// Boots a Clinical Studio three.js scene, loads the YBot rig
// (Adobe Mixamo) into a WebGL canvas, applies the Sovereign
// Material Override (Matte Black + Purple emissive), and harvests
// the rig's bone manifest for Path A mapping verification.
//
// B3-2 SCOPE (shipped)
//   - Static T-pose render only.
//
// B3-3 SCOPE (this commit) — Path A Pilot · Barbell Back Squat
//   - rAF animation driver (start / stop / setMode) consumes the
//     V2 transpiled animation block and the rig-bridge math to
//     drive the live skeleton each frame.
//   - Frame timer derived from animation.duration_ms; phases roll
//     through the V2 4-phase contract (eccentric → isometric →
//     concentric → reset) with shared easing.
//   - FPS probe (sub-30fps over a rolling window) emits a single
//     fallback signal that the IIFE consumes to revert to the V2
//     SVG Sentinel transparently.
//
// SOVEREIGN PALETTE (locked — never deviate)
//   matte black 0x090909 · BBF purple 0x6a0dad · BBF gold 0xf5c800
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { computeBoneRotationsForBlueprint, ROOT_BONE } from './kfh-3d-rig-bridge.js';

const SOVEREIGN = Object.freeze({
  matteBlack: 0x090909,
  bbfPurple:  0x6a0dad,
  bbfGold:    0xf5c800
});

const ASSET_URL = '/public/models/ybot.glb';

const _state = {
  renderer:    null,
  scene:       null,
  camera:      null,
  ybot:        null,
  bones:       {},
  canvas:      null,
  initStarted: false,
  loaded:      false,

  // Animation driver state
  animation:   null,
  mode:        'ok',
  startTs:     0,
  rafId:       null,
  hipsRest:    { x: 0, y: 0, z: 0 },
  restQuats:   {},     // { boneName: THREE.Quaternion } — captured on first apply

  // FPS probe
  frameStamps: [],
  fpsLow:      false,
  onFallback:  null
};

const FPS_WINDOW_MS = 1500;   // rolling window for the avg-FPS probe
const FPS_MIN       = 30;     // hard floor — sub-30 triggers fallback
const FPS_MIN_FRAMES = 24;    // need at least this many samples before judging

// ─── SCENE BOOTSTRAP ─────────────────────────────────────
function _setupScene(canvas) {
  const w = canvas.clientWidth  || canvas.width  || 320;
  const h = canvas.clientHeight || canvas.height || 200;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SOVEREIGN.matteBlack);

  const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
  camera.position.set(0, 1.05, 3.4);
  camera.lookAt(0, 1.05, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha:     false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  if ('outputColorSpace' in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  // ─── Clinical Studio Lighting ───────────────────────
  // Low ambient floor + Sovereign Gold key + Sovereign Purple rim.
  // Matches the V2 wireframe scanner aesthetic in 3D — clinical,
  // not theatrical.
  scene.add(new THREE.AmbientLight(0xffffff, 0.20));

  const keyLight = new THREE.DirectionalLight(SOVEREIGN.bbfGold, 1.10);
  keyLight.position.set(2.5, 4.0, 3.2);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(SOVEREIGN.bbfPurple, 0.85);
  rimLight.position.set(-2.0, 2.4, -2.6);
  scene.add(rimLight);

  // Subtle floor grid in the Sovereign palette — clinical lab tile
  const grid = new THREE.GridHelper(4, 8, SOVEREIGN.bbfGold, SOVEREIGN.bbfPurple);
  grid.position.y = 0;
  if (grid.material) {
    grid.material.opacity = 0.18;
    grid.material.transparent = true;
  }
  scene.add(grid);

  _state.scene    = scene;
  _state.camera   = camera;
  _state.renderer = renderer;
  _state.canvas   = canvas;
}

// ─── SOVEREIGN MATERIAL OVERRIDE ─────────────────────────
// Strip Mixamo defaults. Replace every renderable mesh's material
// with a single MeshStandardMaterial in BBF's identity palette.
function _applySovereignMaterial(root) {
  root.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.material = new THREE.MeshStandardMaterial({
      color:             SOVEREIGN.matteBlack,
      emissive:          SOVEREIGN.bbfPurple,
      emissiveIntensity: 0.07,
      metalness:         0.42,
      roughness:         0.48
    });
    node.castShadow    = false;
    node.receiveShadow = false;
  });
}

// ─── BONE HARVEST + MANIFEST LOG ─────────────────────────
function _harvestBones(root) {
  const bones = {};
  root.traverse((node) => {
    if (node.isBone) bones[node.name] = node;
  });
  _state.bones = bones;
  return bones;
}

function _logBoneManifest(bones) {
  const names = Object.keys(bones);
  console.log(
    '%c[KFH-3D] YBot rig loaded · ' + names.length + ' bones',
    'color:#f5c800;font-weight:bold'
  );
}

function _captureHipsRest() {
  const hips = _state.bones[ROOT_BONE];
  if (hips) {
    _state.hipsRest = { x: hips.position.x, y: hips.position.y, z: hips.position.z };
  }
}

// ─── PUBLIC API ──────────────────────────────────────────
async function init(canvas) {
  if (_state.initStarted) return _state;
  _state.initStarted = true;

  if (!canvas) throw new Error('[KFH-3D] init: canvas element required');
  if (typeof WebGLRenderingContext === 'undefined') {
    throw new Error('[KFH-3D] WebGL not supported in this environment');
  }

  _setupScene(canvas);

  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      ASSET_URL,
      (gltf) => {
        try {
          const ybot = gltf.scene;
          ybot.position.set(0, 0, 0);
          _applySovereignMaterial(ybot);

          const bones = _harvestBones(ybot);
          _logBoneManifest(bones);

          _state.scene.add(ybot);
          _state.ybot   = ybot;
          _state.loaded = true;
          _captureHipsRest();

          // Single static render — canvas may be hidden but the
          // backing WebGL surface is primed for the IIFE toggle.
          _state.renderer.render(_state.scene, _state.camera);
          console.log(
            '%c[KFH-3D] static T-pose render complete · awaiting startAnimation()',
            'color:#6a0dad;font-weight:bold'
          );
          resolve(_state);
        } catch (e) {
          console.warn('[KFH-3D] post-load setup failed:', e);
          reject(e);
        }
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const pct = ((xhr.loaded / xhr.total) * 100).toFixed(1);
          console.log('[KFH-3D] ybot.glb · ' + pct + '% loaded');
        }
      },
      (err) => {
        console.warn('[KFH-3D] ybot.glb load failed (Sentinel SVG remains active):', err);
        reject(err);
      }
    );
  });
}

function render() {
  if (_state.loaded && _state.renderer && _state.scene && _state.camera) {
    _state.renderer.render(_state.scene, _state.camera);
  }
}

// Resize the WebGL renderer + camera projection to match a new
// container size. Used by BBF_HOLOGRAM when re-parenting the
// kfh-3d-stage canvas into the active exercise card's viewport
// (Phase 13 / B3-3 Option B). Safe to call before the rig has
// loaded; the inner-size update applies to the next render.
function resize(w, h) {
  if (!_state.renderer || !_state.camera) return;
  const W = Math.max(1, w | 0);
  const H = Math.max(1, h | 0);
  _state.renderer.setSize(W, H, false);
  _state.camera.aspect = W / H;
  _state.camera.updateProjectionMatrix();
  if (_state.canvas) {
    _state.canvas.width  = W;
    _state.canvas.height = H;
  }
  if (_state.loaded && !_state.rafId) {
    _state.renderer.render(_state.scene, _state.camera);
  }
}

function show() {
  if (_state.canvas) {
    _state.canvas.hidden = false;
    _state.canvas.removeAttribute('aria-hidden');
  }
  render();
}

function hide() {
  if (_state.canvas) {
    _state.canvas.hidden = true;
    _state.canvas.setAttribute('aria-hidden', 'true');
  }
}

function isLoaded() { return _state.loaded; }
function getBones() { return _state.bones; }
function getScene() { return _state.scene; }
function getYBot()  { return _state.ybot; }

// ─── ANIMATION DRIVER ────────────────────────────────────
// Caches each targeted bone's rest local quaternion the first time
// we touch it. Each frame we copy the rest quaternion back, then
// post-multiply the per-frame Z-axis delta from the bridge so the
// rig returns cleanly to T-pose between rep cycles.
function _ensureRestQuat(boneName) {
  if (_state.restQuats[boneName]) return _state.restQuats[boneName];
  const bone = _state.bones[boneName];
  if (!bone) return null;
  _state.restQuats[boneName] = bone.quaternion.clone();
  return _state.restQuats[boneName];
}

const _tmpDeltaQuat = new THREE.Quaternion();

function _applyFrame(t) {
  if (!_state.animation || !_state.bones || !_state.loaded) return;

  const result = computeBoneRotationsForBlueprint(_state.animation, t, _state.mode);
  const rotations = (result && result.rotations) || {};
  const hipsOffset = (result && result.hipsOffset) || { x: 0, y: 0, z: 0 };

  Object.keys(rotations).forEach((boneName) => {
    const bone = _state.bones[boneName];
    if (!bone) return;
    const rest = _ensureRestQuat(boneName);
    if (!rest) return;
    const eul = rotations[boneName];
    _tmpDeltaQuat.setFromEuler(eul);
    bone.quaternion.copy(rest).multiply(_tmpDeltaQuat);
  });

  const hips = _state.bones[ROOT_BONE];
  if (hips) {
    hips.position.set(
      _state.hipsRest.x + hipsOffset.x,
      _state.hipsRest.y + hipsOffset.y,
      _state.hipsRest.z + hipsOffset.z
    );
  }
}

function _resetRestPose() {
  Object.keys(_state.restQuats).forEach((boneName) => {
    const bone = _state.bones[boneName];
    if (bone) bone.quaternion.copy(_state.restQuats[boneName]);
  });
  const hips = _state.bones[ROOT_BONE];
  if (hips) hips.position.set(_state.hipsRest.x, _state.hipsRest.y, _state.hipsRest.z);
}

function _trackFps(now) {
  const stamps = _state.frameStamps;
  stamps.push(now);
  while (stamps.length && (now - stamps[0]) > FPS_WINDOW_MS) stamps.shift();
  if (stamps.length < FPS_MIN_FRAMES) return;
  const span = (stamps[stamps.length - 1] - stamps[0]) / 1000;
  if (span <= 0) return;
  const fps = (stamps.length - 1) / span;
  if (fps < FPS_MIN && !_state.fpsLow) {
    _state.fpsLow = true;
    console.warn('[KFH-3D] FPS probe · sub-30fps detected (' + fps.toFixed(1) + ') — falling back to V2 SVG');
    if (typeof _state.onFallback === 'function') {
      try { _state.onFallback('low-fps'); } catch (e) {}
    }
  }
}

function _frame(now) {
  if (!_state.animation || !_state.loaded) { _state.rafId = null; return; }
  if (!_state.startTs) _state.startTs = now;
  const elapsed = now - _state.startTs;
  const dur = _state.animation.duration_ms || 2400;
  const t = (elapsed % dur) / dur;

  _applyFrame(t);
  _state.renderer.render(_state.scene, _state.camera);

  _trackFps(now);

  if (typeof requestAnimationFrame !== 'undefined') {
    _state.rafId = requestAnimationFrame(_frame);
  } else {
    _state.rafId = null;
  }
}

function startAnimation(animation, mode, opts) {
  stopAnimation();
  if (!animation || !_state.loaded) return false;
  _state.animation = animation;
  _state.mode = mode || 'ok';
  _state.startTs = 0;
  _state.frameStamps = [];
  _state.fpsLow = false;
  _state.onFallback = (opts && opts.onFallback) || null;

  if (typeof requestAnimationFrame === 'undefined') {
    console.warn('[KFH-3D] startAnimation: requestAnimationFrame unavailable');
    return false;
  }
  _state.rafId = requestAnimationFrame(_frame);
  console.log('%c[KFH-3D] animation driver started · mode=' + _state.mode,
              'color:#6a0dad;font-weight:bold');
  return true;
}

function stopAnimation(restPose) {
  if (_state.rafId != null && typeof cancelAnimationFrame !== 'undefined') {
    try { cancelAnimationFrame(_state.rafId); } catch (e) {}
  }
  _state.rafId = null;
  _state.animation = null;
  _state.frameStamps = [];
  if (restPose !== false) _resetRestPose();
}

function setAnimationMode(mode) {
  _state.mode = (mode === 'warn') ? 'warn' : 'ok';
}

function isAnimating() { return _state.rafId != null; }

const api = {
  init, render, resize, show, hide,
  isLoaded, getBones, getScene, getYBot,
  startAnimation, stopAnimation, setAnimationMode, isAnimating,
  SOVEREIGN
};

if (typeof window !== 'undefined') {
  window.BBF_KFH_3D_RENDERER = api;
}

export {
  init, render, resize, show, hide,
  isLoaded, getBones, getScene, getYBot,
  startAnimation, stopAnimation, setAnimationMode, isAnimating,
  SOVEREIGN
};
export default api;
