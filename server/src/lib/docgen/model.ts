import type { GeneratedContent } from "../ai/testPlanGenerate.js";

export type DocBlock =
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "keyValueGrid"; pairs: [string, string][] }
  | { type: "checklist"; items: { label: string; checked: boolean }[] };

type Criterion = { label: string; checked: boolean };
type Risk = { risk: string; probability: string; impact: string; mitigation: string; owner: string };
type Dependency = { name: string; status: string };
type Resource = { role: string; name: string; responsibilities: string };
type Schedule = Record<string, string | undefined>;

export type TestPlanForDoc = {
  planCode: string;
  name: string;
  version: string;
  status: string;
  owner: string;
  testPhase: string;
  releaseVersion: string;
  environment: string;
  priority: string;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  objective: string;
  testTypes: string[];
  otherTestType: string | null;
  inScope: string[];
  outOfScope: string[];
  entryCriteria: Criterion[] | null;
  exitCriteria: Criterion[] | null;
  risks: Risk[] | null;
  dependencies: Dependency[] | null;
  resources: Resource[] | null;
  schedule: Schedule | null;
  generatedContent: GeneratedContent | null;
  approvedAt: Date | null;
  updatedAt: Date;
};

function fmtDate(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export function buildDocumentModel(params: {
  plan: TestPlanForDoc;
  projectName: string;
  requirements: { id: string; title: string; priority: string }[];
}): DocBlock[] {
  const { plan, projectName, requirements } = params;
  const content = plan.generatedContent;
  const blocks: DocBlock[] = [];

  blocks.push({ type: "heading", level: 1, text: plan.name || "Untitled Test Plan" });
  blocks.push({
    type: "keyValueGrid",
    pairs: [
      ["Plan ID", `${plan.planCode} · v${plan.version}`],
      ["Project", projectName],
      ["Status", plan.status.replace("_", " ")],
      ["Owner", plan.owner],
      ["Release / Version", plan.releaseVersion],
      ["Test Phase", plan.testPhase],
      ["Environment", plan.environment],
      ["Priority", plan.priority],
      ["Planned Dates", `${fmtDate(plan.plannedStartDate)} – ${fmtDate(plan.plannedEndDate)}`],
      ["Generated", fmtDate(plan.updatedAt)],
    ],
  });

  blocks.push({ type: "heading", level: 2, text: "1. Document Control" });
  blocks.push({ type: "paragraph", text: content?.sections.documentControl ?? "" });

  blocks.push({ type: "heading", level: 2, text: "2. Test Plan Overview" });
  blocks.push({ type: "paragraph", text: content?.sections.overview ?? "" });

  blocks.push({ type: "heading", level: 2, text: "3. Test Objective" });
  blocks.push({ type: "paragraph", text: plan.objective });

  blocks.push({ type: "heading", level: 2, text: "4. Test Scope" });
  blocks.push({ type: "paragraph", text: content?.sections.scope ?? "" });
  blocks.push({
    type: "table",
    headers: ["In Scope", "Out of Scope"],
    rows: [[plan.inScope.join(", ") || "—", plan.outOfScope.join(", ") || "—"]],
  });

  blocks.push({ type: "heading", level: 2, text: "5. Requirements Coverage & Traceability" });
  blocks.push({
    type: "table",
    headers: ["Requirement ID", "Requirement", "Priority", "Planned Test Types"],
    rows:
      requirements.length > 0
        ? requirements.map((r) => [r.id, r.title, r.priority, plan.testTypes.join(", ") || "—"])
        : [["—", "No requirements linked", "—", "—"]],
  });

  blocks.push({ type: "heading", level: 2, text: "6. Test Strategy" });
  blocks.push({ type: "paragraph", text: content?.sections.testStrategy ?? "" });

  blocks.push({ type: "heading", level: 2, text: "7. Test Types" });
  blocks.push({
    type: "paragraph",
    text: [...plan.testTypes, plan.otherTestType].filter(Boolean).join(", ") || "—",
  });

  blocks.push({ type: "heading", level: 2, text: "8. Test Environment" });
  blocks.push({ type: "paragraph", text: content?.sections.testEnvironment ?? "" });

  blocks.push({ type: "heading", level: 2, text: "9. Test Data Strategy" });
  blocks.push({ type: "paragraph", text: content?.sections.testDataStrategy ?? "" });

  blocks.push({ type: "heading", level: 2, text: "10. Entry Criteria" });
  blocks.push({ type: "checklist", items: plan.entryCriteria ?? [] });

  blocks.push({ type: "heading", level: 2, text: "11. Exit Criteria" });
  blocks.push({ type: "checklist", items: plan.exitCriteria ?? [] });
  blocks.push({ type: "paragraph", text: content?.sections.entryExitCriteria ?? "" });

  blocks.push({ type: "heading", level: 2, text: "12. Test Deliverables" });
  blocks.push({ type: "paragraph", text: content?.sections.deliverables ?? "" });

  blocks.push({ type: "heading", level: 2, text: "13. Test Resources & Responsibilities" });
  blocks.push({ type: "paragraph", text: content?.sections.resourcesResponsibilities ?? "" });
  blocks.push({
    type: "table",
    headers: ["Role", "Name", "Responsibilities"],
    rows: (plan.resources ?? []).map((r) => [r.role, r.name, r.responsibilities]),
  });

  blocks.push({ type: "heading", level: 2, text: "14. Test Schedule" });
  blocks.push({ type: "paragraph", text: content?.sections.schedule ?? "" });
  if (plan.schedule) {
    blocks.push({
      type: "keyValueGrid",
      pairs: Object.entries(plan.schedule)
        .filter(([, v]) => v)
        .map(([k, v]) => [k, v as string]),
    });
  }

  blocks.push({ type: "heading", level: 2, text: "15. Dependencies" });
  blocks.push({ type: "paragraph", text: content?.sections.dependencies ?? "" });
  blocks.push({
    type: "table",
    headers: ["Dependency", "Status"],
    rows: (plan.dependencies ?? []).map((d) => [d.name, d.status]),
  });

  blocks.push({ type: "heading", level: 2, text: "16. Risks & Mitigations" });
  blocks.push({ type: "paragraph", text: content?.sections.risksMitigations ?? "" });
  blocks.push({
    type: "table",
    headers: ["Risk", "Probability", "Impact", "Mitigation", "Owner"],
    rows: (plan.risks ?? []).map((r) => [r.risk, r.probability, r.impact, r.mitigation, r.owner]),
  });

  blocks.push({ type: "heading", level: 2, text: "17. Defect Management Approach" });
  blocks.push({ type: "paragraph", text: content?.sections.defectManagement ?? "" });

  blocks.push({ type: "heading", level: 2, text: "18. Test Execution Approach" });
  blocks.push({ type: "paragraph", text: content?.sections.executionApproach ?? "" });

  if (content && content.assumptionsAndClarifications.length > 0) {
    blocks.push({ type: "heading", level: 2, text: "19. Assumptions & Recommended Clarifications" });
    blocks.push({
      type: "checklist",
      items: content.assumptionsAndClarifications.map((a) => ({ label: a, checked: false })),
    });
  }

  blocks.push({ type: "heading", level: 2, text: "20. Approval / Sign-off" });
  blocks.push({
    type: "keyValueGrid",
    pairs: [
      ["Status", plan.status.replace("_", " ")],
      ["Approved At", fmtDate(plan.approvedAt)],
    ],
  });

  blocks.push({ type: "heading", level: 2, text: "21. Revision History" });
  blocks.push({
    type: "table",
    headers: ["Version", "Status", "Date"],
    rows: [[plan.version, plan.status.replace("_", " "), fmtDate(plan.updatedAt)]],
  });

  return blocks;
}
