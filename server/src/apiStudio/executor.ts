import type { ApiAuthType } from "@prisma/client";
import { ALLOWED_SCHEMES, MAX_RESPONSE_BYTES, MAX_TIMEOUT_MS, MIN_TIMEOUT_MS, REDACTED_VALUE, SENSITIVE_HEADER_NAMES } from "./constants.js";
import { resolveHostSafely, SsrfBlockedError } from "./net/safeDns.js";
import { executeHttpRequest } from "./net/safeFetch.js";
import type { KeyValuePair, RunApiRequestInput, RunApiRequestResult } from "./types.js";

function clampTimeout(timeoutMs: number): number {
  return Math.min(Math.max(timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

function applyAuth(headers: Record<string, string>, authType: ApiAuthType, authConfig: unknown) {
  if (!authConfig || typeof authConfig !== "object") return;
  const config = authConfig as Record<string, unknown>;

  if (authType === "Bearer" && typeof config.token === "string" && config.token) {
    headers.authorization = `Bearer ${config.token}`;
  } else if (authType === "Basic" && typeof config.username === "string") {
    const password = typeof config.password === "string" ? config.password : "";
    headers.authorization = `Basic ${Buffer.from(`${config.username}:${password}`).toString("base64")}`;
  } else if (
    authType === "ApiKey" &&
    typeof config.key === "string" &&
    config.key &&
    typeof config.value === "string"
  ) {
    if (config.in === "query") {
      // Handled by the caller via the URL — see buildFinalUrl.
    } else {
      headers[config.key.toLowerCase()] = config.value;
    }
  }
}

function buildFinalUrl(rawUrl: string, queryParams: KeyValuePair[], authType: ApiAuthType, authConfig: unknown): URL {
  const url = new URL(rawUrl);
  for (const param of queryParams) {
    if (param.enabled && param.key) url.searchParams.append(param.key, param.value);
  }
  if (authType === "ApiKey" && authConfig && typeof authConfig === "object") {
    const config = authConfig as Record<string, unknown>;
    if (config.in === "query" && typeof config.key === "string" && config.key && typeof config.value === "string") {
      url.searchParams.append(config.key, config.value);
    }
  }
  return url;
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? REDACTED_VALUE : value;
  }
  return redacted;
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof SsrfBlockedError) return err.message;
  if (err instanceof Error) {
    if (err.message.includes("timed out")) return err.message;
    return "The request could not be completed.";
  }
  return "The request could not be completed.";
}

function safeErrorCode(err: unknown): string {
  if (err instanceof SsrfBlockedError) return err.code;
  if (err instanceof Error && err.message.includes("timed out")) return "TIMEOUT";
  return "NETWORK_ERROR";
}

// authorize (done by the caller via findAccessibleProject before this is
// invoked) -> validate -> resolve -> security policy -> execute -> sanitize.
// This module makes zero Prisma calls — a pure, testable execution engine,
// same separation BrowserController keeps from persistence.
export async function runApiRequest(input: RunApiRequestInput): Promise<RunApiRequestResult> {
  let finalUrl: URL;
  const requestHeaders: Record<string, string> = {};

  try {
    if (!ALLOWED_SCHEMES.includes(new URL(input.url).protocol as (typeof ALLOWED_SCHEMES)[number])) {
      return {
        status: "Blocked",
        statusCode: null,
        requestUrl: input.url,
        requestHeaders: {},
        responseHeaders: null,
        responseBody: null,
        responseTruncated: false,
        responseSizeBytes: null,
        durationMs: null,
        errorCode: "INVALID_URL",
        errorMessage: "Only http and https URLs are allowed.",
      };
    }

    for (const header of input.headers) {
      if (header.enabled && header.key) requestHeaders[header.key.toLowerCase()] = header.value;
    }
    if (input.bodyType === "json" && input.body && !requestHeaders["content-type"]) {
      requestHeaders["content-type"] = "application/json";
    }
    applyAuth(requestHeaders, input.authType, input.authConfig);
    finalUrl = buildFinalUrl(input.url, input.queryParams, input.authType, input.authConfig);
  } catch {
    return {
      status: "Blocked",
      statusCode: null,
      requestUrl: input.url,
      requestHeaders: {},
      responseHeaders: null,
      responseBody: null,
      responseTruncated: false,
      responseSizeBytes: null,
      durationMs: null,
      errorCode: "INVALID_URL",
      errorMessage: "The request URL is invalid.",
    };
  }

  const timeoutMs = clampTimeout(input.timeoutMs);

  let resolved;
  try {
    resolved = await resolveHostSafely(finalUrl.hostname);
  } catch (err) {
    return {
      status: "Blocked",
      statusCode: null,
      requestUrl: finalUrl.toString(),
      requestHeaders: redactHeaders(requestHeaders),
      responseHeaders: null,
      responseBody: null,
      responseTruncated: false,
      responseSizeBytes: null,
      durationMs: null,
      errorCode: safeErrorCode(err),
      errorMessage: safeErrorMessage(err),
    };
  }

  const scheme = finalUrl.protocol === "https:" ? "https" : "http";
  const port = finalUrl.port ? Number(finalUrl.port) : scheme === "https" ? 443 : 80;

  try {
    const result = await executeHttpRequest({
      method: input.method,
      resolvedAddress: resolved.address,
      originalHostname: resolved.hostname,
      port,
      scheme,
      path: `${finalUrl.pathname}${finalUrl.search}`,
      headers: requestHeaders,
      body: input.body ?? undefined,
      timeoutMs,
      maxResponseBytes: MAX_RESPONSE_BYTES,
    });

    const flatHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(result.headers)) {
      flatHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
    }

    return {
      status: "Success",
      statusCode: result.statusCode,
      requestUrl: finalUrl.toString(),
      requestHeaders: redactHeaders(requestHeaders),
      responseHeaders: flatHeaders,
      responseBody: result.body,
      responseTruncated: result.truncated,
      responseSizeBytes: Buffer.byteLength(result.body),
      durationMs: result.durationMs,
      errorCode: null,
      errorMessage: null,
    };
  } catch (err) {
    return {
      status: "Error",
      statusCode: null,
      requestUrl: finalUrl.toString(),
      requestHeaders: redactHeaders(requestHeaders),
      responseHeaders: null,
      responseBody: null,
      responseTruncated: false,
      responseSizeBytes: null,
      durationMs: null,
      errorCode: safeErrorCode(err),
      errorMessage: safeErrorMessage(err),
    };
  }
}
