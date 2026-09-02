import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { recomputeCycleStatus } from "../lib/testCycleStatus.js";
import { generateWorkItemKey } from "../lib/workItemKey.js";
import { accessibleProjectsWhere } from "../lib/access.js";

export const testExecutionsRouter = Router();
testExecutionsRouter.use(requireAuth);

const EXECUTION_STATUSES = ["NotExecuted", "Pass", "Fail", "Blocked"] as const;

const stepDefectLinksInclude = {
  defectLinks: { include: { workItem: { select: { id: true, key: true, title: true, status: true } } } },
} as const;

async function findOwnedExecution(executionId: string, userId: string | undefined) {
  const execution = await prisma.testExecution.findFirst({
    where: { id: executionId, testCycleTest: { testCycle: { project: accessibleProjectsWhere(userId!) } } },
    include: {
      steps: { orderBy: { stepNumber: "asc" }, include: stepDefectLinksInclude },
      testCycleTest: { select: { testCycleId: true, testCycle: { select: { projectId: true } } } },
    },
  });
  return execution;
}

// Derives the overall execution status from its steps, per the rule:
// any FAIL -> FAILED; else any BLOCKED -> BLOCKED; else all PASS -> PASSED; else NOT EXECUTED.
function deriveStatus(steps: { status: string }[]): (typeof EXECUTION_STATUSES)[number] {
  if (steps.length === 0) return "NotExecuted";
  if (steps.some((s) => s.status === "Fail")) return "Fail";
  if (steps.some((s) => s.status === "Blocked")) return "Blocked";
  if (steps.every((s) => s.status === "Pass")) return "Pass";
  return "NotExecuted";
}

const overrideStatusSchema = z.object({ status: z.enum(EXECUTION_STATUSES) });

// Lets a user set the overall Test Case result directly, without walking every step.
// A later step-status change will recompute and override this via deriveStatus().
testExecutionsRouter.patch("/:id", async (req, res) => {
  const parsed = overrideStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const execution = await findOwnedExecution(req.params.id, req.userId);
  if (!execution) {
    return res.status(404).json({ error: "Test execution not found." });
  }

  const updated = await prisma.testExecution.update({
    where: { id: execution.id },
    data: { status: parsed.data.status },
    include: { steps: { orderBy: { stepNumber: "asc" }, include: stepDefectLinksInclude } },
  });
  await recomputeCycleStatus(execution.testCycleTest.testCycleId);
  res.json(updated);
});

const stepUpdateSchema = z.object({
  status: z.enum(EXECUTION_STATUSES).optional(),
  actualResult: z.string().nullish(),
  comment: z.string().nullish(),
});

testExecutionsRouter.patch("/:id/steps/:stepId", async (req, res) => {
  const parsed = stepUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const execution = await findOwnedExecution(req.params.id, req.userId);
  if (!execution) {
    return res.status(404).json({ error: "Test execution not found." });
  }
  const step = execution.steps.find((s) => s.id === req.params.stepId);
  if (!step) {
    return res.status(404).json({ error: "Test step not found in this execution." });
  }

  const updatedExecution = await prisma.$transaction(async (tx) => {
    await tx.testStepExecution.update({
      where: { id: step.id },
      data: parsed.data,
    });
    const steps = await tx.testStepExecution.findMany({
      where: { testExecutionId: execution.id },
      orderBy: { stepNumber: "asc" },
    });
    return tx.testExecution.update({
      where: { id: execution.id },
      data: { status: deriveStatus(steps) },
      include: { steps: { orderBy: { stepNumber: "asc" }, include: stepDefectLinksInclude } },
    });
  });

  await recomputeCycleStatus(execution.testCycleTest.testCycleId);
  res.json(updatedExecution);
});

// Same fields (and validation) as the general Work Item create endpoint's
// Defect flow (server/src/routes/workItems.ts) — raising a defect from a
// failed test step should be the identical form, not a lighter-weight one.
const createDefectSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  severity: z.string().nullish(),
  priority: z.string().nullish(),
  environment: z.string().nullish(),
  stepsToReproduce: z.string().nullish(),
  expectedResult: z.string().nullish(),
  actualResult: z.string().nullish(),
  assigneeId: z.string().nullish(),
  dueDate: z.coerce.date().nullish(),
});

async function isTeamMember(userId: string, projectId: string): Promise<boolean> {
  const count = await prisma.teamMember.count({
    where: { userId, team: { projects: { some: { id: projectId } } } },
  });
  return count > 0;
}

// Raises a brand-new Defect work item from a failed step and links the two —
// the "Create Defect" action on the Test Cycle execution page.
testExecutionsRouter.post("/:id/steps/:stepId/defects", async (req, res) => {
  const parsed = createDefectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const execution = await findOwnedExecution(req.params.id, req.userId);
  if (!execution) {
    return res.status(404).json({ error: "Test execution not found." });
  }
  const step = execution.steps.find((s) => s.id === req.params.stepId);
  if (!step) {
    return res.status(404).json({ error: "Test step not found in this execution." });
  }

  const projectId = execution.testCycleTest.testCycle.projectId;

  if (parsed.data.assigneeId && !(await isTeamMember(parsed.data.assigneeId, projectId))) {
    return res.status(400).json({ error: "That assignee isn't on this project's team." });
  }

  const key = await generateWorkItemKey(projectId, "Defect");

  await prisma.$transaction(async (tx) => {
    const workItem = await tx.workItem.create({
      data: { ...parsed.data, type: "Defect", key, projectId, createdById: req.userId! },
    });
    await tx.workItemStepLink.create({ data: { workItemId: workItem.id, testStepExecutionId: step.id } });
  });

  const updatedExecution = await prisma.testExecution.findUniqueOrThrow({
    where: { id: execution.id },
    include: { steps: { orderBy: { stepNumber: "asc" }, include: stepDefectLinksInclude } },
  });
  res.status(201).json(updatedExecution);
});

const linkDefectSchema = z.object({ workItemId: z.string().min(1) });

// Links an already-existing Defect work item to a failed step — the "Link
// Existing Defect" action on the Test Cycle execution page.
testExecutionsRouter.post("/:id/steps/:stepId/defects/link", async (req, res) => {
  const parsed = linkDefectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const execution = await findOwnedExecution(req.params.id, req.userId);
  if (!execution) {
    return res.status(404).json({ error: "Test execution not found." });
  }
  const step = execution.steps.find((s) => s.id === req.params.stepId);
  if (!step) {
    return res.status(404).json({ error: "Test step not found in this execution." });
  }

  const workItem = await prisma.workItem.findFirst({
    where: {
      id: parsed.data.workItemId,
      type: "Defect",
      projectId: execution.testCycleTest.testCycle.projectId,
    },
  });
  if (!workItem) {
    return res.status(404).json({ error: "Defect not found in this project." });
  }

  await prisma.workItemStepLink.upsert({
    where: { workItemId_testStepExecutionId: { workItemId: workItem.id, testStepExecutionId: step.id } },
    create: { workItemId: workItem.id, testStepExecutionId: step.id },
    update: {},
  });

  const updatedExecution = await prisma.testExecution.findUniqueOrThrow({
    where: { id: execution.id },
    include: { steps: { orderBy: { stepNumber: "asc" }, include: stepDefectLinksInclude } },
  });
  res.status(201).json(updatedExecution);
});

testExecutionsRouter.delete("/:id/steps/:stepId/defects/:linkId", async (req, res) => {
  const execution = await findOwnedExecution(req.params.id, req.userId);
  if (!execution) {
    return res.status(404).json({ error: "Test execution not found." });
  }
  const step = execution.steps.find((s) => s.id === req.params.stepId);
  if (!step) {
    return res.status(404).json({ error: "Test step not found in this execution." });
  }

  await prisma.workItemStepLink.deleteMany({ where: { id: req.params.linkId, testStepExecutionId: step.id } });

  const updatedExecution = await prisma.testExecution.findUniqueOrThrow({
    where: { id: execution.id },
    include: { steps: { orderBy: { stepNumber: "asc" }, include: stepDefectLinksInclude } },
  });
  res.json(updatedExecution);
});
