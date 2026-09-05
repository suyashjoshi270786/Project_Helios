import crypto from "node:crypto";
import type { ApiAuthType, HttpMethod } from "@prisma/client";
import type { KeyValuePair } from "./types.js";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export type ConvertedFolder = { tempId: string; name: string; parentTempId: string | null };
export type ConvertedRequest = {
  name: string;
  method: HttpMethod;
  url: string;
  queryParams: KeyValuePair[];
  headers: KeyValuePair[];
  bodyType: string | null;
  body: string | null;
  authType: ApiAuthType;
  authConfig: unknown;
  folderTempId: string | null;
};

type PostmanKeyValue = { key: string; value?: string; disabled?: boolean };
type PostmanAuthParam = { key: string; value?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Helios keeps query parameters as a separate editable table rather than
// baked into the URL string (see ParamsTab/KeyValueTable) — the executor
// appends them onto the URL at send time (executor.ts's buildFinalUrl), so
// leaving Postman's querystring embedded in `url` here would double it up.
// Splitting on the raw string itself (not Postman's separate `url.query[]`
// metadata) guarantees nothing is lost even for a minimal export where
// `query[]` is absent or out of sync with `raw`.
function splitUrlAndQuery(url: unknown): { url: string; queryParams: KeyValuePair[] } {
  const raw = typeof url === "string" ? url : isRecord(url) && typeof url.raw === "string" ? url.raw : "";
  const queryIndex = raw.indexOf("?");
  if (queryIndex === -1) return { url: raw, queryParams: [] };

  const base = raw.slice(0, queryIndex);
  const queryParams = raw
    .slice(queryIndex + 1)
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const eqIndex = pair.indexOf("=");
      const key = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
      const value = eqIndex === -1 ? "" : pair.slice(eqIndex + 1);
      return { key: safeDecode(key), value: safeDecode(value), enabled: true };
    });
  return { url: base, queryParams };
}

function extractHeaders(header: unknown): KeyValuePair[] {
  if (!Array.isArray(header)) return [];
  return header
    .filter((h): h is PostmanKeyValue => isRecord(h) && typeof h.key === "string")
    .map((h) => ({ key: h.key, value: h.value ?? "", enabled: !h.disabled }));
}

function extractBody(body: unknown, warnings: string[], requestName: string): { bodyType: string | null; body: string | null } {
  if (!isRecord(body) || !body.mode) return { bodyType: null, body: null };
  if (body.mode === "raw" && typeof body.raw === "string") {
    const language = isRecord(body.options) && isRecord(body.options.raw) ? body.options.raw.language : undefined;
    return { bodyType: language === "json" ? "json" : "text", body: body.raw };
  }
  if (body.mode !== "raw") {
    warnings.push(`"${requestName}": body mode "${body.mode}" isn't supported yet — imported with no body.`);
  }
  return { bodyType: null, body: null };
}

function authParamValue(params: unknown, key: string): string {
  if (!Array.isArray(params)) return "";
  const found = params.find((p): p is PostmanAuthParam => isRecord(p) && p.key === key);
  return found && typeof found.value === "string" ? found.value : "";
}

const TEMPLATE_VAR_PATTERN = /\{\{([^{}]+)\}\}/g;

// Flags anything the user will need to act on before this request can
// actually send — either fill in a value the source file left blank, or
// define a {{variable}} the file referenced. Surfaced in the import summary
// so the gap is visible immediately, not just as a runtime send failure.
function warnAboutAuthValue(warnings: string[], requestName: string, authTypeLabel: string, values: string[]) {
  const variables = new Set(values.flatMap((v) => [...v.matchAll(TEMPLATE_VAR_PATTERN)].map((m) => m[1].trim())));
  if (variables.size > 0) {
    const list = [...variables].map((v) => `{{${v}}}`).join(", ");
    warnings.push(`"${requestName}" uses ${authTypeLabel} auth with ${list} — define ${variables.size === 1 ? "that variable" : "those variables"} in an Environment before sending.`);
  } else if (values.every((v) => !v)) {
    warnings.push(`"${requestName}" requires ${authTypeLabel} auth but the source file left it blank — fill it in on the Auth tab before sending.`);
  }
}

function extractAuth(auth: unknown, warnings: string[], requestName: string): { authType: ApiAuthType; authConfig: unknown } {
  if (!isRecord(auth) || !auth.type || auth.type === "noauth") return { authType: "None", authConfig: {} };

  if (auth.type === "bearer") {
    const token = authParamValue(auth.bearer, "token");
    warnAboutAuthValue(warnings, requestName, "Bearer", [token]);
    return { authType: "Bearer", authConfig: { token } };
  }
  if (auth.type === "basic") {
    const username = authParamValue(auth.basic, "username");
    const password = authParamValue(auth.basic, "password");
    warnAboutAuthValue(warnings, requestName, "Basic", [username, password]);
    return { authType: "Basic", authConfig: { username, password } };
  }
  if (auth.type === "apikey") {
    const value = authParamValue(auth.apikey, "value");
    warnAboutAuthValue(warnings, requestName, "API Key", [value]);
    return {
      authType: "ApiKey",
      authConfig: {
        key: authParamValue(auth.apikey, "key"),
        value,
        in: authParamValue(auth.apikey, "in") === "query" ? "query" : "header",
      },
    };
  }
  warnings.push(`"${requestName}": auth type "${auth.type}" isn't supported yet — imported with no auth.`);
  return { authType: "None", authConfig: {} };
}

// Recursively walks Postman's item[] tree (an item with its own item[] is a
// folder; one with a `request` object is a request leaf) into flat arrays of
// folders/requests referencing each other by locally-generated tempIds — the
// caller creates real DB rows parent-first and remaps tempId -> real id.
export function convertPostmanCollection(collection: unknown): { folders: ConvertedFolder[]; requests: ConvertedRequest[]; warnings: string[] } {
  const folders: ConvertedFolder[] = [];
  const requests: ConvertedRequest[] = [];
  const warnings: string[] = [];

  function walk(items: unknown, parentTempId: string | null) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!isRecord(item) || typeof item.name !== "string") continue;

      if (Array.isArray(item.item)) {
        const tempId = crypto.randomUUID();
        folders.push({ tempId, name: item.name, parentTempId });
        walk(item.item, tempId);
        continue;
      }

      if (isRecord(item.request)) {
        const request = item.request;
        const methodRaw = typeof request.method === "string" ? request.method.toUpperCase() : "GET";
        const method = (HTTP_METHODS.has(methodRaw) ? methodRaw : "GET") as HttpMethod;
        if (!HTTP_METHODS.has(methodRaw)) {
          warnings.push(`"${item.name}": method "${request.method}" isn't supported — imported as GET.`);
        }
        const { bodyType, body } = extractBody(request.body, warnings, item.name);
        const { authType, authConfig } = extractAuth(request.auth, warnings, item.name);
        const { url, queryParams } = splitUrlAndQuery(request.url);
        requests.push({
          name: item.name,
          method,
          url,
          queryParams,
          headers: extractHeaders(request.header),
          bodyType,
          body,
          authType,
          authConfig,
          folderTempId: parentTempId,
        });
      }
    }
  }

  // Always wrap the import in one root folder named after the collection
  // itself — a Postman collection with requests sitting directly in its
  // top-level item[] (no nested sub-folder) would otherwise import as
  // ungrouped requests at the project root, losing the fact that they came
  // from a collection at all. This matches Postman's own tree, which always
  // shows the collection itself as the top-level node.
  const rootItems = isRecord(collection) ? collection.item : undefined;
  const collectionName = isRecord(collection) && isRecord(collection.info) && typeof collection.info.name === "string" ? collection.info.name : "Imported Collection";
  const rootFolderId = crypto.randomUUID();
  folders.push({ tempId: rootFolderId, name: collectionName, parentTempId: null });
  walk(rootItems, rootFolderId);

  return { folders, requests, warnings };
}
