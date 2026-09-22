import type { WorkItemAnalyzedRequirement, WorkItemAnalyzerInput } from "./schema.js";
import { analyzeWorkItemWithGemini } from "./gemini.js";
import { analyzeWorkItemWithAnthropic } from "./anthropic.js";

export type WorkItemAiProvider = "gemini" | "anthropic" | "openai";
export type { WorkItemAnalyzerInput, WorkItemAnalyzedRequirement } from "./schema.js";

type WorkItemAnalyzer = (input: WorkItemAnalyzerInput) => Promise<WorkItemAnalyzedRequirement[]>;

export const WORK_ITEM_ANALYZE_PROVIDERS: Record<WorkItemAiProvider, WorkItemAnalyzer | null> = {
  gemini: analyzeWorkItemWithGemini,
  anthropic: analyzeWorkItemWithAnthropic,
  openai: null,
};
