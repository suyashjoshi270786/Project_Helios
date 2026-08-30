import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { accessibleProjectsWhere, findAccessibleProject, hasProjectAccess } from "../lib/access.js";

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

  if (!(await hasProjectAccess(req.userId!, projectId, "test-cases"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const folders = await prisma.folder.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  res.json(folders);
});

foldersRouter.post("/", async (req, res) => {
  const parsed = folderInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const project = await findAccessibleProject(req.userId!, parsed.data.projectId, "test-cases");
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: parsed.data.parentId, projectId: parsed.data.projectId },
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

const folderUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  parentId: z.string().min(1).nullable().optional(),
});

foldersRouter.patch("/:id", async (req, res) => {
  const parsed = folderUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await prisma.folder.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Folder not found." });
  }

  if (parsed.data.parentId) {
    if (parsed.data.parentId === existing.id) {
      return res.status(400).json({ error: "A folder can't be moved into itself." });
    }
    const allFolders = await prisma.folder.findMany({
      where: { projectId: existing.projectId },
      select: { id: true, parentId: true },
    });
    const byId = new Map(allFolders.map((f) => [f.id, f]));
    let cursor = byId.get(parsed.data.parentId);
    if (!cursor) {
      return res.status(404).json({ error: "Target folder not found." });
    }
    while (cursor) {
      if (cursor.id === existing.id) {
        return res.status(400).json({ error: "Can't move a folder into one of its own subfolders." });
      }
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }

  const updated = await prisma.folder.update({ where: { id: existing.id }, data: parsed.data });
  res.json(updated);
});

// Walks the folder tree under `rootId` (inclusive) and returns every
// descendant folder id — used both to count what a delete would take with it
// and, since Folder->Folder/TestSuite already cascade at the DB level, isn't
// needed for the delete itself, only for the pre-delete warning.
async function getFolderDescendantIds(projectId: string, rootId: string): Promise<string[]> {
  const allFolders = await prisma.folder.findMany({
    where: { projectId },
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const f of allFolders) {
    if (!f.parentId) continue;
    const list = childrenByParent.get(f.parentId) ?? [];
    list.push(f.id);
    childrenByParent.set(f.parentId, list);
  }
  const ids: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ids.push(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return ids;
}

foldersRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.folder.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Folder not found." });
  }

  const descendantIds = await getFolderDescendantIds(existing.projectId, existing.id);
  const [subfolders, suites, testCases] = await Promise.all([
    prisma.folder.count({ where: { id: { in: descendantIds.filter((id) => id !== existing.id) } } }),
    prisma.testSuite.count({ where: { folderId: { in: descendantIds } } }),
    prisma.testCase.count({ where: { testSuite: { folderId: { in: descendantIds } } } }),
  ]);

  const cascade = req.query.cascade === "true";
  if (!cascade && (subfolders > 0 || suites > 0 || testCases > 0)) {
    return res.status(409).json({
      error: "This folder isn't empty.",
      counts: { subfolders, suites, testCases },
    });
  }

  await prisma.folder.delete({ where: { id: existing.id } });
  res.status(204).end();
});
