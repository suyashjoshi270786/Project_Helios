import { ApiError, GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

// Converts a Test Case between its two representations — manual steps and a
// Gherkin script — so switching "Test Type" in the editor doesn't discard
// work already done in the other format. Mirrors testCaseGenerate.ts's
// structure exactly (same schema/prompt/provider-map shape) for consistency
// with the rest of this AI layer.

export type StepInput = { description: string; testData?: string; expectedResult: string };

const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STEP_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    testData: { type: "string" },
    expectedResult: { type: "string" },
  },
  required: ["description", "expectedResult"],
  additionalProperties: false,
} as const;

// --- Steps -> Gherkin -----------------------------------------------------

export type StepsToGherkinInput = { name: string; objective?: string; steps: StepInput[] };
export type StepsToGherkinResult = { gherkinScript: string };

export const STEPS_TO_GHERKIN_SCHEMA = {
  type: "object",
  properties: { gherkinScript: { type: "string" } },
  required: ["gherkinScript"],
  additionalProperties: false,
} as const;

export const STEPS_TO_GHERKIN_SYSTEM_PROMPT = `You convert a manual, step-by-step Test Case into a single Cucumber-style Gherkin script for HeliosQE, a quality engineering platform.
You are given the test case's name, objective, and its ordered manual steps (each with a description, optional test data, and expected result).

Rules:
- Produce one "Feature:" block with one "Scenario:" using Given/When/Then/And exactly reflecting the given steps in order — do not add, remove, reorder, or invent steps or outcomes the input doesn't state.
- The last step's expected result becomes the "Then" (plus any earlier expected results that represent a distinct outcome, as "And" lines).
- Setup-like steps (navigating, preconditions) become "Given"; the first real action becomes "When"; subsequent actions become "And" under When.
- Keep wording close to the original step text — rephrase only for grammatical fit into Given/When/Then, never to add detail that wasn't there.
- Respond with the exact JSON shape requested: a single "gherkinScript" string (plain text, no markdown code fences).`;

function buildStepsToGherkinPrompt(input: StepsToGherkinInput): string {
  const lines = [
    `Test case name: ${input.name}`,
    input.objective ? `Objective: ${input.objective}` : null,
    `Steps:\n${input.steps.map((s, i) => `${i + 1}. ${s.description}${s.testData ? ` (test data: ${s.testData})` : ""} -> Expected: ${s.expectedResult}`).join("\n")}`,
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n\n");
}

export async function convertStepsToGherkinWithGemini(input: StepsToGherkinInput): Promise<StepsToGherkinResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini isn't configured — set GEMINI_API_KEY in server/.env.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildStepsToGherkinPrompt(input);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
        contents: [{ text: prompt }],
        config: {
          systemInstruction: STEPS_TO_GHERKIN_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: STEPS_TO_GHERKIN_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Test Case Converter (Gemini) returned no content");
      return JSON.parse(text) as StepsToGherkinResult;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
      if (!isRetryable || attempt === MAX_ATTEMPTS) break;
      await sleep(attempt * 1000);
    }
  }

  throw lastError;
}

export async function convertStepsToGherkinWithAnthropic(input: StepsToGherkinInput): Promise<StepsToGherkinResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic isn't configured — set ANTHROPIC_API_KEY in server/.env.");
  }

  const client = new Anthropic();
  const prompt = buildStepsToGherkinPrompt(input);
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    system: STEPS_TO_GHERKIN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema: STEPS_TO_GHERKIN_SCHEMA } },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Test Case Converter (Anthropic) returned no text content");
  }
  return JSON.parse(textBlock.text) as StepsToGherkinResult;
}

export type TestCaseConvertProvider = "gemini" | "anthropic" | "openai";
type StepsToGherkinGenerator = (input: StepsToGherkinInput) => Promise<StepsToGherkinResult>;

export const STEPS_TO_GHERKIN_PROVIDERS: Record<TestCaseConvertProvider, StepsToGherkinGenerator | null> = {
  gemini: convertStepsToGherkinWithGemini,
  anthropic: convertStepsToGherkinWithAnthropic,
  openai: null,
};

// --- Gherkin -> Steps -----------------------------------------------------

export type GherkinToStepsInput = { name: string; objective?: string; gherkinScript: string };
export type GherkinToStepsResult = { steps: StepInput[] };

export const GHERKIN_TO_STEPS_SCHEMA = {
  type: "object",
  properties: { steps: { type: "array", items: STEP_SCHEMA } },
  required: ["steps"],
  additionalProperties: false,
} as const;

export const GHERKIN_TO_STEPS_SYSTEM_PROMPT = `You convert a Cucumber-style Gherkin script into an ordered list of manual, step-by-step Test Case steps for HeliosQE, a quality engineering platform.
You are given the test case's name, objective, and its Gherkin script (Feature/Scenario/Given/When/And/Then).

A manual step is an ACTION paired with its OWN EXPECTED RESULT — not one line of Gherkin. Merge each Given/When/And action with the verification line that directly follows and confirms it (a Then/And right after it) into a SINGLE step: the action becomes the step's description, that verification becomes its expectedResult. Do not emit the action and its own confirming outcome as two separate steps.

Rules:
- Walk the scenario in order. Whenever an action line (Given/When/And performing something) is immediately followed by a verification line (Then/And confirming an outcome of THAT action), combine them into one step.
- An action with no immediate confirming line of its own gets a neutral expectedResult such as "Step completes without error." — do not invent an outcome for it.
- A trailing Then/And that isn't paired with a preceding action of its own (e.g. an overall final assertion after several actions) becomes its own step whose description restates what is being checked and whose expectedResult is that same outcome.
- Do not add, remove, reorder, or invent steps or outcomes the Gherkin doesn't state — rephrase only for a clear imperative instruction, never to add detail that wasn't there.
- Include testData only when the Gherkin line itself names a concrete value (e.g. a quoted string or table value) — leave it empty otherwise.
- The resulting step count should be close to the number of distinct actions in the scenario, not the number of Gherkin lines.
- Respond with the exact JSON shape requested: a "steps" array, each with description, optional testData, and expectedResult.`;

function buildGherkinToStepsPrompt(input: GherkinToStepsInput): string {
  const lines = [
    `Test case name: ${input.name}`,
    input.objective ? `Objective: ${input.objective}` : null,
    `Gherkin script:\n${input.gherkinScript}`,
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n\n");
}

export async function convertGherkinToStepsWithGemini(input: GherkinToStepsInput): Promise<GherkinToStepsResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini isn't configured — set GEMINI_API_KEY in server/.env.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildGherkinToStepsPrompt(input);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
        contents: [{ text: prompt }],
        config: {
          systemInstruction: GHERKIN_TO_STEPS_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: GHERKIN_TO_STEPS_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Test Case Converter (Gemini) returned no content");
      return JSON.parse(text) as GherkinToStepsResult;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
      if (!isRetryable || attempt === MAX_ATTEMPTS) break;
      await sleep(attempt * 1000);
    }
  }

  throw lastError;
}

export async function convertGherkinToStepsWithAnthropic(input: GherkinToStepsInput): Promise<GherkinToStepsResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic isn't configured — set ANTHROPIC_API_KEY in server/.env.");
  }

  const client = new Anthropic();
  const prompt = buildGherkinToStepsPrompt(input);
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    system: GHERKIN_TO_STEPS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema: GHERKIN_TO_STEPS_SCHEMA } },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Test Case Converter (Anthropic) returned no text content");
  }
  return JSON.parse(textBlock.text) as GherkinToStepsResult;
}

type GherkinToStepsGenerator = (input: GherkinToStepsInput) => Promise<GherkinToStepsResult>;

export const GHERKIN_TO_STEPS_PROVIDERS: Record<TestCaseConvertProvider, GherkinToStepsGenerator | null> = {
  gemini: convertGherkinToStepsWithGemini,
  anthropic: convertGherkinToStepsWithAnthropic,
  openai: null,
};
