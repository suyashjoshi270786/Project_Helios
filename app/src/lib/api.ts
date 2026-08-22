const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Render's free tier spins the backend down after inactivity and can take
// 50+ seconds to wake back up on the next request — the default timeout
// needs enough headroom to not misreport a waking server as unreachable.
async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 45000): Promise<T> {
  const isFormData = options.body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: AbortSignal.timeout(timeoutMs),
      headers: isFormData
        ? { ...options.headers }
        : { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Is the backend running?");
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? "Something went wrong. Please try again.");
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, timeoutMs?: number) => request<T>(path, {}, timeoutMs),
  post: <T>(path: string, data?: unknown, timeoutMs?: number) =>
    request<T>(
      path,
      { method: "POST", body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined },
      timeoutMs,
    ),
  patch: <T>(path: string, data?: unknown, timeoutMs?: number) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }, timeoutMs),
  delete: <T>(path: string, timeoutMs?: number) => request<T>(path, { method: "DELETE" }, timeoutMs),
};
