import type { KeyValuePair } from "./types.js";

// Centralized variable resolution — per the spec, "do not implement separate
// parsers in UI components." This is the ONLY place {{name}} tokens ever get
// resolved; the client never attempts this itself.

export type VariableScopeSource = "executionLocal" | "request" | "collection" | "environment" | "project";
export type VariableScope = { source: VariableScopeSource; values: Record<string, string> };

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export type ResolveResult = { resolved: string; missing: string[] };

// Precedence is execution-local -> request -> collection -> environment ->
// project/system (first match wins), exactly as documented in the Stage 04
// spec. Callers pass whichever scopes actually have data today
// (executionLocal, environment) — request/collection/project are accepted
// as empty scopes so a later stage can populate them without this function
// changing.
export function resolveTemplate(template: string, scopes: VariableScope[]): ResolveResult {
  const missing: string[] = [];
  const resolved = template.replace(TOKEN_PATTERN, (match, name: string) => {
    for (const scope of scopes) {
      if (Object.prototype.hasOwnProperty.call(scope.values, name)) {
        return scope.values[name];
      }
    }
    missing.push(name);
    return match;
  });
  return { resolved, missing };
}

export type ResolvableFields = {
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  pathParams: KeyValuePair[];
  body: string | null;
  authConfig: unknown;
};

function resolveAuthConfig(authConfig: unknown, scopes: VariableScope[], missing: Set<string>): unknown {
  if (!authConfig || typeof authConfig !== "object") return authConfig;
  const config = authConfig as Record<string, unknown>;
  const resolvedConfig: Record<string, unknown> = { ...config };
  for (const field of ["token", "username", "password", "key", "value"]) {
    if (typeof config[field] === "string") {
      const { resolved, missing: fieldMissing } = resolveTemplate(config[field] as string, scopes);
      resolvedConfig[field] = resolved;
      fieldMissing.forEach((m) => missing.add(m));
    }
  }
  return resolvedConfig;
}

function resolvePairs(pairs: KeyValuePair[], scopes: VariableScope[], missing: Set<string>): KeyValuePair[] {
  return pairs.map((pair) => {
    const { resolved, missing: pairMissing } = resolveTemplate(pair.value, scopes);
    pairMissing.forEach((m) => missing.add(m));
    return { ...pair, value: resolved };
  });
}

// Walks every user-editable string field of a request (url, each header/
// queryParam/pathParam value, body text, and authConfig's string fields)
// through resolveTemplate, collecting every unresolved {{name}} across all
// of them into one deduplicated `missing` list.
export function resolveAll(fields: ResolvableFields, scopes: VariableScope[]): { resolvedFields: ResolvableFields; missing: string[] } {
  const missing = new Set<string>();

  const urlResult = resolveTemplate(fields.url, scopes);
  urlResult.missing.forEach((m) => missing.add(m));

  const headers = resolvePairs(fields.headers, scopes, missing);
  const queryParams = resolvePairs(fields.queryParams, scopes, missing);
  const pathParams = resolvePairs(fields.pathParams, scopes, missing);

  let body = fields.body;
  if (body) {
    const bodyResult = resolveTemplate(body, scopes);
    body = bodyResult.resolved;
    bodyResult.missing.forEach((m) => missing.add(m));
  }

  const authConfig = resolveAuthConfig(fields.authConfig, scopes, missing);

  return {
    resolvedFields: { url: urlResult.resolved, headers, queryParams, pathParams, body, authConfig },
    missing: [...missing],
  };
}
