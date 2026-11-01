const API_ROOT = "/api";

export async function api(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({
    success: false,
    error: "The server returned an unreadable response.",
  }));
  if (!response.ok || !payload.success)
    throw new Error(payload.error || "Request failed.");
  return payload.data;
}

export const send = (method, body) => ({ method, body: JSON.stringify(body) });
