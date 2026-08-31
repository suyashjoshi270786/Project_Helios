import { maskSecretsDeep } from "./credentialMask.js";
import type { AnalyzedFailure } from "./execution/defectCreator.js";
import type { DiscoveredPage, DiscoveredWorkflow, GeneratedScenario } from "./types.js";

export type AutonomousReport = {
  executiveSummary: {
    appName: string | null;
    environment: string | null;
    targetUrl: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
  };
  testSummary: { total: number; passed: number; failed: number; blocked: number; skipped: number };
  discoveredApplication: {
    pages: number;
    workflows: number;
    forms: number;
    interactiveElements: number;
  };
  generatedTests: { bddScenarios: number; automatedScenarios: number };
  failureAnalysis: {
    testCaseCode?: string;
    category: string;
    confidence: number;
    rootCause: string;
    recommendedAction: string;
    defectKey?: string;
  }[];
  qualitySignals: {
    criticalFailures: number;
    repeatedCategories: string[];
    potentialDefects: number;
    potentialAutomationIssues: number;
  };
  recommendations: string[];
};

// Assembles the final report purely from already-persisted stage
// data — never from the credentials closure, which this function never
// receives. Runs maskSecretsDeep defensively over the whole thing in case
// the target application itself echoed a credential value into visible page
// text that ended up in a discovered-page summary or evidence bundle.
export function assembleReport(params: {
  appName: string | null;
  environment: string | null;
  targetUrl: string;
  startedAt: Date | null;
  completedAt: Date | null;
  pages: DiscoveredPage[];
  workflows: DiscoveredWorkflow[];
  scenarios: GeneratedScenario[];
  generatedCount: number;
  cycleSummary: { total: number; passed: number; failed: number; blocked: number; notExecuted: number };
  analyzedFailures: AnalyzedFailure[];
  secrets: string[];
}): AutonomousReport {
  const {
    appName,
    environment,
    targetUrl,
    startedAt,
    completedAt,
    pages,
    workflows,
    scenarios,
    generatedCount,
    cycleSummary,
    analyzedFailures,
    secrets,
  } = params;

  const interactiveElements = pages.reduce((sum, p) => sum + p.page.elements.length, 0);
  const forms = pages.reduce((sum, p) => sum + (p.page.elements.some((e) => e.tag === "input") ? 1 : 0), 0);

  const categoryCounts = new Map<string, number>();
  for (const f of analyzedFailures) {
    categoryCounts.set(f.classification.category, (categoryCounts.get(f.classification.category) ?? 0) + 1);
  }
  const repeatedCategories = [...categoryCounts.entries()].filter(([, count]) => count > 1).map(([category]) => category);

  const recommendations: string[] = [];
  if (categoryCounts.get("ApplicationDefect")) {
    recommendations.push(`Investigate ${categoryCounts.get("ApplicationDefect")} likely application defect(s) filed as Work Items.`);
  }
  if (categoryCounts.get("LocatorIssue")) {
    recommendations.push("Review flagged locator issues — a UI change may have broken a generated selector; tests were not auto-modified.");
  }
  if (categoryCounts.get("Timing")) {
    recommendations.push("Some failures look timing-related; consider whether the affected pages have slow/async loading that needs a UX-level fix.");
  }
  if (cycleSummary.total === 0) {
    recommendations.push("No workflows produced testable scenarios — try adding tester instructions to steer exploration toward specific areas.");
  }

  const report: AutonomousReport = {
    executiveSummary: {
      appName,
      environment,
      targetUrl,
      startedAt: startedAt?.toISOString() ?? null,
      completedAt: completedAt?.toISOString() ?? null,
      durationMs: startedAt && completedAt ? completedAt.getTime() - startedAt.getTime() : null,
    },
    testSummary: {
      total: cycleSummary.total,
      passed: cycleSummary.passed,
      failed: cycleSummary.failed,
      blocked: cycleSummary.blocked,
      skipped: cycleSummary.notExecuted,
    },
    discoveredApplication: { pages: pages.length, workflows: workflows.length, forms, interactiveElements },
    generatedTests: { bddScenarios: scenarios.length, automatedScenarios: generatedCount },
    failureAnalysis: analyzedFailures.map((f) => ({
      category: f.classification.category,
      confidence: f.classification.confidence,
      rootCause: f.classification.rootCause,
      recommendedAction: f.classification.recommendedAction,
      defectKey: f.workItemKey,
    })),
    qualitySignals: {
      criticalFailures: analyzedFailures.filter((f) => f.classification.category === "ApplicationDefect").length,
      repeatedCategories,
      potentialDefects: analyzedFailures.filter((f) => f.workItemId).length,
      potentialAutomationIssues: analyzedFailures.filter((f) =>
        ["AutomationDefect", "LocatorIssue"].includes(f.classification.category),
      ).length,
    },
    recommendations,
  };

  return maskSecretsDeep(report, secrets);
}
