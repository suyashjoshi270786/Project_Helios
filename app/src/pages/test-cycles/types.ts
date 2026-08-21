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

export type TestCycleTest = {
  id: string;
  testCaseId: string;
  testCase: TestCycleTestCase;
  environment?: string | null;
  tester?: string | null;
  status: ExecutionStatus;
};

export type TestCycleDetail = TestCycle & { tests: TestCycleTest[] };

export type TestStepExecution = {
  id: string;
  stepNumber: number;
  description: string;
  testData?: string | null;
  expectedResult: string;
  status: ExecutionStatus;
  actualResult?: string | null;
  comment?: string | null;
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
  testCycle: { id: string; name: string };
  execution: TestExecution;
};
