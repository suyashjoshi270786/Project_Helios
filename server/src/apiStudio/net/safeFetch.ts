import http from "node:http";
import https from "node:https";
import type { HttpMethod } from "@prisma/client";

export type SafeFetchOptions = {
  method: HttpMethod;
  resolvedAddress: string; // validated IP — what we actually connect() to
  originalHostname: string; // for the Host header / TLS SNI
  port: number;
  scheme: "http" | "https";
  path: string; // pathname + search
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  maxResponseBytes: number;
};

export type SafeFetchResult = {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
  truncated: boolean;
  redirected: boolean; // true if upstream sent a 3xx — never auto-followed
  durationMs: number;
};

// Connects directly to a pre-validated IP address (never re-resolving the
// hostname), so this is the ONLY place that ever touches the network for an
// API Studio request. Redirects are surfaced, never followed — the caller
// decides what a 3xx means for their test.
export function executeHttpRequest(opts: SafeFetchOptions): Promise<SafeFetchResult> {
  return new Promise((resolve, reject) => {
    const transport = opts.scheme === "https" ? https : http;
    const startedAt = Date.now();

    const req = transport.request(
      {
        hostname: opts.resolvedAddress,
        port: opts.port,
        path: opts.path,
        method: opts.method,
        headers: { ...opts.headers, host: opts.originalHostname },
        timeout: opts.timeoutMs,
        ...(opts.scheme === "https" ? { servername: opts.originalHostname } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let receivedBytes = 0;
        let truncated = false;

        res.on("data", (chunk: Buffer) => {
          if (truncated) return;
          receivedBytes += chunk.length;
          if (receivedBytes > opts.maxResponseBytes) {
            truncated = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });

        res.on("end", () => {
          const statusCode = res.statusCode ?? 0;
          resolve({
            statusCode,
            headers: res.headers as Record<string, string | string[]>,
            body: Buffer.concat(chunks).toString("utf8"),
            truncated,
            redirected: statusCode >= 300 && statusCode < 400,
            durationMs: Date.now() - startedAt,
          });
        });

        res.on("error", (err) => reject(err));

        res.on("close", () => {
          if (truncated) {
            resolve({
              statusCode: res.statusCode ?? 0,
              headers: res.headers as Record<string, string | string[]>,
              body: Buffer.concat(chunks).toString("utf8"),
              truncated: true,
              redirected: false,
              durationMs: Date.now() - startedAt,
            });
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${opts.timeoutMs}ms.`));
    });
    req.on("error", (err) => reject(err));

    if (opts.body) req.write(opts.body);
    req.end();
  });
}
