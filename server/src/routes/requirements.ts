import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { PROVIDERS, type AiProvider, type AnalyzerInput } from "../lib/ai/registry.js";
import { friendlyValidationError } from "../lib/validation.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const LEGACY_DOC_MIME = "application/msword";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const requirementsRouter = Router();
requirementsRouter.use(requireAuth);

const requirementInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  acceptanceCriteria: z.array(z.string()).default([]),
  flows: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  status: z.enum(["Draft", "InReview", "Approved"]).default("Draft"),
  priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
  sourceText: z.string().optional(),
  projectId: z.string().min(1),
});

const listQuerySchema = z.object({
  projectId: z.string().min(1),
  status: z.enum(["Draft", "InReview", "Approved"]).optional(),
});

requirementsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "projectId is required." });
  }

  const requirements = await prisma.requirement.findMany({
    where: { createdById: req.userId, projectId: parsed.data.projectId, status: parsed.data.status },
    orderBy: { createdAt: "desc" },
  });
  res.json(requirements);
});

requirementsRouter.post("/", async (req, res) => {
  const parsed = requirementInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, createdById: req.userId },
  });
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  const requirement = await prisma.requirement.create({
    data: { ...parsed.data, createdById: req.userId! },
  });
  res.status(201).json(requirement);
});

requirementsRouter.get("/:id", async (req, res) => {
  const requirement = await prisma.requirement.findFirst({
    where: { id: req.params.id, createdById: req.userId },
  });
  if (!requirement) {
    return res.status(404).json({ error: "Requirement not found." });
  }
  res.json(requirement);
});

requirementsRouter.patch("/:id", async (req, res) => {
  const parsed = requirementInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await prisma.requirement.findFirst({
    where: { id: req.params.id, createdById: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Requirement not found." });
  }

  const updated = await prisma.requirement.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  res.json(updated);
});

requirementsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.requirement.findFirst({
    where: { id: req.params.id, createdById: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Requirement not found." });
  }

  await prisma.requirement.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const analyzeInputSchema = z.object({
  text: z.string().optional(),
  provider: z.enum(["gemini", "anthropic", "openai"]).default("gemini"),
});

requirementsRouter.post("/analyze", upload.single("file"), async (req, res) => {
  const parsed = analyzeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const file = req.file;
  if (!file && !parsed.data.text?.trim()) {
    return res.status(400).json({ error: "Paste some text or upload a document to analyze." });
  }

  const analyzerInput: AnalyzerInput = { text: parsed.data.text };

  if (file) {
    if (file.mimetype === LEGACY_DOC_MIME) {
      return res.status(400).json({ error: "Legacy .doc files aren't supported — please save as .docx or PDF." });
    }
    if (file.mimetype === DOCX_MIME) {
      const { value } = await mammoth.extractRawText({ buffer: file.buffer });
      analyzerInput.text = [analyzerInput.text, value].filter(Boolean).join("\n\n");
    } else if (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")) {
      analyzerInput.file = { data: file.buffer.toString("base64"), mimeType: file.mimetype };
    } else {
      return res.status(400).json({ error: "Unsupported file type. Upload a PDF, .docx, or image." });
    }
  }

  const provider = parsed.data.provider as AiProvider;
  const analyze = PROVIDERS[provider];
  if (!analyze) {
    return res.status(400).json({ error: "This model isn't available yet." });
  }

  try {
    const candidates = await analyze(analyzerInput);
    res.json({ candidates });
  } catch (err) {
    console.error(`Requirement Analyzer (${provider}) failed:`, err);
    res.status(502).json({ error: "The Requirement Analyzer is unavailable right now. Try again shortly." });
  }
});
