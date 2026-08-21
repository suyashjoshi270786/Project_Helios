export type WorkItemType = "Initiative" | "Epic" | "Feature" | "Story" | "Task" | "SubTask" | "Defect";

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

export type WorkItemDetail = WorkItem & {
  ancestors: WorkItemAncestor[];
  children: WorkItem[];
  childrenSummary: ChildrenSummary;
  testCases: LinkedTestCase[];
  acceptanceCriteria: AcceptanceCriterion[];
};
