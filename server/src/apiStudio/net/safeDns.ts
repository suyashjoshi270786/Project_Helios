import dns from "node:dns";
import net from "node:net";
import { isPrivateOrReservedIp } from "./ipRangeCheck.js";

export class SsrfBlockedError extends Error {
  // Distinguishes an actual security-policy block from a genuine DNS
  // failure — both currently surface as execution status "Blocked", but the
  // persisted errorCode lets the UI/future automation tell them apart
  // without parsing the message text.
  code: "SSRF_BLOCKED" | "DNS_ERROR";
  constructor(message: string, code: "SSRF_BLOCKED" | "DNS_ERROR") {
    super(message);
    this.code = code;
  }
}

export type ResolvedHost = { hostname: string; address: string; family: 4 | 6 };

// Resolves a hostname to a single IP exactly once and validates that IP
// before returning it. Nothing downstream re-resolves the hostname — the
// validated address is what the actual connection uses — which is what
// closes the classic SSRF TOCTOU gap (DNS answer changing between the
// safety check and the real connect).
export async function resolveHostSafely(hostname: string): Promise<ResolvedHost> {
  const literalFamily = net.isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    if (isPrivateOrReservedIp(hostname, literalFamily as 4 | 6)) {
      throw new SsrfBlockedError(`Destination ${hostname} is a private/reserved address and is blocked.`, "SSRF_BLOCKED");
    }
    return { hostname, address: hostname, family: literalFamily as 4 | 6 };
  }

  let result: dns.LookupAddress;
  try {
    result = await dns.promises.lookup(hostname, { all: false, verbatim: true });
  } catch {
    throw new SsrfBlockedError(`Could not resolve ${hostname}.`, "DNS_ERROR");
  }

  const family = result.family === 6 ? 6 : 4;
  if (isPrivateOrReservedIp(result.address, family)) {
    throw new SsrfBlockedError(`${hostname} resolves to a private/reserved address and is blocked.`, "SSRF_BLOCKED");
  }
  return { hostname, address: result.address, family };
}
