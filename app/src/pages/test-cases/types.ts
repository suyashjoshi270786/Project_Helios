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
  testSuiteId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  steps: TestStep[];
  stepCount?: number;
};
