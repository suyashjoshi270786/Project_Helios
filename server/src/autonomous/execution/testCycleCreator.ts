import { prisma } from "../../lib/prisma.js";

// Reuses the exact same TestCycle table/code-numbering pattern as the manual
// "Create Test Cycle" flow (server/src/routes/testCycles.ts) — an
// autonomous run's results are a real Test Cycle, visible in the existing
// Test Cycles screen, just tagged with autonomousRunId.
export async function createAutonomousTestCycle(params: {
  projectId: string;
  createdById: string;
  autonomousRunId: string;
  appName?: string | null;
  environment?: string | null;
}) {
  const { projectId, createdById, autonomousRunId, appName, environment } = params;
  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.testCycle.count({ where: { projectId } });
    const code = `CYC-${String(existingCount + 1).padStart(4, "0")}`;
    return tx.testCycle.create({
      data: {
        code,
        name: `Autonomous Run — ${appName?.trim() || "Application"}`,
        testPhase: "Autonomous",
        environment: environment ?? undefined,
        projectId,
        createdById,
        autonomousRunId,
      },
    });
  });
}
