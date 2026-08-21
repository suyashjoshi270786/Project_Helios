import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const projectInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

projectsRouter.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { createdById: req.userId },
    orderBy: { createdAt: "asc" },
  });
  res.json(projects);
});

projectsRouter.post("/", async (req, res) => {
  const parsed = projectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const project = await prisma.project.create({
    data: { ...parsed.data, createdById: req.userId! },
  });
  res.status(201).json(project);
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, createdById: req.userId },
  });
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }
  res.json(project);
});

projectsRouter.patch("/:id", async (req, res) => {
  const parsed = projectInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await prisma.project.findFirst({
    where: { id: req.params.id, createdById: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Project not found." });
  }

  const updated = await prisma.project.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  res.json(updated);
});

projectsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.project.findFirst({
    where: { id: req.params.id, createdById: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Project not found." });
  }

  // Deleting a project cascades to everything inside it (requirements, test plans,
  // folders/suites/cases, test cycles, defects) — the foreign keys are set to CASCADE.
  await prisma.project.delete({ where: { id: existing.id } });
  res.status(204).end();
});
