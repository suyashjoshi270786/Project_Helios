const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 8000): Promise<T> {
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
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown, timeoutMs?: number) =>
    request<T>(
      path,
      { method: "POST", body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined },
      timeoutMs,
    ),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
