import type { AutonomousStageName } from "@prisma/client";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Hard ceilings — a per-run override (maxDepth/maxTests from the Start Run
// form) may only ever narrow these, never exceed them. See orchestrator.ts.
export const MAX_PAGES = envInt("AUTONOMOUS_MAX_PAGES", 25);
export const MAX_ACTIONS = envInt("AUTONOMOUS_MAX_ACTIONS", 150);
export const MAX_AI_ITERATIONS = envInt("AUTONOMOUS_MAX_AI_ITERATIONS", 100);
export const MAX_TESTS = envInt("AUTONOMOUS_MAX_TESTS", 15);
export const MAX_RUN_DURATION_MS = envInt("AUTONOMOUS_MAX_RUN_DURATION_MS", 20 * 60 * 1000);

export const STAGE_ORDER: AutonomousStageName[] = [
  "Initialization",
  "Login",
  "AuthVerification",
  "Exploration",
  "WorkflowDiscovery",
  "ScenarioGeneration",
  "BddGeneration",
  "TestGeneration",
  "TestCycleCreation",
  "TestExecution",
  "FailureAnalysis",
  "DefectCreation",
  "ReportGeneration",
];

export function isAutonomousTestingEnabled(): boolean {
  return process.env.ENABLE_AUTONOMOUS_TESTING === "true";
}
