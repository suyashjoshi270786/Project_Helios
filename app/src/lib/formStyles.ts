import type { SyntheticEvent } from "react";

export const INPUT_CLASS =
  "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 transition-all";

export const TEXTAREA_CLASS = `${INPUT_CLASS} resize-y`;

export const SELECT_CLASS = INPUT_CLASS;

export const LABEL_CLASS = "text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block";

export const CARD_CLASS =
  "bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm shadow-slate-200/60 dark:shadow-none";

export const BUTTON_PRIMARY_CLASS =
  "inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2 shadow-sm shadow-indigo-600/20";

export const BUTTON_SECONDARY_CLASS =
  "inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-medium rounded-lg px-3.5 py-2 transition-colors";

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function openDatePicker(e: SyntheticEvent<HTMLInputElement>) {
  (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
}
