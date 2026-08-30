import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { PROVIDERS, type AiProvider, type AnalyzerInput } from "../lib/ai/registry.js";
import {
  TEST_CASE_GENERATE_PROVIDERS,
  type GeneratedTestCases,
  type TestCaseGenerateProvider,
} from "../lib/ai/testCaseGenerate.js";
import { friendlyValidationError } from "../lib/validation.js";
import { accessibleProjectsWhere, findAccessibleProject, hasProjectAccess } from "../lib/access.js";

const MAX_GENERATED_SUITE_NAME_LENGTH = 80;

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

  if (!(await hasProjectAccess(req.userId!, parsed.data.projectId, "requirements"))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const requirements = await prisma.requirement.findMany({
    where: { projectId: parsed.data.projectId, status: parsed.data.status },
    orderBy: { createdAt: "desc" },
    include: {
      generatedTestCases: { select: { testSuiteId: true, testSuite: { select: { name: true } } } },
    },
  });
  res.json(
    requirements.map(({ generatedTestCases, ...r }) => {
      const bySuite = new Map<string, { suiteId: string; name: string; count: number }>();
      for (const tc of generatedTestCases) {
        const existing = bySuite.get(tc.testSuiteId);
        if (existing) existing.count += 1;
        else bySuite.set(tc.testSuiteId, { suiteId: tc.testSuiteId, name: tc.testSuite.name, count: 1 });
      }
      return { ...r, generatedSuites: [...bySuite.values()] };
    }),
  );
});

requirementsRouter.post("/", async (req, res) => {
  const parsed = requirementInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const project = await findAccessibleProject(req.userId!, parsed.data.projectId, "requirements");
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
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
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
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
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
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Requirement not found." });
  }

  await prisma.requirement.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const SCENARIO_SUITE_NAMES = { Positive: "Positive Scenarios", Negative: "Negative Scenarios" } as const;

const bulkGenerateInputSchema = z.object({
  requirementIds: z.array(z.string().min(1)).min(1),
  provider: z.enum(["gemini", "anthropic", "openai"]).default("gemini"),
});

type GenerateResult =
  | { requirementId: string; error: string }
  | {
      requirementId: string;
      folderId: string;
      positiveSuiteId: string | null;
      negativeSuiteId: string | null;
      positiveCount: number;
      negativeCount: number;
    };

requirementsRouter.post("/generate-test-cases", async (req, res) => {
  const parsed = bulkGenerateInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const provider = parsed.data.provider as TestCaseGenerateProvider;
  const generate = TEST_CASE_GENERATE_PROVIDERS[provider];
  if (!generate) {
    return res.status(400).json({ error: "This model isn't available yet." });
  }

  const requirements = await prisma.requirement.findMany({
    where: { id: { in: parsed.data.requirementIds }, project: accessibleProjectsWhere(req.userId!) },
  });
  if (requirements.length === 0) {
    return res.status(404).json({ error: "No matching requirements found." });
  }
  for (const requirement of requirements) {
    if (!(await hasProjectAccess(req.userId!, requirement.projectId, "requirements"))) {
      return res.status(404).json({ error: "Requirement not found." });
    }
  }
  const notApproved = requirements.filter((r) => r.status !== "Approved");
  if (notApproved.length > 0) {
    return res.status(400).json({ error: "Only Approved requirements can generate test cases." });
  }

  const results: GenerateResult[] = [];

  for (const requirement of requirements) {
    let generated;
    try {
      generated = await generate({
        title: requirement.title,
        description: requirement.description,
        acceptanceCriteria: requirement.acceptanceCriteria,
        flows: requirement.flows,
        risks: requirement.risks,
      });
    } catch (err) {
      console.error(`Test Case Generator (${provider}) failed for requirement ${requirement.id}:`, err);
      results.push({ requirementId: requirement.id, error: "The Test Case Generator is unavailable right now." });
      continue;
    }

    if (generated.testCases.length === 0) {
      results.push({ requirementId: requirement.id, error: "Couldn't produce any test cases from this requirement." });
      continue;
    }

    try {
      const outcome = await generateForRequirement(requirement, generated.testCases, req.userId!);
      results.push({ requirementId: requirement.id, ...outcome });
    } catch (err) {
      console.error(`Failed to save generated test cases for requirement ${requirement.id}:`, err);
      results.push({ requirementId: requirement.id, error: "Could not save the generated test cases." });
    }
  }

  res.status(201).json({ results });
});

// `code` is assigned by counting existing rows, which is only safe against a
// single writer at a time — under real concurrency (a double-click, two team
// members generating at once) two requests can compute the same count and
// collide on the (projectId, code) unique constraint. Retrying the whole
// transaction with a freshly recomputed count resolves that without needing
// a database-level sequence just for this.
const CODE_CONFLICT_MAX_ATTEMPTS = 5;

async function generateForRequirement(
  requirement: { id: string; projectId: string; title: string },
  testCases: GeneratedTestCases["testCases"],
  userId: string,
) {
  for (let attempt = 1; attempt <= CODE_CONFLICT_MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // A prior generation run on this requirement already has a subfolder —
        // reuse it (and its Positive/Negative suites) instead of duplicating.
        const existingLink = await tx.testCase.findFirst({
          where: { sourceRequirementId: requirement.id },
          select: { testSuite: { select: { folderId: true } } },
        });

        let subfolderId: string;
        if (existingLink) {
          subfolderId = existingLink.testSuite.folderId;
        } else {
          let rootFolder = await tx.folder.findFirst({
            where: { projectId: requirement.projectId, parentId: null, name: "Requirements" },
          });
          if (!rootFolder) {
            rootFolder = await tx.folder.create({
              data: { projectId: requirement.projectId, name: "Requirements", createdById: userId },
            });
          }
          const subfolderName = requirement.title.slice(0, MAX_GENERATED_SUITE_NAME_LENGTH);
          let subfolder = await tx.folder.findFirst({
            where: { projectId: requirement.projectId, parentId: rootFolder.id, name: subfolderName },
          });
          if (!subfolder) {
            subfolder = await tx.folder.create({
              data: {
                projectId: requirement.projectId,
                parentId: rootFolder.id,
                name: subfolderName,
                createdById: userId,
              },
            });
          }
          subfolderId = subfolder.id;
        }

        const suiteByCategory = new Map<"Positive" | "Negative", string>();
        async function getSuiteId(category: "Positive" | "Negative"): Promise<string> {
          const cached = suiteByCategory.get(category);
          if (cached) return cached;
          const name = SCENARIO_SUITE_NAMES[category];
          let suite = await tx.testSuite.findFirst({ where: { folderId: subfolderId, name } });
          if (!suite) {
            suite = await tx.testSuite.create({
              data: { projectId: requirement.projectId, folderId: subfolderId, name, createdById: userId },
            });
          }
          suiteByCategory.set(category, suite.id);
          return suite.id;
        }

        let existingCount = await tx.testCase.count({ where: { projectId: requirement.projectId } });
        let positiveCount = 0;
        let negativeCount = 0;

        for (const candidate of testCases) {
          const category: "Positive" | "Negative" = candidate.category === "Negative" ? "Negative" : "Positive";
          const testSuiteId = await getSuiteId(category);
          existingCount += 1;
          const code = `TC-${String(existingCount).padStart(4, "0")}`;
          const testCase = await tx.testCase.create({
            data: {
              code,
              name: candidate.name,
              objective: candidate.objective || undefined,
              testSuiteId,
              projectId: requirement.projectId,
              createdById: userId,
              sourceRequirementId: requirement.id,
            },
          });
          await tx.testStep.createMany({
            data: candidate.steps.map((step, index) => ({
              testCaseId: testCase.id,
              stepNumber: index + 1,
              description: step.description,
              testData: step.testData || undefined,
              expectedResult: step.expectedResult,
            })),
          });
          if (category === "Positive") positiveCount += 1;
          else negativeCount += 1;
        }

        return {
          folderId: subfolderId,
          positiveSuiteId: suiteByCategory.get("Positive") ?? null,
          negativeSuiteId: suiteByCategory.get("Negative") ?? null,
          positiveCount,
          negativeCount,
        };
      });
    } catch (err) {
      const isCodeConflict =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("code");
      if (!isCodeConflict || attempt === CODE_CONFLICT_MAX_ATTEMPTS) throw err;
    }
  }
  throw new Error("unreachable");
}

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
