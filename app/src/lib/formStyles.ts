import type { SyntheticEvent } from "react";

export const INPUT_CLASS =
  "w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-600 transition-colors";

export const TEXTAREA_CLASS = `${INPUT_CLASS} resize-y`;

export const SELECT_CLASS = INPUT_CLASS;

export const LABEL_CLASS = "text-xs text-slate-500 dark:text-slate-400 mb-1 block";

export const CARD_CLASS = "bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5";

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function openDatePicker(e: SyntheticEvent<HTMLInputElement>) {
  (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
}
