export {
  INPUT_CLASS,
  TEXTAREA_CLASS,
  SELECT_CLASS,
  LABEL_CLASS,
  CARD_CLASS,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  newId,
} from "../../lib/formStyles";

export const TEST_CASE_ENVIRONMENT_OPTIONS = ["DEV", "QA", "ST", "SIT", "UAT", "PROD"];

export const TEST_CASE_PHASE_OPTIONS = ["ST", "SIT", "UAT", "Regression", "Production"];

export const TEST_CASE_TYPE_OPTIONS: { value: "Manual" | "Automated"; label: string }[] = [
  { value: "Manual", label: "Manual" },
  { value: "Automated", label: "Automated" },
];

export const TEST_CASE_TYPE_BADGE_CLASS: Record<"Manual" | "Automated", string> = {
  Manual: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  Automated: "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400",
};

export const LATEST_STATUS_BADGE_CLASS: Record<"NotExecuted" | "Pass" | "Fail" | "Blocked", string> = {
  NotExecuted: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  Pass: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  Fail: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
  Blocked: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
};

export const LATEST_STATUS_LABELS: Record<"NotExecuted" | "Pass" | "Fail" | "Blocked", string> = {
  NotExecuted: "Not Run",
  Pass: "Passed",
  Fail: "Failed",
  Blocked: "Blocked",
};
