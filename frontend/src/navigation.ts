export function workspaceDestination(value: string | null) {
  if (!value || /[\\\r\n]/.test(value)) return "/app";
  let url: URL;
  try {
    url = new URL(value, "https://knowsphere.local");
  } catch {
    return "/app";
  }
  return url.origin === "https://knowsphere.local" &&
    /^\/app(?:\/|$)/.test(url.pathname)
    ? `${url.pathname}${url.search}${url.hash}`
    : "/app";
}
