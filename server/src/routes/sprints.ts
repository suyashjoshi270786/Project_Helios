import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { accessibleProjectsWhere, findAccessibleProject, hasProjectAccess } from "../lib/access.js";

export const sprintsRouter = Router();
sprintsRouter.use(requireAuth);

const sprintInputSchema = z.object({
  name: z.string().min(1),
  goal: z.string().nullish(),
  startDate: z.coerce.date().nullish(),
  endDate: z.coerce.date().nullish(),
});

function summarizeSprint(sprint: { workItems: { status: string; storyPoints: number | null }[] }) {
  const total = sprint.workItems.length;
  const done = sprint.workItems.filter((w) => w.status === "Done").length;
  const points = sprint.workItems.reduce((sum, w) => sum + (w.storyPoints ?? 0), 0);
  return { total, done, points };
}

sprintsRouter.get("/", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }

  if (!(await hasProjectAccess(req.userId!, projectId, "work-items"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { workItems: { select: { status: true, storyPoints: true } } },
  });

  res.json(sprints.map(({ workItems, ...sprint }) => ({ ...sprint, summary: summarizeSprint({ workItems }) })));
});

sprintsRouter.post("/", async (req, res) => {
  const bodySchema = sprintInputSchema.extend({ projectId: z.string().min(1) });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { projectId, ...fields } = parsed.data;

  const project = await findAccessibleProject(req.userId!, projectId, "work-items");
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  const sprint = await prisma.sprint.create({ data: { ...fields, projectId, createdById: req.userId! } });
  res.status(201).json({ ...sprint, summary: { total: 0, done: 0, points: 0 } });
});

sprintsRouter.patch("/:id", async (req, res) => {
  const parsed = sprintInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await prisma.sprint.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Sprint not found." });
  }

  const updated = await prisma.sprint.update({ where: { id: existing.id }, data: parsed.data });
  const workItems = await prisma.workItem.findMany({
    where: { sprintId: updated.id },
    select: { status: true, storyPoints: true },
  });
  res.json({ ...updated, summary: summarizeSprint({ workItems }) });
});

// Starting a sprint requires no other Active sprint in the same project —
// the standard single-active-sprint Scrum rule. Completing one sends any
// item that isn't Done back to the backlog rather than leaving it stranded
// in a closed sprint.
const transitionSchema = z.object({ status: z.enum(["Planned", "Active", "Completed"]) });

sprintsRouter.post("/:id/transition", async (req, res) => {
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const sprint = await prisma.sprint.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!sprint) {
    return res.status(404).json({ error: "Sprint not found." });
  }

  if (parsed.data.status === "Active" && sprint.status !== "Active") {
    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId: sprint.projectId, status: "Active", id: { not: sprint.id } },
    });
    if (activeSprint) {
      return res.status(409).json({ error: `Complete "${activeSprint.name}" before starting another sprint.` });
    }
  }

  if (parsed.data.status === "Completed" && sprint.status !== "Completed") {
    await prisma.workItem.updateMany({
      where: { sprintId: sprint.id, status: { not: "Done" } },
      data: { sprintId: null },
    });
  }

  const updated = await prisma.sprint.update({ where: { id: sprint.id }, data: { status: parsed.data.status } });
  const workItems = await prisma.workItem.findMany({
    where: { sprintId: updated.id },
    select: { status: true, storyPoints: true },
  });
  res.json({ ...updated, summary: summarizeSprint({ workItems }) });
});

sprintsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.sprint.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Sprint not found." });
  }
  // WorkItem.sprintId is onDelete: SetNull, so members return to the backlog automatically.
  await prisma.sprint.delete({ where: { id: existing.id } });
  res.status(204).end();
});
