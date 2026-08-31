import { callGeminiJson } from "./geminiClient.js";
import type { DiscoveredWorkflow, GeneratedScenario } from "../types.js";

const SCENARIO_SCHEMA = {
  type: "object",
  properties: {
    scenarios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          feature: { type: "string" },
          name: { type: "string" },
          objective: { type: "string" },
          preconditions: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          expectedResult: { type: "string" },
          priority: { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
          type: {
            type: "string",
            enum: ["Functional", "Positive", "Negative", "Validation", "Navigation", "Smoke"],
          },
          confidence: { type: "number" },
          workflowName: { type: "string" },
        },
        required: [
          "feature",
          "name",
          "objective",
          "preconditions",
          "steps",
          "expectedResult",
          "priority",
          "type",
          "confidence",
          "workflowName",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["scenarios"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are the Test Scenario generator for HeliosQE's Autonomous Testing agent.
Given a list of discovered application workflows, produce high-value, executable test scenarios — not hundreds of meaningless permutations. Favor one strong scenario per workflow, plus an obvious negative/validation counterpart only when the workflow clearly implies one (e.g. a login form implies an invalid-credentials case).
Each scenario's "steps" must be concrete UI actions grounded in the workflow's own steps — do not invent business rules the workflow doesn't state. "workflowName" must exactly match one of the given workflow names.`;

export async function generateScenarios(
  workflows: DiscoveredWorkflow[],
  maxScenarios: number,
  instructions?: string | null,
): Promise<GeneratedScenario[]> {
  if (workflows.length === 0) return [];

  const prompt = `Discovered workflows:
${JSON.stringify(workflows)}

Generate at most ${maxScenarios} test scenarios total.
${instructions ? `Tester-provided context/instructions: ${instructions}` : ""}`;

  const result = await callGeminiJson<{ scenarios: Omit<GeneratedScenario, "id">[] }>({
    systemPrompt: SYSTEM_PROMPT,
    prompt,
    schema: SCENARIO_SCHEMA,
  });

  return result.scenarios.slice(0, maxScenarios).map((s, i) => ({ ...s, id: `SCN-${String(i + 1).padStart(3, "0")}` }));
}
