import { prisma } from "../../lib/prisma.js";
import { generateGherkin } from "../ai/bddGenerator.js";
import { findDuplicateScenarioIds } from "../ai/dedupChecker.js";
import { MAX_TESTS } from "../constants.js";
import type { GeneratedScenario } from "../types.js";

const FOLDER_NAME = "Autonomous Testing";

// Reuses the exact same TestCase/TestStep tables the manual "Create Test
// Case" flow writes to (testType: Automated, gherkinScript populated) —
// generated tests show up in the existing Test Cases screen like any other,
// just tagged with autonomousRunId for traceability. Lands under a
// dedicated "Autonomous Testing" folder/suite per target host rather than
// scattering into whatever folder happens to be selected.
async function ensureFolderAndSuite(projectId: string, createdById: string, targetHost: string) {
  let folder = await prisma.folder.findFirst({ where: { projectId, name: FOLDER_NAME, parentId: null } });
  if (!folder) {
    folder = await prisma.folder.create({ data: { projectId, name: FOLDER_NAME, createdById } });
  }
  const suiteName = `Autonomous — ${targetHost}`;
  let suite = await prisma.testSuite.findFirst({ where: { projectId, folderId: folder.id, name: suiteName } });
  if (!suite) {
    suite = await prisma.testSuite.create({ data: { projectId, folderId: folder.id, name: suiteName, createdById } });
  }
  return suite;
}

export type GeneratedTestCase = { testCaseId: string; code: string; scenario: GeneratedScenario; gherkin: string };

export async function generateAutomatedTests(params: {
  projectId: string;
  createdById: string;
  autonomousRunId: string;
  targetUrl: string;
  scenarios: GeneratedScenario[];
  maxTests: number;
  onLog: (line: string) => void;
}): Promise<GeneratedTestCase[]> {
  const { projectId, createdById, autonomousRunId, targetUrl, scenarios, maxTests, onLog } = params;
  const cap = Math.min(maxTests, MAX_TESTS);
  const targetHost = new URL(targetUrl).host;
  const suite = await ensureFolderAndSuite(projectId, createdById, targetHost);

  // Cross-run dedup: a scenario testing the same functionality an earlier
  // run (or a manually-authored test) already covers shouldn't consume a
  // slot of this run's test budget — skip it and spend that slot on a
  // workflow that isn't covered yet, rather than piling up near-identical
  // "Select Organization" style test cases every time exploration lands on
  // the same screen. Two layers: a free exact-name check first, then one
  // batched Gemini call to catch the common case of the SAME functionality
  // getting a differently-worded name across runs (LLM output isn't
  // byte-stable) — cheaper than an AI call per scenario, and skipped
  // entirely when there's nothing yet to dedup against.
  const existingTestCases = await prisma.testCase.findMany({
    where: { projectId },
    select: { name: true, objective: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const existingNames = new Set(existingTestCases.map((tc) => tc.name.trim().toLowerCase()));

  const exactDuplicates = scenarios.filter((s) => existingNames.has(s.name.trim().toLowerCase()));
  const candidates = scenarios.filter((s) => !existingNames.has(s.name.trim().toLowerCase()));
  const aiDuplicateIds = await findDuplicateScenarioIds(candidates, existingTestCases, onLog);

  for (const s of exactDuplicates) onLog(`Skipped "${s.name}" — an identically-named test case already exists.`);
  for (const s of candidates) {
    if (aiDuplicateIds.has(s.id)) onLog(`Skipped "${s.name}" — an equivalent test case already exists in this project.`);
  }

  const results: GeneratedTestCase[] = [];

  for (const scenario of candidates) {
    if (results.length >= cap) break;
    if (aiDuplicateIds.has(scenario.id)) continue;

    let gherkin: string;
    try {
      gherkin = await generateGherkin(scenario);
    } catch (err) {
      onLog(`BDD generation failed for "${scenario.name}": ${(err as Error).message}`);
      continue;
    }

    const testCase = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.testCase.count({ where: { projectId } });
      const code = `TC-${String(existingCount + 1).padStart(4, "0")}`;
      const created = await tx.testCase.create({
        data: {
          code,
          name: scenario.name,
          objective: scenario.objective,
          preconditions: scenario.preconditions,
          testType: "Automated",
          gherkinScript: gherkin,
          testSuiteId: suite.id,
          projectId,
          createdById,
          autonomousRunId,
        },
      });
      if (scenario.steps.length > 0) {
        await tx.testStep.createMany({
          data: scenario.steps.map((description, index) => ({
            testCaseId: created.id,
            stepNumber: index + 1,
            description,
            expectedResult: index === scenario.steps.length - 1 ? scenario.expectedResult : "Step completes without error.",
          })),
        });
      }
      return created;
    });

    onLog(`Generated test case ${testCase.code} — "${scenario.name}".`);
    results.push({ testCaseId: testCase.id, code: testCase.code, scenario, gherkin });
  }

  return results;
}
