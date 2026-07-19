// src/components/command/AnatomyViewport3D.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Anatomy Arena · 3D Biomechanical Viewport (React Three Fiber).
//
// The heavy WebGL layer — lazy-loaded by BiomechanicsViewer so three/drei never
// touch the main bundle. Renders a procedural biomechanical rig (skeletal /
// muscular / neurological groups) with five interactive gold joint nodes; a click
// raycasts (R3F pointer events), emissive-highlights, and Drei <Bounds> zooms to
// the node. A Draco-decoded Z-Anatomy GLB drops in via <Suspense> the moment
// MODEL_URL is set — until then the procedural rig is the fallback.

import { Component, Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Bounds, useBounds, OrbitControls, useGLTF } from '@react-three/drei';
import { ANATOMY_JOINTS } from './anatomyViewerData.js';

// The Biomechanics mesh source. Points at the LOCAL web-served file — drop
// model.glb into frontend/public/anatomy/ (see download_anatomy.py) and it loads
// via Suspense/Draco (decoder served locally from /draco/ — no CDN). Until the
// file exists the loader falls back to the procedural rig (see ModelBoundary), so
// this reference is safe to ship: add the GLB + redeploy and the mesh appears with
// no code change. A Supabase anatomy-assets bucket URL works here too. Set null to
// force the procedural rig.
const MODEL_URL = '/anatomy/model.glb';

// ── Procedural biomechanical rig ─────────────────────────────────────────────
function Skeletal({ visible }) {
  const mat = { color: '#90caf9', roughness: 0.1, metalness: 0.9, wireframe: true };
  return (
    <group visible={visible}>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.12, 0.15, 4, 8]} /><meshStandardMaterial {...mat} /></mesh>
      <mesh position={[0, 2, 0]}><coneGeometry args={[1.2, 2.2, 10, 5, true]} /><meshStandardMaterial {...mat} /></mesh>
      <mesh position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.8, 0.15, 6, 12]} /><meshStandardMaterial {...mat} /></mesh>
      <mesh position={[0, 2.8, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.08, 0.08, 2.6, 8]} /><meshStandardMaterial {...mat} /></mesh>
      {[-0.6, 0.6].map((x) => <mesh key={`f${x}`} position={[x, -1.6, 0]}><cylinderGeometry args={[0.15, 0.12, 2.2, 8]} /><meshStandardMaterial {...mat} /></mesh>)}
      {[-0.6, 0.6].map((x) => <mesh key={`t${x}`} position={[x, -3.8, 0]}><cylinderGeometry args={[0.12, 0.08, 2.2, 8]} /><meshStandardMaterial {...mat} /></mesh>)}
      <mesh position={[0, 3.5, 0]}><boxGeometry args={[0.7, 0.9, 0.7]} /><meshStandardMaterial {...mat} /></mesh>
    </group>
  );
}

function Muscular({ visible }) {
  const mat = { color: '#ef5350', roughness: 0.4, metalness: 0.1, opacity: 0.65, transparent: true };
  return (
    <group visible={visible}>
      <mesh position={[0, 1, -0.3]}><boxGeometry args={[0.6, 1.8, 0.4]} /><meshStandardMaterial {...mat} /></mesh>
      {[-0.4, 0.4].map((x) => <mesh key={`g${x}`} position={[x, -0.6, -0.3]}><sphereGeometry args={[0.5, 8, 8]} /><meshStandardMaterial {...mat} /></mesh>)}
      {[-0.6, 0.6].map((x) => <mesh key={`q${x}`} position={[x, -1.6, 0.15]}><cylinderGeometry args={[0.24, 0.2, 1.8, 8]} /><meshStandardMaterial {...mat} /></mesh>)}
    </group>
  );
}

function Neurological({ visible }) {
  const mat = { color: '#ffeb3b', wireframe: true };
  return (
    <group visible={visible}>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.04, 0.04, 4.2, 8]} /><meshBasicMaterial {...mat} /></mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i}>
          <mesh position={[-0.7, 0.6 + i * 0.4, 0]} rotation={[0, 0, Math.PI / 2.2]}><cylinderGeometry args={[0.015, 0.005, 1.8, 4]} /><meshBasicMaterial {...mat} /></mesh>
          <mesh position={[0.7, 0.6 + i * 0.4, 0]} rotation={[0, 0, -Math.PI / 2.2]}><cylinderGeometry args={[0.015, 0.005, 1.8, 4]} /><meshBasicMaterial {...mat} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ── Interactive joint node ───────────────────────────────────────────────────
// A subtle raycast anchor sized to the REAL mesh scale (meters): a ~2.6 cm bead,
// small enough to sit on a knee/hip without swallowing the joint. It grows and
// brightens on hover/active so it stays discoverable without being loud.
const NODE_RADIUS = 0.026;
function JointNode({ id, position, active, onSelect }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const bounds = useBounds();
  const emissive = active ? '#ffeb3b' : hovered ? '#ff00ff' : '#4a0080';
  return (
    <mesh
      ref={ref}
      position={position}
      scale={active ? 1.5 : hovered ? 1.25 : 1}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      onClick={(e) => { e.stopPropagation(); onSelect(id); if (ref.current) bounds.refresh(ref.current).fit(); }}
    >
      <sphereGeometry args={[NODE_RADIUS, 20, 20]} />
      <meshStandardMaterial
        color={active ? '#ffeb3b' : '#f5c800'}
        roughness={0.2}
        metalness={0.85}
        emissive={emissive}
        emissiveIntensity={active ? 0.85 : hovered ? 0.55 : 0.18}
      />
    </mesh>
  );
}

// Re-fit the whole rig on reset (and on first mount).
function BoundsController({ resetSignal }) {
  const bounds = useBounds();
  useEffect(() => { bounds.refresh().clip().fit(); }, [resetSignal, bounds]);
  return null;
}

// Draco-decoded Z-Anatomy mesh — only mounted when MODEL_URL is configured.
function ZAnatomyModel({ url }) {
  const { scene } = useGLTF(url, '/draco/');
  return <primitive object={scene} />;
}

// The procedural biomechanical rig — the always-safe fallback.
function ProceduralRig({ systems }) {
  return (
    <>
      <Skeletal visible={systems.skeletal} />
      <Muscular visible={systems.muscular} />
      <Neurological visible={systems.neurological} />
    </>
  );
}

// If the GLB is missing / fails to decode, render the procedural rig instead of
// tearing down the whole viewport — so MODEL_URL is safe to ship before the file
// lands (it just shows procedural until the mesh is present).
class ModelBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* non-fatal — procedural rig backstops */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function AnatomyViewport3D({ systems, activeSegment, onSelect, resetSignal }) {
  return (
    <Canvas
      className="av-canvas"
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ position: [0, 3, 10], fov: 45, near: 0.1, far: 100 }}
    >
      <color attach="background" args={['#07000f']} />
      <fogExp2 attach="fog" args={['#07000f', 0.04]} />

      <ambientLight color="#221144" intensity={1.2} />
      <directionalLight color="#f5c800" intensity={1.5} position={[5, 10, 5]} />
      <directionalLight color="#6a0dad" intensity={2.0} position={[-5, 2, -5]} />
      {/* Ground plane at the mesh's foot level (y≈0), sized to the ~1.7 m figure. */}
      <gridHelper args={[4, 16, '#6a0dad', '#160026']} position={[0, 0, 0]} />

      <Bounds fit clip margin={1.2}>
        <BoundsController resetSignal={resetSignal} />
        {MODEL_URL ? (
          <ModelBoundary fallback={<ProceduralRig systems={systems} />}>
            <Suspense fallback={<ProceduralRig systems={systems} />}>
              <ZAnatomyModel url={MODEL_URL} />
            </Suspense>
          </ModelBoundary>
        ) : (
          <ProceduralRig systems={systems} />
        )}
        {ANATOMY_JOINTS.map((j) => (
          <JointNode key={j.id} id={j.id} position={j.position} active={activeSegment === j.id} onSelect={onSelect} />
        ))}
      </Bounds>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        // Trackpad-first interaction: one-finger drag / left-drag orbits with
        // smooth damping; two-finger trackpad scroll dollies to the cursor; pan
        // is always available (two-finger touch, or right-drag / shift-drag).
        enablePan
        enableZoom
        enableRotate
        screenSpacePanning
        zoomToCursor
        rotateSpeed={0.65}
        panSpeed={0.8}
        zoomSpeed={0.9}
        // Scaled for the ~1.7 m mesh (meters): close inspection down to 0.4 m.
        minDistance={0.4}
        maxDistance={8}
        maxPolarAngle={Math.PI / 1.8}
        target={[0, 0.9, 0]}
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        autoRotate={!activeSegment}
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
