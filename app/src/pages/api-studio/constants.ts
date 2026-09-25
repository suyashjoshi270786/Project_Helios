export {
  CARD_CLASS,
  INPUT_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
  LABEL_CLASS,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  newId,
} from "../../lib/formStyles";

import type { ApiExecutionStatus, AssertionResultStatus, AssertionType, EnvironmentClassification, HttpMethod, OverallTestResult, VariableClassification, WorkflowFailurePolicy } from "./types";

export const WORKFLOW_FAILURE_POLICY_OPTIONS: { value: WorkflowFailurePolicy; label: string; description: string }[] = [
  { value: "Stop", label: "Stop on first failure", description: "Halts the run immediately when a step fails — later steps don't run." },
  { value: "Continue", label: "Continue regardless", description: "Runs every step even after a failure; the overall run still reports Pass." },
  { value: "ContinueButMarkFailed", label: "Continue, but mark failed", description: "Runs every step even after a failure, and the overall run reports Fail if any step failed." },
];

export const WORKFLOW_STEP_STATUS_BADGE_CLASS: Record<string, string> = {
  Pass: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  Fail: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
  Error: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  Skipped: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

export const HTTP_METHOD_OPTIONS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export const VARIABLE_CLASSIFICATION_OPTIONS: VariableClassification[] = ["Public", "Configuration", "Sensitive", "Secret"];
export const ENVIRONMENT_CLASSIFICATION_OPTIONS: EnvironmentClassification[] = ["Development", "Staging", "Production"];

export const ENVIRONMENT_CLASSIFICATION_BADGE_CLASS: Record<EnvironmentClassification, string> = {
  Development: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  Staging: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  Production: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
};

// A variable's own classification isn't shown as a colored badge elsewhere,
// but Sensitive/Secret rows in the environment editor use this to signal
// "masked" at a glance.
export const VARIABLE_CLASSIFICATION_SECRET = new Set<VariableClassification>(["Sensitive", "Secret"]);

export const METHOD_BADGE_CLASS: Record<HttpMethod, string> = {
  GET: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  POST: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  PUT: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  PATCH: "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400",
  DELETE: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
  HEAD: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  OPTIONS: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

// Colors the numeric HTTP status itself, so a 4xx/5xx reads as a warning
// at a glance even when the request has no assertions attached (assertions
// still separately drive the Pass/Fail "Test:" badge shown alongside this).
export function statusCodeToneClass(statusCode: number | null | undefined): string {
  if (statusCode == null) return "text-slate-400 dark:text-slate-500";
  if (statusCode >= 200 && statusCode < 300) return "text-emerald-600 dark:text-emerald-400 font-medium";
  if (statusCode >= 300 && statusCode < 400) return "text-blue-600 dark:text-blue-400 font-medium";
  if (statusCode >= 400) return "text-red-600 dark:text-red-400 font-medium";
  return "text-slate-400 dark:text-slate-500";
}

// `ApiExecutionStatus` alone is a transport-level outcome — "Success" only
// means a real HTTP response came back, not that it was a 2xx (a 400/500
// is still transport "Success"). Showing the raw enum value as a green
// "Success" pill next to e.g. "Status 400" read as a flat contradiction.
// This derives what's actually shown from BOTH the transport outcome and
// the real status code, so a 4xx/5xx response reads as "Error" in red —
// matching what it actually is — while a genuine 2xx/3xx still reads
// "Success" in green. Network-level failures (no response at all) and
// SSRF-blocked requests keep their own distinct transport-level labels.
export function executionOutcome(execution: { status: ApiExecutionStatus; statusCode: number | null }): {
  label: string;
  badgeClass: string;
} {
  if (execution.status === "Blocked") {
    return { label: "Blocked", badgeClass: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" };
  }
  if (execution.status === "Error") {
    return { label: "Error", badgeClass: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400" };
  }
  // status === "Success": a real response came back — let its own status
  // code decide whether that's actually good or bad.
  if (execution.statusCode != null && execution.statusCode >= 400) {
    return { label: "Error", badgeClass: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400" };
  }
  return { label: "Success", badgeClass: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" };
}

export const ASSERTION_RESULT_BADGE_CLASS: Record<AssertionResultStatus, string> = {
  PASS: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  FAIL: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
  ERROR: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  SKIPPED: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

// The aggregate verdict once a request has assertions — distinct from
// executionOutcome() above, which reflects transport + real status code.
export const OVERALL_RESULT_BADGE_CLASS: Record<OverallTestResult, string> = {
  Pass: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  Fail: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
  Error: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  Blocked: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  Skipped: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

// Grouped for the Assertions tab's category -> type dropdown, matching the
// "no-code builder: category -> operator -> target -> expected" shape from
// the spec. `needsTarget` controls whether the target input (JSON path or
// header name) is shown; every type needs an "expected" value except
// JsonFieldExists/HeaderExists/HeaderNotExists.
export const ASSERTION_TYPE_GROUPS: { category: string; types: { value: AssertionType; label: string; needsTarget: boolean; needsExpected: boolean; expectedPlaceholder?: string; targetPlaceholder?: string }[] }[] = [
  {
    category: "HTTP",
    types: [
      { value: "StatusEquals", label: "Status Code Equals", needsTarget: false, needsExpected: true, expectedPlaceholder: "200" },
      { value: "StatusNotEquals", label: "Status Code Not Equals", needsTarget: false, needsExpected: true, expectedPlaceholder: "500" },
      { value: "StatusInList", label: "Status Code In List", needsTarget: false, needsExpected: true, expectedPlaceholder: "200, 201, 204" },
    ],
  },
  {
    category: "Performance",
    types: [
      { value: "ResponseTimeLessThan", label: "Response Time Less Than (ms)", needsTarget: false, needsExpected: true, expectedPlaceholder: "2000" },
      { value: "ResponseTimeLessThanOrEqual", label: "Response Time At Most (ms)", needsTarget: false, needsExpected: true, expectedPlaceholder: "2000" },
      { value: "ResponseTimeGreaterThan", label: "Response Time Greater Than (ms)", needsTarget: false, needsExpected: true, expectedPlaceholder: "100" },
    ],
  },
  {
    category: "Headers",
    types: [
      { value: "HeaderExists", label: "Header Exists", needsTarget: true, needsExpected: false, targetPlaceholder: "content-type" },
      { value: "HeaderNotExists", label: "Header Not Exists", needsTarget: true, needsExpected: false, targetPlaceholder: "x-debug" },
      { value: "HeaderEquals", label: "Header Equals", needsTarget: true, needsExpected: true, targetPlaceholder: "content-type", expectedPlaceholder: "application/json" },
      { value: "HeaderContains", label: "Header Contains", needsTarget: true, needsExpected: true, targetPlaceholder: "content-type", expectedPlaceholder: "json" },
      { value: "HeaderRegex", label: "Header Matches Regex", needsTarget: true, needsExpected: true, targetPlaceholder: "content-type", expectedPlaceholder: "^application/" },
    ],
  },
  {
    category: "Body",
    types: [
      { value: "BodyNotEmpty", label: "Body Not Empty", needsTarget: false, needsExpected: false },
      { value: "BodyContains", label: "Body Contains", needsTarget: false, needsExpected: true, expectedPlaceholder: "success" },
      { value: "BodyNotContains", label: "Body Not Contains", needsTarget: false, needsExpected: true, expectedPlaceholder: "error" },
      { value: "BodyRegex", label: "Body Matches Regex", needsTarget: false, needsExpected: true, expectedPlaceholder: "^\\{" },
      { value: "JsonFieldExists", label: "JSON Field Exists", needsTarget: true, needsExpected: false, targetPlaceholder: "$.data.id" },
      { value: "JsonFieldEquals", label: "JSON Field Equals", needsTarget: true, needsExpected: true, targetPlaceholder: "$.status", expectedPlaceholder: "ACTIVE" },
      { value: "JsonFieldNotEquals", label: "JSON Field Not Equals", needsTarget: true, needsExpected: true, targetPlaceholder: "$.status", expectedPlaceholder: "FAILED" },
      { value: "JsonFieldType", label: "JSON Field Type", needsTarget: true, needsExpected: true, targetPlaceholder: "$.items", expectedPlaceholder: "array" },
      { value: "JsonFieldIsNull", label: "JSON Field Is Null", needsTarget: true, needsExpected: false, targetPlaceholder: "$.deletedAt" },
      { value: "JsonFieldIsNotNull", label: "JSON Field Is Not Null", needsTarget: true, needsExpected: false, targetPlaceholder: "$.id" },
      { value: "JsonFieldRegex", label: "JSON Field Matches Regex", needsTarget: true, needsExpected: true, targetPlaceholder: "$.email", expectedPlaceholder: "^.+@.+$" },
      { value: "JsonFieldGreaterThan", label: "JSON Field Greater Than", needsTarget: true, needsExpected: true, targetPlaceholder: "$.total", expectedPlaceholder: "0" },
      { value: "JsonFieldLessThan", label: "JSON Field Less Than", needsTarget: true, needsExpected: true, targetPlaceholder: "$.total", expectedPlaceholder: "1000" },
      { value: "JsonArrayContains", label: "JSON Array Contains", needsTarget: true, needsExpected: true, targetPlaceholder: "$.tags", expectedPlaceholder: "admin" },
      { value: "JsonArrayLength", label: "JSON Array Length Equals", needsTarget: true, needsExpected: true, targetPlaceholder: "$.items", expectedPlaceholder: "3" },
    ],
  },
];

export const ASSERTION_TYPE_META = Object.fromEntries(ASSERTION_TYPE_GROUPS.flatMap((g) => g.types).map((t) => [t.value, t])) as Record<
  AssertionType,
  (typeof ASSERTION_TYPE_GROUPS)[number]["types"][number]
>;

// The executor clamps to 30s server-side regardless of what's stored — this
// client timeout gives it margin so the UI's own timeout never races ahead
// of the server's confirmed ceiling.
export const EXECUTE_CLIENT_TIMEOUT_MS = 35000;
export const MIN_TIMEOUT_MS = 1000;
export const MAX_TIMEOUT_MS = 30000;
