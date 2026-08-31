import { callGeminiJson } from "./geminiClient.js";
import type { GeneratedScenario } from "../types.js";

const DEDUP_SCHEMA = {
  type: "object",
  properties: {
    duplicateScenarioIds: { type: "array", items: { type: "string" } },
  },
  required: ["duplicateScenarioIds"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You compare newly proposed test scenarios against a project's already-existing test cases.
Identify which of the new scenarios test the SAME underlying functionality/workflow as one that already exists — these would be redundant to generate again, even if worded differently (e.g. "Create New Item" and "Successfully Create a New Item" are the same functionality).
Do NOT flag a new scenario as a duplicate just because it relates to a similar area — a different path through the same feature (e.g. a negative/validation case vs the positive case, or testing a different field) is NOT a duplicate.
Return the "id" of every new scenario that duplicates an existing test case. Return an empty array if none do.`;

// A single batched Gemini call (not one per scenario, per the cost-efficiency
// guidance) that catches near-duplicates a plain string comparison misses —
// LLM-generated scenario names vary in phrasing run to run for the exact
// same underlying page/workflow, so exact-match dedup alone reliably fails
// to catch them (verified empirically: two runs against the same app
// produced "Create New Item" and "Create New Item Successfully" for the
// identical workflow).
export async function findDuplicateScenarioIds(
  scenarios: GeneratedScenario[],
  existingTestCases: { name: string; objective: string | null }[],
  onLog: (line: string) => void,
): Promise<Set<string>> {
  if (scenarios.length === 0 || existingTestCases.length === 0) return new Set();

  const prompt = `Existing test cases in this project:
${existingTestCases.map((tc) => `- ${tc.name}${tc.objective ? `: ${tc.objective}` : ""}`).join("\n")}

Newly proposed scenarios:
${scenarios.map((s) => `- id=${s.id} "${s.name}": ${s.objective}`).join("\n")}`;

  try {
    const result = await callGeminiJson<{ duplicateScenarioIds: string[] }>({
      systemPrompt: SYSTEM_PROMPT,
      prompt,
      schema: DEDUP_SCHEMA,
    });
    return new Set(result.duplicateScenarioIds);
  } catch (err) {
    onLog(`Duplicate-scenario check skipped: ${(err as Error).message}`);
    return new Set();
  }
}
