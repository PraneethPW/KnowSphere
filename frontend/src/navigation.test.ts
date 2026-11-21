import { describe, expect, it } from "vitest";
import { workspaceDestination } from "./navigation";
describe("login return destinations", () => {
  it("preserves research deep links", () => {
    expect(workspaceDestination("/app/library?document=source#text")).toBe(
      "/app/library?document=source#text",
    );
  });
  it("rejects external and unrelated destinations", () => {
    for (const target of [
      null,
      "//attacker.example/app",
      "https://attacker.example/app",
      "/application",
      "/auth",
      "/app\\evil",
      "/app\n",
    ])
      expect(workspaceDestination(target)).toBe("/app");
  });
});
