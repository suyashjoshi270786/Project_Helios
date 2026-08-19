export type TestPlanStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "GENERATING"
  | "GENERATED"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED";

export type TestPlanPriority = "Critical" | "High" | "Medium" | "Low";

export type SuggestField = "objective" | "testStrategy" | "testDataRequirements" | "riskDescription" | "riskMitigation";

export type Criterion = { id: string; label: string; checked: boolean; custom?: boolean };

export type Risk = { id: string; risk: string; probability: string; impact: string; mitigation: string; owner: string };

export type Dependency = { id: string; name: string; status: "Available" | "Pending" | "Blocked" | "Unknown" };

export type Resource = { id: string; role: string; name: string; responsibilities: string };

export type Schedule = {
  planningStart?: string;
  planningEnd?: string;
  testDesignStart?: string;
  executionStart?: string;
  executionEnd?: string;
  regression?: string;
  signOff?: string;
};

export type EnvironmentConfig = {
  applicationUrl?: string;
  browsers?: string[];
  os?: string;
  database?: string;
  apiEnvironment?: string;
};

export type TestDataStrategy = {
  dataSource?: string;
  dataRequirements?: string;
  sensitiveDataHandling?: string;
};

export type GeneratedSections = {
  documentControl: string;
  overview: string;
  scope: string;
  testStrategy: string;
  testEnvironment: string;
  testDataStrategy: string;
  entryExitCriteria: string;
  deliverables: string;
  resourcesResponsibilities: string;
  schedule: string;
  dependencies: string;
  risksMitigations: string;
  defectManagement: string;
  executionApproach: string;
};

export type GeneratedContent = {
  sections: GeneratedSections;
  assumptionsAndClarifications: string[];
};

export type RequirementSummary = {
  id: string;
  title: string;
  description: string;
  status: "Draft" | "InReview" | "Approved";
  priority: "Low" | "Medium" | "High";
};

export type TestPlan = {
  id: string;
  planCode: string;
  version: string;
  isLatest: boolean;
  name: string;
  status: TestPlanStatus;
  testPhase: string;
  releaseVersion: string;
  environment: string;
  priority: TestPlanPriority;
  owner: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  objective: string;
  testTypes: string[];
  otherTestType?: string | null;
  inScope: string[];
  outOfScope: string[];
  testStrategy?: Record<string, string> | null;
  testDataStrategy?: TestDataStrategy | null;
  environmentConfig?: EnvironmentConfig | null;
  entryCriteria?: Criterion[] | null;
  exitCriteria?: Criterion[] | null;
  risks?: Risk[] | null;
  dependencies?: Dependency[] | null;
  resources?: Resource[] | null;
  schedule?: Schedule | null;
  aiProvider: string;
  documentFormats: string[];
  generatedContent?: GeneratedContent | null;
  generatedAt: string | null;
  approvedById?: string | null;
  approvedAt: string | null;
  rejectedReason?: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  selectedRequirementIds: string[];
  requirements?: RequirementSummary[];
  requirementCount?: number;
};

export type TestPlanDraft = Partial<
  Omit<TestPlan, "id" | "planCode" | "version" | "isLatest" | "status" | "projectId" | "createdAt" | "updatedAt">
> & { selectedRequirementIds: string[] };
