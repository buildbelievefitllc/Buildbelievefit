// ═══════════════════════════════════════════════════════════════
// KFH-3D-RENDERER.JS — BBF Kinematic Form HUD V3 Renderer (ESM)
// Sovereign Gold Standard — Phase 13 / B3-2
//
// Boots a Clinical Studio three.js scene, loads the YBot rig
// (Adobe Mixamo) into a WebGL canvas, applies the Sovereign
// Material Override (Matte Black + Purple emissive), and harvests
// the rig's bone manifest for Path A mapping verification.
//
// B3-2 SCOPE
//   - Static T-pose render only. No animation. No V2 Blueprint
//     wiring yet. Path A driver lives in kfh-3d-rig-bridge.js
//     and lands wired in B3-3 (Barbell Back Squat pilot).
//   - Canvas hidden by default (HTML `hidden` attribute). Toggle
//     via window.BBF_KFH_3D_RENDERER.show() once the IIFE switch
//     wires up in B3-3.
//
// SOVEREIGN PALETTE (locked — never deviate)
//   matte black 0x090909 · BBF purple 0x6a0dad · BBF gold 0xf5c800
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
  loaded:      false
};

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
  console.log('[KFH-3D] full bone list:', names);
  const sorted = names.slice().sort();
  sorted.forEach((n, i) => {
    console.log('[KFH-3D] bone[' + String(i).padStart(3, '0') + ']:', n);
  });
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

          // Single static render — canvas may be hidden but the
          // backing WebGL surface is primed for when the IIFE
          // shows it in B3-3.
          _state.renderer.render(_state.scene, _state.camera);
          console.log(
            '%c[KFH-3D] static T-pose render complete · canvas hidden until B3-3',
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

function show() {
  if (_state.canvas) _state.canvas.hidden = false;
  render();
}

function hide() {
  if (_state.canvas) _state.canvas.hidden = true;
}

function isLoaded() { return _state.loaded; }
function getBones() { return _state.bones; }
function getScene() { return _state.scene; }
function getYBot()  { return _state.ybot; }

const api = {
  init, render, show, hide,
  isLoaded, getBones, getScene, getYBot,
  SOVEREIGN
};

if (typeof window !== 'undefined') {
  window.BBF_KFH_3D_RENDERER = api;
}

export {
  init, render, show, hide,
  isLoaded, getBones, getScene, getYBot,
  SOVEREIGN
};
export default api;
