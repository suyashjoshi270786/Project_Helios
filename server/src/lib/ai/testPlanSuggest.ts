import { describeContext, GENERATE_TEXT_PROVIDERS, type SuggestProvider } from "./suggest.js";

export type { SuggestProvider };
export type SuggestField = "objective" | "testStrategy" | "testDataRequirements" | "riskDescription" | "riskMitigation";

const FIELD_INSTRUCTIONS: Record<SuggestField, string> = {
  objective:
    "Write a concise, professional Test Plan objective (2-3 sentences) describing what this test plan validates.",
  testStrategy:
    "Write a short paragraph (2-4 sentences) describing the test strategy for the given test type within this test plan.",
  testDataRequirements:
    "Write a short paragraph (2-4 sentences) describing the test data requirements for this test plan, including what kinds of data are needed and any sensitive-data handling considerations.",
  riskDescription: "Suggest one realistic, specific risk (1-2 sentences) relevant to this test plan.",
  riskMitigation: "Suggest a concrete mitigation (1-2 sentences) for the given risk.",
};

const SUGGEST_SYSTEM_PROMPT = `You are a test planning writing assistant inside HeliosQE, a quality engineering platform. Given context about a test plan already entered by the user, draft a short, professional piece of text for the requested field. Ground your draft in the provided context — do not invent unrelated requirements, business rules, or details that contradict it. Respond with plain text only: no markdown, no headings, no surrounding quotes, no preamble like "Here is a draft".`;

function buildSuggestPrompt(field: SuggestField, context: Record<string, unknown>): string {
  return `${FIELD_INSTRUCTIONS[field]}\n\nContext:\n${describeContext(context)}\n\nReturn ONLY the drafted text for this field — no preamble, no labels, no markdown, no quotation marks.`;
}

async function suggest(field: SuggestField, context: Record<string, unknown>, provider: SuggestProvider): Promise<string> {
  const generate = GENERATE_TEXT_PROVIDERS[provider];
  if (!generate) throw new Error("This model isn't available yet.");
  return generate(SUGGEST_SYSTEM_PROMPT, buildSuggestPrompt(field, context));
}

type Suggester = (field: SuggestField, context: Record<string, unknown>) => Promise<string>;

export const SUGGEST_PROVIDERS: Record<SuggestProvider, Suggester | null> = {
  gemini: (field, context) => suggest(field, context, "gemini"),
  anthropic: (field, context) => suggest(field, context, "anthropic"),
  openai: null,
};
