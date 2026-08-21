import { ApiError, GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function describeContext(context: Record<string, unknown>): string {
  const lines = Object.entries(context)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  return lines.length > 0 ? lines.join("\n") : "No additional context was provided.";
}

export async function generateWithGemini(systemPrompt: string, prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini isn't configured — set GEMINI_API_KEY in server/.env.");
  }

  const ai = new GoogleGenAI({ apiKey });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
        contents: [{ text: prompt }],
        config: { systemInstruction: systemPrompt },
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

export async function generateWithAnthropic(systemPrompt: string, prompt: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic isn't configured — set ANTHROPIC_API_KEY in server/.env.");
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Suggestion (Anthropic) returned no text content");
  }
  return textBlock.text.trim();
}

export type SuggestProvider = "gemini" | "anthropic" | "openai";
type Generator = (systemPrompt: string, prompt: string) => Promise<string>;

export const GENERATE_TEXT_PROVIDERS: Record<SuggestProvider, Generator | null> = {
  gemini: generateWithGemini,
  anthropic: generateWithAnthropic,
  openai: null,
};
