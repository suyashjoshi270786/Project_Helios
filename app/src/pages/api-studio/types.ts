export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type ApiAuthType = "None" | "Bearer" | "Basic" | "ApiKey";
export type ApiExecutionStatus = "Success" | "Error" | "Blocked";

export type KeyValuePair = { key: string; value: string; enabled: boolean; description?: string };

export type AssertionType =
  | "StatusEquals"
  | "StatusInList"
  | "StatusNotEquals"
  | "ResponseTimeLessThan"
  | "ResponseTimeLessThanOrEqual"
  | "ResponseTimeGreaterThan"
  | "HeaderExists"
  | "HeaderNotExists"
  | "HeaderEquals"
  | "HeaderContains"
  | "HeaderRegex"
  | "BodyNotEmpty"
  | "BodyContains"
  | "BodyNotContains"
  | "BodyRegex"
  | "JsonFieldExists"
  | "JsonFieldEquals"
  | "JsonFieldNotEquals"
  | "JsonFieldType"
  | "JsonFieldIsNull"
  | "JsonFieldIsNotNull"
  | "JsonFieldRegex"
  | "JsonFieldGreaterThan"
  | "JsonFieldLessThan"
  | "JsonArrayContains"
  | "JsonArrayLength";

export type AssertionDef = {
  id: string;
  name: string;
  type: AssertionType;
  target?: string;
  expected?: string;
};

export type AssertionResultStatus = "PASS" | "FAIL" | "SKIPPED" | "ERROR";

export type AssertionResult = {
  id: string;
  name: string;
  type: AssertionType;
  expected: string | null;
  actual: string | null;
  status: AssertionResultStatus;
  message: string;
  evidence: string;
};

export type OverallTestResult = "Pass" | "Fail" | "Error" | "Blocked" | "Skipped";

export type VariableClassification = "Public" | "Configuration" | "Sensitive" | "Secret";
export type EnvironmentClassification = "Development" | "Staging" | "Production";

export type ApiEnvironmentVariable = {
  key: string;
  classification: VariableClassification;
  // Always null for Sensitive/Secret — the server never returns those in
  // plaintext. Use `hasValue` to know whether one is set.
  value: string | null;
  hasValue: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiEnvironment = {
  id: string;
  name: string;
  description: string | null;
  classification: EnvironmentClassification;
  projectId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  variables: ApiEnvironmentVariable[];
};

export type ApiFolder = {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  parentId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiRequest = {
  id: string;
  name: string;
  description: string | null;
  method: HttpMethod;
  url: string;
  queryParams: KeyValuePair[] | null;
  headers: KeyValuePair[] | null;
  pathParams: KeyValuePair[] | null;
  bodyType: string | null;
  body: string | null;
  authType: ApiAuthType;
  authConfig: unknown;
  assertions: AssertionDef[] | null;
  timeoutMs: number;
  followRedirects: boolean;
  folderId: string | null;
  projectId: string;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiExecutionMode = "Manual" | "Test" | "Cycle" | "Scheduled" | "CI";

export type ApiExecution = {
  id: string;
  apiRequestId: string;
  projectId: string;
  executionMode: ApiExecutionMode;
  correlationId: string;
  method: HttpMethod;
  url: string;
  requestHeaders: Record<string, string> | null;
  requestBody: string | null;
  status: ApiExecutionStatus;
  statusCode: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  responseTruncated: boolean;
  responseSizeBytes: number | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  assertionResults: AssertionResult[] | null;
  overallResult: OverallTestResult | null;
  retestOfId: string | null;
  environmentId: string | null;
  executedById: string;
  startedAt: string;
  completedAt: string;
};
