export type WorkItemType = "Initiative" | "Epic" | "Feature" | "Story" | "Task" | "SubTask" | "Defect";

export type TeamMemberRef = { id: string; name: string; email: string; avatarUrl?: string | null };

export type WorkItem = {
  id: string;
  type: WorkItemType;
  key: string;
  title: string;
  description?: string | null;
  asA?: string | null;
  iWant?: string | null;
  soThat?: string | null;
  status: string;
  priority?: string | null;
  assignee?: string | null;
  reporter?: string | null;
  assigneeId?: string | null;
  reporterId?: string | null;
  assignedTo?: TeamMemberRef | null;
  reportedBy?: TeamMemberRef | null;
  severity?: string | null;
  environment?: string | null;
  stepsToReproduce?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  rank: number;
  sprintId?: string | null;
  storyPoints?: number | null;
  originalEstimate?: number | null;
  remainingEstimate?: number | null;
  labels: string[];
  components: string[];
  startDate?: string | null;
  targetDate?: string | null;
  dueDate?: string | null;
  parentId?: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  childCount?: number;
  parent?: { id: string; key: string; title: string } | null;
};

export type AcceptanceCriterion = {
  id: string;
  workItemId: string;
  text: string;
  completed: boolean;
  order: number;
};

export type LinkedTestCase = {
  id: string;
  code: string;
  name: string;
};

export type WorkItemAncestor = {
  id: string;
  key: string;
  title: string;
  type: WorkItemType;
};

export type ChildrenSummary = { total: number; byType: Record<string, number> };

export type FoundInTrace = {
  linkId: string;
  stepNumber: number;
  testCase: { id: string; code: string; name: string };
  testCycle: { id: string; name: string };
};

export type TestCaseCoverage = { total: number; passed: number; failed: number; blocked: number; notRun: number };

export type RelatedRequirement = { id: string; title: string; status: "Draft" | "InReview" | "Approved" };

export type WorkItemDetail = WorkItem & {
  ancestors: WorkItemAncestor[];
  children: WorkItem[];
  childrenSummary: ChildrenSummary;
  testCases: LinkedTestCase[];
  acceptanceCriteria: AcceptanceCriterion[];
  foundIn: FoundInTrace[];
  // Real counts only — "Not available" is used in the UI wherever there's
  // genuinely nothing to compute from, never a fabricated number.
  testCaseCoverage: TestCaseCoverage;
  requirements: RelatedRequirement[];
};

export type SprintStatus = "Planned" | "Active" | "Completed";

export type SprintSummary = { total: number; done: number; points: number };

export type Sprint = {
  id: string;
  name: string;
  goal?: string | null;
  status: SprintStatus;
  startDate?: string | null;
  endDate?: string | null;
  projectId: string;
  summary: SprintSummary;
};
