import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

export const testSuitesRouter = Router();
testSuitesRouter.use(requireAuth);

const testSuiteInputSchema = z.object({
  name: z.string().min(1),
  projectId: z.string().min(1),
  folderId: z.string().min(1),
});

testSuitesRouter.get("/", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const folderId = typeof req.query.folderId === "string" ? req.query.folderId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }

  const testSuites = await prisma.testSuite.findMany({
    where: { createdById: req.userId, projectId, folderId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { testCases: true } } },
  });
  res.json(testSuites.map(({ _count, ...suite }) => ({ ...suite, testCaseCount: _count.testCases })));
});

testSuitesRouter.post("/", async (req, res) => {
  const parsed = testSuiteInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid test suite payload.", details: parsed.error.flatten() });
  }

  const folder = await prisma.folder.findFirst({
    where: { id: parsed.data.folderId, projectId: parsed.data.projectId, createdById: req.userId },
  });
  if (!folder) {
    return res.status(404).json({ error: "Folder not found." });
  }

  const testSuite = await prisma.testSuite.create({
    data: { ...parsed.data, createdById: req.userId! },
  });
  res.status(201).json(testSuite);
});

testSuitesRouter.get("/:id", async (req, res) => {
  const testSuite = await prisma.testSuite.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!testSuite) {
    return res.status(404).json({ error: "Test suite not found." });
  }
  res.json(testSuite);
});

testSuitesRouter.patch("/:id", async (req, res) => {
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid test suite payload.", details: parsed.error.flatten() });
  }

  const existing = await prisma.testSuite.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Test suite not found." });
  }

  const updated = await prisma.testSuite.update({ where: { id: existing.id }, data: parsed.data });
  res.json(updated);
});

testSuitesRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.testSuite.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Test suite not found." });
  }

  const caseCount = await prisma.testCase.count({ where: { testSuiteId: existing.id } });
  if (caseCount > 0) {
    return res.status(409).json({ error: "Remove its test cases before deleting this test suite." });
  }

  await prisma.testSuite.delete({ where: { id: existing.id } });
  res.status(204).end();
});
