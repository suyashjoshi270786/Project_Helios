import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { buildImportPreview, guessColumnMapping, parseCsvHeadersAndRows, type ColumnMapping } from "../lib/csvImport.js";
import { friendlyValidationError } from "../lib/validation.js";

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

const testCaseInputSchema = z.object({
  name: z.string().min(1),
  objective: z.string().optional(),
  preconditions: z.string().optional(),
  environment: z.string().optional(),
  testPhase: z.string().optional(),
  testType: z.enum(["Manual", "Automated"]).default("Manual"),
  testSuiteId: z.string().min(1),
  projectId: z.string().min(1),
  steps: z.array(stepInputSchema).min(1, "At least one test step is required."),
});

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

  const where: Prisma.TestCaseWhereInput = {
    createdById: req.userId,
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
      include: { _count: { select: { steps: true } } },
    }),
    prisma.testCase.count({ where }),
  ]);

  res.json({
    testCases: testCases.map(({ _count, ...tc }) => ({ ...tc, stepCount: _count.steps })),
    total,
  });
});

testCasesRouter.post("/", async (req, res) => {
  const parsed = testCaseInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { steps, testSuiteId, projectId, ...fields } = parsed.data;

  const testSuite = await prisma.testSuite.findFirst({
    where: { id: testSuiteId, projectId, createdById: req.userId },
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

    await tx.testStep.createMany({
      data: steps.map((step, index) => ({ ...step, testCaseId: created.id, stepNumber: index + 1 })),
    });

    return tx.testCase.findUniqueOrThrow({ where: { id: created.id }, include: { steps: { orderBy: { stepNumber: "asc" } } } });
  });

  res.status(201).json(testCase);
});

const importQuerySchema = z.object({
  projectId: z.string().min(1),
  testSuiteId: z.string().min(1),
});

async function assertTestSuiteOwned(userId: string | undefined, projectId: string, testSuiteId: string) {
  return prisma.testSuite.findFirst({ where: { id: testSuiteId, projectId, createdById: userId } });
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
    where: { id: testSuiteId, projectId, createdById: req.userId },
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

testCasesRouter.get("/:id", async (req, res) => {
  const testCase = await prisma.testCase.findFirst({
    where: { id: req.params.id, createdById: req.userId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });
  if (!testCase) {
    return res.status(404).json({ error: "Test case not found." });
  }
  res.json(testCase);
});

testCasesRouter.patch("/:id", async (req, res) => {
  const parsed = testCaseInputSchema.partial().extend({ archived: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await prisma.testCase.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Test case not found." });
  }

  const { steps, testSuiteId, projectId, ...fields } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    if (steps) {
      await tx.testStep.deleteMany({ where: { testCaseId: existing.id } });
      await tx.testStep.createMany({
        data: steps.map((step, index) => ({ ...step, testCaseId: existing.id, stepNumber: index + 1 })),
      });
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
  const existing = await prisma.testCase.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Test case not found." });
  }

  await prisma.testCase.delete({ where: { id: existing.id } });
  res.status(204).end();
});
