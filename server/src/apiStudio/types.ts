import type { ApiAuthType, ApiExecutionStatus, HttpMethod } from "@prisma/client";

export type KeyValuePair = { key: string; value: string; enabled: boolean };

export type RunApiRequestInput = {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  bodyType: string | null;
  body: string | null;
  authType: ApiAuthType;
  authConfig: unknown;
  timeoutMs: number;
};

export type RunApiRequestResult = {
  status: ApiExecutionStatus;
  statusCode: number | null;
  requestUrl: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  responseTruncated: boolean;
  responseSizeBytes: number | null;
  durationMs: number | null;
  // Short machine-readable code alongside the human-readable message — see
  // ApiExecution.errorCode in schema.prisma for the full rationale.
  errorCode: string | null;
  errorMessage: string | null;
};
