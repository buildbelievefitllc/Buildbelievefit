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

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, useBounds, OrbitControls, useGLTF } from '@react-three/drei';
import { ANATOMY_JOINTS } from './anatomyViewerData.js';

// Null until a Z-Anatomy GLB is uploaded to the anatomy-assets bucket. When set,
// the mesh loads via Suspense/Draco (decoder served locally from /draco/ — no CDN).
const MODEL_URL = null;

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
function JointNode({ id, position, active, onSelect }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const bounds = useBounds();
  const emissive = active ? '#ffeb3b' : hovered ? '#ff00ff' : '#4a0080';
  return (
    <mesh
      ref={ref}
      position={position}
      scale={active ? 1.4 : 1}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      onClick={(e) => { e.stopPropagation(); onSelect(id); if (ref.current) bounds.refresh(ref.current).fit(); }}
    >
      <sphereGeometry args={[0.22, 24, 24]} />
      <meshStandardMaterial
        color={active ? '#ffeb3b' : '#f5c800'}
        roughness={0.15}
        metalness={0.9}
        emissive={emissive}
        emissiveIntensity={active ? 0.9 : hovered ? 0.8 : 0.2}
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
      <gridHelper args={[30, 30, '#6a0dad', '#160026']} position={[0, -2, 0]} />

      <Bounds fit clip margin={1.2}>
        <BoundsController resetSignal={resetSignal} />
        {MODEL_URL ? (
          <Suspense fallback={null}>
            <ZAnatomyModel url={MODEL_URL} />
          </Suspense>
        ) : (
          <>
            <Skeletal visible={systems.skeletal} />
            <Muscular visible={systems.muscular} />
            <Neurological visible={systems.neurological} />
          </>
        )}
        {ANATOMY_JOINTS.map((j) => (
          <JointNode key={j.id} id={j.id} position={j.position} active={activeSegment === j.id} onSelect={onSelect} />
        ))}
      </Bounds>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={20}
        maxPolarAngle={Math.PI / 1.8}
        target={[0, 1, 0]}
        autoRotate={!activeSegment}
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
