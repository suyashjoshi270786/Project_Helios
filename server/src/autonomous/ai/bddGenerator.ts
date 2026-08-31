import { callGeminiJson } from "./geminiClient.js";
import type { GeneratedScenario } from "../types.js";

const BDD_SCHEMA = {
  type: "object",
  properties: { gherkin: { type: "string" } },
  required: ["gherkin"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You write valid Gherkin (Feature/Scenario/Given/When/And/Then) from a structured test scenario.
Represent only what the scenario's own steps and expected result actually state — do not invent application behavior or expected results the scenario doesn't already imply. Output plain Gherkin text only (no markdown fences, no commentary).`;

export async function generateGherkin(scenario: GeneratedScenario): Promise<string> {
  const prompt = `Feature: ${scenario.feature}
Scenario: ${scenario.name}
Objective: ${scenario.objective}
Preconditions: ${scenario.preconditions}
Steps:
${scenario.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
Expected result: ${scenario.expectedResult}`;

  const result = await callGeminiJson<{ gherkin: string }>({ systemPrompt: SYSTEM_PROMPT, prompt, schema: BDD_SCHEMA });
  return result.gherkin.trim();
}
