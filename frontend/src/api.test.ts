import { describe, expect, it } from "vitest";
import { parseSSEFrame } from "./api";

describe("SSE framing", () => {
  it("parses a streamed token without losing Unicode or whitespace", () => {
    expect(
      parseSSEFrame('event: token\ndata: {"text":" café → graph "}'),
    ).toEqual({ event: "token", data: { text: " café → graph " } });
  });
  it("ignores heartbeats and handles CRLF", () => {
    expect(parseSSEFrame(": heartbeat")).toBeNull();
    expect(
      parseSSEFrame('id: 7\r\nevent: done\r\ndata: {"saved":true}'),
    ).toEqual({ event: "done", data: { saved: true } });
  });
  it("surfaces malformed provider data instead of silently accepting it", () => {
    expect(() => parseSSEFrame("event: token\ndata: invalid-json")).toThrow();
  });
});
