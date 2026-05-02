'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { DrumPiece } from '@/lib/sound-engine';

const DC: Record<DrumPiece, { hex: number; css: string }> = {
  kick:  { hex: 0xfb923c, css: '#fb923c' },
  snare: { hex: 0x22d3ee, css: '#22d3ee' },
  hihat: { hex: 0xfacc15, css: '#facc15' },
  crash: { hex: 0xf87171, css: '#f87171' },
  tabla_bayan: { hex: 0xbb9977, css: '#bb9977' },
  tabla_dayan: { hex: 0xffddbb, css: '#ffddbb' },
};

export interface DrumstickSceneProps {
  mode: 'drum' | 'guitar' | 'tabla';
  r1gx: number; r1gy: number; r1gz: number;
  r1HitPiece: DrumPiece | null; r1HitVersion: number; r1Connected: boolean;
  r2gx: number; r2gy: number; r2gz: number;
  r2HitPiece: DrumPiece | null; r2HitVersion: number; r2Connected: boolean;
}

// ── Background ────────────────────────────────────────────────────
function Starfield() {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) {
      a[i * 3]     = (Math.random() - 0.5) * 100;
      a[i * 3 + 1] = (Math.random() - 0.5) * 60;
      a[i * 3 + 2] = -15 - Math.random() * 40;
    }
    return a;
  }, []);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.z += d * 0.008; });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color="#8888ff" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function GlowFloor() {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(0);
  useFrame((_, d) => {
    t.current += d;
    if (matRef.current) matRef.current.opacity = 0.08 + Math.sin(t.current * 0.4) * 0.03;
  });
  return (
    <mesh position={[0, -2.1, -5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[30, 30, 24, 24]} />
      <meshBasicMaterial ref={matRef} color="#3a3aff" wireframe transparent opacity={0.08} />
    </mesh>
  );
}

// ── Instruments ───────────────────────────────────────────────────

function DrumInstrument({ piece, hitPiece, hitVersion, position, rotation = [0, 0, 0] }: 
  { piece: DrumPiece; hitPiece: DrumPiece | null; hitVersion: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const mat1 = useRef<THREE.MeshStandardMaterial>(null);
  const mat2 = useRef<THREE.MeshStandardMaterial>(null);
  const mat3 = useRef<THREE.MeshStandardMaterial>(null);

  const spring = useRef(1.0);
  const glow   = useRef(0.0);
  const prevV  = useRef(-1);

  useEffect(() => {
    if (hitVersion > 0 && hitVersion !== prevV.current && hitPiece === piece) {
      prevV.current = hitVersion;
      spring.current = 1.18;
      glow.current   = 1.0;
    }
  }, [hitVersion, hitPiece, piece]);

  useFrame((_, d) => {
    spring.current = THREE.MathUtils.lerp(spring.current, 1.0, d * 9);
    glow.current   = THREE.MathUtils.lerp(glow.current,   0,   d * 3);
    if (groupRef.current) groupRef.current.scale.setScalar(spring.current);
    if (lightRef.current) lightRef.current.intensity = glow.current * 10;
    const g = glow.current;
    if (mat1.current) mat1.current.emissiveIntensity = g;
    if (mat2.current) mat2.current.emissiveIntensity = g;
    if (mat3.current) mat3.current.emissiveIntensity = g * 0.6;
  });

  const { css, hex } = DC[piece];

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <pointLight ref={lightRef} color={hex} intensity={0} distance={4} />

      {piece === 'kick' && (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.75, 0.75, 0.55, 36]} />
            <meshStandardMaterial ref={mat1} color="#180a00" emissive={css} emissiveIntensity={0} roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0.29, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <circleGeometry args={[0.74, 36]} />
            <meshStandardMaterial ref={mat2} color="#221100" emissive={css} emissiveIntensity={0} roughness={0.8} />
          </mesh>
          <mesh position={[0.31, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <ringGeometry args={[0.58, 0.72, 36]} />
            <meshStandardMaterial ref={mat3} color={css} emissive={css} emissiveIntensity={0} metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      )}

      {piece === 'snare' && (
        <group>
          <mesh castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.22, 32]} />
            <meshStandardMaterial ref={mat1} color="#08101e" emissive={css} emissiveIntensity={0} metalness={0.55} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <circleGeometry args={[0.38, 32]} />
            <meshStandardMaterial ref={mat2} color="#0d1828" emissive={css} emissiveIntensity={0} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.115, 0]}>
            <ringGeometry args={[0.36, 0.42, 32]} />
            <meshStandardMaterial ref={mat3} color="#aaa" emissive={css} emissiveIntensity={0} metalness={0.95} roughness={0.05} />
          </mesh>
        </group>
      )}

      {piece === 'hihat' && (
        <group>
          {([0.1, -0.04] as const).map((y, i) => (
            <mesh key={i} position={[0, y, 0]} rotation={[i === 0 ? 0.06 : -0.02, 0, 0]} castShadow>
              <cylinderGeometry args={[0.34, 0.28, 0.025, 36]} />
              <meshStandardMaterial ref={i === 0 ? mat1 : mat2} color="#120f00" emissive={css} emissiveIntensity={0} metalness={0.85} roughness={0.15} />
            </mesh>
          ))}
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.9, 8]} />
            <meshStandardMaterial color="#444" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      )}

      {piece === 'crash' && (
        <mesh castShadow rotation={[0.08, 0, 0.1]}>
          <cylinderGeometry args={[0.6, 0.52, 0.022, 48]} />
          <meshStandardMaterial ref={mat1} color="#100800" emissive={css} emissiveIntensity={0} metalness={0.9} roughness={0.1} />
        </mesh>
      )}

      {piece === 'tabla_bayan' && (
        <group position={[0, 0.1, 0]}>
          {/* Metallic Bowl (Hemisphere) */}
          <mesh castShadow rotation={[0, 0, 0]}>
            <sphereGeometry args={[0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial ref={mat1} color="#b87333" emissive={css} emissiveIntensity={0} metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Top skin */}
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.45, 32]} />
            <meshStandardMaterial color="#e6d5c3" roughness={0.9} />
          </mesh>
          {/* Syahi (Black patch) - off-center for Bayan */}
          <mesh position={[-0.15, 0.01, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.15, 32]} />
            <meshStandardMaterial ref={mat2} color="#111" emissive={css} emissiveIntensity={0} roughness={0.8} />
          </mesh>
          {/* Base ring */}
          <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.04, 16, 32]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      )}

      {piece === 'tabla_dayan' && (
        <group position={[0, 0.15, 0]}>
          {/* Wooden Tapered Body */}
          <mesh castShadow position={[0, -0.25, 0]}>
            <cylinderGeometry args={[0.3, 0.35, 0.5, 32]} />
            <meshStandardMaterial ref={mat1} color="#5c3a21" emissive={css} emissiveIntensity={0} metalness={0.1} roughness={0.8} />
          </mesh>
          {/* Top skin */}
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.3, 32]} />
            <meshStandardMaterial color="#e6d5c3" roughness={0.9} />
          </mesh>
          {/* Syahi (Black patch) - centered for Dayan */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.15, 32]} />
            <meshStandardMaterial ref={mat2} color="#111" emissive={css} emissiveIntensity={0} roughness={0.8} />
          </mesh>
          {/* Base ring */}
          <mesh position={[0, -0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.18, 0.04, 16, 32]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      )}

      <Text position={[0, -0.95, 0]} fontSize={0.1} color={css || '#ffffff'} anchorX="center" anchorY="middle" fillOpacity={0.45}>
        {piece.replace('_', ' ').toUpperCase()}
      </Text>
    </group>
  );
}

function GuitarInstrument() {
  const groupRef = useRef<THREE.Group>(null);
  
  // A simple stylized acoustic guitar
  return (
    <group ref={groupRef} position={[0, -0.5, -2]} rotation={[-0.2, 0, 0.2]}>
      {/* Guitar Body */}
      <group position={[0, 0, 0]}>
        <mesh castShadow position={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.8, 0.8, 0.2, 32]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.6} />
        </mesh>
        <mesh castShadow position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.6, 0.6, 0.2, 32]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.6} />
        </mesh>
        {/* Sound hole */}
        <mesh position={[0, 0.2, 0.11]}>
          <circleGeometry args={[0.25, 32]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* Bridge */}
        <mesh position={[0, -0.6, 0.11]}>
          <boxGeometry args={[0.4, 0.1, 0.05]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>

      {/* Guitar Neck */}
      <mesh castShadow position={[0, 1.8, 0]}>
        <boxGeometry args={[0.25, 2.0, 0.1]} />
        <meshStandardMaterial color="#5c3a21" roughness={0.7} />
      </mesh>
      
      {/* Headstock */}
      <mesh castShadow position={[0, 2.9, 0]}>
        <boxGeometry args={[0.35, 0.4, 0.1]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.7} />
      </mesh>

      {/* Strings */}
      {[...Array(6)].map((_, i) => (
        <mesh key={i} position={[-0.1 + i * 0.04, 1.0, 0.08]}>
          <cylinderGeometry args={[0.003, 0.003, 3.2, 4]} />
          <meshStandardMaterial color="#eee" metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ── Avatars (Stick & Hand) ────────────────────────────────────────

interface Particle { pos: THREE.Vector3; vel: THREE.Vector3; life: number; maxLife: number; scale: number; col: number }

function AvatarFX({ gx, gy, gz, hitPiece, hitVersion, offsetX, label, isHand = false, handPos }: 
  { gx: number; gy: number; gz: number; hitPiece: DrumPiece | null; hitVersion: number; offsetX: number; label: string; isHand?: boolean; handPos?: [number, number, number] }) {
  
  const grp     = useRef<THREE.Group>(null);
  const light   = useRef<THREE.PointLight>(null);
  const swRef   = useRef<THREE.Mesh>(null);
  const instRef = useRef<THREE.InstancedMesh>(null);
  const tipMat  = useRef<THREE.MeshStandardMaterial>(null);
  const handMat = useRef<THREE.MeshStandardMaterial>(null);
  const MAX     = 60;
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const dcol    = useMemo(() => new THREE.Color(), []);
  const tRot    = useRef({ x: 0, y: 0, z: 0 });
  const glow    = useRef(2.0);
  const parts   = useRef<Particle[]>([]);
  const wave    = useRef<{ scale: number; opacity: number; col: number } | null>(null);
  const prevV   = useRef(-1);

  // Apply positions
  const basePos: [number, number, number] = handPos || [offsetX, 0.5, 0];

  useEffect(() => {
    tRot.current = { x: -gx * 0.003, y: -gy * 0.003, z: gz * 0.003 };
  }, [gx, gy, gz]);

  useEffect(() => {
    if (hitVersion === 0 || hitVersion === prevV.current) return;
    prevV.current = hitVersion;
    const c = hitPiece ? DC[hitPiece].hex : 0x818cf8;
    const n = hitPiece === 'crash' ? 70 : 45;
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI, sp = 0.04 + Math.random() * 0.09;
      parts.current.push({
        pos: new THREE.Vector3(0, 0.68, 0),
        vel: new THREE.Vector3(Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.sin(ph) * Math.sin(th)) * sp + 0.03, Math.cos(ph) * sp),
        life: 1, maxLife: 0.5 + Math.random() * 0.7, scale: 0.012 + Math.random() * 0.022, col: c,
      });
      if (parts.current.length > MAX) parts.current.shift();
    }
    wave.current = { scale: 0.05, opacity: 0.9, col: c };
    glow.current = 10;
  }, [hitVersion, hitPiece]);

  useFrame((_, d) => {
    if (!grp.current) return;
    const L = 1 - Math.pow(0.006, d);
    grp.current.rotation.x = THREE.MathUtils.lerp(grp.current.rotation.x, tRot.current.x, L);
    grp.current.rotation.y = THREE.MathUtils.lerp(grp.current.rotation.y, tRot.current.y, L);
    grp.current.rotation.z = THREE.MathUtils.lerp(grp.current.rotation.z, tRot.current.z, L);
    glow.current = THREE.MathUtils.lerp(glow.current, 2, d * 4);
    if (light.current) light.current.intensity = glow.current;
    const tipCss = hitPiece ? DC[hitPiece].css : '#818cf8';
    
    if (tipMat.current) {
      tipMat.current.color.set(tipCss);
      tipMat.current.emissive.set(tipCss);
      tipMat.current.emissiveIntensity = glow.current * 0.12;
    }
    
    if (handMat.current) {
      handMat.current.emissive.set(tipCss);
      handMat.current.emissiveIntensity = glow.current * 0.05;
    }

    // particles
    const mesh = instRef.current;
    if (mesh) {
      parts.current = parts.current.filter(p => p.life > 0);
      parts.current.forEach((p, i) => {
        p.life -= d / p.maxLife; p.vel.y -= d * 0.12; p.pos.add(p.vel);
        dummy.position.copy(p.pos); dummy.scale.setScalar(p.scale * Math.max(0, p.life)); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        dcol.setHex(p.col).lerp(new THREE.Color(0), 1 - Math.max(0, p.life));
        mesh.setColorAt(i, dcol);
      });
      for (let i = parts.current.length; i < MAX; i++) {
        dummy.scale.setScalar(0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    // shockwave
    const sw = wave.current;
    if (sw && swRef.current) {
      sw.scale += d * 4.5; sw.opacity -= d * 2.8;
      swRef.current.scale.setScalar(sw.scale);
      (swRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, sw.opacity);
      if (sw.opacity <= 0) { wave.current = null; swRef.current.scale.setScalar(0); }
    }
  });

  const tipHex = hitPiece ? DC[hitPiece].hex : 0x818cf8;

  return (
    <group ref={grp} position={basePos}>
      
      {!isHand ? (
        // --- DRUMSTICK ---
        <>
          <mesh castShadow>
            <cylinderGeometry args={[0.016, 0.03, 1.3, 16]} />
            <meshStandardMaterial color="#c8a060" roughness={0.35} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.68, 0]}>
            <sphereGeometry args={[0.042, 20, 20]} />
            <meshStandardMaterial ref={tipMat} color="#818cf8" emissive="#818cf8" emissiveIntensity={0.9} roughness={0.15} metalness={0.7} />
          </mesh>
        </>
      ) : (
        // --- HAND ---
        // A stylized robotic/geometric hand
        <group position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Palm */}
          <mesh castShadow position={[0, 0, 0]}>
            <boxGeometry args={[0.2, 0.25, 0.04]} />
            <meshStandardMaterial ref={handMat} color="#334455" roughness={0.4} metalness={0.6} />
          </mesh>
          {/* Fingers */}
          {[...Array(4)].map((_, i) => (
            <mesh key={i} castShadow position={[-0.075 + i * 0.05, 0.18, 0]}>
              <capsuleGeometry args={[0.02, 0.1 - Math.abs(i - 1.5) * 0.02, 4, 8]} />
              <meshStandardMaterial color="#445566" roughness={0.5} metalness={0.5} />
            </mesh>
          ))}
          {/* Thumb */}
          <mesh castShadow position={[0.12, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <capsuleGeometry args={[0.025, 0.08, 4, 8]} />
            <meshStandardMaterial color="#445566" roughness={0.5} metalness={0.5} />
          </mesh>
        </group>
      )}

      <pointLight ref={light} position={[0, 0.68, 0]} intensity={2} distance={2.5} color={tipHex} />
      <Text position={[0, -0.85, 0]} fontSize={0.13} color="#4b5563" anchorX="center" anchorY="middle">
        {label}
      </Text>
      
      {/* Particles */}
      <instancedMesh ref={instRef} args={[undefined, undefined, MAX]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial vertexColors transparent />
      </instancedMesh>
      
      {/* Shockwave */}
      <mesh ref={swRef} position={[0, 0.65, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0}>
        <torusGeometry args={[0.3, 0.011, 8, 48]} />
        <meshBasicMaterial color={tipHex} transparent opacity={0} />
      </mesh>
    </group>
  );
}

// ── Scene ─────────────────────────────────────────────────────────
function Scene(props: DrumstickSceneProps) {
  const { mode, r1gx, r1gy, r1gz, r1HitPiece, r1HitVersion,
          r2gx, r2gy, r2gz, r2HitPiece, r2HitVersion } = props;

  const hitPiece   = r1HitPiece ?? r2HitPiece;
  const hitVersion = r1HitVersion + r2HitVersion;

  return (
    <>
      <color attach="background" args={['#06060f']} />
      <fog attach="fog" args={['#06060f', 14, 38]} />
      <Starfield />
      <GlowFloor />

      <ambientLight intensity={0.22} color="#6060ff" />
      <directionalLight position={[5, 8, 4]} intensity={1.1} castShadow />
      <directionalLight position={[-5, 3, -3]} intensity={0.3} color="#4040ff" />
      <pointLight position={[0, 5, 2]} intensity={0.9} color="#ffffff" />

      {/* ── DRUM MODE ── */}
      {mode === 'drum' && (
        <>
          <DrumInstrument piece="kick"  position={[0,    -1.1, -3.2]} hitPiece={hitPiece} hitVersion={hitVersion} />
          <DrumInstrument piece="snare" position={[-1.8, -0.8, -2.0]} hitPiece={hitPiece} hitVersion={hitVersion} />
          <DrumInstrument piece="hihat" position={[1.8,   0.0, -2.0]} hitPiece={hitPiece} hitVersion={hitVersion} />
          <DrumInstrument piece="crash" position={[2.8,   0.8, -2.8]} hitPiece={hitPiece} hitVersion={hitVersion} rotation={[0.05, -0.3, 0.08]} />
          
          {/* Note: Ring 1 (Right Hand) gets positive X, Ring 2 (Left Hand) gets negative X */}
          <AvatarFX gx={r1gx} gy={r1gy} gz={r1gz} hitPiece={r1HitPiece} hitVersion={r1HitVersion} offsetX={-1.1} label="L" />
          <AvatarFX gx={r2gx} gy={r2gy} gz={r2gz} hitPiece={r2HitPiece} hitVersion={r2HitVersion} offsetX={1.1}  label="R" />
        </>
      )}

      {/* ── TABLA MODE ── */}
      {mode === 'tabla' && (
        <>
          {/* Bayan (Left Bass) and Dayan (Right Treble) */}
          <DrumInstrument piece="tabla_bayan" position={[-0.8, -0.6, -1.8]} hitPiece={hitPiece} hitVersion={hitVersion} />
          <DrumInstrument piece="tabla_dayan" position={[0.8, -0.6, -1.8]} hitPiece={hitPiece} hitVersion={hitVersion} />
          
          <AvatarFX isHand gx={r1gx} gy={r1gy} gz={r1gz} hitPiece={r1HitPiece} hitVersion={r1HitVersion} offsetX={-0.8} label="L" />
          <AvatarFX isHand gx={r2gx} gy={r2gy} gz={r2gz} hitPiece={r2HitPiece} hitVersion={r2HitVersion} offsetX={0.8}  label="R" />
        </>
      )}

      {/* ── GUITAR MODE ── */}
      {mode === 'guitar' && (
        <>
          <GuitarInstrument />
          {/* Position hands near the guitar: Left hand on neck, Right hand on body */}
          <AvatarFX isHand gx={r1gx} gy={r1gy} gz={r1gz} hitPiece={r1HitPiece} hitVersion={r1HitVersion} offsetX={0} handPos={[-0.3, 0.8, -1.2]} label="L" />
          <AvatarFX isHand gx={r2gx} gy={r2gy} gz={r2gz} hitPiece={r2HitPiece} hitVersion={r2HitVersion} offsetX={0} handPos={[0.5, 0.0, -1.0]}  label="R" />
        </>
      )}

      <OrbitControls enableZoom={false} enablePan={false}
        minPolarAngle={Math.PI * 0.28} maxPolarAngle={Math.PI * 0.72}
        autoRotate={r1gx === 0 && r1gy === 0 && r1gz === 0 && r2gx === 0 && r2gy === 0 && r2gz === 0}
        autoRotateSpeed={0.4}
      />
    </>
  );
}

// ── Exported canvas ───────────────────────────────────────────────
export function DrumstickScene(props: DrumstickSceneProps) {
  return (
    <Canvas camera={{ position: [0, 1.5, 5.5], fov: 50 }} gl={{ antialias: true }} shadows
      style={{ width: '100%', height: '100%' }}>
      <Scene {...props} />
    </Canvas>
  );
}

// ── Idle demo ─────────────────────────────────────────────────────
export function DrumstickSceneIdle() {
  const pieces: DrumPiece[] = ['kick', 'snare', 'hihat', 'crash'];
  const [r1, setR1] = useState<{ piece: DrumPiece; version: number }>({ piece: 'kick', version: 0 });
  const [r2, setR2] = useState<{ piece: DrumPiece; version: number }>({ piece: 'snare', version: 0 });

  useEffect(() => {
    let idx = 0; let tog = false;
    const t = setInterval(() => {
      idx = (idx + 1) % pieces.length; tog = !tog;
      if (tog) setR1({ piece: pieces[idx], version: Date.now() });
      else     setR2({ piece: pieces[idx], version: Date.now() });
    }, 1400);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <DrumstickScene
    mode="drum"
    r1gx={0} r1gy={0} r1gz={0} r1HitPiece={r1.piece} r1HitVersion={r1.version} r1Connected={false}
    r2gx={0} r2gy={0} r2gz={0} r2HitPiece={r2.piece} r2HitVersion={r2.version} r2Connected={false}
  />;
}
