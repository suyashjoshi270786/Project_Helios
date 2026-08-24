import { describeContext, GENERATE_TEXT_PROVIDERS, type SuggestProvider } from "./suggest.js";

export type { SuggestProvider };
export type WorkItemSuggestField =
  | "description"
  | "userStory"
  | "acceptanceCriteria"
  | "stepsToReproduce"
  | "expectedResult";

const FIELD_INSTRUCTIONS: Record<WorkItemSuggestField, string> = {
  description: "Write a concise, professional description (2-4 sentences) for this work item.",
  userStory:
    'Write a user story in exactly this three-line format, nothing else:\nAs a: <role>\nI want: <capability>\nSo that: <business value>',
  acceptanceCriteria:
    "Generate 3 to 6 concise, testable acceptance criteria for this work item. One per line, plain sentences — no numbering, no markdown bullets, no blank lines.",
  stepsToReproduce:
    "Write clear, numbered steps to reproduce this defect (3-6 steps) based on its title and description. One step per line, plain sentences — no markdown bullets, no blank lines. If the description doesn't give enough detail for a specific step, write a reasonable generic step rather than inventing specific data values.",
  expectedResult:
    "Write one or two sentences describing what should have happened, based on the defect's title and description. Plain text, no markdown.",
};

const SYSTEM_PROMPT = `You are an Agile work-item writing assistant inside Helios, a quality engineering and delivery platform. Given context about a work item already entered by the user (its type, title, and any existing description or user story), draft the requested content. Ground your draft strictly in the provided context — never invent unrelated business rules or requirements. When drafting defect fields (steps to reproduce, expected result), never invent the actual/observed behavior — that comes only from the user. Respond with plain text only, following the requested format exactly: no markdown, no headings, no preamble like "Here is a draft".`;

function buildPrompt(field: WorkItemSuggestField, context: Record<string, unknown>): string {
  return `${FIELD_INSTRUCTIONS[field]}\n\nContext:\n${describeContext(context)}\n\nReturn ONLY the requested content.`;
}

export async function suggestWorkItemField(
  field: WorkItemSuggestField,
  context: Record<string, unknown>,
  provider: SuggestProvider,
): Promise<string> {
  const generate = GENERATE_TEXT_PROVIDERS[provider];
  if (!generate) throw new Error("This model isn't available yet.");
  return generate(SYSTEM_PROMPT, buildPrompt(field, context));
}
