export {
  INPUT_CLASS,
  SELECT_CLASS,
  LABEL_CLASS,
  CARD_CLASS,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
} from "../../lib/formStyles";

import type { ModuleKey, TeamRole } from "./types";

export const MODULE_OPTIONS: { value: ModuleKey; label: string }[] = [
  { value: "requirements", label: "Requirements" },
  { value: "work-items", label: "Work Items (Board, Backlog, Sprints)" },
  { value: "test-planning", label: "Test Planning" },
  { value: "test-cases", label: "Test Cases" },
  { value: "test-cycles", label: "Test Cycles" },
  { value: "autonomous-testing", label: "Autonomous Testing" },
  { value: "api-studio", label: "API Studio" },
];

export const ROLE_BADGE_CLASS: Record<TeamRole, string> = {
  Owner: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  Admin: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400",
  Member: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};
