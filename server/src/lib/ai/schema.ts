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
You are given raw, unstructured input — a spec, a user story, meeting notes, a feature description, a bare URL/page name, or an attached document/image.
Extract every distinct testable requirement it implies. For each one, identify:
- a short title
- a clear description of what the system must do
- concrete, verifiable acceptance criteria
- the key user/system flows it affects
- risks or ambiguities a QE engineer should know about (edge cases, unclear scope, missing detail)

If the input implies only one requirement, return one.

Sparse input still deserves a useful answer. If the input names or points at a recognizable feature, screen, or page — even just a URL path, a page name, or a short phrase like "test the login page" — infer the most reasonable, industry-standard testable requirement(s) for that kind of feature (e.g. a "/login" URL implies authentication with valid/invalid credentials and input validation; a "checkout" mention implies payment and order flows). Base the inference on common QE practice for that feature type, not on invented business specifics (exact password rules, specific error copy, etc.). Always add an entry to that requirement's "risks" array stating plainly that it was inferred from minimal input and the real acceptance criteria/business rules should be confirmed with the team.

Do not invent requirements with no basis at all in the input. Only return an empty requirements array — {"requirements": []} — when the input has no recognizable feature, screen, or subject whatsoever (pure greetings, gibberish, or chatter unrelated to any product surface). Do NOT describe the input's vagueness or ambiguity as if it were itself a requirement.`;
