import { REDACTED_VALUE, SENSITIVE_HEADER_NAMES } from "./constants.js";
import type { RunApiRequestResult } from "./types.js";

// Single source of truth for every supported assertion type — the route's
// Zod schema imports this array directly (`z.enum(ASSERTION_TYPES)`) instead
// of keeping its own parallel list, after that exact duplication caused a
// stale-enum bug once already (new types added here weren't accepted by the
// create/update routes because their own copy hadn't been updated).
export const ASSERTION_TYPES = [
  "StatusEquals",
  "StatusInList",
  "StatusNotEquals",
  "ResponseTimeLessThan",
  "ResponseTimeLessThanOrEqual",
  "ResponseTimeGreaterThan",
  "HeaderExists",
  "HeaderNotExists",
  "HeaderEquals",
  "HeaderContains",
  "HeaderRegex",
  "BodyNotEmpty",
  "BodyContains",
  "BodyNotContains",
  "BodyRegex",
  "JsonFieldExists",
  "JsonFieldEquals",
  "JsonFieldNotEquals",
  "JsonFieldType",
  "JsonFieldIsNull",
  "JsonFieldIsNotNull",
  "JsonFieldRegex",
  "JsonFieldGreaterThan",
  "JsonFieldLessThan",
  "JsonArrayContains",
  "JsonArrayLength",
] as const;

export type AssertionType = (typeof ASSERTION_TYPES)[number];

export type AssertionDef = {
  id: string;
  name: string;
  type: AssertionType;
  // JSON path ("$.data.id") for JsonField*/JsonArray* types, header name for
  // Header* types, unused for Status/ResponseTime/Body* (expected carries
  // the value for those).
  target?: string;
  expected?: string;
};

export type AssertionResult = {
  id: string;
  name: string;
  type: AssertionType;
  expected: string | null;
  actual: string | null;
  status: "PASS" | "FAIL" | "SKIPPED" | "ERROR";
  message: string;
  // Points at what in the execution was checked (e.g. "responseHeaders.content-type",
  // "responseBody $.data.id", "statusCode") — lets the UI/a human trace a
  // failure back to the exact place in the response without re-deriving it.
  evidence: string;
};

// Exported for reuse by the Stage 05 workflow extraction step
// (extractVariable, below) — same JSON-path reader, one implementation.
export function readJsonPath(value: unknown, path: string): { found: boolean; value: unknown } {
  if (!path.startsWith("$")) return { found: false, value: undefined };
  const tokens = path
    .slice(1)
    .split(/\.|\[|\]/)
    .filter((t) => t.length > 0);

  let current: unknown = value;
  for (const token of tokens) {
    if (current === null || current === undefined) return { found: false, value: undefined };
    const index = /^\d+$/.test(token) ? Number(token) : null;
    if (index !== null) {
      if (!Array.isArray(current) || index >= current.length) return { found: false, value: undefined };
      current = current[index];
    } else {
      if (typeof current !== "object" || Array.isArray(current) || !(token in current)) {
        return { found: false, value: undefined };
      }
      current = (current as Record<string, unknown>)[token];
    }
  }
  return { found: true, value: current };
}

export function parseJsonBody(body: string | null): { ok: true; value: unknown } | { ok: false } {
  if (!body) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false };
  }
}

export function stringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function headerActual(headers: Record<string, string> | null, key: string): string | null {
  const value = headers?.[key.toLowerCase()] ?? null;
  if (value !== null && SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) return REDACTED_VALUE;
  return value;
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function evaluateOne(def: AssertionDef, result: RunApiRequestResult): AssertionResult {
  const base = { id: def.id, name: def.name, type: def.type };

  if (result.status === "Blocked") {
    return { ...base, expected: def.expected ?? null, actual: null, status: "ERROR", message: "Request was blocked before a response was received.", evidence: "status" };
  }

  switch (def.type) {
    case "StatusEquals": {
      const actual = result.statusCode;
      const pass = actual === Number(def.expected);
      return { ...base, expected: def.expected ?? null, actual: String(actual), status: pass ? "PASS" : "FAIL", message: pass ? "Status matched." : `Expected status ${def.expected}, got ${actual}.`, evidence: "statusCode" };
    }
    case "StatusNotEquals": {
      const actual = result.statusCode;
      const pass = actual !== Number(def.expected);
      return { ...base, expected: def.expected ?? null, actual: String(actual), status: pass ? "PASS" : "FAIL", message: pass ? "Status did not match (as expected)." : `Status was ${actual}, which was not expected.`, evidence: "statusCode" };
    }
    case "StatusInList": {
      const allowed = (def.expected ?? "").split(",").map((s) => s.trim());
      const actual = String(result.statusCode);
      const pass = allowed.includes(actual);
      return { ...base, expected: def.expected ?? null, actual, status: pass ? "PASS" : "FAIL", message: pass ? "Status was in the allowed list." : `Status ${actual} was not in [${allowed.join(", ")}].`, evidence: "statusCode" };
    }

    case "ResponseTimeLessThan":
    case "ResponseTimeLessThanOrEqual":
    case "ResponseTimeGreaterThan": {
      const threshold = Number(def.expected);
      const actual = result.durationMs;
      if (actual === null) return { ...base, expected: def.expected ?? null, actual: null, status: "ERROR", message: "No duration recorded.", evidence: "durationMs" };
      const pass = def.type === "ResponseTimeLessThan" ? actual < threshold : def.type === "ResponseTimeLessThanOrEqual" ? actual <= threshold : actual > threshold;
      const cmp = def.type === "ResponseTimeLessThan" ? "under" : def.type === "ResponseTimeLessThanOrEqual" ? "at or under" : "over";
      return { ...base, expected: def.expected ?? null, actual: String(actual), status: pass ? "PASS" : "FAIL", message: pass ? `Responded in ${actual}ms.` : `Took ${actual}ms, expected ${cmp} ${threshold}ms.`, evidence: "durationMs" };
    }

    case "HeaderExists": {
      const pass = !!result.responseHeaders && (def.target ?? "").toLowerCase() in result.responseHeaders;
      return { ...base, expected: def.target ?? null, actual: pass ? "present" : "missing", status: pass ? "PASS" : "FAIL", message: pass ? `Header "${def.target}" is present.` : `Header "${def.target}" was not found.`, evidence: `responseHeaders.${def.target}` };
    }
    case "HeaderNotExists": {
      const exists = !!result.responseHeaders && (def.target ?? "").toLowerCase() in result.responseHeaders;
      return { ...base, expected: def.target ?? null, actual: exists ? "present" : "missing", status: exists ? "FAIL" : "PASS", message: exists ? `Header "${def.target}" was present, expected absent.` : `Header "${def.target}" is absent, as expected.`, evidence: `responseHeaders.${def.target}` };
    }
    case "HeaderEquals": {
      // Compare against the raw value so an equality check on a sensitive
      // header (e.g. Set-Cookie) can still genuinely PASS — only the
      // returned/persisted `actual` is masked, matching HeaderContains/Regex.
      const raw = result.responseHeaders?.[(def.target ?? "").toLowerCase()] ?? null;
      const pass = raw === def.expected;
      return { ...base, expected: def.expected ?? null, actual: headerActual(result.responseHeaders, def.target ?? ""), status: pass ? "PASS" : "FAIL", message: pass ? "Header value matched." : `Header "${def.target}" did not match the expected value.`, evidence: `responseHeaders.${def.target}` };
    }
    case "HeaderContains": {
      const raw = result.responseHeaders?.[(def.target ?? "").toLowerCase()] ?? null;
      const pass = raw !== null && raw.includes(def.expected ?? "");
      return { ...base, expected: def.expected ?? null, actual: headerActual(result.responseHeaders, def.target ?? ""), status: pass ? "PASS" : "FAIL", message: pass ? `Header "${def.target}" contains the expected text.` : `Header "${def.target}" does not contain the expected text.`, evidence: `responseHeaders.${def.target}` };
    }
    case "HeaderRegex": {
      const raw = result.responseHeaders?.[(def.target ?? "").toLowerCase()] ?? null;
      const regex = safeRegex(def.expected ?? "");
      if (!regex) return { ...base, expected: def.expected ?? null, actual: null, status: "ERROR", message: "The regular expression is invalid.", evidence: `responseHeaders.${def.target}` };
      const pass = raw !== null && regex.test(raw);
      return { ...base, expected: def.expected ?? null, actual: headerActual(result.responseHeaders, def.target ?? ""), status: pass ? "PASS" : "FAIL", message: pass ? `Header "${def.target}" matches the pattern.` : `Header "${def.target}" does not match the pattern.`, evidence: `responseHeaders.${def.target}` };
    }

    case "BodyNotEmpty": {
      const pass = !!result.responseBody && result.responseBody.trim().length > 0;
      return { ...base, expected: "non-empty", actual: pass ? "non-empty" : "empty", status: pass ? "PASS" : "FAIL", message: pass ? "Body is not empty." : "Body is empty.", evidence: "responseBody" };
    }
    case "BodyContains": {
      const body = result.responseBody ?? "";
      const pass = body.includes(def.expected ?? "");
      return { ...base, expected: def.expected ?? null, actual: pass ? "found" : "not found", status: pass ? "PASS" : "FAIL", message: pass ? "Body contains the expected text." : "Body does not contain the expected text.", evidence: "responseBody" };
    }
    case "BodyNotContains": {
      const body = result.responseBody ?? "";
      const found = body.includes(def.expected ?? "");
      return { ...base, expected: def.expected ?? null, actual: found ? "found" : "not found", status: found ? "FAIL" : "PASS", message: found ? "Body contains text that was expected to be absent." : "Body does not contain the text, as expected.", evidence: "responseBody" };
    }
    case "BodyRegex": {
      const regex = safeRegex(def.expected ?? "");
      if (!regex) return { ...base, expected: def.expected ?? null, actual: null, status: "ERROR", message: "The regular expression is invalid.", evidence: "responseBody" };
      const pass = regex.test(result.responseBody ?? "");
      return { ...base, expected: def.expected ?? null, actual: pass ? "matched" : "no match", status: pass ? "PASS" : "FAIL", message: pass ? "Body matches the pattern." : "Body does not match the pattern.", evidence: "responseBody" };
    }

    case "JsonFieldExists":
    case "JsonFieldEquals":
    case "JsonFieldNotEquals":
    case "JsonFieldType":
    case "JsonFieldIsNull":
    case "JsonFieldIsNotNull":
    case "JsonFieldRegex":
    case "JsonFieldGreaterThan":
    case "JsonFieldLessThan":
    case "JsonArrayContains":
    case "JsonArrayLength": {
      const evidence = `responseBody ${def.target ?? ""}`;
      const parsed = parseJsonBody(result.responseBody);
      if (!parsed.ok) {
        return { ...base, expected: def.expected ?? null, actual: null, status: "ERROR", message: "Response body is not valid JSON.", evidence };
      }
      const { found, value } = readJsonPath(parsed.value, def.target ?? "");

      if (def.type === "JsonFieldExists") {
        return { ...base, expected: def.target ?? null, actual: found ? stringify(value) : "not found", status: found ? "PASS" : "FAIL", message: found ? `${def.target} exists.` : `${def.target} was not found.`, evidence };
      }
      if (!found) {
        return { ...base, expected: def.expected ?? null, actual: null, status: "ERROR", message: `${def.target} was not found in the response.`, evidence };
      }

      if (def.type === "JsonFieldType") {
        const actualType = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
        const pass = actualType === def.expected;
        return { ...base, expected: def.expected ?? null, actual: actualType, status: pass ? "PASS" : "FAIL", message: pass ? "Type matched." : `${def.target} was type "${actualType}", expected "${def.expected}".`, evidence };
      }
      if (def.type === "JsonFieldIsNull") {
        const pass = value === null;
        return { ...base, expected: "null", actual: stringify(value), status: pass ? "PASS" : "FAIL", message: pass ? `${def.target} is null.` : `${def.target} is not null.`, evidence };
      }
      if (def.type === "JsonFieldIsNotNull") {
        const pass = value !== null;
        return { ...base, expected: "not null", actual: stringify(value), status: pass ? "PASS" : "FAIL", message: pass ? `${def.target} is not null.` : `${def.target} is null.`, evidence };
      }
      if (def.type === "JsonFieldRegex") {
        const regex = safeRegex(def.expected ?? "");
        if (!regex) return { ...base, expected: def.expected ?? null, actual: null, status: "ERROR", message: "The regular expression is invalid.", evidence };
        const pass = regex.test(stringify(value));
        return { ...base, expected: def.expected ?? null, actual: stringify(value), status: pass ? "PASS" : "FAIL", message: pass ? "Value matches the pattern." : "Value does not match the pattern.", evidence };
      }
      if (def.type === "JsonFieldGreaterThan" || def.type === "JsonFieldLessThan") {
        const actualNum = Number(value);
        const expectedNum = Number(def.expected);
        if (Number.isNaN(actualNum) || Number.isNaN(expectedNum)) {
          return { ...base, expected: def.expected ?? null, actual: stringify(value), status: "ERROR", message: "Value is not numeric.", evidence };
        }
        const pass = def.type === "JsonFieldGreaterThan" ? actualNum > expectedNum : actualNum < expectedNum;
        return { ...base, expected: def.expected ?? null, actual: String(actualNum), status: pass ? "PASS" : "FAIL", message: pass ? "Numeric comparison passed." : `${def.target} was ${actualNum}, expected ${def.type === "JsonFieldGreaterThan" ? ">" : "<"} ${expectedNum}.`, evidence };
      }
      if (def.type === "JsonArrayContains") {
        if (!Array.isArray(value)) return { ...base, expected: def.expected ?? null, actual: stringify(value), status: "ERROR", message: `${def.target} is not an array.`, evidence };
        const pass = value.some((item) => stringify(item) === def.expected);
        return { ...base, expected: def.expected ?? null, actual: stringify(value), status: pass ? "PASS" : "FAIL", message: pass ? "Array contains the expected value." : "Array does not contain the expected value.", evidence };
      }
      if (def.type === "JsonArrayLength") {
        if (!Array.isArray(value)) return { ...base, expected: def.expected ?? null, actual: stringify(value), status: "ERROR", message: `${def.target} is not an array.`, evidence };
        const pass = value.length === Number(def.expected);
        return { ...base, expected: def.expected ?? null, actual: String(value.length), status: pass ? "PASS" : "FAIL", message: pass ? "Array length matched." : `Array length was ${value.length}, expected ${def.expected}.`, evidence };
      }

      // JsonFieldEquals / JsonFieldNotEquals
      const actualStr = stringify(value);
      const pass = actualStr === def.expected;
      const isEquals = def.type === "JsonFieldEquals";
      const finalPass = isEquals ? pass : !pass;
      return {
        ...base,
        expected: def.expected ?? null,
        actual: actualStr,
        status: finalPass ? "PASS" : "FAIL",
        message: finalPass ? "Value matched as expected." : `${def.target} was "${actualStr}"${isEquals ? `, expected "${def.expected}"` : " which was not expected"}.`,
        evidence,
      };
    }

    default:
      return { ...base, expected: def.expected ?? null, actual: null, status: "SKIPPED", message: "Unknown assertion type.", evidence: "" };
  }
}

export function evaluateAssertions(assertions: AssertionDef[], result: RunApiRequestResult): AssertionResult[] {
  return assertions.map((def) => {
    try {
      return evaluateOne(def, result);
    } catch (err) {
      return {
        id: def.id,
        name: def.name,
        type: def.type,
        expected: def.expected ?? null,
        actual: null,
        status: "ERROR",
        message: err instanceof Error ? err.message : "Assertion could not be evaluated.",
        evidence: "",
      };
    }
  });
}

// PascalCase to match the ApiTestResult Prisma enum directly (this codebase's
// other Prisma enums, e.g. ApiExecutionStatus, use PascalCase) — distinct
// from AssertionResult.status, which stays UPPERCASE per the spec's exact
// "PASS/FAIL/SKIPPED/ERROR" wording for the per-assertion Result model.
export type OverallTestResult = "Pass" | "Fail" | "Error" | "Blocked" | "Skipped";

// Aggregate verdict per the spec: an API Request only becomes an "API Test"
// once it has assertions — a plain request with none has no verdict (null),
// matching "API Request = executable interaction. API Test = executable
// interaction + expected behavior." Pass requires the transport to have
// actually succeeded AND every assertion to have passed.
export function computeOverallResult(transportStatus: "Success" | "Error" | "Blocked", assertionResults: AssertionResult[]): OverallTestResult | null {
  if (assertionResults.length === 0) return null;
  if (transportStatus === "Blocked") return "Blocked";
  if (transportStatus === "Error") return "Error";
  if (assertionResults.some((r) => r.status === "ERROR")) return "Error";
  if (assertionResults.some((r) => r.status === "FAIL")) return "Fail";
  return "Pass";
}

export type ExtractionDef = { source: "jsonPath" | "header"; path: string };

// Stage 05's variable extraction: pulls one value out of a response (JSON
// path or response header) for a workflow step to hand to the next one.
// Returns undefined (not a thrown error) when unresolvable — a workflow
// keeps going, and the next step will itself report MISSING_VARIABLES via
// the existing Stage 04 mechanism if it actually needed the value.
export function extractVariable(extraction: ExtractionDef, result: RunApiRequestResult): string | undefined {
  if (extraction.source === "header") {
    const value = result.responseHeaders?.[extraction.path.toLowerCase()];
    return value ?? undefined;
  }

  const parsed = parseJsonBody(result.responseBody);
  if (!parsed.ok) return undefined;
  const { found, value } = readJsonPath(parsed.value, extraction.path);
  if (!found) return undefined;
  return stringify(value);
}
