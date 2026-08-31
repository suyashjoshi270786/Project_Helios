export type RunStatus = "Pending" | "Running" | "Completed" | "Failed" | "Cancelled";
export type StageStatus = "Pending" | "Running" | "Completed" | "Failed" | "Skipped" | "Cancelled";

export type StageName =
  | "Initialization"
  | "Login"
  | "AuthVerification"
  | "Exploration"
  | "WorkflowDiscovery"
  | "ScenarioGeneration"
  | "BddGeneration"
  | "TestGeneration"
  | "TestCycleCreation"
  | "TestExecution"
  | "FailureAnalysis"
  | "DefectCreation"
  | "ReportGeneration";

export type AutonomousStage = {
  id: string;
  stage: StageName;
  status: StageStatus;
  progress: number;
  logs: string[] | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type BddDocument = { testCaseId: string; code: string; gherkin: string };

export type AutonomousRun = {
  id: string;
  targetUrl: string;
  appName: string | null;
  environment: string | null;
  instructions: string | null;
  maxDepth: number | null;
  maxTests: number | null;
  status: RunStatus;
  currentStage: StageName | null;
  pagesVisited: number;
  actionsTaken: number;
  testsGenerated: number;
  testsExecuted: number;
  testsPassed: number;
  testsFailed: number;
  defectsCreated: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  stages: AutonomousStage[];
  bddDocuments?: BddDocument[] | null;
};

export type AutonomousRunSummary = {
  id: string;
  targetUrl: string;
  appName: string | null;
  environment: string | null;
  status: RunStatus;
  currentStage: StageName | null;
  testsPassed: number;
  testsFailed: number;
  defectsCreated: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

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
  discoveredApplication: { pages: number; workflows: number; forms: number; interactiveElements: number };
  generatedTests: { bddScenarios: number; automatedScenarios: number };
  failureAnalysis: {
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

// Client-side only — never becomes part of any long-lived type, since the
// backend never returns credentials in any response.
export type StartRunInput = {
  projectId: string;
  targetUrl: string;
  username: string;
  password: string;
  environment?: string;
  appName?: string;
  instructions?: string;
  maxDepth?: number;
  maxTests?: number;
};
