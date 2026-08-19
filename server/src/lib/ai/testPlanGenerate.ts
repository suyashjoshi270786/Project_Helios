import { ApiError, GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

export type GeneratedSections = {
  documentControl: string;
  overview: string;
  scope: string;
  testStrategy: string;
  testEnvironment: string;
  testDataStrategy: string;
  entryExitCriteria: string;
  deliverables: string;
  resourcesResponsibilities: string;
  schedule: string;
  dependencies: string;
  risksMitigations: string;
  defectManagement: string;
  executionApproach: string;
};

export type GeneratedContent = {
  sections: GeneratedSections;
  assumptionsAndClarifications: string[];
};

export type GenerateInput = { context: Record<string, unknown> };

const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SECTION_KEYS: (keyof GeneratedSections)[] = [
  "documentControl",
  "overview",
  "scope",
  "testStrategy",
  "testEnvironment",
  "testDataStrategy",
  "entryExitCriteria",
  "deliverables",
  "resourcesResponsibilities",
  "schedule",
  "dependencies",
  "risksMitigations",
  "defectManagement",
  "executionApproach",
];

export const GENERATE_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "object",
      properties: Object.fromEntries(SECTION_KEYS.map((key) => [key, { type: "string" }])),
      required: SECTION_KEYS,
      additionalProperties: false,
    },
    assumptionsAndClarifications: { type: "array", items: { type: "string" } },
  },
  required: ["sections", "assumptionsAndClarifications"],
  additionalProperties: false,
} as const;

export const GENERATE_SYSTEM_PROMPT = `You are the Test Plan Generator for HeliosQE, a quality engineering platform.
You are given the full set of structured inputs a QA lead has already entered for a Test Plan: its details, selected test types, scope, test strategy notes, test data strategy, environment configuration, entry/exit criteria, risks, dependencies, resources, schedule, and the approved requirements it covers.

Write professional, concise prose for each document section, strictly grounded in the structured input provided. Every section should read like part of a real test plan document — clear and specific, not generic filler.

Rules:
- Do not invent business requirements, application behavior, or acceptance criteria that were not implied by the input.
- Do not invent specific dates, names, or numbers that were not given.
- If a section's input is thin or missing, write a brief, honest paragraph noting what has been defined so far, and add an entry to "assumptionsAndClarifications" naming exactly what's missing (e.g. "Performance acceptance criteria were not provided.").
- The requirements coverage table and revision history are assembled separately by the system — do not attempt to author them.
- Respond with the exact JSON shape requested. No markdown, no code fences.`;

function buildUserPrompt(context: Record<string, unknown>): string {
  const lines = Object.entries(context)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  return `Structured Test Plan input:\n${lines.join("\n")}`;
}

export async function generateWithGemini(input: GenerateInput): Promise<GeneratedContent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini isn't configured — set GEMINI_API_KEY in server/.env.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildUserPrompt(input.context);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
        contents: [{ text: prompt }],
        config: {
          systemInstruction: GENERATE_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: GENERATE_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Test Plan Generator (Gemini) returned no content");
      return JSON.parse(text) as GeneratedContent;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
      if (!isRetryable || attempt === MAX_ATTEMPTS) break;
      await sleep(attempt * 1000);
    }
  }

  throw lastError;
}

export async function generateWithAnthropic(input: GenerateInput): Promise<GeneratedContent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic isn't configured — set ANTHROPIC_API_KEY in server/.env.");
  }

  const client = new Anthropic();
  const prompt = buildUserPrompt(input.context);
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: GENERATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: { type: "json_schema", schema: GENERATE_SCHEMA },
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Test Plan Generator (Anthropic) returned no text content");
  }
  return JSON.parse(textBlock.text) as GeneratedContent;
}

export type GenerateProvider = "gemini" | "anthropic" | "openai";
type Generator = (input: GenerateInput) => Promise<GeneratedContent>;

export const GENERATE_PROVIDERS: Record<GenerateProvider, Generator | null> = {
  gemini: generateWithGemini,
  anthropic: generateWithAnthropic,
  openai: null,
};
