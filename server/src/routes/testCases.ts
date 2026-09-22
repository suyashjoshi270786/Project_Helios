import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { buildImportPreview, guessColumnMapping, parseCsvHeadersAndRows, type ColumnMapping } from "../lib/csvImport.js";
import { friendlyValidationError } from "../lib/validation.js";
import { accessibleProjectsWhere, hasProjectAccess } from "../lib/access.js";
import { STEPS_TO_GHERKIN_PROVIDERS, GHERKIN_TO_STEPS_PROVIDERS, type TestCaseConvertProvider } from "../lib/ai/testCaseConvert.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const testCasesRouter = Router();
testCasesRouter.use(requireAuth);

const stepInputSchema = z.object({
  description: z.string().min(1),
  testData: z.string().optional(),
  expectedResult: z.string().min(1),
});

// Manual cases use step-by-step `steps`; Automated cases use a single Gherkin
// script instead — enforced in the POST handler below (based on testType),
// since PATCH needs every field optional for partial updates.
const testCaseInputSchema = z.object({
  name: z.string().min(1),
  objective: z.string().optional(),
  preconditions: z.string().optional(),
  environment: z.string().optional(),
  testPhase: z.string().optional(),
  testType: z.enum(["Manual", "Automated"]).default("Manual"),
  testSuiteId: z.string().min(1),
  projectId: z.string().min(1),
  steps: z.array(stepInputSchema).optional(),
  gherkinScript: z.string().optional(),
});

function validateStepsOrGherkin(testType: "Manual" | "Automated", steps?: unknown[], gherkinScript?: string) {
  if (testType === "Manual" && (!steps || steps.length === 0)) {
    return "At least one test step is required for a Manual test case.";
  }
  if (testType === "Automated" && !gherkinScript?.trim()) {
    return "A Gherkin script is required for an Automated test case.";
  }
  return null;
}

const listQuerySchema = z.object({
  projectId: z.string().min(1),
  testSuiteId: z.string().optional(),
  search: z.string().optional(),
  environment: z.string().optional(),
  testPhase: z.string().optional(),
  testType: z.enum(["Manual", "Automated"]).optional(),
  includeArchived: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

testCasesRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { projectId, testSuiteId, search, environment, testPhase, testType, includeArchived, take, skip } =
    parsed.data;

  if (!(await hasProjectAccess(req.userId!, projectId, "test-cases"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const where: Prisma.TestCaseWhereInput = {
    projectId,
    testSuiteId,
    environment,
    testPhase,
    testType,
    archived: includeArchived ? undefined : false,
    name: search ? { contains: search, mode: "insensitive" } : undefined,
  };

  const [testCases, total] = await Promise.all([
    prisma.testCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        _count: { select: { steps: true } },
        // Most recent cycle run for this case, if any — drives the real
        // pass/fail counts on the Test Cases stats bar (never fabricated).
        cycleTests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { execution: { select: { status: true } } },
        },
      },
    }),
    prisma.testCase.count({ where }),
  ]);

  res.json({
    testCases: testCases.map(({ _count, cycleTests, ...tc }) => ({
      ...tc,
      stepCount: _count.steps,
      latestStatus: cycleTests[0]?.execution?.status ?? "NotExecuted",
    })),
    total,
  });
});

testCasesRouter.post("/", async (req, res) => {
  const parsed = testCaseInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { steps, testSuiteId, projectId, ...fields } = parsed.data;

  const stepError = validateStepsOrGherkin(fields.testType, steps, fields.gherkinScript);
  if (stepError) {
    return res.status(400).json({ error: stepError });
  }

  const testSuite = await prisma.testSuite.findFirst({
    where: { id: testSuiteId, projectId, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!testSuite) {
    return res.status(404).json({ error: "Test suite not found." });
  }

  const testCase = await prisma.$transaction(async (tx) => {
    const existingCount = await tx.testCase.count({ where: { projectId } });
    const code = `TC-${String(existingCount + 1).padStart(4, "0")}`;

    const created = await tx.testCase.create({
      data: {
        ...fields,
        code,
        testSuiteId,
        projectId,
        createdById: req.userId!,
      },
    });

    if (steps && steps.length > 0) {
      await tx.testStep.createMany({
        data: steps.map((step, index) => ({ ...step, testCaseId: created.id, stepNumber: index + 1 })),
      });
    }

    return tx.testCase.findUniqueOrThrow({ where: { id: created.id }, include: { steps: { orderBy: { stepNumber: "asc" } } } });
  });

  res.status(201).json(testCase);
});

// Converts between a Test Case's two representations (manual steps <->
// Gherkin script) so switching "Test Type" in the editor doesn't discard
// work already done in the other format. Does not touch the database —
// the editor applies the result to its local draft and the user still
// explicitly saves, same as any other field edit.
const convertSchema = z.object({
  direction: z.enum(["stepsToGherkin", "gherkinToSteps"]),
  name: z.string().min(1),
  objective: z.string().optional(),
  steps: z.array(stepInputSchema).optional(),
  gherkinScript: z.string().optional(),
  provider: z.enum(["gemini", "anthropic", "openai"]).default("gemini"),
});

testCasesRouter.post("/convert", async (req, res) => {
  const parsed = convertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { direction, name, objective, steps, gherkinScript, provider } = parsed.data;

  if (direction === "stepsToGherkin") {
    if (!steps || steps.length === 0) {
      return res.status(400).json({ error: "Add at least one complete step before converting to Gherkin." });
    }
    const generate = STEPS_TO_GHERKIN_PROVIDERS[provider as TestCaseConvertProvider];
    if (!generate) {
      return res.status(400).json({ error: "This model isn't available yet." });
    }
    try {
      const result = await generate({ name, objective, steps });
      return res.json(result);
    } catch (err) {
      console.error("Steps->Gherkin conversion failed:", err);
      return res.status(502).json({ error: "Could not convert the steps to Gherkin right now. Try again shortly." });
    }
  }

  if (!gherkinScript?.trim()) {
    return res.status(400).json({ error: "Write a Gherkin script before converting it to steps." });
  }
  const generate = GHERKIN_TO_STEPS_PROVIDERS[provider as TestCaseConvertProvider];
  if (!generate) {
    return res.status(400).json({ error: "This model isn't available yet." });
  }
  try {
    const result = await generate({ name, objective, gherkinScript });
    return res.json(result);
  } catch (err) {
    console.error("Gherkin->Steps conversion failed:", err);
    return res.status(502).json({ error: "Could not convert the Gherkin script to steps right now. Try again shortly." });
  }
});

const importQuerySchema = z.object({
  projectId: z.string().min(1),
  testSuiteId: z.string().min(1),
});

async function assertTestSuiteOwned(userId: string | undefined, projectId: string, testSuiteId: string) {
  return prisma.testSuite.findFirst({ where: { id: testSuiteId, projectId, project: accessibleProjectsWhere(userId!) } });
}

testCasesRouter.post("/import/parse", upload.single("file"), async (req, res) => {
  const parsed = importQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "projectId and testSuiteId are required." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Upload a CSV file." });
  }
  if (!req.file.originalname.toLowerCase().endsWith(".csv")) {
    return res.status(400).json({ error: "Only .csv files are supported." });
  }

  const testSuite = await assertTestSuiteOwned(req.userId, parsed.data.projectId, parsed.data.testSuiteId);
  if (!testSuite) {
    return res.status(404).json({ error: "Test suite not found." });
  }

  const result = parseCsvHeadersAndRows(req.file.buffer);
  if ("fatalError" in result) {
    return res.status(400).json({ error: result.fatalError });
  }
  res.json({
    headers: result.headers,
    rows: result.rows,
    totalRows: result.rows.length,
    guessedMapping: guessColumnMapping(result.headers),
  });
});

const validateInputSchema = z.object({
  projectId: z.string().min(1),
  testSuiteId: z.string().min(1),
  rows: z.array(z.record(z.string(), z.string())).min(1),
  mapping: z.record(z.string(), z.string().nullish()),
});

testCasesRouter.post("/import/validate", async (req, res) => {
  const parsed = validateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const testSuite = await assertTestSuiteOwned(req.userId, parsed.data.projectId, parsed.data.testSuiteId);
  if (!testSuite) {
    return res.status(404).json({ error: "Test suite not found." });
  }

  const result = buildImportPreview(parsed.data.rows, parsed.data.mapping as ColumnMapping);
  if ("fatalError" in result) {
    return res.status(400).json({ error: result.fatalError });
  }
  res.json(result.preview);
});

const importCandidateSchema = z.object({
  name: z.string().min(1),
  objective: z.string().optional(),
  preconditions: z.string().optional(),
  environment: z.string().optional(),
  testPhase: z.string().optional(),
  testType: z.enum(["Manual", "Automated"]).default("Manual"),
  steps: z.array(stepInputSchema).min(1),
});

const importInputSchema = z.object({
  projectId: z.string().min(1),
  testSuiteId: z.string().min(1),
  testCases: z.array(importCandidateSchema).min(1),
});

testCasesRouter.post("/import", async (req, res) => {
  const parsed = importInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { projectId, testSuiteId, testCases } = parsed.data;

  const testSuite = await prisma.testSuite.findFirst({
    where: { id: testSuiteId, projectId, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!testSuite) {
    return res.status(404).json({ error: "Test suite not found." });
  }

  const created = await prisma.$transaction(async (tx) => {
    const existingCount = await tx.testCase.count({ where: { projectId } });
    const results = [];
    for (let i = 0; i < testCases.length; i++) {
      const { steps, ...fields } = testCases[i];
      const code = `TC-${String(existingCount + i + 1).padStart(4, "0")}`;
      const newCase = await tx.testCase.create({
        data: { ...fields, code, testSuiteId, projectId, createdById: req.userId! },
      });
      await tx.testStep.createMany({
        data: steps.map((step, index) => ({ ...step, testCaseId: newCase.id, stepNumber: index + 1 })),
      });
      results.push(newCase);
    }
    return results;
  });

  res.status(201).json({ imported: created.length });
});

// Same "retry the whole transaction on a (projectId, code) collision" idea
// used by the Requirement->Test Case generator (generateForRequirement
// above/in requirements.ts) — a bulk copy creates several new codes at
// once, so it needs the same protection a single POST / doesn't.
const CODE_CONFLICT_MAX_ATTEMPTS = 5;

const bulkTargetSchema = z.object({
  testCaseIds: z.array(z.string().min(1)).min(1).max(200),
  testSuiteId: z.string().min(1),
});

// Plain updateMany — no codes are touched, nothing to retry. Folder
// location is organizational metadata only: this changes testSuiteId and
// nothing else, so the case's id, Requirement link, Work Item links, and
// execution history are all untouched by construction.
testCasesRouter.post("/bulk-move", async (req, res) => {
  const parsed = bulkTargetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  const { testCaseIds, testSuiteId } = parsed.data;

  const destination = await prisma.testSuite.findFirst({
    where: { id: testSuiteId, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!destination) {
    return res.status(404).json({ error: "Destination folder not found." });
  }

  const cases = await prisma.testCase.findMany({
    where: { id: { in: testCaseIds }, projectId: destination.projectId },
    select: { id: true, testSuiteId: true },
  });
  if (cases.length === 0) {
    return res.status(404).json({ error: "No matching test cases found." });
  }

  await prisma.testCase.updateMany({
    where: { id: { in: cases.map((c) => c.id) } },
    data: { testSuiteId },
  });

  // Returned so the UI can offer Undo (move each case back to where it
  // came from) without a second round-trip to look it up.
  res.json({ moved: cases.length, previousSuiteIds: Object.fromEntries(cases.map((c) => [c.id, c.testSuiteId])) });
});

// Deep-copies each case (+ its steps) into the destination suite with a
// fresh code. Deliberately drops sourceRequirementId and does not clone
// workItemLinks — a copy is a new, independent artifact, not the same
// tested behavior duplicated. Cloning that traceability would double-count
// in Work Item/Requirement coverage rollups and could confuse the
// Requirement->Test Case generator's own re-run idempotency check (which
// looks up "do I already have test cases for this requirement" by
// sourceRequirementId).
testCasesRouter.post("/bulk-copy", async (req, res) => {
  const parsed = bulkTargetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  const { testCaseIds, testSuiteId } = parsed.data;

  const destination = await prisma.testSuite.findFirst({
    where: { id: testSuiteId, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!destination) {
    return res.status(404).json({ error: "Destination folder not found." });
  }

  const sourceCases = await prisma.testCase.findMany({
    where: { id: { in: testCaseIds }, projectId: destination.projectId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });
  if (sourceCases.length === 0) {
    return res.status(404).json({ error: "No matching test cases found." });
  }

  for (let attempt = 1; attempt <= CODE_CONFLICT_MAX_ATTEMPTS; attempt++) {
    try {
      const copiedIds = await prisma.$transaction(async (tx) => {
        let existingCount = await tx.testCase.count({ where: { projectId: destination.projectId } });
        const ids: string[] = [];
        for (const source of sourceCases) {
          existingCount += 1;
          const code = `TC-${String(existingCount).padStart(4, "0")}`;
          const copy = await tx.testCase.create({
            data: {
              code,
              name: source.name,
              objective: source.objective,
              preconditions: source.preconditions,
              environment: source.environment,
              testPhase: source.testPhase,
              testType: source.testType,
              gherkinScript: source.gherkinScript,
              testSuiteId,
              projectId: destination.projectId,
              createdById: req.userId!,
              sourceRequirementId: null,
            },
          });
          if (source.steps.length > 0) {
            await tx.testStep.createMany({
              data: source.steps.map((step) => ({
                testCaseId: copy.id,
                stepNumber: step.stepNumber,
                description: step.description,
                testData: step.testData,
                expectedResult: step.expectedResult,
              })),
            });
          }
          ids.push(copy.id);
        }
        return ids;
      });
      return res.status(201).json({ copied: copiedIds.length, testCaseIds: copiedIds });
    } catch (err) {
      const isCodeConflict =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("code");
      if (!isCodeConflict || attempt === CODE_CONFLICT_MAX_ATTEMPTS) {
        console.error("Bulk copy failed:", err);
        return res.status(500).json({ error: "Could not copy those test cases. Try again." });
      }
    }
  }
});

testCasesRouter.get("/:id", async (req, res) => {
  const testCase = await prisma.testCase.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      testSuite: { select: { id: true, name: true, folderId: true, folder: { select: { id: true, name: true, parentId: true } } } },
      sourceRequirement: { select: { id: true, title: true } },
      workItemLinks: { select: { workItem: { select: { id: true, key: true, title: true, type: true } } } },
    },
  });
  if (!testCase) {
    return res.status(404).json({ error: "Test case not found." });
  }
  const { workItemLinks, ...rest } = testCase;
  res.json({ ...rest, workItems: workItemLinks.map((l) => l.workItem) });
});

testCasesRouter.patch("/:id", async (req, res) => {
  const parsed = testCaseInputSchema.partial().extend({ archived: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await prisma.testCase.findFirst({ where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) } });
  if (!existing) {
    return res.status(404).json({ error: "Test case not found." });
  }

  const { steps, testSuiteId, projectId, ...fields } = parsed.data;

  const effectiveType = fields.testType ?? existing.testType;
  if (steps !== undefined || fields.gherkinScript !== undefined || fields.testType !== undefined) {
    const stepError = validateStepsOrGherkin(
      effectiveType,
      steps ?? (effectiveType === "Manual" ? undefined : []),
      fields.gherkinScript ?? existing.gherkinScript ?? undefined,
    );
    if (stepError) {
      return res.status(400).json({ error: stepError });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (steps) {
      await tx.testStep.deleteMany({ where: { testCaseId: existing.id } });
      if (steps.length > 0) {
        await tx.testStep.createMany({
          data: steps.map((step, index) => ({ ...step, testCaseId: existing.id, stepNumber: index + 1 })),
        });
      }
    }
    return tx.testCase.update({
      where: { id: existing.id },
      data: fields,
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    });
  });

  res.json(updated);
});

testCasesRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.testCase.findFirst({ where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) } });
  if (!existing) {
    return res.status(404).json({ error: "Test case not found." });
  }

  await prisma.testCase.delete({ where: { id: existing.id } });
  res.status(204).end();
});
