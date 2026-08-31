import { ApiError, GoogleGenAI } from "@google/genai";

// Mirrors the retry/error-handling pattern already used in
// server/src/lib/ai/gemini.ts and suggest.ts. Kept as its own copy here
// (nothing under server/src/lib/ai/* is modified by this feature) but
// shared across every autonomous-testing AI call site so the loop isn't
// duplicated five times over.
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 4;
const MAX_BACKOFF_MS = 30000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A 429 on Gemini's free tier (15 requests/minute) is a per-minute quota,
// not a momentary blip — Google's own error tells us exactly how long until
// it resets (`"retryDelay":"19s"` in the error body). A fixed 1-3s backoff
// (fine for a genuinely transient 503) is nowhere near enough for that and
// just burns through MAX_ATTEMPTS while still rate-limited. Honor the hint
// when present; fall back to exponential backoff otherwise.
function retryDelayMs(err: unknown, attempt: number): number {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (match) return Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 1000, MAX_BACKOFF_MS);
  return Math.min(attempt * 2000, MAX_BACKOFF_MS);
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// Every call site passes a JSON schema and gets back parsed, schema-shaped
// JSON — same responseJsonSchema pattern used throughout the existing AI
// layer, never the native function/tool-calling SDK feature.
export async function callGeminiJson<T>(params: {
  systemPrompt: string;
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<T> {
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
        contents: [{ text: params.prompt }],
        config: {
          systemInstruction: params.systemPrompt,
          responseMimeType: "application/json",
          responseJsonSchema: params.schema,
        },
      });
      const text = response.text;
      if (!text) throw new Error("Autonomous Testing AI call returned no content.");
      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
      if (!isRetryable || attempt === MAX_ATTEMPTS) break;
      await sleep(retryDelayMs(err, attempt));
    }
  }
  throw lastError;
}
