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

describe("stream transport", () => {
  it("handles CRLF boundaries split between network packets", async () => {
    const { streamChat } = await import("./api");
    const original = globalThis.fetch;
    const encoder = new TextEncoder();
    const chunks = [
      "event: token\r",
      '\ndata: {"text":"café"}\r',
      "\n\r",
      "\nevent: done\r\ndata: {}\r\n\r\n",
    ];
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (const chunk of chunks)
              controller.enqueue(encoder.encode(chunk));
            controller.close();
          },
        }),
      );
    try {
      const events: string[] = [];
      await streamChat("/test", {}, new AbortController().signal, (event) =>
        events.push(event),
      );
      expect(events).toEqual(["token", "done"]);
    } finally {
      globalThis.fetch = original;
    }
  });
});

it("redirects expired streamed sessions through the shared expiry handler", async () => {
  const { streamChat, ApiError } = await import("./api");
  const previousFetch = globalThis.fetch;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { dispatchEvent: (event: Event) => events.push(event.type) },
  });
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: "Session expired" }), {
      status: 401,
    });
  try {
    await expect(
      streamChat("/test", {}, new AbortController().signal, () => {}),
    ).rejects.toBeInstanceOf(ApiError);
    expect(events).toEqual(["knowsphere:expired"]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
