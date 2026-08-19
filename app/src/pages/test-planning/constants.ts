import type { Criterion, TestPlanDraft } from "./types";

export { INPUT_CLASS, TEXTAREA_CLASS, SELECT_CLASS, LABEL_CLASS, CARD_CLASS, newId, openDatePicker } from "../../lib/formStyles";

export const TEST_PHASE_OPTIONS = [
  "System Testing",
  "System Integration Testing (SIT)",
  "User Acceptance Testing (UAT)",
  "Regression Testing",
  "Smoke Testing",
  "Sanity Testing",
  "Release Validation",
  "Production Validation",
  "Performance Testing",
  "Security Testing",
  "Accessibility Testing",
  "Custom",
];

export const TEST_TYPE_OPTIONS = [
  "Functional Testing",
  "Integration Testing",
  "API Testing",
  "UI Testing",
  "Regression Testing",
  "Database Testing",
  "Performance Testing",
  "Security Testing",
  "Accessibility Testing",
  "Compatibility Testing",
  "Usability Testing",
  "Smoke Testing",
  "Sanity Testing",
  "Exploratory Testing",
  "Other",
];

export const ENVIRONMENT_OPTIONS = ["DEV", "QA", "SIT", "UAT", "STAGING", "PROD"];

export const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "Critical", label: "Critical" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

export const TEST_PHASE_RECOMMENDATIONS: Record<string, string[]> = {
  "System Integration Testing (SIT)": ["Integration Testing", "API Testing", "Database Testing"],
  "User Acceptance Testing (UAT)": ["Functional Testing", "Usability Testing"],
  "Regression Testing": ["Regression Testing", "Functional Testing"],
  "Performance Testing": ["Performance Testing"],
  "Security Testing": ["Security Testing"],
  "Smoke Testing": ["Smoke Testing", "Functional Testing"],
};

export const DEFAULT_ENTRY_CRITERIA: Criterion[] = [
  { id: "req-approved", label: "Requirements approved", checked: false },
  { id: "build-deployed", label: "Build deployed", checked: false },
  { id: "env-available", label: "Environment available", checked: false },
  { id: "data-available", label: "Test data available", checked: false },
  { id: "deps-available", label: "Dependencies available", checked: false },
  { id: "critical-defects-resolved", label: "Critical defects from previous cycle resolved", checked: false },
  { id: "cases-reviewed", label: "Test cases reviewed", checked: false },
];

export const DEFAULT_EXIT_CRITERIA: Criterion[] = [
  { id: "critical-executed", label: "100% critical test cases executed", checked: false },
  { id: "pass-rate", label: "≥95% overall pass rate", checked: false },
  { id: "no-critical-defects", label: "No open Critical defects", checked: false },
  { id: "no-blocker-defects", label: "No blocker defects", checked: false },
  { id: "failed-reviewed", label: "All failed tests reviewed", checked: false },
  { id: "report-generated", label: "Test report generated", checked: false },
];

export const TEST_STRATEGY_SECTIONS: Record<string, string> = {
  "Functional Testing": "Functional Testing Strategy",
  "Integration Testing": "Integration Testing Strategy",
  "API Testing": "API Testing Strategy",
  "UI Testing": "UI Testing Strategy",
  "Regression Testing": "Regression Strategy",
  "Database Testing": "Database Validation Strategy",
  "Performance Testing": "Performance Strategy",
  "Security Testing": "Security Strategy",
};

export function getValidationIssues(draft: TestPlanDraft): string[] {
  const issues: string[] = [];
  if (!draft.name?.trim()) issues.push("Test Plan Name is required.");
  if (!draft.releaseVersion?.trim()) issues.push("Release / Version is required.");
  if (!draft.testPhase?.trim()) issues.push("Test Phase is required.");
  if (!draft.environment?.trim()) issues.push("Environment is required.");
  if (!draft.priority) issues.push("Priority is required.");
  if (!draft.owner?.trim()) issues.push("Owner is required.");
  if (!draft.objective?.trim()) issues.push("Objective is required.");
  if (!draft.selectedRequirementIds || draft.selectedRequirementIds.length === 0) {
    issues.push("At least one approved requirement must be selected.");
  }
  if (!draft.testTypes || draft.testTypes.length === 0) {
    issues.push("At least one test type must be selected.");
  }
  return issues;
}
