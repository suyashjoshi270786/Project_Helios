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

// Numbers by the highest number already in use for this type, not by a
// count of existing rows — a plain count drifts below reality the moment
// any item of that type is deleted or re-typed away (its number is now
// "free" but never reused, yet count no longer matches the highest number
// actually on a row), which produced real (projectId, key) collisions on
// re-key. Still wrapped in a create/update retry at the call sites below
// as a second layer, since two concurrent requests can both read the same
// max before either writes.
export async function generateWorkItemKey(projectId: string, type: (typeof WORK_ITEM_TYPES)[number]) {
  const prefix = KEY_PREFIX[type];
  const existing = await prisma.workItem.findMany({
    where: { projectId, type },
    select: { key: true },
  });
  let maxNumber = 0;
  for (const { key } of existing) {
    const match = key.match(/-(\d+)$/);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  }
  return `${prefix}-${String(maxNumber + 1).padStart(3, "0")}`;
}

// Small retry-on-collision wrapper shared by create and re-key-on-type-change —
// same idea as the code-conflict retry already used for TestCase codes
// (server/src/routes/testCases.ts, server/src/routes/requirements.ts), just
// generalized: regenerate a fresh key and retry the write itself, since
// `fn` is what actually performs the create/update using that key.
export async function withGeneratedKeyRetry<T>(
  projectId: string,
  type: (typeof WORK_ITEM_TYPES)[number],
  fn: (key: string) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const key = await generateWorkItemKey(projectId, type);
    try {
      return await fn(key);
    } catch (err) {
      const isKeyConflict =
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "P2002" &&
        "meta" in err &&
        (err.meta as { target?: string[] } | undefined)?.target?.includes("key");
      if (!isKeyConflict || attempt === maxAttempts) throw err;
    }
  }
  throw new Error("unreachable");
}
