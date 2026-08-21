import { prisma } from "./prisma.js";

// A cycle's status reflects how far along its tests are — not a value the
// user sets by hand. Recompute it after anything that changes execution
// state or membership (a test added/removed, a step or override update).
export async function recomputeCycleStatus(cycleId: string) {
  const tests = await prisma.testCycleTest.findMany({
    where: { testCycleId: cycleId },
    include: { execution: { select: { status: true } } },
  });

  const statuses = tests.map((t) => t.execution?.status ?? "NotExecuted");
  const executedCount = statuses.filter((s) => s !== "NotExecuted").length;
  const passedCount = statuses.filter((s) => s === "Pass").length;

  // Completed only when every test in the cycle has actually passed — a cycle
  // where everything ran but something failed/blocked is still "in progress"
  // until that's resolved and retested.
  const status =
    tests.length === 0 || executedCount === 0
      ? "NotStarted"
      : passedCount === tests.length
        ? "Completed"
        : "InProgress";

  await prisma.testCycle.update({ where: { id: cycleId }, data: { status } });
  return status;
}
