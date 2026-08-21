export {
  INPUT_CLASS,
  TEXTAREA_CLASS,
  SELECT_CLASS,
  LABEL_CLASS,
  CARD_CLASS,
  openDatePicker,
} from "../../lib/formStyles";
export { TEST_CASE_ENVIRONMENT_OPTIONS, TEST_CASE_PHASE_OPTIONS } from "../test-cases/constants";

import type { TestCycleStatus, ExecutionStatus } from "./types";

export const TEST_CYCLE_STATUS_OPTIONS: { value: TestCycleStatus; label: string }[] = [
  { value: "NotStarted", label: "Not Started" },
  { value: "InProgress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
];

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  NotExecuted: "Not Executed",
  Pass: "Passed",
  Fail: "Failed",
  Blocked: "Blocked",
};

export const EXECUTION_STATUS_BADGE_CLASS: Record<ExecutionStatus, string> = {
  NotExecuted: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400",
  Pass: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  Fail: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
  Blocked: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
};

export const EXECUTION_STATUS_ORDER: ExecutionStatus[] = ["Pass", "Fail", "Blocked", "NotExecuted"];

export const EXECUTION_STATUS_BUTTON_CLASS: Record<ExecutionStatus, string> = {
  NotExecuted:
    "border-yellow-300 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30",
  Pass: "border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
  Fail: "border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30",
  Blocked: "border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30",
};
