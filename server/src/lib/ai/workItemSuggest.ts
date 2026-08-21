import { describeContext, GENERATE_TEXT_PROVIDERS, type SuggestProvider } from "./suggest.js";

export type { SuggestProvider };
export type WorkItemSuggestField = "description" | "userStory" | "acceptanceCriteria";

const FIELD_INSTRUCTIONS: Record<WorkItemSuggestField, string> = {
  description: "Write a concise, professional description (2-4 sentences) for this work item.",
  userStory:
    'Write a user story in exactly this three-line format, nothing else:\nAs a: <role>\nI want: <capability>\nSo that: <business value>',
  acceptanceCriteria:
    "Generate 3 to 6 concise, testable acceptance criteria for this work item. One per line, plain sentences — no numbering, no markdown bullets, no blank lines.",
};

const SYSTEM_PROMPT = `You are an Agile work-item writing assistant inside Helios, a quality engineering and delivery platform. Given context about a work item already entered by the user (its type, title, and any existing description or user story), draft the requested content. Ground your draft strictly in the provided context — never invent unrelated business rules or requirements. Respond with plain text only, following the requested format exactly: no markdown, no headings, no preamble like "Here is a draft".`;

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
