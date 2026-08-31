import { callGeminiJson } from "./geminiClient.js";
import { maskSecretsDeep } from "../credentialMask.js";
import type { EvidenceBundle, FailureClassification } from "../types.js";

const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: ["ApplicationDefect", "AutomationDefect", "LocatorIssue", "Timing", "Environment", "AuthSession", "Network", "Unknown"],
    },
    confidence: { type: "number" },
    rootCause: { type: "string" },
    recommendedAction: { type: "string" },
  },
  required: ["category", "confidence", "rootCause", "recommendedAction"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You classify a failed automated test step for HeliosQE's Autonomous Testing agent.
Do NOT assume every failure is an application defect. Use the evidence given (error, expected vs actual result, console/network errors, URL) to pick the single most likely category:
- ApplicationDefect: the application itself behaved incorrectly.
- AutomationDefect: the generated test step itself is wrong (bad step logic, wrong expectation).
- LocatorIssue: the step likely targeted an element that no longer matches (state this as a possibility, never claim certainty a locator "changed").
- Timing: a race condition / synchronization issue (element not ready yet, animation, async load).
- Environment: infrastructure/environment problem unrelated to the app's own logic (deploy issue, seed data missing).
- AuthSession: the session/authentication was lost or invalid mid-test.
- Network: a network/API request failed independent of the UI action.
- Unknown: evidence is insufficient to say.
Give a confidence 0-1 and a concise, evidence-grounded root cause and recommended action. Never assert a fix was applied — only recommend.`;

export async function classifyFailure(evidence: EvidenceBundle, secrets: string[]): Promise<FailureClassification> {
  const masked = maskSecretsDeep(evidence, secrets);
  const prompt = `Evidence:
${JSON.stringify(masked)}`;

  return callGeminiJson<FailureClassification>({ systemPrompt: SYSTEM_PROMPT, prompt, schema: CLASSIFICATION_SCHEMA });
}
