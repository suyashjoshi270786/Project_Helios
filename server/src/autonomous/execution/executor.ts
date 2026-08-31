import { prisma } from "../../lib/prisma.js";
import { recomputeCycleStatus } from "../../lib/testCycleStatus.js";
import { interpretStep } from "../generation/stepInterpreter.js";
import { saveScreenshot } from "../evidence/evidenceStore.js";
import { isCancelled, elapsedMs } from "../runRegistry.js";
import { MAX_RUN_DURATION_MS } from "../constants.js";
import type { BrowserController } from "../browser/browserController.js";
import type { GeneratedTestCase } from "../generation/automationGenerator.js";
import type { DiscoveredWorkflow, EvidenceBundle } from "../types.js";

type ExecutionStatus = "NotExecuted" | "Pass" | "Fail" | "Blocked";

// A logout/sign-out test case ends the browser's authenticated session for
// the rest of the run — since every generated test replays in one shared
// persistent session, running it earlier would silently break every test
// that runs after it (they'd all land on the login page instead of the
// page they're meant to test). Running it last, once, avoids that.
const LOGOUT_PATTERN = /log[\s-]?out|sign[\s-]?out/i;

function isLogoutScenario(gen: GeneratedTestCase): boolean {
  return LOGOUT_PATTERN.test(gen.scenario.name) || LOGOUT_PATTERN.test(gen.scenario.workflowName);
}

function orderForExecution(generated: GeneratedTestCase[]): GeneratedTestCase[] {
  const logoutTests = generated.filter(isLogoutScenario);
  const rest = generated.filter((g) => !isLogoutScenario(g));
  return [...rest, ...logoutTests];
}

// Same "any Fail -> Fail; else any Blocked -> Blocked; else all Pass ->
// Pass" rule as the manual execution flow (server/src/routes/testExecutions.ts
// deriveStatus) — reimplemented locally rather than importing from a route
// file, since that function isn't exported and this feature must not modify
// existing files.
function deriveOverallStatus(steps: { status: ExecutionStatus }[]): ExecutionStatus {
  if (steps.length === 0) return "NotExecuted";
  if (steps.some((s) => s.status === "Fail")) return "Fail";
  if (steps.some((s) => s.status === "Blocked")) return "Blocked";
  if (steps.every((s) => s.status === "Pass")) return "Pass";
  return "NotExecuted";
}

export type FailedStep = {
  testCaseId: string;
  testExecutionId: string;
  testStepExecutionId: string;
  evidence: EvidenceBundle;
};

// Replays each generated TestCase's steps through the real browser,
// creating the exact same TestCycleTest -> TestExecution -> TestStepExecution
// rows the manual "select tests" flow creates (server/src/routes/testCycles.ts),
// so results land in the real Test Cycle UI. Each step is interpreted
// against the LIVE page's current elements (see generation/stepInterpreter.ts)
// — steps that can't be confidently mapped to a concrete action are treated
// as an observation/assertion checkpoint rather than a guessed interaction.
export async function executeGeneratedTests(params: {
  runId: string;
  testCycleId: string;
  controller: BrowserController;
  generated: GeneratedTestCase[];
  workflows: DiscoveredWorkflow[];
  targetUrl: string;
  onLog: (line: string) => void;
}): Promise<{ passed: number; failed: number; failedSteps: FailedStep[] }> {
  const { runId, testCycleId, controller, generated, workflows, targetUrl, onLog } = params;
  const workflowByName = new Map(workflows.map((w) => [w.name, w]));

  let passed = 0;
  let failed = 0;
  const failedSteps: FailedStep[] = [];

  for (const gen of orderForExecution(generated)) {
    if (isCancelled(runId) || elapsedMs(runId) > MAX_RUN_DURATION_MS) {
      onLog("Test execution stopped (cancelled or run duration limit reached).");
      break;
    }

    const testCase = await prisma.testCase.findUniqueOrThrow({
      where: { id: gen.testCaseId },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    });

    const execution = await prisma.$transaction(async (tx) => {
      const cycleTest = await tx.testCycleTest.create({ data: { testCycleId, testCaseId: testCase.id } });
      const created = await tx.testExecution.create({ data: { testCycleTestId: cycleTest.id, startedAt: new Date() } });
      if (testCase.steps.length > 0) {
        await tx.testStepExecution.createMany({
          data: testCase.steps.map((step) => ({
            testExecutionId: created.id,
            testStepId: step.id,
            stepNumber: step.stepNumber,
            description: step.description,
            testData: step.testData,
            expectedResult: step.expectedResult,
          })),
        });
      }
      return created;
    });

    const stepExecutions = await prisma.testStepExecution.findMany({
      where: { testExecutionId: execution.id },
      orderBy: { stepNumber: "asc" },
    });

    const startUrl = workflowByName.get(gen.scenario.workflowName)?.startUrl || targetUrl;
    const stepStatuses: { status: ExecutionStatus }[] = [];
    let caseFailed = false;

    try {
      await controller.navigate(startUrl);
    } catch (err) {
      caseFailed = true;
      onLog(`${gen.code}: failed to navigate to ${startUrl} — ${(err as Error).message}`);
    }

    for (const step of stepExecutions) {
      if (caseFailed) {
        await prisma.testStepExecution.update({
          where: { id: step.id },
          data: { status: "Blocked", actualResult: "Skipped — an earlier step in this test failed." },
        });
        stepStatuses.push({ status: "Blocked" });
        continue;
      }

      let status: ExecutionStatus = "Pass";
      let actualResult = "Step completed.";

      try {
        const pageBefore = await controller.inspectPage();
        const action = interpretStep(step.description, pageBefore.elements);
        const consoleCountBefore = controller.captureConsole().length;
        const networkCountBefore = controller.captureNetwork().length;
        let pageAfter = pageBefore;

        if (action.kind === "click") {
          await controller.click(action.selectorHint);
          actualResult = "Clicked the matched element.";
          // A click can trigger an async fetch that fails a moment later
          // (the click call itself succeeds regardless) — give it a beat
          // before checking for new console/network errors below.
          await new Promise((resolve) => setTimeout(resolve, 500));
          pageAfter = await controller.inspectPage();
        } else if (action.kind === "type") {
          await controller.type(action.selectorHint, action.value);
          actualResult = "Entered a value into the matched field.";
        } else {
          actualResult = `Observed page: "${pageAfter.title}" (${pageAfter.url}).`;
        }

        // A password field showing up on a page that isn't itself a
        // login/logout scenario means the session was unexpectedly lost
        // (e.g. it expired, or an earlier step in this run logged out) —
        // report that honestly as a failure instead of a false "Pass" for
        // steps that fell back to "assert" (which otherwise just observes
        // whatever page it lands on). FailureAnalysis can then classify it
        // as AuthSession with real evidence.
        const isAuthWorkflow = /log[\s-]?in|sign[\s-]?in|log[\s-]?out|sign[\s-]?out/i.test(gen.scenario.workflowName);
        if (!isAuthWorkflow && pageAfter.elements.some((e) => e.type === "password")) {
          status = "Fail";
          actualResult = `Unexpectedly landed on a page with a login form — the session appears to have been lost (now at ${pageAfter.url}).`;
          caseFailed = true;
        } else if (action.kind !== "assert") {
          // A click/type "succeeding" only means Playwright could perform
          // the DOM interaction — it says nothing about whether the app's
          // own resulting behavior (an async fetch, a JS handler) actually
          // worked. Check for errors this specific action caused, not
          // pre-existing page noise, by comparing against the counts
          // captured just before the action ran.
          const newNetworkErrors = controller.captureNetwork().slice(networkCountBefore);
          const newConsoleErrors = controller.captureConsole().slice(consoleCountBefore);
          if (newNetworkErrors.length > 0) {
            const first = newNetworkErrors[0];
            status = "Fail";
            actualResult = `This action triggered a failed network request: ${first.method} ${first.url} (${first.status ?? first.failure ?? "failed"}).`;
            caseFailed = true;
          } else if (newConsoleErrors.length > 0) {
            status = "Fail";
            actualResult = `This action triggered a browser console error: ${newConsoleErrors[0].text}`;
            caseFailed = true;
          }
        }
      } catch (err) {
        status = "Fail";
        actualResult = (err as Error).message;
        caseFailed = true;
      }

      await prisma.testStepExecution.update({ where: { id: step.id }, data: { status, actualResult } });
      stepStatuses.push({ status });

      if (status === "Fail") {
        const evidence: EvidenceBundle = {
          error: actualResult,
          consoleErrors: controller.captureConsole().map((c) => c.text),
          networkErrors: controller.captureNetwork().map((n) => `${n.method} ${n.url} ${n.status ?? n.failure ?? ""}`),
          url: controller.getCurrentUrl(),
          expectedResult: step.expectedResult,
          actualResult,
        };
        try {
          const shot = await controller.screenshot();
          evidence.screenshotPath = await saveScreenshot(runId, `${gen.code}-step${step.stepNumber}`, shot);
        } catch {
          // Screenshot capture is best-effort only.
        }
        failedSteps.push({ testCaseId: testCase.id, testExecutionId: execution.id, testStepExecutionId: step.id, evidence });
      }
    }

    const overallStatus = deriveOverallStatus(stepStatuses);
    await prisma.testExecution.update({ where: { id: execution.id }, data: { status: overallStatus, completedAt: new Date() } });
    await recomputeCycleStatus(testCycleId);

    if (overallStatus === "Pass") passed++;
    else failed++;
    onLog(`${gen.code}: ${overallStatus}`);
  }

  return { passed, failed, failedSteps };
}
