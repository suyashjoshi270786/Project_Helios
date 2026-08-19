export { INPUT_CLASS, TEXTAREA_CLASS, SELECT_CLASS, LABEL_CLASS, CARD_CLASS, newId } from "../../lib/formStyles";

export const TEST_CASE_ENVIRONMENT_OPTIONS = ["DEV", "QA", "ST", "SIT", "UAT", "PROD"];

export const TEST_CASE_PHASE_OPTIONS = ["ST", "SIT", "UAT", "Regression", "Production"];

export const TEST_CASE_TYPE_OPTIONS: { value: "Manual" | "Automated"; label: string }[] = [
  { value: "Manual", label: "Manual" },
  { value: "Automated", label: "Automated" },
];
