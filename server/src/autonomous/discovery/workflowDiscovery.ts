import { callGeminiJson } from "../ai/geminiClient.js";
import type { DiscoveredPage, DiscoveredWorkflow } from "../types.js";

const WORKFLOW_SCHEMA = {
  type: "object",
  properties: {
    workflows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          startUrl: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          expectedOutcome: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["name", "startUrl", "steps", "expectedOutcome", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["workflows"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You identify meaningful, testable end-to-end user workflows (e.g. login, search, CRUD create/read/update/delete, form submission with validation, navigation) from a list of discovered pages of a web application and their interactive elements.
Only describe workflows the pages actually support — do not invent behavior, business rules, or outcomes the elements don't imply. If a workflow's outcome can't be reasonably inferred, describe it in general terms (e.g. "the item should appear in the list") rather than guessing specifics.
Return at most 12 workflows, most valuable/testable first.`;

// Rule-based first pass: a cheap, deterministic text summary of each page's
// interactive surface (input/button counts, top labels) fed to one Gemini
// call, rather than sending every page individually — see spec section 23.
function summarizePagesForPrompt(pages: DiscoveredPage[]): string {
  return pages
    .map((p) => {
      const inputs = p.page.elements.filter((e) => e.tag === "input" || e.tag === "select" || e.tag === "textarea").length;
      const buttons = p.page.elements.filter((e) => e.tag === "button" || e.role === "button").length;
      const labels = p.page.elements
        .map((e) => e.name)
        .filter(Boolean)
        .slice(0, 10)
        .join(", ");
      return `${p.url} — "${p.title}" (${inputs} input(s), ${buttons} button(s)): ${labels}`;
    })
    .join("\n");
}

export async function discoverWorkflows(pages: DiscoveredPage[], instructions?: string | null): Promise<DiscoveredWorkflow[]> {
  if (pages.length === 0) return [];

  const prompt = `Discovered pages:
${summarizePagesForPrompt(pages)}

${instructions ? `Tester-provided context/instructions: ${instructions}\n` : ""}Identify the most meaningful, testable user workflows across these pages.`;

  const result = await callGeminiJson<{ workflows: DiscoveredWorkflow[] }>({
    systemPrompt: SYSTEM_PROMPT,
    prompt,
    schema: WORKFLOW_SCHEMA,
  });
  return result.workflows;
}
