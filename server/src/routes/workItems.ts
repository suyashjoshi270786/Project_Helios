import { Router } from "express";
import { z } from "zod";
import { Prisma, type WorkItemType } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { suggestWorkItemField, type WorkItemSuggestField, type SuggestProvider } from "../lib/ai/workItemSuggest.js";
import { summarizeBoard, type BoardPulseItem } from "../lib/ai/boardPulse.js";
import { WORK_ITEM_TYPES, generateWorkItemKey } from "../lib/workItemKey.js";

const BOARD_TYPES = ["Story", "Task", "SubTask", "Defect"] as const;

export const workItemsRouter = Router();
workItemsRouter.use(requireAuth);

const workItemInputSchema = z.object({
  type: z.enum(WORK_ITEM_TYPES),
  title: z.string().min(1),
  description: z.string().nullish(),
  asA: z.string().nullish(),
  iWant: z.string().nullish(),
  soThat: z.string().nullish(),
  status: z.string().min(1).optional(),
  priority: z.string().nullish(),
  assignee: z.string().nullish(),
  reporter: z.string().nullish(),
  severity: z.string().nullish(),
  environment: z.string().nullish(),
  stepsToReproduce: z.string().nullish(),
  expectedResult: z.string().nullish(),
  actualResult: z.string().nullish(),
  storyPoints: z.coerce.number().int().nullish(),
  originalEstimate: z.coerce.number().nullish(),
  remainingEstimate: z.coerce.number().nullish(),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  startDate: z.coerce.date().nullish(),
  targetDate: z.coerce.date().nullish(),
  dueDate: z.coerce.date().nullish(),
  rank: z.number().optional(),
  sprintId: z.string().nullish(),
  parentId: z.string().nullish(),
});

function summarizeChildren(children: { type: WorkItemType; status: string }[]) {
  const byType: Record<string, number> = {};
  for (const child of children) {
    byType[child.type] = (byType[child.type] ?? 0) + 1;
  }
  return { total: children.length, byType };
}

const suggestInputSchema = z.object({
  field: z.enum(["description", "userStory", "acceptanceCriteria", "stepsToReproduce", "expectedResult"]),
  context: z.record(z.string(), z.unknown()).default({}),
  provider: z.enum(["gemini", "anthropic", "openai"]).default("gemini"),
});

workItemsRouter.post("/suggest", async (req, res) => {
  const parsed = suggestInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  try {
    const suggestion = await suggestWorkItemField(
      parsed.data.field as WorkItemSuggestField,
      parsed.data.context,
      parsed.data.provider as SuggestProvider,
    );
    res.json({ suggestion });
  } catch (err) {
    console.error(`Work item suggestion (${parsed.data.provider}) failed:`, err);
    res.status(502).json({ error: "AI suggestions are unavailable right now. Try again shortly." });
  }
});

const boardPulseSchema = z.object({
  projectId: z.string().min(1),
  provider: z.enum(["gemini", "anthropic", "openai"]).default("gemini"),
});

workItemsRouter.post("/board-pulse", async (req, res) => {
  const parsed = boardPulseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  const { projectId, provider } = parsed.data;

  const project = await prisma.project.findFirst({ where: { id: projectId, createdById: req.userId } });
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  const items = await prisma.workItem.findMany({
    where: { projectId, createdById: req.userId, type: { in: [...BOARD_TYPES] } },
    select: { key: true, type: true, title: true, status: true, priority: true, assignee: true, dueDate: true, updatedAt: true },
  });

  const now = Date.now();
  const pulseItems: BoardPulseItem[] = items.map((item) => ({
    key: item.key,
    type: item.type,
    title: item.title,
    status: item.status,
    priority: item.priority,
    assignee: item.assignee,
    dueDate: item.dueDate?.toISOString() ?? null,
    daysSinceUpdate: Math.floor((now - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
  }));

  try {
    const summary = await summarizeBoard(pulseItems, provider as SuggestProvider);
    res.json({ summary });
  } catch (err) {
    console.error(`Board pulse (${provider}) failed:`, err);
    res.status(502).json({ error: "AI Board Pulse is unavailable right now. Try again shortly." });
  }
});

workItemsRouter.get("/", async (req, res) => {
  const querySchema = z.object({
    projectId: z.string().min(1),
    type: z.enum(WORK_ITEM_TYPES).optional(),
    parentId: z.string().optional(),
    sprintId: z.string().optional(),
    search: z.string().optional(),
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { projectId, type, parentId, sprintId, search } = parsed.data;

  const where: Prisma.WorkItemWhereInput = {
    createdById: req.userId,
    projectId,
    type,
    parentId: parentId === "none" ? null : parentId,
    sprintId: sprintId === "none" ? null : sprintId,
    title: search ? { contains: search, mode: "insensitive" } : undefined,
  };

  const items = await prisma.workItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { children: true } },
      parent: { select: { id: true, key: true, title: true } },
    },
  });

  res.json(items.map(({ _count, ...item }) => ({ ...item, childCount: _count.children })));
});

workItemsRouter.post("/", async (req, res) => {
  const bodySchema = workItemInputSchema.extend({ projectId: z.string().min(1) });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { projectId, parentId, ...fields } = parsed.data;

  const project = await prisma.project.findFirst({ where: { id: projectId, createdById: req.userId } });
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  if (parentId) {
    const parent = await prisma.workItem.findFirst({ where: { id: parentId, projectId, createdById: req.userId } });
    if (!parent) {
      return res.status(404).json({ error: "Parent work item not found." });
    }
  }

  const key = await generateWorkItemKey(projectId, fields.type);
  const workItem = await prisma.workItem.create({
    // New items sort to the bottom of the backlog by default — Date.now() is
    // monotonically increasing, so it doubles as a simple append-only rank.
    data: { rank: Date.now(), ...fields, parentId, projectId, key, createdById: req.userId! },
  });
  res.status(201).json({ ...workItem, childCount: 0 });
});

async function buildAncestors(workItem: { parentId: string | null }) {
  const ancestors: { id: string; key: string; title: string; type: WorkItemType }[] = [];
  let currentParentId = workItem.parentId;
  let guard = 0;
  while (currentParentId && guard < 20) {
    const parent = await prisma.workItem.findUnique({
      where: { id: currentParentId },
      select: { id: true, key: true, title: true, type: true, parentId: true },
    });
    if (!parent) break;
    ancestors.unshift({ id: parent.id, key: parent.key, title: parent.title, type: parent.type });
    currentParentId = parent.parentId;
    guard++;
  }
  return ancestors;
}

workItemsRouter.get("/:id", async (req, res) => {
  const workItem = await prisma.workItem.findFirst({
    where: { id: req.params.id, createdById: req.userId },
    include: {
      children: { orderBy: { createdAt: "asc" } },
      acceptanceCriteria: { orderBy: { order: "asc" } },
      testCaseLinks: { include: { testCase: true } },
      stepLinks: {
        include: {
          testStepExecution: {
            include: {
              testExecution: {
                include: { testCycleTest: { include: { testCase: true, testCycle: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!workItem) {
    return res.status(404).json({ error: "Work item not found." });
  }

  const ancestors = await buildAncestors(workItem);
  const { children, testCaseLinks, stepLinks, ...rest } = workItem;

  res.json({
    ...rest,
    ancestors,
    children,
    childrenSummary: summarizeChildren(children),
    testCases: testCaseLinks.map((l) => l.testCase),
    foundIn: stepLinks.map((l) => ({
      linkId: l.id,
      stepNumber: l.testStepExecution.stepNumber,
      testCase: l.testStepExecution.testExecution.testCycleTest.testCase,
      testCycle: l.testStepExecution.testExecution.testCycleTest.testCycle,
    })),
  });
});

workItemsRouter.patch("/:id", async (req, res) => {
  const parsed = workItemInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await prisma.workItem.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Work item not found." });
  }

  const { parentId, ...fields } = parsed.data;
  if (parentId !== undefined) {
    if (parentId === existing.id) {
      return res.status(400).json({ error: "A work item cannot be its own parent." });
    }
    if (parentId) {
      const parent = await prisma.workItem.findFirst({
        where: { id: parentId, projectId: existing.projectId, createdById: req.userId },
      });
      if (!parent) {
        return res.status(404).json({ error: "Parent work item not found." });
      }
    }
  }

  // Changing type re-keys the item (BUG-003 -> STORY-004, etc.) so the key
  // prefix never lies about what the item currently is.
  const key = fields.type && fields.type !== existing.type ? await generateWorkItemKey(existing.projectId, fields.type) : undefined;

  const updated = await prisma.workItem.update({
    where: { id: existing.id },
    data: { ...fields, ...(key ? { key } : {}), ...(parentId !== undefined ? { parentId } : {}) },
  });
  res.json(updated);
});

workItemsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.workItem.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Work item not found." });
  }
  const childCount = await prisma.workItem.count({ where: { parentId: existing.id } });
  if (childCount > 0) {
    return res.status(409).json({ error: "Remove or reassign its child items before deleting this work item." });
  }
  await prisma.workItem.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const criterionInputSchema = z.object({ text: z.string().min(1) });

workItemsRouter.post("/:id/acceptance-criteria", async (req, res) => {
  const parsed = criterionInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const workItem = await prisma.workItem.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!workItem) {
    return res.status(404).json({ error: "Work item not found." });
  }
  const count = await prisma.workItemAcceptanceCriterion.count({ where: { workItemId: workItem.id } });
  const criterion = await prisma.workItemAcceptanceCriterion.create({
    data: { workItemId: workItem.id, text: parsed.data.text, order: count },
  });
  res.status(201).json(criterion);
});

const criterionUpdateSchema = z.object({
  text: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  order: z.number().int().optional(),
});

workItemsRouter.patch("/:id/acceptance-criteria/:criterionId", async (req, res) => {
  const parsed = criterionUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const workItem = await prisma.workItem.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!workItem) {
    return res.status(404).json({ error: "Work item not found." });
  }
  const criterion = await prisma.workItemAcceptanceCriterion.findFirst({
    where: { id: req.params.criterionId, workItemId: workItem.id },
  });
  if (!criterion) {
    return res.status(404).json({ error: "Acceptance criterion not found." });
  }
  const updated = await prisma.workItemAcceptanceCriterion.update({
    where: { id: criterion.id },
    data: parsed.data,
  });
  res.json(updated);
});

workItemsRouter.delete("/:id/acceptance-criteria/:criterionId", async (req, res) => {
  const workItem = await prisma.workItem.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!workItem) {
    return res.status(404).json({ error: "Work item not found." });
  }
  const criterion = await prisma.workItemAcceptanceCriterion.findFirst({
    where: { id: req.params.criterionId, workItemId: workItem.id },
  });
  if (!criterion) {
    return res.status(404).json({ error: "Acceptance criterion not found." });
  }
  await prisma.workItemAcceptanceCriterion.delete({ where: { id: criterion.id } });
  res.status(204).end();
});

const linkTestCasesSchema = z.object({ testCaseIds: z.array(z.string().min(1)).min(1) });

workItemsRouter.post("/:id/test-cases", async (req, res) => {
  const parsed = linkTestCasesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const workItem = await prisma.workItem.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!workItem) {
    return res.status(404).json({ error: "Work item not found." });
  }
  const testCases = await prisma.testCase.findMany({
    where: { id: { in: parsed.data.testCaseIds }, projectId: workItem.projectId, createdById: req.userId },
    select: { id: true },
  });
  if (testCases.length === 0) {
    return res.status(400).json({ error: "No valid test cases were selected." });
  }
  await prisma.workItemTestCase.createMany({
    data: testCases.map((tc) => ({ workItemId: workItem.id, testCaseId: tc.id })),
    skipDuplicates: true,
  });
  res.status(201).json({ linked: testCases.length });
});

workItemsRouter.delete("/:id/test-cases/:testCaseId", async (req, res) => {
  const workItem = await prisma.workItem.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!workItem) {
    return res.status(404).json({ error: "Work item not found." });
  }
  await prisma.workItemTestCase.deleteMany({
    where: { workItemId: workItem.id, testCaseId: req.params.testCaseId },
  });
  res.status(204).end();
});
