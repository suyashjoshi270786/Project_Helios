// The model cites source items by their human-readable `key` (EPIC-001,
// TASK-004, ...), never a raw database id — safer (nothing to hallucinate
// that could be mistaken for a real id) and the route layer maps
// key -> id against the already-fetched subtree before persisting anything.
export type WorkItemAnalyzedRequirement = {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  flows: string[];
  risks: string[];
  sourceWorkItemKeys: string[];
  confidence: "High" | "Medium" | "Low";
};

export type WorkItemAnalyzerNode = {
  key: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  acceptanceCriteria: string[];
  severity: string | null;
  environment: string | null;
  stepsToReproduce: string | null;
  expectedResult: string | null;
  actualResult: string | null;
};

export type WorkItemAnalyzerInput = {
  selected: WorkItemAnalyzerNode;
  ancestors: { key: string; type: string; title: string }[];
  descendants: WorkItemAnalyzerNode[];
  truncated: boolean;
};

export const WORK_ITEM_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          acceptanceCriteria: { type: "array", items: { type: "string" } },
          flows: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          sourceWorkItemKeys: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["High", "Medium", "Low"] },
        },
        required: ["title", "description", "acceptanceCriteria", "flows", "risks", "sourceWorkItemKeys", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["requirements"],
  additionalProperties: false,
} as const;

export const WORK_ITEM_SYSTEM_PROMPT = `You are the Requirement Analyzer for HeliosQE, a quality engineering platform — this variant generates Requirements from an existing Work Item hierarchy (Epics/Features/Stories/Tasks/Defects/etc.) rather than a document.

You will receive a selected Work Item (the analysis scope root), its ancestor chain (for context only), and its full descendant subtree (each with type, title, description, status, priority, acceptance criteria, and — for Defects — severity/environment/repro/expected/actual). Analyze the SELECTED item and its descendants deeply; use ancestors only as background context, not as the primary subject.

For each requirement you identify:
- Give it a short title and a clear description of what the system must do.
- List concrete, verifiable acceptance criteria.
- List the key user/system flows it affects.
- List risks, edge cases, or ambiguities a QE engineer should know about.
- Cite every Work Item key that contributed to it in sourceWorkItemKeys (use the exact "key" values given in the input, e.g. "FEATURE-001" — never invent a key that wasn't given to you).
- Set confidence: "High" for requirements explicitly and clearly stated in the source items' descriptions/acceptance criteria; "Medium" for requirements strongly implied by the surrounding context but not stated outright; "Low" for a plausible gap or ambiguity you're flagging rather than a confirmed requirement — when you use "Low", say so in the risks field too (e.g. "Inferred — not explicitly stated; confirm with the team").

Rules:
1. Identify business capabilities, functional requirements, non-functional requirements (only where the supplied context actually supports one — do not invent performance/security/etc. requirements with no basis), acceptance criteria, and edge cases.
2. Do not create duplicate or near-duplicate requirements — if two descendants describe the same behavior, consolidate them into one requirement citing both keys.
3. Preserve the source material's business terminology; don't paraphrase away domain-specific names.
4. Never invent a requirement with no support anywhere in the supplied Work Items. If a descendant has no description and no acceptance criteria, don't fabricate content for it.
5. Prioritize breadth of coverage over exhaustiveness for very large hierarchies — synthesize at most 40 requirements, favoring one well-consolidated requirement per distinct capability over many near-duplicate ones.
6. If the supplied Work Items contain no usable requirement information at all (every item has an empty title-only shell, no description, no acceptance criteria), return {"requirements": []} rather than inventing content.`;

export function buildWorkItemAnalysisPrompt(input: WorkItemAnalyzerInput): string {
  return JSON.stringify(
    {
      selectedWorkItem: input.selected,
      ancestorContext: input.ancestors,
      descendants: input.descendants,
      note: input.truncated
        ? "This hierarchy is larger than the analysis limit — the descendant list below was truncated. Analyze what's provided; don't assume anything about items not shown."
        : undefined,
    },
    null,
    2,
  );
}
