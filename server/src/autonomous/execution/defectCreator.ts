import { prisma } from "../../lib/prisma.js";
import { generateWorkItemKey } from "../../lib/workItemKey.js";
import { classifyFailure } from "../ai/failureAnalyzer.js";
import type { FailedStep } from "./executor.js";
import type { FailureClassification } from "../types.js";

export type AnalyzedFailure = {
  failedStep: FailedStep;
  classification: FailureClassification;
  workItemId?: string;
  workItemKey?: string;
};

// Only ApplicationDefect classifications raise a real Defect work item —
// automation/locator/timing/environment/auth/network/unknown failures are
// still reported, but not auto-filed as application bugs (spec section 16:
// not every failed automated test is a defect).
const DEFECT_WORTHY: FailureClassification["category"][] = ["ApplicationDefect"];

export async function analyzeAndFileDefects(params: {
  projectId: string;
  createdById: string;
  failedSteps: FailedStep[];
  secrets: string[];
  onLog: (line: string) => void;
}): Promise<AnalyzedFailure[]> {
  const { projectId, createdById, failedSteps, secrets, onLog } = params;
  const results: AnalyzedFailure[] = [];

  for (const failedStep of failedSteps) {
    let classification: FailureClassification;
    try {
      classification = await classifyFailure(failedStep.evidence, secrets);
    } catch (err) {
      onLog(`Failure analysis skipped for one step: ${(err as Error).message}`);
      classification = {
        category: "Unknown",
        confidence: 0,
        rootCause: "Failure analysis could not run.",
        recommendedAction: "Review this failure manually.",
      };
    }

    let workItemId: string | undefined;
    let workItemKey: string | undefined;

    if (DEFECT_WORTHY.includes(classification.category)) {
      const key = await generateWorkItemKey(projectId, "Defect");
      const workItem = await prisma.$transaction(async (tx) => {
        const created = await tx.workItem.create({
          data: {
            type: "Defect",
            key,
            title: `Autonomous Testing: ${failedStep.evidence.expectedResult.slice(0, 80)}`,
            description: classification.rootCause,
            severity: classification.confidence >= 0.7 ? "High" : "Medium",
            stepsToReproduce: `Discovered autonomously at ${failedStep.evidence.url}.`,
            expectedResult: failedStep.evidence.expectedResult,
            actualResult: failedStep.evidence.actualResult,
            projectId,
            createdById,
          },
        });
        await tx.workItemStepLink.create({
          data: { workItemId: created.id, testStepExecutionId: failedStep.testStepExecutionId },
        });
        return created;
      });
      workItemId = workItem.id;
      workItemKey = workItem.key;
      onLog(`Filed defect ${workItem.key} (${classification.category}, ${Math.round(classification.confidence * 100)}% confidence).`);
    } else {
      onLog(`Step failure classified as ${classification.category} — not auto-filed as a defect.`);
    }

    results.push({ failedStep, classification, workItemId, workItemKey });
  }

  return results;
}
