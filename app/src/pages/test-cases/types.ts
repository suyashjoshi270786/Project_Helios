export type Folder = {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TestSuite = {
  id: string;
  name: string;
  folderId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  testCaseCount?: number;
};

export type TestCaseType = "Manual" | "Automated";

export type TestStep = {
  id: string;
  stepNumber: number;
  description: string;
  testData?: string | null;
  expectedResult: string;
};

export type TestStepDraft = {
  key: string;
  description: string;
  testData: string;
  expectedResult: string;
};

export type WorkItemRef = { id: string; key: string; title: string; type: string };

export type TestCase = {
  id: string;
  code: string;
  name: string;
  objective?: string | null;
  preconditions?: string | null;
  environment?: string | null;
  testPhase?: string | null;
  testType: TestCaseType;
  archived: boolean;
  gherkinScript?: string | null;
  sourceRequirementId?: string | null;
  testSuiteId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  steps: TestStep[];
  stepCount?: number;
  latestStatus?: "NotExecuted" | "Pass" | "Fail" | "Blocked";
  // Only populated by GET /test-cases/:id (the detail/editor view) — where
  // this case is organized (folder path) vs. where it originated
  // (Requirement/Work Item) are different concepts, both shown there.
  testSuite?: { id: string; name: string; folderId: string; folder: { id: string; name: string; parentId: string | null } };
  sourceRequirement?: { id: string; title: string } | null;
  workItems?: WorkItemRef[];
};
