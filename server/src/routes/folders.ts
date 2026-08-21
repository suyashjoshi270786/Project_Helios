import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";

export const foldersRouter = Router();
foldersRouter.use(requireAuth);

const folderInputSchema = z.object({
  name: z.string().min(1),
  projectId: z.string().min(1),
  parentId: z.string().nullish(),
});

foldersRouter.get("/", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }

  const folders = await prisma.folder.findMany({
    where: { createdById: req.userId, projectId },
    orderBy: { createdAt: "asc" },
  });
  res.json(folders);
});

foldersRouter.post("/", async (req, res) => {
  const parsed = folderInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, createdById: req.userId },
  });
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: parsed.data.parentId, projectId: parsed.data.projectId, createdById: req.userId },
    });
    if (!parent) {
      return res.status(404).json({ error: "Parent folder not found." });
    }
  }

  const folder = await prisma.folder.create({
    data: { ...parsed.data, createdById: req.userId! },
  });
  res.status(201).json(folder);
});

foldersRouter.patch("/:id", async (req, res) => {
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await prisma.folder.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Folder not found." });
  }

  const updated = await prisma.folder.update({ where: { id: existing.id }, data: parsed.data });
  res.json(updated);
});

foldersRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.folder.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Folder not found." });
  }

  const [childCount, suiteCount] = await Promise.all([
    prisma.folder.count({ where: { parentId: existing.id } }),
    prisma.testSuite.count({ where: { folderId: existing.id } }),
  ]);
  if (childCount > 0 || suiteCount > 0) {
    return res.status(409).json({ error: "Remove its subfolders and test suites before deleting this folder." });
  }

  await prisma.folder.delete({ where: { id: existing.id } });
  res.status(204).end();
});
