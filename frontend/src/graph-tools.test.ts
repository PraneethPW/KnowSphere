import { describe, expect, it } from "vitest";
import { shortestPath } from "./graph-tools";
import type { GraphLink } from "./types";
const edge = (source: string, target: string) =>
  ({ source, target }) as GraphLink;
describe("investigation paths", () => {
  it("finds the minimum undirected chain despite cycles and parallel evidence", () => {
    const links = [
      edge("a", "b"),
      edge("a", "b"),
      edge("b", "c"),
      edge("c", "a"),
      edge("c", "d"),
      edge("b", "e"),
      edge("e", "f"),
      edge("f", "d"),
    ];
    expect(shortestPath(links, "d", "a")).toEqual(["d", "c", "a"]);
  });
  it("handles disconnected, empty, and identical endpoints", () => {
    expect(shortestPath([edge("a", "b")], "a", "c")).toEqual([]);
    expect(shortestPath([], "a", "a")).toEqual(["a"]);
    expect(shortestPath([], "", "a")).toEqual([]);
  });
});
