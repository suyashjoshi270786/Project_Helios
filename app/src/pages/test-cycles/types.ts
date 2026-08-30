export type TestCycleStatus = "NotStarted" | "InProgress" | "Completed";

export type ExecutionStatus = "NotExecuted" | "Pass" | "Fail" | "Blocked";

export type CycleSummary = {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  notExecuted: number;
};

export type TestCycle = {
  id: string;
  code: string;
  name: string;
  testPhase: string;
  environment?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  owner?: string | null;
  status: TestCycleStatus;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  summary: CycleSummary;
};

export type TestCycleTestCase = {
  id: string;
  code: string;
  name: string;
  testType: "Manual" | "Automated";
  environment?: string | null;
  testPhase?: string | null;
};

export type LinkedDefectSummary = { id: string; key: string; title: string };

export type TestCycleTest = {
  id: string;
  testCaseId: string;
  testCase: TestCycleTestCase;
  environment?: string | null;
  tester?: string | null;
  status: ExecutionStatus;
  defects: LinkedDefectSummary[];
};

export type TestCycleDetail = TestCycle & { tests: TestCycleTest[] };

export type LinkedDefect = {
  id: string;
  workItem: { id: string; key: string; title: string; status: string };
};

export type TestStepExecution = {
  id: string;
  stepNumber: number;
  description: string;
  testData?: string | null;
  expectedResult: string;
  status: ExecutionStatus;
  actualResult?: string | null;
  comment?: string | null;
  defectLinks: LinkedDefect[];
};

export type TestExecution = {
  id: string;
  status: ExecutionStatus;
  steps: TestStepExecution[];
};

export type TestCycleTestExecutionDetail = {
  id: string;
  environment?: string | null;
  tester?: string | null;
  testCase: TestCycleTestCase;
  projectId: string;
  testCycle: { id: string; name: string };
  execution: TestExecution;
};
