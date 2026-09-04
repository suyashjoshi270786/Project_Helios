export const MODULE_KEYS = [
  "requirements",
  "work-items",
  "test-planning",
  "test-cases",
  "test-cycles",
  "autonomous-testing",
  "api-studio",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  requirements: "Requirements",
  "work-items": "Work Items (Board, Backlog, Sprints)",
  "test-planning": "Test Planning",
  "test-cases": "Test Cases",
  "test-cycles": "Test Cycles",
  "autonomous-testing": "Autonomous Testing",
  "api-studio": "API Studio",
};

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}
