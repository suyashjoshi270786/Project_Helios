import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Prisma, type ApiRequest } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { accessibleProjectsWhere, findAccessibleProject, hasProjectAccess } from "../lib/access.js";
import { randomUUID } from "node:crypto";
import { runApiRequest } from "../apiStudio/index.js";
import { evaluateAssertions, computeOverallResult, extractVariable, ASSERTION_TYPES, type AssertionDef } from "../apiStudio/assertions.js";
import { acquireExecutionSlot, releaseExecutionSlot, ConcurrencyLimitError } from "../apiStudio/concurrency.js";
import { MAX_BODY_SIZE_BYTES, MAX_HEADER_COUNT, MAX_URL_LENGTH } from "../apiStudio/constants.js";
import { resolveAll, type VariableScope } from "../apiStudio/variables.js";
import { encryptSecret, decryptSecret, EncryptionNotConfiguredError } from "../apiStudio/secretCrypto.js";
import { convertPostmanCollection } from "../apiStudio/postmanImport.js";
import type { KeyValuePair } from "../apiStudio/types.js";

export const apiStudioRouter = Router();
apiStudioRouter.use(requireAuth);

const kvPairSchema = z.object({ key: z.string(), value: z.string(), enabled: z.boolean(), description: z.string().optional() });
const httpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const authTypeSchema = z.enum(["None", "Bearer", "Basic", "ApiKey"]);
const assertionTypeSchema = z.enum(ASSERTION_TYPES);
const assertionDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: assertionTypeSchema,
  target: z.string().optional(),
  expected: z.string().optional(),
});

const createRequestSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullish(),
  method: httpMethodSchema.default("GET"),
  url: z.string().min(1).max(MAX_URL_LENGTH),
  queryParams: z.array(kvPairSchema).optional(),
  headers: z.array(kvPairSchema).max(MAX_HEADER_COUNT).optional(),
  pathParams: z.array(kvPairSchema).optional(),
  bodyType: z.string().nullish(),
  body: z.string().max(MAX_BODY_SIZE_BYTES).nullish(),
  authType: authTypeSchema.default("None"),
  authConfig: z.unknown().optional(),
  assertions: z.array(assertionDefSchema).optional(),
  timeoutMs: z.number().int().min(1000).max(30000).optional(),
  // Accepted for domain completeness, but not yet wired to real behavior —
  // see the field comment on ApiRequest.followRedirects in schema.prisma.
  followRedirects: z.boolean().optional(),
  folderId: z.string().nullish(),
});

// Deliberately NOT `createRequestSchema.partial()` — Zod's `.default()` on a
// field still substitutes its default for a field that's simply absent from
// the input, even once the field is wrapped `.optional()` by `.partial()`.
// That silently reset `method` to "GET" and `authType` to "None" on every
// partial PATCH/execute-override that didn't explicitly repeat those two
// fields — a real bug caught by this stage's own smoke test. Every field
// here is independently optional with no default, so an absent key truly
// stays absent (and is excluded from the merge in `executeAndPersist`/the
// PATCH handler below) rather than clobbering the stored value.
const updateRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullish(),
  method: httpMethodSchema.optional(),
  url: z.string().min(1).max(MAX_URL_LENGTH).optional(),
  queryParams: z.array(kvPairSchema).optional(),
  headers: z.array(kvPairSchema).max(MAX_HEADER_COUNT).optional(),
  pathParams: z.array(kvPairSchema).optional(),
  bodyType: z.string().nullish(),
  body: z.string().max(MAX_BODY_SIZE_BYTES).nullish(),
  authType: authTypeSchema.optional(),
  authConfig: z.unknown().optional(),
  assertions: z.array(assertionDefSchema).optional(),
  timeoutMs: z.number().int().min(1000).max(30000).optional(),
  followRedirects: z.boolean().optional(),
  folderId: z.string().nullish(),
});
// Same shape as an update, but used purely as an in-memory override for one
// execution — never written to the database (see the execute route).
// `environmentId`/`variables` are execute-only concepts, not part of a
// saved request, so they're added on top rather than living in
// updateRequestSchema.
const executeOverrideSchema = updateRequestSchema.extend({
  environmentId: z.string().nullish(),
  // Execution-local variable overrides — highest precedence in the
  // resolution chain, for a one-off value without editing the environment.
  variables: z.record(z.string(), z.string()).optional(),
});

function toJsonArray(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

apiStudioRouter.get("/requests", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }
  if (!(await hasProjectAccess(req.userId!, projectId, "api-studio"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const requests = await prisma.apiRequest.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

apiStudioRouter.post("/requests", async (req, res) => {
  const parsed = createRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  if (!(await hasProjectAccess(req.userId!, parsed.data.projectId, "api-studio"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  if (parsed.data.folderId) {
    const folder = await prisma.apiFolder.findFirst({ where: { id: parsed.data.folderId, projectId: parsed.data.projectId } });
    if (!folder) return res.status(404).json({ error: "Folder not found." });
  }

  const { projectId, authConfig, queryParams, headers, pathParams, assertions, ...fields } = parsed.data;
  const created = await prisma.apiRequest.create({
    data: {
      ...fields,
      authConfig: toJsonArray(authConfig),
      queryParams: toJsonArray(queryParams),
      headers: toJsonArray(headers),
      pathParams: toJsonArray(pathParams),
      assertions: toJsonArray(assertions),
      projectId,
      createdById: req.userId!,
    },
  });
  res.status(201).json(created);
});

apiStudioRouter.get("/requests/:id", async (req, res) => {
  const request = await prisma.apiRequest.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }
  res.json(request);
});

apiStudioRouter.patch("/requests/:id", async (req, res) => {
  const parsed = updateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const existing = await prisma.apiRequest.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Request not found." });
  }

  if (parsed.data.folderId) {
    const folder = await prisma.apiFolder.findFirst({ where: { id: parsed.data.folderId, projectId: existing.projectId } });
    if (!folder) return res.status(404).json({ error: "Folder not found." });
  }

  const { authConfig, queryParams, headers, pathParams, assertions, ...fields } = parsed.data;
  const updated = await prisma.apiRequest.update({
    where: { id: existing.id },
    data: {
      ...fields,
      ...(authConfig !== undefined ? { authConfig: toJsonArray(authConfig) } : {}),
      ...(queryParams !== undefined ? { queryParams: toJsonArray(queryParams) } : {}),
      ...(headers !== undefined ? { headers: toJsonArray(headers) } : {}),
      ...(pathParams !== undefined ? { pathParams: toJsonArray(pathParams) } : {}),
      ...(assertions !== undefined ? { assertions: toJsonArray(assertions) } : {}),
      updatedById: req.userId!,
    },
  });
  res.json(updated);
});

apiStudioRouter.delete("/requests/:id", async (req, res) => {
  const existing = await prisma.apiRequest.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Request not found." });
  }

  await prisma.apiRequest.delete({ where: { id: existing.id } });
  res.status(204).end();
});

apiStudioRouter.post("/requests/:id/clone", async (req, res) => {
  const existing = await prisma.apiRequest.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Request not found." });
  }

  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = existing;
  const clone = await prisma.apiRequest.create({
    data: {
      ...rest,
      name: `${existing.name} (copy)`,
      createdById: req.userId!,
    } as Prisma.ApiRequestUncheckedCreateInput,
  });
  res.status(201).json(clone);
});

apiStudioRouter.get("/requests/:id/executions", async (req, res) => {
  const request = await prisma.apiRequest.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  const executions = await prisma.apiExecution.findMany({
    where: { apiRequestId: request.id },
    orderBy: { completedAt: "desc" },
  });
  res.json(executions);
});

apiStudioRouter.get("/requests/:id/executions/:executionId", async (req, res) => {
  const request = await prisma.apiRequest.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  const execution = await prisma.apiExecution.findFirst({
    where: { id: req.params.executionId, apiRequestId: request.id },
  });
  if (!execution) {
    return res.status(404).json({ error: "Execution not found." });
  }
  res.json(execution);
});

// Re-evaluates the request's CURRENT assertions against a PAST response
// snapshot, without resending the HTTP request — the spec's "Rerun" ask:
// "architect the assertion engine so stored response snapshots can be
// re-tested without resending the request." Creates a new execution row
// (never mutates the original — see the immutability note on
// ApiExecution.assertionResults) with the same transport data but fresh
// assertionResults/overallResult, linked back via retestOfId.
apiStudioRouter.post("/requests/:id/executions/:executionId/retest", async (req, res) => {
  const request = await prisma.apiRequest.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  const original = await prisma.apiExecution.findFirst({
    where: { id: req.params.executionId, apiRequestId: request.id },
  });
  if (!original) {
    return res.status(404).json({ error: "Execution not found." });
  }

  const assertions = Array.isArray(request.assertions) ? (request.assertions as unknown as AssertionDef[]) : [];
  const reconstructed = {
    status: original.status,
    statusCode: original.statusCode,
    requestUrl: original.url,
    requestHeaders: (original.requestHeaders as Record<string, string> | null) ?? {},
    responseHeaders: original.responseHeaders as Record<string, string> | null,
    responseBody: original.responseBody,
    responseTruncated: original.responseTruncated,
    responseSizeBytes: original.responseSizeBytes,
    durationMs: original.durationMs,
    errorCode: original.errorCode,
    errorMessage: original.errorMessage,
  };
  const assertionResults = evaluateAssertions(assertions, reconstructed);
  const overallResult = computeOverallResult(original.status, assertionResults);
  const now = new Date();

  const retest = await prisma.apiExecution.create({
    data: {
      apiRequestId: request.id,
      projectId: request.projectId,
      executionMode: "Manual",
      correlationId: randomUUID(),
      retestOfId: original.id,
      method: original.method,
      url: original.url,
      requestHeaders: original.requestHeaders ?? undefined,
      requestBody: original.requestBody,
      status: original.status,
      statusCode: original.statusCode,
      responseHeaders: original.responseHeaders ?? undefined,
      responseBody: original.responseBody,
      responseTruncated: original.responseTruncated,
      responseSizeBytes: original.responseSizeBytes,
      // No network call happened — durationMs still reflects the original
      // response's real speed (still meaningful data), but startedAt/
      // completedAt mark when this re-evaluation itself ran, not the
      // original network timing.
      durationMs: original.durationMs,
      errorCode: original.errorCode,
      errorMessage: original.errorMessage,
      assertionResults: assertionResults as unknown as Prisma.InputJsonValue,
      overallResult: overallResult ?? undefined,
      executedById: req.userId!,
      startedAt: now,
      completedAt: now,
    },
  });
  res.status(201).json(retest);
});

// A guessed/leaked request id could otherwise be used to drive outbound
// traffic through Helios's own network egress — throttle the one route that
// actually reaches out to the internet, same spirit as the auth/API-token
// throttles already in server/src/index.ts.
const executeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Substitutes {name} tokens in the URL with values from pathParams before
// the executor ever sees the URL.
function applyPathParams(url: string, pathParams: KeyValuePair[]): string {
  let resolved = url;
  for (const param of pathParams) {
    if (param.enabled && param.key) {
      resolved = resolved.replaceAll(`{${param.key}}`, param.value);
    }
  }
  return resolved;
}

// Loads an environment's variables and decrypts any Sensitive/Secret values
// in memory only — the decrypted map lives for the duration of one
// executeAndPersist call and is never logged, returned to a client, or
// persisted anywhere itself.
async function loadEnvironmentVariables(environmentId: string | null | undefined, projectId: string): Promise<Record<string, string>> {
  if (!environmentId) return {};
  const environment = await prisma.apiEnvironment.findFirst({
    where: { id: environmentId, projectId },
    include: { variables: true },
  });
  if (!environment) return {};

  const values: Record<string, string> = {};
  for (const variable of environment.variables) {
    if (variable.encryptedValue) {
      try {
        values[variable.key] = decryptSecret(variable.encryptedValue);
      } catch {
        // A variable that can't be decrypted (missing/rotated key, or
        // tampered data) is treated as unresolved rather than crashing the
        // whole execution — it will surface as a MISSING_VARIABLES error.
      }
    } else if (variable.value !== null) {
      values[variable.key] = variable.value;
    }
  }
  return values;
}

// Executes one ApiRequest row (with optional in-memory field overrides),
// resolves {{variable}} tokens, evaluates assertions against the result, and
// persists the ApiExecution row. Shared by the single-request execute route
// and the run-a-folder route below. `correlationId`/`executionMode` are
// supplied by the caller so a whole "Run Collection" batch can share one
// correlationId while a single Send gets its own.
async function executeAndPersist(
  request: ApiRequest,
  overrides: Partial<z.infer<typeof executeOverrideSchema>>,
  userId: string,
  correlationId: string,
) {
  const effective = { ...request, ...overrides };
  const headers = Array.isArray(effective.headers) ? (effective.headers as KeyValuePair[]) : [];
  const queryParams = Array.isArray(effective.queryParams) ? (effective.queryParams as KeyValuePair[]) : [];
  const pathParams = Array.isArray(effective.pathParams) ? (effective.pathParams as KeyValuePair[]) : [];
  const assertions = Array.isArray(effective.assertions) ? (effective.assertions as unknown as AssertionDef[]) : [];
  const environmentId = "environmentId" in overrides ? (overrides.environmentId ?? null) : null;

  // Precedence: execution-local -> request -> collection -> environment ->
  // project/system (documented in the Stage 04 plan). Only executionLocal
  // and environment have any real data source today.
  const scopes: VariableScope[] = [
    { source: "executionLocal", values: overrides.variables ?? {} },
    { source: "request", values: {} },
    { source: "collection", values: {} },
    { source: "environment", values: await loadEnvironmentVariables(environmentId, request.projectId) },
    { source: "project", values: {} },
  ];

  const { resolvedFields, missing } = resolveAll({ url: effective.url, headers, queryParams, pathParams, body: effective.body, authConfig: effective.authConfig }, scopes);

  if (missing.length > 0) {
    const now = new Date();
    return prisma.apiExecution.create({
      data: {
        apiRequestId: request.id,
        projectId: request.projectId,
        executionMode: "Manual",
        correlationId,
        environmentId: environmentId ?? undefined,
        method: effective.method,
        url: effective.url,
        status: "Error",
        errorCode: "MISSING_VARIABLES",
        errorMessage: `Missing required variable(s): ${missing.map((m) => `{{${m}}}`).join(", ")}`,
        executedById: userId,
        startedAt: now,
        completedAt: now,
      },
    });
  }

  const startedAt = new Date();
  acquireExecutionSlot();
  let result;
  try {
    result = await runApiRequest({
      method: effective.method,
      url: applyPathParams(resolvedFields.url, resolvedFields.pathParams),
      headers: resolvedFields.headers,
      queryParams: resolvedFields.queryParams,
      bodyType: effective.bodyType,
      body: resolvedFields.body,
      authType: effective.authType,
      authConfig: resolvedFields.authConfig,
      timeoutMs: effective.timeoutMs,
    });
  } finally {
    releaseExecutionSlot();
  }
  const completedAt = new Date();

  const assertionResults = evaluateAssertions(assertions, result);
  const overallResult = computeOverallResult(result.status, assertionResults);

  return prisma.apiExecution.create({
    data: {
      apiRequestId: request.id,
      projectId: request.projectId,
      executionMode: "Manual",
      correlationId,
      environmentId: environmentId ?? undefined,
      method: effective.method,
      url: result.requestUrl,
      requestHeaders: result.requestHeaders,
      requestBody: resolvedFields.body,
      status: result.status,
      statusCode: result.statusCode,
      responseHeaders: result.responseHeaders ?? undefined,
      responseBody: result.responseBody,
      responseTruncated: result.responseTruncated,
      responseSizeBytes: result.responseSizeBytes,
      durationMs: result.durationMs,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      assertionResults: assertionResults as unknown as Prisma.InputJsonValue,
      overallResult: overallResult ?? undefined,
      executedById: userId,
      startedAt,
      completedAt,
    },
  });
}

apiStudioRouter.post("/requests/:id/execute", executeRateLimit, async (req, res) => {
  const requestId = String(req.params.id);
  const request = await prisma.apiRequest.findFirst({
    where: { id: requestId, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  const parsedOverrides = executeOverrideSchema.safeParse(req.body ?? {});
  if (!parsedOverrides.success) {
    return res.status(400).json({ error: friendlyValidationError(parsedOverrides.error) });
  }

  try {
    const execution = await executeAndPersist(request, parsedOverrides.data, req.userId!, randomUUID());
    res.status(201).json(execution);
  } catch (err) {
    if (err instanceof ConcurrencyLimitError) {
      return res.status(429).json({ error: err.message });
    }
    throw err;
  }
});

// ---- Collections (folders) ----

const folderInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(2000).nullish(),
  projectId: z.string().min(1),
  parentId: z.string().nullish(),
});

apiStudioRouter.get("/folders", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }
  if (!(await hasProjectAccess(req.userId!, projectId, "api-studio"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const folders = await prisma.apiFolder.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  res.json(folders);
});

apiStudioRouter.post("/folders", async (req, res) => {
  const parsed = folderInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const project = await findAccessibleProject(req.userId!, parsed.data.projectId, "api-studio");
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.apiFolder.findFirst({ where: { id: parsed.data.parentId, projectId: parsed.data.projectId } });
    if (!parent) return res.status(404).json({ error: "Parent folder not found." });
  }

  const folder = await prisma.apiFolder.create({ data: { ...parsed.data, createdById: req.userId! } });
  res.status(201).json(folder);
});

const folderUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(2000).nullish(),
  parentId: z.string().min(1).nullable().optional(),
});

apiStudioRouter.patch("/folders/:id", async (req, res) => {
  const parsed = folderUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const existing = await prisma.apiFolder.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Folder not found." });
  }

  if (parsed.data.parentId) {
    if (parsed.data.parentId === existing.id) {
      return res.status(400).json({ error: "A folder can't be moved into itself." });
    }
    const allFolders = await prisma.apiFolder.findMany({
      where: { projectId: existing.projectId },
      select: { id: true, parentId: true },
    });
    const byId = new Map(allFolders.map((f) => [f.id, f]));
    let cursor = byId.get(parsed.data.parentId);
    if (!cursor) {
      return res.status(404).json({ error: "Target folder not found." });
    }
    while (cursor) {
      if (cursor.id === existing.id) {
        return res.status(400).json({ error: "Can't move a folder into one of its own subfolders." });
      }
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }

  const updated = await prisma.apiFolder.update({ where: { id: existing.id }, data: parsed.data });
  res.json(updated);
});

async function getApiFolderDescendantIds(projectId: string, rootId: string): Promise<string[]> {
  const allFolders = await prisma.apiFolder.findMany({ where: { projectId }, select: { id: true, parentId: true } });
  const childrenByParent = new Map<string, string[]>();
  for (const f of allFolders) {
    if (!f.parentId) continue;
    const list = childrenByParent.get(f.parentId) ?? [];
    list.push(f.id);
    childrenByParent.set(f.parentId, list);
  }
  const ids: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ids.push(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return ids;
}

apiStudioRouter.delete("/folders/:id", async (req, res) => {
  const existing = await prisma.apiFolder.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Folder not found." });
  }

  const descendantIds = await getApiFolderDescendantIds(existing.projectId, existing.id);
  const [subfolders, requests] = await Promise.all([
    prisma.apiFolder.count({ where: { id: { in: descendantIds.filter((id) => id !== existing.id) } } }),
    prisma.apiRequest.count({ where: { folderId: { in: descendantIds } } }),
  ]);

  const cascade = req.query.cascade === "true";
  if (!cascade && (subfolders > 0 || requests > 0)) {
    return res.status(409).json({ error: "This folder isn't empty.", counts: { subfolders, requests } });
  }

  await prisma.apiFolder.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// Sequentially executes every request directly inside a folder (not
// recursive into subfolders). No variable extraction/chaining between
// requests — each runs independently, exactly like clicking Send on each in
// turn. True chaining is deliberately out of scope (see the implementation plan).
const runFolderSchema = z.object({ environmentId: z.string().nullish() });

apiStudioRouter.post("/folders/:id/run", executeRateLimit, async (req, res) => {
  const folderId = String(req.params.id);
  const folder = await prisma.apiFolder.findFirst({
    where: { id: folderId, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!folder) {
    return res.status(404).json({ error: "Folder not found." });
  }

  const parsedBody = runFolderSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({ error: friendlyValidationError(parsedBody.error) });
  }

  const requests = await prisma.apiRequest.findMany({ where: { folderId: folder.id }, orderBy: { createdAt: "asc" } });
  const runCorrelationId = randomUUID();
  const executions = [];
  try {
    for (const request of requests) {
      executions.push(await executeAndPersist(request, { environmentId: parsedBody.data.environmentId }, req.userId!, runCorrelationId));
    }
  } catch (err) {
    if (err instanceof ConcurrencyLimitError) {
      return res.status(429).json({ error: err.message, executions });
    }
    throw err;
  }
  res.status(201).json(executions);
});

// ---- Environments ----

const classificationSchema = z.enum(["Public", "Configuration", "Sensitive", "Secret"]);
const environmentClassificationSchema = z.enum(["Development", "Staging", "Production"]);
const SECRET_CLASSIFICATIONS = new Set(["Sensitive", "Secret"]);

// Never returns a Sensitive/Secret value in plaintext — "never appear in
// normal API responses" per the spec. `hasValue` lets the UI show a masked
// placeholder for an already-set secret without ever receiving it.
function serializeVariable(variable: { key: string; classification: string; value: string | null; encryptedValue: string | null; createdAt: Date; updatedAt: Date }) {
  const isSecret = SECRET_CLASSIFICATIONS.has(variable.classification);
  return {
    key: variable.key,
    classification: variable.classification,
    value: isSecret ? null : variable.value,
    hasValue: isSecret ? variable.encryptedValue !== null : variable.value !== null,
    createdAt: variable.createdAt,
    updatedAt: variable.updatedAt,
  };
}

apiStudioRouter.get("/environments", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }
  if (!(await hasProjectAccess(req.userId!, projectId, "api-studio"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const environments = await prisma.apiEnvironment.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { variables: true },
  });
  res.json(environments.map((e) => ({ ...e, variables: e.variables.map(serializeVariable) })));
});

const environmentInputSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullish(),
  classification: environmentClassificationSchema.default("Development"),
});

apiStudioRouter.post("/environments", async (req, res) => {
  const parsed = environmentInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  if (!(await hasProjectAccess(req.userId!, parsed.data.projectId, "api-studio"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const environment = await prisma.apiEnvironment.create({ data: { ...parsed.data, createdById: req.userId! } });
  res.status(201).json({ ...environment, variables: [] });
});

const environmentUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullish(),
  classification: environmentClassificationSchema.optional(),
});

apiStudioRouter.patch("/environments/:id", async (req, res) => {
  const parsed = environmentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const existing = await prisma.apiEnvironment.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Environment not found." });
  }

  const updated = await prisma.apiEnvironment.update({
    where: { id: existing.id },
    data: parsed.data,
    include: { variables: true },
  });
  res.json({ ...updated, variables: updated.variables.map(serializeVariable) });
});

apiStudioRouter.delete("/environments/:id", async (req, res) => {
  const existing = await prisma.apiEnvironment.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Environment not found." });
  }

  await prisma.apiEnvironment.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const variableUpsertSchema = z.object({
  classification: classificationSchema.default("Configuration"),
  // Omit entirely to leave an existing Sensitive/Secret value unchanged
  // (write-only, like changing a password) — only a non-empty value actually
  // updates/creates the stored value.
  value: z.string().max(10_000).optional(),
});

apiStudioRouter.patch("/environments/:id/variables/:key", async (req, res) => {
  const parsed = variableUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const environment = await prisma.apiEnvironment.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!environment) {
    return res.status(404).json({ error: "Environment not found." });
  }

  const key = req.params.key;
  const isSecret = SECRET_CLASSIFICATIONS.has(parsed.data.classification);

  let value: string | null | undefined;
  let encryptedValue: string | null | undefined;
  if (parsed.data.value !== undefined) {
    if (isSecret) {
      try {
        encryptedValue = encryptSecret(parsed.data.value);
        value = null;
      } catch (err) {
        if (err instanceof EncryptionNotConfiguredError) {
          return res.status(503).json({ error: "Secret storage isn't configured on this server yet — contact an administrator." });
        }
        throw err;
      }
    } else {
      value = parsed.data.value;
      encryptedValue = null;
    }
  }

  const variable = await prisma.apiEnvironmentVariable.upsert({
    where: { environmentId_key: { environmentId: environment.id, key } },
    create: {
      environmentId: environment.id,
      key,
      classification: parsed.data.classification,
      value: value ?? null,
      encryptedValue: encryptedValue ?? null,
    },
    update: {
      classification: parsed.data.classification,
      ...(value !== undefined ? { value } : {}),
      ...(encryptedValue !== undefined ? { encryptedValue } : {}),
    },
  });
  res.status(201).json(serializeVariable(variable));
});

apiStudioRouter.delete("/environments/:id/variables/:key", async (req, res) => {
  const environment = await prisma.apiEnvironment.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!environment) {
    return res.status(404).json({ error: "Environment not found." });
  }

  await prisma.apiEnvironmentVariable.deleteMany({ where: { environmentId: environment.id, key: req.params.key } });
  res.status(204).end();
});

// ---- Workflows (chained, ordered, multi-request scenarios) ----

const extractionSchema = z.object({
  id: z.string(),
  source: z.enum(["jsonPath", "header"]),
  path: z.string(),
  variableName: z.string(),
});
const workflowStepSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  apiRequestId: z.string(),
  extractions: z.array(extractionSchema).optional(),
});
type WorkflowStep = z.infer<typeof workflowStepSchema>;
const failurePolicySchema = z.enum(["Stop", "Continue", "ContinueButMarkFailed"]);

const workflowInputSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullish(),
  failurePolicy: failurePolicySchema.default("Stop"),
});

apiStudioRouter.get("/workflows", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }
  if (!(await hasProjectAccess(req.userId!, projectId, "api-studio"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const workflows = await prisma.apiWorkflow.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  res.json(workflows);
});

apiStudioRouter.post("/workflows", async (req, res) => {
  const parsed = workflowInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  if (!(await hasProjectAccess(req.userId!, parsed.data.projectId, "api-studio"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const workflow = await prisma.apiWorkflow.create({ data: { ...parsed.data, createdById: req.userId!, steps: [] } });
  res.status(201).json(workflow);
});

apiStudioRouter.get("/workflows/:id", async (req, res) => {
  const workflow = await prisma.apiWorkflow.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!workflow) {
    return res.status(404).json({ error: "Workflow not found." });
  }
  res.json(workflow);
});

const workflowUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullish(),
  failurePolicy: failurePolicySchema.optional(),
  // The step editor always sends the full ordered array back — same
  // "replace wholesale" pattern as ApiRequest.assertions.
  steps: z.array(workflowStepSchema).optional(),
});

apiStudioRouter.patch("/workflows/:id", async (req, res) => {
  const parsed = workflowUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const existing = await prisma.apiWorkflow.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Workflow not found." });
  }

  const { steps, ...fields } = parsed.data;
  const updated = await prisma.apiWorkflow.update({
    where: { id: existing.id },
    data: { ...fields, ...(steps !== undefined ? { steps: steps as unknown as Prisma.InputJsonValue } : {}) },
  });
  res.json(updated);
});

apiStudioRouter.delete("/workflows/:id", async (req, res) => {
  const existing = await prisma.apiWorkflow.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Workflow not found." });
  }

  await prisma.apiWorkflow.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// Runs an ordered workflow: each step executes via the SAME executeAndPersist
// used everywhere else (real ApiExecution row, full assertion/masking
// pipeline), chaining extracted values through a plain in-memory `variables`
// map — the Stage 04 execution-local scope, at its highest precedence — that
// is never written to any ApiEnvironment row. Failure policy semantics:
//   Stop                  -> halt immediately on the first failed step; overall Fail.
//   Continue              -> run every step regardless; failures are visible
//                            per-step but don't fail the overall run (treated
//                            as informational/non-fatal).
//   ContinueButMarkFailed -> run every step regardless; overall Fail if any
//                            step failed.
async function runWorkflowAndPersist(workflow: { id: string; projectId: string; failurePolicy: string; steps: unknown }, environmentId: string | null | undefined, userId: string) {
  const steps = (Array.isArray(workflow.steps) ? (workflow.steps as WorkflowStep[]) : []).slice().sort((a, b) => a.order - b.order);
  const runCorrelationId = randomUUID();
  const variables: Record<string, string> = {};
  const stepTraces: Record<string, unknown>[] = [];
  let anyFailed = false;

  for (const step of steps) {
    const request = await prisma.apiRequest.findFirst({ where: { id: step.apiRequestId, projectId: workflow.projectId } });
    if (!request) {
      stepTraces.push({ stepId: step.id, apiRequestId: step.apiRequestId, apiExecutionId: null, extractedVariables: {}, status: "Error", message: "Request not found." });
      if (workflow.failurePolicy === "Stop") {
        anyFailed = true;
        break;
      }
      if (workflow.failurePolicy === "ContinueButMarkFailed") anyFailed = true;
      continue;
    }

    const execution = await executeAndPersist(request, { environmentId, variables }, userId, runCorrelationId);
    const stepFailed = execution.status !== "Success" || execution.overallResult === "Fail" || execution.overallResult === "Error";

    const reconstructed = {
      status: execution.status,
      statusCode: execution.statusCode,
      requestUrl: execution.url,
      requestHeaders: (execution.requestHeaders as Record<string, string> | null) ?? {},
      responseHeaders: execution.responseHeaders as Record<string, string> | null,
      responseBody: execution.responseBody,
      responseTruncated: execution.responseTruncated,
      responseSizeBytes: execution.responseSizeBytes,
      durationMs: execution.durationMs,
      errorCode: execution.errorCode,
      errorMessage: execution.errorMessage,
    };
    const extracted: Record<string, string> = {};
    for (const ext of step.extractions ?? []) {
      const value = extractVariable({ source: ext.source, path: ext.path }, reconstructed);
      if (value !== undefined) {
        extracted[ext.variableName] = value;
        variables[ext.variableName] = value;
      }
    }

    stepTraces.push({
      stepId: step.id,
      apiRequestId: request.id,
      apiExecutionId: execution.id,
      extractedVariables: extracted,
      status: stepFailed ? "Fail" : "Pass",
    });

    if (stepFailed) {
      if (workflow.failurePolicy === "Stop") {
        anyFailed = true;
        break;
      }
      if (workflow.failurePolicy === "ContinueButMarkFailed") anyFailed = true;
    }
  }

  return prisma.apiWorkflowRun.create({
    data: {
      workflowId: workflow.id,
      projectId: workflow.projectId,
      correlationId: runCorrelationId,
      overallResult: anyFailed ? "Fail" : "Pass",
      steps: stepTraces as unknown as Prisma.InputJsonValue,
      executedById: userId,
    },
  });
}

const runWorkflowSchema = z.object({ environmentId: z.string().nullish() });

apiStudioRouter.post("/workflows/:id/run", executeRateLimit, async (req, res) => {
  const workflowId = String(req.params.id);
  const workflow = await prisma.apiWorkflow.findFirst({
    where: { id: workflowId, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!workflow) {
    return res.status(404).json({ error: "Workflow not found." });
  }

  const parsedBody = runWorkflowSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({ error: friendlyValidationError(parsedBody.error) });
  }

  try {
    const run = await runWorkflowAndPersist(workflow, parsedBody.data.environmentId, req.userId!);
    res.status(201).json(run);
  } catch (err) {
    if (err instanceof ConcurrencyLimitError) {
      return res.status(429).json({ error: err.message });
    }
    throw err;
  }
});

apiStudioRouter.get("/workflows/:id/runs", async (req, res) => {
  const workflow = await prisma.apiWorkflow.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!workflow) {
    return res.status(404).json({ error: "Workflow not found." });
  }

  const runs = await prisma.apiWorkflowRun.findMany({ where: { workflowId: workflow.id }, orderBy: { completedAt: "desc" } });
  res.json(runs);
});

// ---- Folder duplicate ----

// Recursively deep-copies a folder, every subfolder, and every request
// inside them (new ids throughout, same project) — closes the Collections
// "duplicate" verb gap from the spec.
apiStudioRouter.post("/folders/:id/duplicate", async (req, res) => {
  const existing = await prisma.apiFolder.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Folder not found." });
  }

  const descendantIds = await getApiFolderDescendantIds(existing.projectId, existing.id);
  const [allFolders, allRequests] = await Promise.all([
    prisma.apiFolder.findMany({ where: { id: { in: descendantIds } } }),
    prisma.apiRequest.findMany({ where: { folderId: { in: descendantIds } } }),
  ]);

  const newRootId = await prisma.$transaction(async (tx) => {
    const idMap = new Map<string, string>();

    // Parents before children — allFolders isn't guaranteed to already be in
    // that order, so walk it repeatedly until every folder's parent (or the
    // root, which has no parent to wait for) has been created.
    const pending = [...allFolders];
    while (pending.length > 0) {
      const index = pending.findIndex((f) => f.id === existing.id || (f.parentId && idMap.has(f.parentId)));
      const folder = pending.splice(index, 1)[0];
      const created = await tx.apiFolder.create({
        data: {
          name: folder.id === existing.id ? `${folder.name} (copy)` : folder.name,
          description: folder.description,
          projectId: folder.projectId,
          parentId: folder.id === existing.id ? null : idMap.get(folder.parentId!),
          createdById: req.userId!,
        },
      });
      idMap.set(folder.id, created.id);
    }

    for (const request of allRequests) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, folderId, ...rest } = request;
      await tx.apiRequest.create({
        data: { ...rest, folderId: idMap.get(folderId!), createdById: req.userId! } as Prisma.ApiRequestUncheckedCreateInput,
      });
    }

    return idMap.get(existing.id)!;
  });

  const newRoot = await prisma.apiFolder.findUnique({ where: { id: newRootId } });
  res.status(201).json(newRoot);
});

// ---- Postman collection import ----

const postmanImportSchema = z.object({
  projectId: z.string().min(1),
  folderId: z.string().nullish(),
  collection: z.unknown(),
});

apiStudioRouter.post("/import/postman", async (req, res) => {
  const parsed = postmanImportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  if (!(await hasProjectAccess(req.userId!, parsed.data.projectId, "api-studio"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  if (parsed.data.folderId) {
    const folder = await prisma.apiFolder.findFirst({ where: { id: parsed.data.folderId, projectId: parsed.data.projectId } });
    if (!folder) return res.status(404).json({ error: "Folder not found." });
  }

  const { folders, requests, warnings } = convertPostmanCollection(parsed.data.collection);

  const result = await prisma.$transaction(async (tx) => {
    const idMap = new Map<string, string>();

    const pending = [...folders];
    while (pending.length > 0) {
      const index = pending.findIndex((f) => !f.parentTempId || idMap.has(f.parentTempId));
      const folder = pending.splice(index, 1)[0];
      const created = await tx.apiFolder.create({
        data: {
          name: folder.name,
          projectId: parsed.data.projectId,
          parentId: folder.parentTempId ? idMap.get(folder.parentTempId) : (parsed.data.folderId ?? null),
          createdById: req.userId!,
        },
      });
      idMap.set(folder.tempId, created.id);
    }

    for (const request of requests) {
      await tx.apiRequest.create({
        data: {
          name: request.name,
          method: request.method,
          url: request.url,
          queryParams: request.queryParams as unknown as Prisma.InputJsonValue,
          headers: request.headers as unknown as Prisma.InputJsonValue,
          bodyType: request.bodyType,
          body: request.body,
          authType: request.authType,
          authConfig: request.authConfig as Prisma.InputJsonValue,
          folderId: request.folderTempId ? idMap.get(request.folderTempId) : (parsed.data.folderId ?? null),
          projectId: parsed.data.projectId,
          createdById: req.userId!,
        },
      });
    }

    return { foldersCreated: folders.length, requestsCreated: requests.length };
  });

  res.status(201).json({ ...result, warnings });
});
