import { MAX_CONCURRENT_EXECUTIONS } from "./constants.js";

// Process-wide in-flight counter — deliberately as simple as possible (no
// per-user tracking, no external store) since this exists purely to cap
// total outbound-request concurrency for this one Node process, not to
// enforce any per-user fairness policy.
let inFlight = 0;

export class ConcurrencyLimitError extends Error {}

export function acquireExecutionSlot(): void {
  if (inFlight >= MAX_CONCURRENT_EXECUTIONS) {
    throw new ConcurrencyLimitError(`Too many API Studio requests are running at once (limit ${MAX_CONCURRENT_EXECUTIONS}). Try again in a moment.`);
  }
  inFlight++;
}

export function releaseExecutionSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
}
