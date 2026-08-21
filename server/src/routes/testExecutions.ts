import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { recomputeCycleStatus } from "../lib/testCycleStatus.js";

export const testExecutionsRouter = Router();
testExecutionsRouter.use(requireAuth);

const EXECUTION_STATUSES = ["NotExecuted", "Pass", "Fail", "Blocked"] as const;

async function findOwnedExecution(executionId: string, userId: string | undefined) {
  const execution = await prisma.testExecution.findFirst({
    where: { id: executionId, testCycleTest: { testCycle: { createdById: userId } } },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      testCycleTest: { select: { testCycleId: true } },
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
    include: { steps: { orderBy: { stepNumber: "asc" } } },
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
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    });
  });

  await recomputeCycleStatus(execution.testCycleTest.testCycleId);
  res.json(updatedExecution);
});
