import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { ANALYSIS_SCHEMA, SYSTEM_PROMPT, type AnalyzedRequirement, type AnalyzerInput } from "./schema.js";

// Google's free tier occasionally returns 503 (model overloaded) or 429 (rate limited)
// for a moment under load. Both are transient — retry a couple of times before giving up.
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function analyzeWithGemini(input: AnalyzerInput): Promise<AnalyzedRequirement[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini isn't configured — set GEMINI_API_KEY in server/.env.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const parts: Part[] = [
    { text: input.text?.trim() || "Extract requirements from the attached document." },
  ];
  if (input.file) {
    parts.push({ inlineData: { data: input.file.data, mimeType: input.file.mimeType } });
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
        contents: parts,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: ANALYSIS_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Requirement Analyzer (Gemini) returned no content");
      }

      const parsed = JSON.parse(text) as { requirements: AnalyzedRequirement[] };
      return parsed.requirements;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
      if (!isRetryable || attempt === MAX_ATTEMPTS) break;
      await sleep(attempt * 1000);
    }
  }

  throw lastError;
}
