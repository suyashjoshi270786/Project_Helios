export {
  CARD_CLASS,
  INPUT_CLASS,
  TEXTAREA_CLASS,
  LABEL_CLASS,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
} from "../../lib/formStyles";

import type { RunStatus, StageName, StageStatus } from "./types";

export const STAGE_ORDER: StageName[] = [
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

export const STAGE_LABELS: Record<StageName, string> = {
  Initialization: "Initialization",
  Login: "Login",
  AuthVerification: "Auth Verification",
  Exploration: "Exploration",
  WorkflowDiscovery: "Workflow Discovery",
  ScenarioGeneration: "Scenario Generation",
  BddGeneration: "BDD Generation",
  TestGeneration: "Test Generation",
  TestCycleCreation: "Test Cycle Creation",
  TestExecution: "Test Execution",
  FailureAnalysis: "Failure Analysis",
  DefectCreation: "Defect Creation",
  ReportGeneration: "Report Generation",
};

export const STAGE_STATUS_BADGE_CLASS: Record<StageStatus, string> = {
  Pending: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  Running: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  Completed: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  Failed: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
  Skipped: "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500",
  Cancelled: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
};

export const RUN_STATUS_BADGE_CLASS: Record<RunStatus, string> = {
  Pending: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  Running: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  Completed: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  Failed: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
  Cancelled: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
};

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  Pending: "Pending",
  Running: "Running",
  Completed: "Completed",
  Failed: "Failed",
  Cancelled: "Cancelled",
};

export const POLL_INTERVAL_MS = 3000;
