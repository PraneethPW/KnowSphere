import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
function Reactor({ still }: { still: boolean }) {
  const inner = useRef<THREE.Group>(null),
    outer = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!still) {
      if (inner.current) {
        inner.current.rotation.y += Math.min(delta, 0.05) * 0.13;
        inner.current.rotation.x += Math.min(delta, 0.05) * 0.05;
      }
      if (outer.current)
        outer.current.rotation.z -= Math.min(delta, 0.05) * 0.035;
    }
  });
  return (
    <group rotation={[0.35, 0.3, -0.35]}>
      <group ref={inner}>
        <mesh>
          <icosahedronGeometry args={[1.13, 1]} />
          <meshStandardMaterial
            color="#073d50"
            metalness={0.8}
            roughness={0.3}
            flatShading
            emissive="#096178"
            emissiveIntensity={0.35}
          />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[1.16, 1]} />
          <meshBasicMaterial
            color="#38e8f2"
            wireframe
            transparent
            opacity={0.7}
          />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[1.48, 1]} />
          <meshBasicMaterial
            color="#38e8f2"
            wireframe
            transparent
            opacity={0.13}
          />
        </mesh>
      </group>
      <group ref={outer}>
        {[0, 1, 2].map((n) => (
          <group key={n} rotation={[n * 0.8, n * 0.55, 0]}>
            <mesh>
              <torusGeometry args={[1.85 + n * 0.25, 0.018, 8, 128]} />
              <meshBasicMaterial
                color={n === 1 ? "#ff8450" : "#29cee4"}
                transparent
                opacity={n === 1 ? 0.9 : 0.5}
              />
            </mesh>
            {Array.from({ length: 28 }, (_, i) => {
              const a = (i / 28) * Math.PI * 2;
              return (
                <mesh
                  key={i}
                  position={[
                    Math.cos(a) * (1.85 + n * 0.25),
                    Math.sin(a) * (1.85 + n * 0.25),
                    0,
                  ]}
                  rotation={[0, 0, a]}
                >
                  <boxGeometry args={[0.06, 0.018, 0.045]} />
                  <meshBasicMaterial color={n === 1 ? "#ff8450" : "#38e8f2"} />
                </mesh>
              );
            })}
          </group>
        ))}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.55, 0.004, 6, 128]} />
        <meshBasicMaterial color="#27788c" />
      </mesh>
    </group>
  );
}
export default function Orb() {
  const reduced = useReducedMotion();
  return (
    <div className="orb-canvas" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 7.8], fov: 43 }}
        dpr={[1, 1.5]}
        frameloop={reduced ? "demand" : "always"}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.2} />
        <pointLight position={[3, 4, 4]} intensity={70} color="#7cf2ff" />
        <pointLight position={[-3, -2, 2]} intensity={25} color="#ff7744" />
        <Reactor still={!!reduced} />
        <OrbitControls enablePan={false} enableZoom={false} />
      </Canvas>
    </div>
  );
}
