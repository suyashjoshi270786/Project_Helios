import { ApiError, GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

export type ScenarioCategory = "Positive" | "Negative";

export type GeneratedTestCase = {
  name: string;
  objective: string;
  category: ScenarioCategory;
  steps: { description: string; testData?: string; expectedResult: string }[];
};

export type GeneratedTestCases = { testCases: GeneratedTestCase[] };

export type TestCaseGenerateInput = {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  flows: string[];
  risks: string[];
};

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

export const TEST_CASE_GENERATE_SCHEMA = {
  type: "object",
  properties: {
    testCases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          objective: { type: "string" },
          category: { type: "string", enum: ["Positive", "Negative"] },
          steps: { type: "array", items: STEP_SCHEMA },
        },
        required: ["name", "objective", "category", "steps"],
        additionalProperties: false,
      },
    },
  },
  required: ["testCases"],
  additionalProperties: false,
} as const;

export const TEST_CASE_GENERATE_SYSTEM_PROMPT = `You are the Test Case Generator for HeliosQE, a quality engineering platform.
You are given one APPROVED requirement: its title, description, acceptance criteria, key flows, and known risks/ambiguities.

Produce a set of manual, step-by-step Test Cases that give thorough coverage of this requirement, split into two categories:
- "Positive": the happy path plus the meaningful valid combinations of the inputs, options, and flows the requirement actually describes (e.g. different valid credential types, different valid combinations of the described settings/paths). Cover every realistic valid combination implied by the acceptance criteria and flows — do not stop at just one happy-path case if the requirement clearly implies more than one valid path or combination.
- "Negative": invalid input, error handling, boundary conditions, and unhappy paths — especially any implied by the requirement's own risks or acceptance criteria. Include multiple distinct negative scenarios when the requirement supports it (e.g. invalid credentials, empty/missing input, expired/locked state, rate limiting, unauthorized access), not just one.

Rules:
- Every test case must have a "category" of exactly "Positive" or "Negative".
- Do not invent a combination that isn't implied by the given input — "cover every valid combination" means the combinations actually described or implied by the requirement, not an unbounded mathematical enumeration of every field.
- Each test case needs a clear, specific name, a one-sentence objective, and an ordered list of steps.
- Each step needs a concrete, actionable description, optional test data, and a specific, verifiable expected result — never vague results like "it works".
- Ground every test case strictly in the given requirement. Do not invent business rules or UI copy that isn't implied by the input.
- Do not restate the requirement text verbatim as a single test case — decompose it into real, executable test cases across both categories.
- Respond with the exact JSON shape requested. No markdown, no code fences.`;

function buildUserPrompt(input: TestCaseGenerateInput): string {
  const lines = [
    `Title: ${input.title}`,
    `Description: ${input.description}`,
    input.acceptanceCriteria.length > 0 ? `Acceptance Criteria:\n${input.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}` : null,
    input.flows.length > 0 ? `Flows:\n${input.flows.map((f) => `- ${f}`).join("\n")}` : null,
    input.risks.length > 0 ? `Known risks/ambiguities:\n${input.risks.map((r) => `- ${r}`).join("\n")}` : null,
  ].filter((line): line is string => Boolean(line));
  return `Approved requirement:\n${lines.join("\n\n")}`;
}

export async function generateTestCasesWithGemini(input: TestCaseGenerateInput): Promise<GeneratedTestCases> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini isn't configured — set GEMINI_API_KEY in server/.env.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildUserPrompt(input);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
        contents: [{ text: prompt }],
        config: {
          systemInstruction: TEST_CASE_GENERATE_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: TEST_CASE_GENERATE_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Test Case Generator (Gemini) returned no content");
      return JSON.parse(text) as GeneratedTestCases;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
      if (!isRetryable || attempt === MAX_ATTEMPTS) break;
      await sleep(attempt * 1000);
    }
  }

  throw lastError;
}

export async function generateTestCasesWithAnthropic(input: TestCaseGenerateInput): Promise<GeneratedTestCases> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic isn't configured — set ANTHROPIC_API_KEY in server/.env.");
  }

  const client = new Anthropic();
  const prompt = buildUserPrompt(input);
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: TEST_CASE_GENERATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: { type: "json_schema", schema: TEST_CASE_GENERATE_SCHEMA },
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Test Case Generator (Anthropic) returned no text content");
  }
  return JSON.parse(textBlock.text) as GeneratedTestCases;
}

export type TestCaseGenerateProvider = "gemini" | "anthropic" | "openai";
type Generator = (input: TestCaseGenerateInput) => Promise<GeneratedTestCases>;

export const TEST_CASE_GENERATE_PROVIDERS: Record<TestCaseGenerateProvider, Generator | null> = {
  gemini: generateTestCasesWithGemini,
  anthropic: generateTestCasesWithAnthropic,
  openai: null,
};
