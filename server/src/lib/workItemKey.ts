import { prisma } from "./prisma.js";

export const WORK_ITEM_TYPES = ["Initiative", "Epic", "Feature", "Story", "Task", "SubTask", "Defect"] as const;

export const KEY_PREFIX: Record<(typeof WORK_ITEM_TYPES)[number], string> = {
  Initiative: "INIT",
  Epic: "EPIC",
  Feature: "FEATURE",
  Story: "STORY",
  Task: "TASK",
  SubTask: "SUBTASK",
  Defect: "BUG",
};

export async function generateWorkItemKey(projectId: string, type: (typeof WORK_ITEM_TYPES)[number]) {
  const count = await prisma.workItem.count({ where: { projectId, type } });
  return `${KEY_PREFIX[type]}-${String(count + 1).padStart(3, "0")}`;
}
