import type { GraphLink } from "./types";
/** Undirected shortest connection chain across the currently visible, filtered graph. */
export function shortestPath(
  links: GraphLink[],
  source: string,
  target: string,
): string[] {
  if (!source || !target) return [];
  if (source === target) return [source];
  const adjacency = new Map<string, Set<string>>();
  for (const link of links) {
    if (!adjacency.has(link.source)) adjacency.set(link.source, new Set());
    if (!adjacency.has(link.target)) adjacency.set(link.target, new Set());
    adjacency.get(link.source)!.add(link.target);
    adjacency.get(link.target)!.add(link.source);
  }
  const parent = new Map<string, string | null>([[source, null]]),
    queue = [source];
  for (let i = 0; i < queue.length; i++) {
    for (const next of adjacency.get(queue[i]) || []) {
      if (parent.has(next)) continue;
      parent.set(next, queue[i]);
      if (next === target) {
        const path = [next];
        let p = parent.get(next);
        while (p) {
          path.unshift(p);
          p = parent.get(p);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [];
}
