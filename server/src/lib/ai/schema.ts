export type AnalyzedRequirement = {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  flows: string[];
  risks: string[];
};

export type AnalyzerInput = {
  text?: string;
  file?: { data: string; mimeType: string };
};

export const ANALYSIS_SCHEMA = {
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
        },
        required: ["title", "description", "acceptanceCriteria", "flows", "risks"],
        additionalProperties: false,
      },
    },
  },
  required: ["requirements"],
  additionalProperties: false,
} as const;

export const SYSTEM_PROMPT = `You are the Requirement Analyzer for HeliosQE, a quality engineering platform.
You are given raw, unstructured input — a spec, a user story, meeting notes, a feature description, or an attached document/image.
Extract every distinct testable requirement it implies. For each one, identify:
- a short title
- a clear description of what the system must do
- concrete, verifiable acceptance criteria
- the key user/system flows it affects
- risks or ambiguities a QE engineer should know about (edge cases, unclear scope, missing detail)

If the input implies only one requirement, return one. Do not invent requirements the input doesn't support.

If the input does not describe any testable feature or behavior at all — for example, a bare URL, a single vague word, or unrelated chatter — return an empty requirements array: {"requirements": []}. Do NOT describe the input's vagueness or ambiguity as if it were itself a requirement.`;
