import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";

function Sculpture({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const y = 1 - (i / 499) * 2,
        radius = Math.sqrt(1 - y * y),
        angle = i * Math.PI * (3 - Math.sqrt(5));
      values.set(
        [
          Math.cos(angle) * radius * 2.2,
          y * 2.2,
          Math.sin(angle) * radius * 2.2,
        ],
        i * 3,
      );
    }
    return values;
  }, []);
  useFrame((_, delta) => {
    if (group.current && !still)
      group.current.rotation.y += Math.min(delta, 0.05) * 0.08;
  });
  return (
    <group ref={group} rotation={[0.25, 0, 0.3]}>
      <mesh>
        <sphereGeometry args={[2.12, 48, 32]} />
        <meshStandardMaterial color="#111a15" roughness={0.9} metalness={0.7} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[2.16, 3]} />
        <meshBasicMaterial
          color="#b7d78b"
          wireframe
          transparent
          opacity={0.16}
        />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.026}
          color="#dcf5b2"
          sizeAttenuation
          transparent
          opacity={0.8}
        />
      </points>
      {[0, 1, 2].map((n) => (
        <mesh key={n} rotation={[n * 0.7 + 0.4, n * 0.65, n * 0.3]}>
          <torusGeometry args={[2.6 + n * 0.12, 0.006, 8, 160]} />
          <meshBasicMaterial
            color={n === 1 ? "#d9f99d" : "#839367"}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
      <mesh position={[2.2, 0.5, 1.1]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color="#d9f99d" />
      </mesh>
    </group>
  );
}
export default function Orb() {
  const reduced = useReducedMotion();
  return (
    <div className="orb-canvas" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 7.7], fov: 43 }}
        dpr={[1, 1.5]}
        frameloop={reduced ? "demand" : "always"}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 3]} color="#d9f99d" intensity={2} />
        <Float
          speed={reduced ? 0 : 0.7}
          rotationIntensity={0.12}
          floatIntensity={0.4}
        >
          <Sculpture still={!!reduced} />
        </Float>
      </Canvas>
    </div>
  );
}
