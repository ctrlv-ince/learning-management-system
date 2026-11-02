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

export function apiUpload(path, formData, { onProgress, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_ROOT}${path}`);
    request.withCredentials = true;
    request.timeout = timeout;
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });
    request.addEventListener("load", () => {
      let payload;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error("The server returned an unreadable response."));
        return;
      }
      if (request.status < 200 || request.status >= 300 || !payload.success) {
        reject(new Error(payload.error || `Upload failed (${request.status}).`));
        return;
      }
      resolve(payload.data);
    });
    request.addEventListener("error", () =>
      reject(new Error("Network error during upload. Check your connection and try again.")),
    );
    request.addEventListener("timeout", () =>
      reject(new Error("Upload timed out. Check your connection and try again.")),
    );
    request.addEventListener("abort", () => reject(new Error("Upload was cancelled.")));
    request.send(formData);
  });
}

export const send = (method, body) => ({ method, body: JSON.stringify(body) });
