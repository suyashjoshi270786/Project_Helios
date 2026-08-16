import type { AnalyzedRequirement, AnalyzerInput } from "./schema.js";
import { analyzeWithGemini } from "./gemini.js";
import { analyzeWithAnthropic } from "./anthropic.js";

export type AiProvider = "gemini" | "anthropic" | "openai";
export type { AnalyzerInput } from "./schema.js";

type Analyzer = (input: AnalyzerInput) => Promise<AnalyzedRequirement[]>;

export const PROVIDERS: Record<AiProvider, Analyzer | null> = {
  gemini: analyzeWithGemini,
  anthropic: analyzeWithAnthropic,
  openai: null,
};
