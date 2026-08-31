// Shared types for the Autonomous Testing pipeline. Kept in one file per the
// module's isolation goal — nothing here is imported by any non-autonomous
// code, and this file imports nothing from outside server/src/autonomous.

// Received once by the route handler and passed by reference down into the
// orchestrator/browser controller. Never persisted, never logged, never
// included in any object that gets written to the DB or sent to Gemini.
export type Credentials = {
  username: string;
  password: string;
};

export type RunConfig = {
  runId: string;
  projectId: string;
  createdById: string;
  targetUrl: string;
  appName?: string | null;
  environment?: string | null;
  instructions?: string | null;
  maxDepth: number;
  maxTests: number;
};

// The controlled action set Gemini is allowed to choose from during
// exploration. Helios executes the chosen action via BrowserController and
// reports the result back — Gemini never touches the browser directly.
export const ALLOWED_ACTIONS = [
  "navigate",
  "click",
  "type",
  "select",
  "hover",
  "scroll",
  "wait",
  "inspect_dom",
  "inspect_accessibility_tree",
  "find_element",
  "screenshot",
  "capture_console",
  "capture_network",
  "get_current_url",
  "go_back",
  "finish",
] as const;

export type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

export type AgentAction = {
  action: AllowedAction;
  // Free-form params interpreted per-action (e.g. { selectorHint, value }
  // for "type", { url } for "navigate"). Kept loose because the shape is
  // validated against a per-action JSON schema at the Gemini call site, not
  // re-validated here.
  params: Record<string, string | undefined>;
  reasoning: string;
};

export type ElementSummary = {
  selectorHint: string;
  role: string;
  name: string;
  tag: string;
  type?: string;
  required?: boolean;
};

// A compact, size-budgeted view of a page — this, never the raw DOM, is what
// ever reaches Gemini.
export type PageSummary = {
  url: string;
  title: string;
  headingText: string;
  elements: ElementSummary[];
};

export type ActionResult = {
  action: AllowedAction;
  ok: boolean;
  message: string;
  page?: PageSummary;
};

export type DiscoveredPage = {
  url: string;
  title: string;
  page: PageSummary;
  depth: number;
};

export type DiscoveredWorkflow = {
  name: string;
  startUrl: string;
  steps: string[];
  expectedOutcome: string;
  confidence: number;
};

export type GeneratedScenario = {
  id: string;
  feature: string;
  name: string;
  objective: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  type: "Functional" | "Positive" | "Negative" | "Validation" | "Navigation" | "Smoke";
  confidence: number;
  workflowName: string;
};

export type EvidenceBundle = {
  error?: string;
  screenshotPath?: string;
  consoleErrors: string[];
  networkErrors: string[];
  url: string;
  expectedResult: string;
  actualResult: string;
};

export type FailureCategory =
  | "ApplicationDefect"
  | "AutomationDefect"
  | "LocatorIssue"
  | "Timing"
  | "Environment"
  | "AuthSession"
  | "Network"
  | "Unknown";

export type FailureClassification = {
  category: FailureCategory;
  confidence: number;
  rootCause: string;
  recommendedAction: string;
};
