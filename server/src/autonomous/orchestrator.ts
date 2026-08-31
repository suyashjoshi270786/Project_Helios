import type { AutonomousStageName } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { MAX_ACTIONS, MAX_PAGES, MAX_RUN_DURATION_MS, MAX_TESTS, STAGE_ORDER } from "./constants.js";
import { registerRun, unregisterRun, isCancelled, elapsedMs } from "./runRegistry.js";
import { maskSecrets } from "./credentialMask.js";
import { BrowserController } from "./browser/browserController.js";
import { exploreApplication } from "./discovery/explorer.js";
import { discoverWorkflows } from "./discovery/workflowDiscovery.js";
import { generateScenarios } from "./ai/scenarioGenerator.js";
import { generateAutomatedTests, type GeneratedTestCase } from "./generation/automationGenerator.js";
import { createAutonomousTestCycle } from "./execution/testCycleCreator.js";
import { executeGeneratedTests, type FailedStep } from "./execution/executor.js";
import { analyzeAndFileDefects, type AnalyzedFailure } from "./execution/defectCreator.js";
import { assembleReport } from "./reporter.js";
import type { Credentials, DiscoveredPage, DiscoveredWorkflow, GeneratedScenario, RunConfig } from "./types.js";

// Thrown internally to unwind the pipeline early on cancellation/timeout
// without treating it as a stage failure — caught once at the top of
// startRun() to mark the run Cancelled instead of Failed.
class RunAborted extends Error {
  constructor(public readonly reason: "cancelled" | "timeout") {
    super(reason === "cancelled" ? "Run was cancelled." : "Run duration limit reached.");
  }
}

async function guardBudget(runId: string, stage: AutonomousStageName) {
  if (isCancelled(runId)) {
    await prisma.autonomousStage.update({
      where: { autonomousRunId_stage: { autonomousRunId: runId, stage } },
      data: { status: "Cancelled" },
    });
    throw new RunAborted("cancelled");
  }
  if (elapsedMs(runId) > MAX_RUN_DURATION_MS) {
    await prisma.autonomousStage.update({
      where: { autonomousRunId_stage: { autonomousRunId: runId, stage } },
      data: { status: "Cancelled", error: "Run duration limit reached." },
    });
    throw new RunAborted("timeout");
  }
}

// Wraps one pipeline stage: checkpoints cancellation/duration before it
// starts, persists Running -> Completed/Failed with per-stage logs, and
// updates AutonomousRun.currentStage — the single place stage bookkeeping
// happens, so every stage below only needs to describe its own work.
async function runStage<T>(
  runId: string,
  stage: AutonomousStageName,
  secrets: string[],
  fn: (log: (line: string) => void) => Promise<T>,
): Promise<T> {
  await guardBudget(runId, stage);

  const lines: string[] = [];
  const log = (line: string) => lines.push(maskSecrets(line, secrets));

  await prisma.autonomousStage.update({
    where: { autonomousRunId_stage: { autonomousRunId: runId, stage } },
    data: { status: "Running", startedAt: new Date() },
  });
  await prisma.autonomousRun.update({ where: { id: runId }, data: { currentStage: stage } });

  try {
    const result = await fn(log);
    await prisma.autonomousStage.update({
      where: { autonomousRunId_stage: { autonomousRunId: runId, stage } },
      data: { status: "Completed", progress: 100, completedAt: new Date(), logs: lines },
    });
    return result;
  } catch (err) {
    const message = maskSecrets((err as Error).message, secrets);
    await prisma.autonomousStage.update({
      where: { autonomousRunId_stage: { autonomousRunId: runId, stage } },
      data: { status: "Failed", error: message, completedAt: new Date(), logs: lines },
    });
    throw err;
  }
}

async function skipRemaining(runId: string, from: AutonomousStageName[]) {
  await prisma.autonomousStage.updateMany({
    where: { autonomousRunId: runId, stage: { in: from }, status: "Pending" },
    data: { status: "Skipped" },
  });
}

// The fire-and-forget pipeline driver. `credentials` lives only in this
// function's local scope for the run's duration — it is never assigned to
// runRegistry, never returned, and never passed to anything that logs or
// persists (see the credential-handling checklist in the implementation
// plan). Called by the route handler without awaiting.
export async function startRun(config: RunConfig, credentials: Credentials): Promise<void> {
  const { runId } = config;
  registerRun(runId);
  const secrets = [credentials.username, credentials.password];
  const maxPages = Math.min(config.maxDepth > 0 ? config.maxDepth * 8 : MAX_PAGES, MAX_PAGES);
  const maxDepth = Math.max(1, Math.min(config.maxDepth || 3, 10));
  const maxTests = Math.max(1, Math.min(config.maxTests || MAX_TESTS, MAX_TESTS));

  const controller = new BrowserController(config.targetUrl, MAX_ACTIONS);

  let pages: DiscoveredPage[] = [];
  let workflows: DiscoveredWorkflow[] = [];
  let scenarios: GeneratedScenario[] = [];
  let generated: GeneratedTestCase[] = [];
  let testCycleId: string | null = null;
  let failedSteps: FailedStep[] = [];
  let analyzedFailures: AnalyzedFailure[] = [];

  try {
    await prisma.autonomousRun.update({ where: { id: runId }, data: { status: "Running", startedAt: new Date() } });

    await runStage(runId, "Initialization", secrets, async (log) => {
      log(`Starting autonomous run against ${new URL(config.targetUrl).host}.`);
      await controller.launch();
      log("Browser launched.");
    });

    const loginPageUrl = await runStage(runId, "Login", secrets, async (log) => {
      log("Locating the login form and submitting credentials...");
      const result = await controller.login(config.targetUrl, credentials.username, credentials.password);
      if (!result.submitted) {
        throw new Error("No password field was found on the target page — a login form could not be located.");
      }
      log("Credentials submitted.");
      return result.loginPageUrl ?? config.targetUrl;
    });

    await runStage(runId, "AuthVerification", secrets, async (log) => {
      const ok = await controller.verifyAuthenticated(loginPageUrl);
      if (!ok) {
        throw new Error(
          "Could not confirm login succeeded — after submitting credentials, the page still shows a login form, hasn't navigated anywhere new, or hasn't rendered any real content (e.g. still on a loading/interstitial screen). Check that the credentials are correct and that the target isn't blocking automated browsers.",
        );
      }
      log(`Authenticated. Now at ${controller.getCurrentUrl()}.`);
    });

    pages = await runStage(runId, "Exploration", secrets, async (log) => {
      const result = await exploreApplication({
        runId,
        controller,
        rootUrl: controller.getCurrentUrl(),
        maxPages,
        maxDepth,
        instructions: config.instructions,
        onLog: log,
      });
      log(`Discovered ${result.length} page(s).`);
      await prisma.autonomousRun.update({
        where: { id: runId },
        data: { pagesVisited: result.length, actionsTaken: controller.getActionCount(), discoveredPages: result },
      });
      return result;
    });

    workflows = await runStage(runId, "WorkflowDiscovery", secrets, async (log) => {
      const result = await discoverWorkflows(pages, config.instructions);
      log(`Identified ${result.length} workflow(s).`);
      for (const w of result) log(`Workflow: ${w.name}`);
      await prisma.autonomousRun.update({ where: { id: runId }, data: { workflows: result } });
      return result;
    });

    scenarios = await runStage(runId, "ScenarioGeneration", secrets, async (log) => {
      const result = await generateScenarios(workflows, maxTests, config.instructions);
      log(`Generated ${result.length} test scenario(s).`);
      await prisma.autonomousRun.update({ where: { id: runId }, data: { scenarios: result } });
      return result;
    });

    // BDD generation happens per-scenario inside generateAutomatedTests
    // (each scenario's Gherkin is produced right before its TestCase is
    // created), so this stage's job is just to record that intent and let
    // TestGeneration do the combined work — avoids generating Gherkin for
    // scenarios that then fail to become a TestCase for an unrelated reason.
    await runStage(runId, "BddGeneration", secrets, async (log) => {
      log(`${scenarios.length} scenario(s) queued for Gherkin generation during Test Generation.`);
    });

    generated = await runStage(runId, "TestGeneration", secrets, async (log) => {
      const result = await generateAutomatedTests({
        projectId: config.projectId,
        createdById: config.createdById,
        autonomousRunId: runId,
        targetUrl: config.targetUrl,
        scenarios,
        maxTests,
        onLog: log,
      });
      await prisma.autonomousRun.update({
        where: { id: runId },
        data: {
          testsGenerated: result.length,
          bddDocuments: result.map((r) => ({ testCaseId: r.testCaseId, code: r.code, gherkin: r.gherkin })),
        },
      });
      return result;
    });

    testCycleId = await runStage(runId, "TestCycleCreation", secrets, async (log) => {
      const cycle = await createAutonomousTestCycle({
        projectId: config.projectId,
        createdById: config.createdById,
        autonomousRunId: runId,
        appName: config.appName,
        environment: config.environment,
      });
      log(`Created test cycle ${cycle.code}.`);
      return cycle.id;
    });

    if (testCycleId) {
      const cycleId = testCycleId;
      const executionResult = await runStage(runId, "TestExecution", secrets, async (log) => {
        const result = await executeGeneratedTests({
          runId,
          testCycleId: cycleId,
          controller,
          generated,
          workflows,
          targetUrl: config.targetUrl,
          onLog: log,
        });
        await prisma.autonomousRun.update({
          where: { id: runId },
          data: { testsExecuted: generated.length, testsPassed: result.passed, testsFailed: result.failed },
        });
        return result;
      });
      failedSteps = executionResult.failedSteps;
    }

    analyzedFailures = await runStage(runId, "FailureAnalysis", secrets, async (log) => {
      if (failedSteps.length === 0) {
        log("No failed steps to analyze.");
        return [];
      }
      const result = await analyzeAndFileDefects({
        projectId: config.projectId,
        createdById: config.createdById,
        failedSteps,
        secrets,
        onLog: log,
      });
      return result;
    });

    // DefectCreation is folded into FailureAnalysis (defects are filed as
    // part of classifying each failure — see execution/defectCreator.ts) so
    // this stage just records the outcome rather than repeating the work.
    await runStage(runId, "DefectCreation", secrets, async (log) => {
      const filed = analyzedFailures.filter((f) => f.workItemId).length;
      log(`${filed} defect(s) filed from ${analyzedFailures.length} analyzed failure(s).`);
      await prisma.autonomousRun.update({ where: { id: runId }, data: { defectsCreated: filed } });
    });

    await runStage(runId, "ReportGeneration", secrets, async (log) => {
      const cycleSummary = testCycleId
        ? await summarizeCycle(testCycleId)
        : { total: 0, passed: 0, failed: 0, blocked: 0, notExecuted: 0 };
      const run = await prisma.autonomousRun.findUniqueOrThrow({ where: { id: runId } });
      const report = assembleReport({
        appName: config.appName ?? null,
        environment: config.environment ?? null,
        targetUrl: config.targetUrl,
        startedAt: run.startedAt,
        completedAt: new Date(),
        pages,
        workflows,
        scenarios,
        generatedCount: generated.length,
        cycleSummary,
        analyzedFailures,
        secrets,
      });
      await prisma.autonomousRun.update({ where: { id: runId }, data: { report } });
      log("Report generated.");
    });

    await prisma.autonomousRun.update({
      where: { id: runId },
      data: { status: "Completed", completedAt: new Date() },
    });
  } catch (err) {
    if (err instanceof RunAborted) {
      await skipRemaining(runId, STAGE_ORDER);
      await prisma.autonomousRun.update({
        where: { id: runId },
        data: {
          status: err.reason === "cancelled" ? "Cancelled" : "Failed",
          errorMessage: err.message,
          completedAt: new Date(),
        },
      });
    } else {
      const message = maskSecrets((err as Error).message, secrets);
      await skipRemaining(runId, STAGE_ORDER);
      await prisma.autonomousRun.update({
        where: { id: runId },
        data: { status: "Failed", errorMessage: message, completedAt: new Date() },
      });
    }
  } finally {
    await controller.close();
    unregisterRun(runId);
  }
}

async function summarizeCycle(testCycleId: string) {
  const tests = await prisma.testCycleTest.findMany({
    where: { testCycleId },
    include: { execution: { select: { status: true } } },
  });
  const counts = { total: tests.length, passed: 0, failed: 0, blocked: 0, notExecuted: 0 };
  for (const t of tests) {
    const status = t.execution?.status ?? "NotExecuted";
    if (status === "Pass") counts.passed++;
    else if (status === "Fail") counts.failed++;
    else if (status === "Blocked") counts.blocked++;
    else counts.notExecuted++;
  }
  return counts;
}
