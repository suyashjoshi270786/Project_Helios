import Anthropic from "@anthropic-ai/sdk";
import {
  WORK_ITEM_ANALYSIS_SCHEMA,
  WORK_ITEM_SYSTEM_PROMPT,
  buildWorkItemAnalysisPrompt,
  type WorkItemAnalyzedRequirement,
  type WorkItemAnalyzerInput,
} from "./schema.js";

const MODEL = "claude-sonnet-5";

export async function analyzeWorkItemWithAnthropic(input: WorkItemAnalyzerInput): Promise<WorkItemAnalyzedRequirement[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic isn't configured — set ANTHROPIC_API_KEY in server/.env.");
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    // Raised from the document analyzer's 4096 — a large Work Item
    // hierarchy can legitimately want many candidate requirements in one
    // response, each with its own acceptance-criteria/flows/risks arrays.
    max_tokens: 16000,
    system: WORK_ITEM_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildWorkItemAnalysisPrompt(input) }],
    output_config: {
      format: { type: "json_schema", schema: WORK_ITEM_ANALYSIS_SCHEMA },
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Work Item Requirement Analyzer (Anthropic) returned no text content");
  }

  const parsed = JSON.parse(textBlock.text) as { requirements: WorkItemAnalyzedRequirement[] };
  return parsed.requirements;
}
