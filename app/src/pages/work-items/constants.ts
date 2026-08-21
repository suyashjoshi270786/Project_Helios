export {
  INPUT_CLASS,
  TEXTAREA_CLASS,
  SELECT_CLASS,
  LABEL_CLASS,
  CARD_CLASS,
  newId,
  openDatePicker,
} from "../../lib/formStyles";

import type { WorkItemType } from "./types";

export const WORK_ITEM_TYPE_OPTIONS: { value: WorkItemType; label: string }[] = [
  { value: "Initiative", label: "Initiative" },
  { value: "Epic", label: "Epic" },
  { value: "Feature", label: "Feature" },
  { value: "Story", label: "Story" },
  { value: "Task", label: "Task" },
  { value: "SubTask", label: "Sub-Task" },
];

export const WORK_ITEM_TYPE_LABELS: Record<WorkItemType, string> = {
  Initiative: "Initiative",
  Epic: "Epic",
  Feature: "Feature",
  Story: "Story",
  Task: "Task",
  SubTask: "Sub-Task",
  Defect: "Defect",
};

export const WORK_ITEM_TYPE_BADGE_CLASS: Record<WorkItemType, string> = {
  Initiative: "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400",
  Epic: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400",
  Feature: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400",
  Story: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  Task: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  SubTask: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  Defect: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
};

export const WORK_ITEM_STATUS_OPTIONS = [
  "Backlog",
  "To Do",
  "In Progress",
  "Code Review",
  "Ready for QA",
  "In QA",
  "Done",
];

export const WORK_ITEM_PRIORITY_OPTIONS = ["Highest", "High", "Medium", "Low", "Lowest"];

// Which types a given type may sensibly be created under — a soft UX guide only,
// the backend stays flexible per the spec's "no hardcoded single hierarchy" rule.
export const ALLOWED_PARENT_TYPES: Record<WorkItemType, WorkItemType[]> = {
  Initiative: [],
  Epic: ["Initiative"],
  Feature: ["Epic"],
  Story: ["Epic", "Feature"],
  Task: ["Epic", "Feature", "Story"],
  SubTask: ["Story", "Task"],
  Defect: ["Epic", "Feature", "Story", "Task"],
};

export const CHILD_TYPE_OPTIONS: Record<WorkItemType, WorkItemType[]> = {
  Initiative: ["Epic"],
  Epic: ["Feature", "Story", "Task"],
  Feature: ["Story", "Task"],
  Story: ["SubTask", "Task"],
  Task: ["SubTask"],
  SubTask: [],
  Defect: [],
};
