import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import {
  WORK_ITEM_ANALYSIS_SCHEMA,
  WORK_ITEM_SYSTEM_PROMPT,
  buildWorkItemAnalysisPrompt,
  type WorkItemAnalyzedRequirement,
  type WorkItemAnalyzerInput,
} from "./schema.js";

// Same transient-error retry as the document analyzer (server/src/lib/ai/gemini.ts).
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function analyzeWorkItemWithGemini(input: WorkItemAnalyzerInput): Promise<WorkItemAnalyzedRequirement[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini isn't configured — set GEMINI_API_KEY in server/.env.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const parts: Part[] = [{ text: buildWorkItemAnalysisPrompt(input) }];

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
        contents: parts,
        config: {
          systemInstruction: WORK_ITEM_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: WORK_ITEM_ANALYSIS_SCHEMA,
          // A large hierarchy can reasonably want many candidate
          // requirements at once — the document analyzer never had to
          // worry about this (one document, one call), but an Epic with
          // 100+ descendants easily could without a deliberate ceiling.
          maxOutputTokens: 16000,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Work Item Requirement Analyzer (Gemini) returned no content");
      }

      const parsed = JSON.parse(text) as { requirements: WorkItemAnalyzedRequirement[] };
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
