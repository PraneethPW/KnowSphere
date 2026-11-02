export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      headers: {
        "X-KnowSphere-Client": "web",
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Cannot reach KnowSphere. Check your connection and the API service.",
      0,
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("knowsphere:expired"));
    throw new ApiError(
      typeof data.detail === "string"
        ? data.detail
        : `The service returned an error (${response.status}).`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const post = <T>(path: string, data: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });

export function parseSSEFrame(
  frame: string,
): { event: string; data: unknown } | null {
  let event = "message";
  const parts: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) parts.push(line.slice(5).trimStart());
  }
  if (!parts.length) return null;
  return { event, data: JSON.parse(parts.join("\n")) };
}

export async function streamChat(
  path: string,
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: string, data: Record<string, unknown>) => void,
) {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: "POST",
      credentials: "same-origin",
      signal,
      headers: {
        "Content-Type": "application/json",
        "X-KnowSphere-Client": "web",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError(
      "Cannot reach the AI service. Check your connection.",
      0,
    );
  }
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      data.detail || "The answer could not be started.",
      response.status,
    );
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const parsed = parseSSEFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (!parsed) continue;
        const data = parsed.data as Record<string, unknown>;
        if (parsed.event === "error")
          throw new ApiError(String(data.message), 502);
        if (parsed.event === "done") complete = true;
        onEvent(parsed.event, data);
      }
      if (done) break;
    }
    if (!complete)
      throw new ApiError(
        "The answer stream was interrupted. Please retry.",
        502,
      );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function downloadGraph(spaceId: string) {
  const graph = await api<unknown>(`/spaces/${spaceId}/export`);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "knowsphere-graph.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
