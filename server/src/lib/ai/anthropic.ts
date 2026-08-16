import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_SCHEMA, SYSTEM_PROMPT, type AnalyzedRequirement, type AnalyzerInput } from "./schema.js";

const MODEL = "claude-sonnet-5";

export async function analyzeWithAnthropic(input: AnalyzerInput): Promise<AnalyzedRequirement[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic isn't configured — set ANTHROPIC_API_KEY in server/.env.");
  }
  if (input.file) {
    throw new Error("File upload isn't supported for Claude yet — paste the text instead, or switch to Gemini.");
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: input.text ?? "" }],
    output_config: {
      format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Requirement Analyzer (Anthropic) returned no text content");
  }

  const parsed = JSON.parse(textBlock.text) as { requirements: AnalyzedRequirement[] };
  return parsed.requirements;
}
