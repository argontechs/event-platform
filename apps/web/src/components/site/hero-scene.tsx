"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function Arch() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += delta * 0.15;
    // subtle parallax toward the pointer — "drag to explore" feel
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, state.pointer.y * 0.2, 0.04);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, state.pointer.x * 0.12, 0.04);
  });

  const lanterns = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return [Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0] as [number, number, number];
      }),
    [],
  );

  return (
    <group ref={group}>
      {/* Main blue event arch */}
      <mesh>
        <torusGeometry args={[1.6, 0.12, 32, 140]} />
        <meshStandardMaterial
          color="#2f6fed"
          metalness={0.95}
          roughness={0.2}
          emissive="#0b2a6b"
          emissiveIntensity={0.45}
        />
      </mesh>
      {/* Inner accent ring */}
      <mesh rotation={[0, 0, Math.PI / 2]} scale={0.62}>
        <torusGeometry args={[1.6, 0.04, 24, 140]} />
        <meshStandardMaterial color="#9cc3ff" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Floating light orbs around the arch */}
      {lanterns.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.07, 24, 24]} />
          <meshStandardMaterial
            color="#bfe0ff"
            emissive="#4f9bff"
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}
    </group>
  );
}

function Petals({ count = 160 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.2 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.03;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#8fb8ff"
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 4]} intensity={45} color="#cfe2ff" />
      <pointLight position={[-4, -2, -3]} intensity={26} color="#2f6fed" />
      <Arch />
      <Petals />
    </Canvas>
  );
}
