import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import type { GraphLink, GraphNode } from "../types";
import { KIND_COLORS } from "../types";

function Scene({
  nodes,
  links,
  selected,
  onSelect,
  positions,
  labels,
  reset,
  fresh,
  path,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  selected: string;
  onSelect: (id: string) => void;
  positions: Map<string, [number, number, number]>;
  labels: boolean;
  reset: number;
  fresh: Set<string>;
  path: string[];
}) {
  const [hovered, setHovered] = useState(""),
    group = useRef<THREE.Group>(null),
    controls = useRef<OrbitControlsType>(null);
  const reduced = useReducedMotion(),
    { camera, size } = useThree();
  useEffect(() => {
    const radius =
      Math.max(2, ...Array.from(positions.values(), (p) => Math.hypot(...p))) +
      0.7;
    const vertical = THREE.MathUtils.degToRad(45);
    const horizontal =
      2 *
      Math.atan(
        (Math.tan(vertical / 2) * size.width) / Math.max(size.height, 1),
      );
    const distance =
      (radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.12;
    camera.position.set(0, 0, distance);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
  }, [reset, camera, positions, size.width, size.height]);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 12, 12), []);
  useEffect(() => () => sphere.dispose(), [sphere]);
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);
  useFrame((_, delta) => {
    if (group.current && !selected && !reduced && !hovered)
      group.current.rotation.y += Math.min(delta, 0.05) * 0.015;
  });
  const linePositions = useMemo(() => {
    const values: number[] = [];
    for (const link of links) {
      const a = positions.get(link.source),
        b = positions.get(link.target);
      if (a && b) values.push(...a, ...b);
    }
    return new Float32Array(values);
  }, [links, positions]);
  const highlighted = useMemo(
    () =>
      new Set(
        links
          .filter(
            (l) =>
              l.source === selected ||
              l.target === selected ||
              (path.includes(l.source) && path.includes(l.target)),
          )
          .flatMap((l) => [l.source, l.target]),
      ),
    [selected, links, path],
  );
  const activePositions = useMemo(() => {
    const values: number[] = [];
    for (const link of links.filter(
      (l) =>
        l.source === selected ||
        l.target === selected ||
        (path.includes(l.source) && path.includes(l.target)),
    )) {
      const a = positions.get(link.source),
        b = positions.get(link.target);
      if (a && b) values.push(...a, ...b);
    }
    return new Float32Array(values);
  }, [links, positions, selected, path]);
  return (
    <>
      <ambientLight intensity={1} />
      <pointLight position={[5, 8, 10]} intensity={20} />
      <group ref={group}>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[linePositions, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#26758d"
            transparent
            opacity={selected ? 0.1 : 0.27}
          />
        </lineSegments>
        {(selected || path.length > 0) && (
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[activePositions, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#38e8f2" transparent opacity={0.8} />
          </lineSegments>
        )}
        {nodes.map((node, i) => {
          const active =
              node.id === selected ||
              node.id === hovered ||
              path.includes(node.id),
            dim = selected && !highlighted.has(node.id) && node.id !== selected;
          return (
            <mesh
              key={node.id}
              geometry={sphere}
              position={positions.get(node.id)}
              scale={
                active
                  ? 0.36
                  : Math.min(0.32, 0.14 + Math.sqrt(node.degree) * 0.04)
              }
              onClick={(event) => {
                event.stopPropagation();
                onSelect(node.id);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                setHovered(node.id);
              }}
              onPointerOut={() => setHovered("")}
            >
              <meshStandardMaterial
                color={KIND_COLORS[node.kind] || "#38e8f2"}
                emissive={KIND_COLORS[node.kind] || "#38e8f2"}
                emissiveIntensity={active || fresh.has(node.id) ? 2 : 0.4}
                transparent
                opacity={dim ? 0.36 : 1}
                roughness={0.4}
              />
              {(active || (labels && i < 28 && !dim)) && (
                <Html
                  position={[0, 1.8, 0]}
                  center
                  style={{ pointerEvents: "none" }}
                >
                  <div
                    className={`graph-node-label ${active ? "selected" : ""}`}
                  >
                    {node.name}
                  </div>
                </Html>
              )}
            </mesh>
          );
        })}
      </group>
      <OrbitControls
        ref={controls}
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={100}
      />
    </>
  );
}

export default function GraphScene(props: {
  nodes: GraphNode[];
  links: GraphLink[];
  selected: string;
  onSelect: (id: string) => void;
  labels: boolean;
  reset: number;
  fresh: Set<string>;
  path: string[];
}) {
  const [positions, setPositions] = useState<
    Map<string, [number, number, number]>
  >(new Map());
  useEffect(() => {
    const worker = new Worker(new URL("../layout.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      event: MessageEvent<{ ids: string[]; positions: Float32Array }>,
    ) => {
      setPositions(
        new Map(
          event.data.ids.map((id, i) => [
            id,
            [
              event.data.positions[i * 3],
              event.data.positions[i * 3 + 1],
              event.data.positions[i * 3 + 2],
            ],
          ]),
        ),
      );
    };
    worker.postMessage({
      ids: props.nodes.map((n) => n.id),
      links: props.links.map((l) => [l.source, l.target]),
    });
    return () => worker.terminate();
  }, [props.nodes, props.links]);
  return (
    <div
      className="graph-canvas"
      aria-label={`Interactive 3D graph with ${props.nodes.length} entities. Use the entity list for keyboard navigation.`}
    >
      <Canvas
        camera={{ position: [0, 0, 25], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        onPointerMissed={() => props.onSelect("")}
      >
        <color attach="background" args={["#070f1d"]} />
        {positions.size > 0 && <Scene {...props} positions={positions} />}
      </Canvas>
      {positions.size === 0 && (
        <div className="graph-positioning">
          Finding the shape of your connections…
        </div>
      )}
    </div>
  );
}
