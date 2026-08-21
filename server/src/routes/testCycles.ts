import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { recomputeCycleStatus } from "../lib/testCycleStatus.js";

export const testCyclesRouter = Router();
testCyclesRouter.use(requireAuth);

const testCycleInputSchema = z.object({
  name: z.string().min(1),
  testPhase: z.string().min(1),
  environment: z.string().nullish(),
  description: z.string().nullish(),
  startDate: z.coerce.date().nullish(),
  endDate: z.coerce.date().nullish(),
  owner: z.string().nullish(),
  status: z.enum(["NotStarted", "InProgress", "Completed"]).optional(),
});

function summarizeCycle(cycle: {
  tests: { execution: { status: string } | null }[];
}) {
  const counts = { total: cycle.tests.length, passed: 0, failed: 0, blocked: 0, notExecuted: 0 };
  for (const test of cycle.tests) {
    const status = test.execution?.status ?? "NotExecuted";
    if (status === "Pass") counts.passed++;
    else if (status === "Fail") counts.failed++;
    else if (status === "Blocked") counts.blocked++;
    else counts.notExecuted++;
  }
  return counts;
}

testCyclesRouter.get("/", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }

  const cycles = await prisma.testCycle.findMany({
    where: { createdById: req.userId, projectId },
    orderBy: { createdAt: "desc" },
    include: { tests: { include: { execution: { select: { status: true } } } } },
  });

  res.json(
    cycles.map(({ tests, ...cycle }) => ({ ...cycle, summary: summarizeCycle({ tests }) })),
  );
});

const createTestCycleSchema = testCycleInputSchema.extend({ projectId: z.string().min(1) });

testCyclesRouter.post("/", async (req, res) => {
  const parsed = createTestCycleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { projectId, ...fields } = parsed.data;

  const project = await prisma.project.findFirst({ where: { id: projectId, createdById: req.userId } });
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  const cycle = await prisma.testCycle.create({
    data: { ...fields, projectId, createdById: req.userId! },
  });
  res.status(201).json({ ...cycle, summary: { total: 0, passed: 0, failed: 0, blocked: 0, notExecuted: 0 } });
});

testCyclesRouter.get("/:id", async (req, res) => {
  const cycle = await prisma.testCycle.findFirst({
    where: { id: req.params.id, createdById: req.userId },
    include: {
      tests: {
        orderBy: { createdAt: "asc" },
        include: { testCase: true, execution: { select: { status: true } } },
      },
    },
  });
  if (!cycle) {
    return res.status(404).json({ error: "Test cycle not found." });
  }
  const status = await recomputeCycleStatus(cycle.id);
  const { tests, ...rest } = cycle;
  res.json({
    ...rest,
    status,
    summary: summarizeCycle({ tests }),
    tests: tests.map((t) => ({
      id: t.id,
      testCaseId: t.testCaseId,
      testCase: t.testCase,
      environment: t.environment,
      tester: t.tester,
      status: t.execution?.status ?? "NotExecuted",
    })),
  });
});

testCyclesRouter.patch("/:id", async (req, res) => {
  const parsed = testCycleInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await prisma.testCycle.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Test cycle not found." });
  }

  const updated = await prisma.testCycle.update({ where: { id: existing.id }, data: parsed.data });
  res.json(updated);
});

testCyclesRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.testCycle.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Test cycle not found." });
  }
  await prisma.testCycle.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const addTestsSchema = z.object({ testCaseIds: z.array(z.string().min(1)).min(1) });

testCyclesRouter.post("/:id/tests", async (req, res) => {
  const parsed = addTestsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const cycle = await prisma.testCycle.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!cycle) {
    return res.status(404).json({ error: "Test cycle not found." });
  }

  const testCases = await prisma.testCase.findMany({
    where: { id: { in: parsed.data.testCaseIds }, projectId: cycle.projectId, createdById: req.userId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });
  if (testCases.length === 0) {
    return res.status(400).json({ error: "No valid test cases were selected." });
  }

  const existingLinks = await prisma.testCycleTest.findMany({
    where: { testCycleId: cycle.id, testCaseId: { in: testCases.map((tc) => tc.id) } },
    select: { testCaseId: true },
  });
  const alreadyLinked = new Set(existingLinks.map((l) => l.testCaseId));
  const toAdd = testCases.filter((tc) => !alreadyLinked.has(tc.id));

  await prisma.$transaction(async (tx) => {
    for (const testCase of toAdd) {
      const cycleTest = await tx.testCycleTest.create({
        data: { testCycleId: cycle.id, testCaseId: testCase.id },
      });
      const execution = await tx.testExecution.create({
        data: { testCycleTestId: cycleTest.id },
      });
      if (testCase.steps.length > 0) {
        await tx.testStepExecution.createMany({
          data: testCase.steps.map((step) => ({
            testExecutionId: execution.id,
            testStepId: step.id,
            stepNumber: step.stepNumber,
            description: step.description,
            testData: step.testData,
            expectedResult: step.expectedResult,
          })),
        });
      }
    }
  });

  if (toAdd.length > 0) await recomputeCycleStatus(cycle.id);
  res.status(201).json({ added: toAdd.length, skipped: testCases.length - toAdd.length });
});

testCyclesRouter.delete("/:id/tests/:cycleTestId", async (req, res) => {
  const cycle = await prisma.testCycle.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!cycle) {
    return res.status(404).json({ error: "Test cycle not found." });
  }
  const cycleTest = await prisma.testCycleTest.findFirst({
    where: { id: req.params.cycleTestId, testCycleId: cycle.id },
  });
  if (!cycleTest) {
    return res.status(404).json({ error: "That test isn't in this cycle." });
  }
  await prisma.testCycleTest.delete({ where: { id: cycleTest.id } });
  await recomputeCycleStatus(cycle.id);
  res.status(204).end();
});

testCyclesRouter.get("/:id/tests/:cycleTestId", async (req, res) => {
  const cycle = await prisma.testCycle.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!cycle) {
    return res.status(404).json({ error: "Test cycle not found." });
  }
  const cycleTest = await prisma.testCycleTest.findFirst({
    where: { id: req.params.cycleTestId, testCycleId: cycle.id },
    include: {
      testCase: true,
      execution: { include: { steps: { orderBy: { stepNumber: "asc" } } } },
    },
  });
  if (!cycleTest) {
    return res.status(404).json({ error: "That test isn't in this cycle." });
  }
  res.json({
    id: cycleTest.id,
    environment: cycleTest.environment,
    tester: cycleTest.tester,
    testCase: cycleTest.testCase,
    testCycle: { id: cycle.id, name: cycle.name },
    execution: cycleTest.execution,
  });
});

const bulkAssignSchema = z.object({
  testCycleTestIds: z.array(z.string().min(1)).min(1),
  environment: z.string().nullish(),
  tester: z.string().nullish(),
});

testCyclesRouter.patch("/:id/tests/bulk", async (req, res) => {
  const parsed = bulkAssignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const cycle = await prisma.testCycle.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!cycle) {
    return res.status(404).json({ error: "Test cycle not found." });
  }

  const { testCycleTestIds, environment, tester } = parsed.data;
  const data: Record<string, unknown> = {};
  if (environment !== undefined) data.environment = environment;
  if (tester !== undefined) data.tester = tester;

  const result = await prisma.testCycleTest.updateMany({
    where: { id: { in: testCycleTestIds }, testCycleId: cycle.id },
    data,
  });
  res.json({ updated: result.count });
});
