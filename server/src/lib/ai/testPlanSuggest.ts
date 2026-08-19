import { ApiError, GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

export type SuggestField = "objective" | "testStrategy" | "testDataRequirements" | "riskDescription" | "riskMitigation";

const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FIELD_INSTRUCTIONS: Record<SuggestField, string> = {
  objective:
    "Write a concise, professional Test Plan objective (2-3 sentences) describing what this test plan validates.",
  testStrategy:
    "Write a short paragraph (2-4 sentences) describing the test strategy for the given test type within this test plan.",
  testDataRequirements:
    "Write a short paragraph (2-4 sentences) describing the test data requirements for this test plan, including what kinds of data are needed and any sensitive-data handling considerations.",
  riskDescription: "Suggest one realistic, specific risk (1-2 sentences) relevant to this test plan.",
  riskMitigation: "Suggest a concrete mitigation (1-2 sentences) for the given risk.",
};

const SUGGEST_SYSTEM_PROMPT = `You are a test planning writing assistant inside HeliosQE, a quality engineering platform. Given context about a test plan already entered by the user, draft a short, professional piece of text for the requested field. Ground your draft in the provided context — do not invent unrelated requirements, business rules, or details that contradict it. Respond with plain text only: no markdown, no headings, no surrounding quotes, no preamble like "Here is a draft".`;

function describeContext(context: Record<string, unknown>): string {
  const lines = Object.entries(context)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  return lines.length > 0 ? lines.join("\n") : "No additional context was provided.";
}

function buildSuggestPrompt(field: SuggestField, context: Record<string, unknown>): string {
  return `${FIELD_INSTRUCTIONS[field]}\n\nContext:\n${describeContext(context)}\n\nReturn ONLY the drafted text for this field — no preamble, no labels, no markdown, no quotation marks.`;
}

export async function suggestWithGemini(field: SuggestField, context: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini isn't configured — set GEMINI_API_KEY in server/.env.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildSuggestPrompt(field, context);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
        contents: [{ text: prompt }],
        config: { systemInstruction: SUGGEST_SYSTEM_PROMPT },
      });

      const text = response.text?.trim();
      if (!text) throw new Error("Suggestion (Gemini) returned no content");
      return text;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
      if (!isRetryable || attempt === MAX_ATTEMPTS) break;
      await sleep(attempt * 1000);
    }
  }

  throw lastError;
}

export async function suggestWithAnthropic(field: SuggestField, context: Record<string, unknown>): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic isn't configured — set ANTHROPIC_API_KEY in server/.env.");
  }

  const client = new Anthropic();
  const prompt = buildSuggestPrompt(field, context);
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system: SUGGEST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Suggestion (Anthropic) returned no text content");
  }
  return textBlock.text.trim();
}

export type SuggestProvider = "gemini" | "anthropic" | "openai";
type Suggester = (field: SuggestField, context: Record<string, unknown>) => Promise<string>;

export const SUGGEST_PROVIDERS: Record<SuggestProvider, Suggester | null> = {
  gemini: suggestWithGemini,
  anthropic: suggestWithAnthropic,
  openai: null,
};
