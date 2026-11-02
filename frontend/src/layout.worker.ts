// All positions derive from real entity IDs and graph links; no synthetic records.
type LayoutInput = { ids: string[]; links: [string, string][] };
self.onmessage = (event: MessageEvent<LayoutInput>) => {
  const { ids, links } = event.data,
    count = ids.length;
  const indices = new Map(ids.map((id, i) => [id, i]));
  const positions = new Float32Array(count * 3),
    velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let hash = 0;
    for (const c of ids[i]) hash = (hash * 31 + c.charCodeAt(0)) | 0;
    const angle = i * Math.PI * (3 - Math.sqrt(5)),
      y = 1 - 2 * ((i + 0.5) / count);
    const radius = Math.sqrt(Math.max(0, 1 - y * y)),
      spread = Math.max(3, Math.cbrt(count) * 1.5);
    positions.set(
      [
        Math.cos(angle) * radius * spread,
        y * spread,
        Math.sin(angle) * radius * spread + (hash % 100) / 200,
      ],
      i * 3,
    );
  }
  const edges = links.map(([a, b]) => [indices.get(a)!, indices.get(b)!]);
  for (let tick = 0; tick < 110; tick++) {
    const alpha = 1 - tick / 120;
    for (let i = 0; i < count; i++)
      for (let j = i + 1; j < count; j++) {
        const dx = positions[i * 3] - positions[j * 3],
          dy = positions[i * 3 + 1] - positions[j * 3 + 1],
          dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const distance2 = Math.max(dx * dx + dy * dy + dz * dz, 0.1),
          force = Math.min(0.06, 0.12 / distance2) * alpha;
        velocities[i * 3] += dx * force;
        velocities[i * 3 + 1] += dy * force;
        velocities[i * 3 + 2] += dz * force;
        velocities[j * 3] -= dx * force;
        velocities[j * 3 + 1] -= dy * force;
        velocities[j * 3 + 2] -= dz * force;
      }
    for (const [a, b] of edges) {
      const dx = positions[a * 3] - positions[b * 3],
        dy = positions[a * 3 + 1] - positions[b * 3 + 1],
        dz = positions[a * 3 + 2] - positions[b * 3 + 2];
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.01),
        f = ((distance - 2.3) * 0.012 * alpha) / distance;
      velocities[a * 3] -= dx * f;
      velocities[a * 3 + 1] -= dy * f;
      velocities[a * 3 + 2] -= dz * f;
      velocities[b * 3] += dx * f;
      velocities[b * 3 + 1] += dy * f;
      velocities[b * 3 + 2] += dz * f;
    }
    for (let k = 0; k < count * 3; k++) {
      velocities[k] = (velocities[k] - positions[k] * 0.0015 * alpha) * 0.8;
      positions[k] += velocities[k];
    }
  }
  self.postMessage({ ids, positions }, { transfer: [positions.buffer] });
};
