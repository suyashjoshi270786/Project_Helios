import { callGeminiJson } from "./geminiClient.js";
import { ALLOWED_ACTIONS, type AgentAction, type PageSummary } from "../types.js";

// The OBSERVE -> REASON step of the exploration loop. Gemini sees only a
// compact PageSummary plus a list of not-yet-visited same-origin links — it
// never receives credentials or raw DOM. It picks exactly one action; Helios
// (BrowserController) is the only thing that ever executes it (the ACT
// step), and the result feeds back into the next OBSERVE.
const ACTION_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: [...ALLOWED_ACTIONS] },
    params: {
      type: "object",
      properties: {
        url: { type: "string" },
        selectorHint: { type: "string" },
        value: { type: "string" },
      },
      additionalProperties: false,
    },
    reasoning: { type: "string" },
  },
  required: ["action", "params", "reasoning"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are the exploration reasoning engine for HeliosQE's Autonomous Testing agent.
You are given a compact summary of the current page of a web application (already authenticated) and a list of not-yet-visited links within the same application.
Choose exactly ONE next action to help build a useful map of the application's pages and interactive workflows:
- "navigate": go to one of the listed candidate links (params.url). Prefer this when there are unvisited links — breadth of discovery is the priority.
- "click": interact with an element on the CURRENT page (params.selectorHint, copied exactly from an element in the page summary) to reveal additional UI (a menu, tab, modal, dropdown, or the next step of a gated flow like an organization/workspace picker) that isn't reachable via a plain link. For a combobox/searchable dropdown specifically, ALWAYS click it first with no typing before considering "type" — many such components show a default list of real, already-existing options as soon as they're opened, with no search text needed. If that reveals options (role "option" elements will appear in the next page summary), click the one that best matches the goal — never guess/type a value when a real option is already visible to pick from.
- "type": type a short value into a text/search/combobox input (params.selectorHint copied exactly from an element in the page summary, params.value) ONLY after a plain click on it already happened and revealed no usable options, or the field isn't a dropdown at all (a plain text field). If tester-provided instructions name a specific value, still click the field first — if that value already appears as a default option, click it directly instead of typing.
- "finish": stop trying on THIS page — nothing more useful remains here, or every available action has already been attempted with no effect.
Never choose "select", "hover", "scroll", "wait", or any inspection/capture action here — this decision is exploration-only.
Do not repeat an action you have already tried on this page if it's listed below as already attempted — pick something different or "finish".
When more than one way to proceed exists (e.g. selecting an EXISTING item from a list vs. creating a brand-new one), prefer the path that uses EXISTING data — exploration should map the application, not populate it with new test data.
Keep "reasoning" to one short sentence.`;

export async function decideNextExplorationAction(input: {
  page: PageSummary;
  candidateLinks: string[];
  instructions?: string | null;
  visitedCount: number;
  pageBudgetRemaining: number;
  alreadyAttempted?: string[];
}): Promise<AgentAction> {
  const prompt = `Current page:
${JSON.stringify(input.page)}

Not-yet-visited same-application links (up to 15 shown):
${input.candidateLinks.slice(0, 15).join("\n") || "(none)"}

Pages visited so far: ${input.visitedCount}. Page budget remaining: ${input.pageBudgetRemaining}.
${input.alreadyAttempted?.length ? `Already attempted on this page (do not repeat): ${input.alreadyAttempted.join(", ")}` : ""}
${input.instructions ? `Tester-provided context/instructions: ${input.instructions}` : ""}`;

  return callGeminiJson<AgentAction>({ systemPrompt: SYSTEM_PROMPT, prompt, schema: ACTION_SCHEMA });
}
