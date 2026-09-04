function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const MAX_RESPONSE_BYTES = envInt("API_STUDIO_MAX_RESPONSE_BYTES", 2 * 1024 * 1024);
export const MIN_TIMEOUT_MS = 1000;
// Hard ceiling — a request's own stored timeoutMs may only ever narrow this,
// never exceed it. See executor.ts.
export const MAX_TIMEOUT_MS = envInt("API_STUDIO_MAX_TIMEOUT_MS", 30000);
export const ALLOWED_SCHEMES = ["http:", "https:"] as const;

export const MAX_HEADER_COUNT = envInt("API_STUDIO_MAX_HEADER_COUNT", 100);
export const MAX_URL_LENGTH = envInt("API_STUDIO_MAX_URL_LENGTH", 4000);
export const MAX_BODY_SIZE_BYTES = envInt("API_STUDIO_MAX_BODY_SIZE_BYTES", 1_000_000);

// A single Helios process has no queue/worker pool — this just caps how many
// outbound requests can be in flight at once so a burst of Sends (or a
// misbehaving script hammering the API) can't exhaust the server's own
// sockets/memory. Not per-user: a shared ceiling across the whole process,
// same spirit as the existing express-rate-limit throttles being IP/token-
// scoped time windows rather than a true concurrency limit.
export const MAX_CONCURRENT_EXECUTIONS = envInt("API_STUDIO_MAX_CONCURRENT_EXECUTIONS", 20);

// Shared between the executor (redacts these in the persisted requestHeaders
// snapshot) and the assertion engine (redacts these when they're the target
// of a Header* assertion) so a request or response secret can never surface
// in a stored execution or Test Result either way.
export const SENSITIVE_HEADER_NAMES = new Set(["authorization", "cookie", "set-cookie", "x-api-key", "www-authenticate"]);
export const REDACTED_VALUE = "***";
