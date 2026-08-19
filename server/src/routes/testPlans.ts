import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { SUGGEST_PROVIDERS, type SuggestField, type SuggestProvider } from "../lib/ai/testPlanSuggest.js";
import { GENERATE_PROVIDERS, type GenerateProvider } from "../lib/ai/testPlanGenerate.js";
import { buildDocumentModel, type TestPlanForDoc } from "../lib/docgen/model.js";
import { renderTestPlanDocx } from "../lib/docgen/testPlanDocx.js";
import { renderTestPlanPdf } from "../lib/docgen/testPlanPdf.js";

const JSON_FIELDS = [
  "testStrategy",
  "testDataStrategy",
  "environmentConfig",
  "entryCriteria",
  "exitCriteria",
  "risks",
  "dependencies",
  "resources",
  "schedule",
] as const;

function toPrismaJsonUpdate(fields: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...fields };
  for (const key of JSON_FIELDS) {
    if (result[key] === null) result[key] = Prisma.JsonNull;
  }
  return result as Prisma.TestPlanUpdateInput;
}

export const testPlansRouter = Router();
testPlansRouter.use(requireAuth);

const criterionSchema = z.object({
  id: z.string(),
  label: z.string(),
  checked: z.boolean(),
  custom: z.boolean().optional(),
});

const riskSchema = z.object({
  id: z.string(),
  risk: z.string(),
  probability: z.string(),
  impact: z.string(),
  mitigation: z.string(),
  owner: z.string(),
});

const dependencySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["Available", "Pending", "Blocked", "Unknown"]),
});

const resourceSchema = z.object({
  id: z.string(),
  role: z.string(),
  name: z.string(),
  responsibilities: z.string(),
});

const scheduleSchema = z.object({
  planningStart: z.string().optional(),
  planningEnd: z.string().optional(),
  testDesignStart: z.string().optional(),
  executionStart: z.string().optional(),
  executionEnd: z.string().optional(),
  regression: z.string().optional(),
  signOff: z.string().optional(),
});

const environmentConfigSchema = z.object({
  applicationUrl: z.string().optional(),
  browsers: z.array(z.string()).optional(),
  os: z.string().optional(),
  database: z.string().optional(),
  apiEnvironment: z.string().optional(),
});

const testDataStrategySchema = z.object({
  dataSource: z.string().optional(),
  dataRequirements: z.string().optional(),
  sensitiveDataHandling: z.string().optional(),
});

const testPlanInputSchema = z.object({
  name: z.string().min(1),
  testPhase: z.string().min(1),
  releaseVersion: z.string().min(1),
  environment: z.string().min(1),
  priority: z.enum(["Critical", "High", "Medium", "Low"]),
  owner: z.string().min(1),
  plannedStartDate: z.coerce.date().nullable().optional(),
  plannedEndDate: z.coerce.date().nullable().optional(),
  objective: z.string().min(1),
  testTypes: z.array(z.string()).default([]),
  otherTestType: z.string().nullish(),
  inScope: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  testStrategy: z.record(z.string(), z.string()).nullish(),
  testDataStrategy: testDataStrategySchema.nullish(),
  environmentConfig: environmentConfigSchema.nullish(),
  entryCriteria: z.array(criterionSchema).nullish(),
  exitCriteria: z.array(criterionSchema).nullish(),
  risks: z.array(riskSchema).nullish(),
  dependencies: z.array(dependencySchema).nullish(),
  resources: z.array(resourceSchema).nullish(),
  schedule: scheduleSchema.nullish(),
  requirementIds: z.array(z.string()).optional(),
});

const createTestPlanSchema = z.object({
  projectId: z.string().min(1),
  requirementIds: z.array(z.string()).optional(),
});

function flattenTestPlan<T extends { links?: { requirementId: string }[] }>(plan: T) {
  const { links, ...rest } = plan;
  return { ...rest, selectedRequirementIds: (links ?? []).map((l) => l.requirementId) };
}

async function replaceRequirementLinks(
  tx: Prisma.TransactionClient,
  testPlanId: string,
  projectId: string,
  userId: string,
  requirementIds: string[],
) {
  const approved = await tx.requirement.findMany({
    where: { id: { in: requirementIds }, projectId, createdById: userId, status: "Approved" },
    select: { id: true },
  });
  const approvedIds = new Set(approved.map((r) => r.id));
  const validIds = [...new Set(requirementIds.filter((id) => approvedIds.has(id)))];

  await tx.testPlanRequirement.deleteMany({ where: { testPlanId } });
  if (validIds.length > 0) {
    await tx.testPlanRequirement.createMany({
      data: validIds.map((requirementId) => ({ testPlanId, requirementId })),
      skipDuplicates: true,
    });
  }
}

testPlansRouter.get("/", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }

  const plans = await prisma.testPlan.findMany({
    where: { createdById: req.userId, projectId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { links: true } } },
  });
  res.json(
    plans.map(({ _count, ...plan }) => ({ ...plan, requirementCount: _count.links })),
  );
});

testPlansRouter.post("/", async (req, res) => {
  const parsed = createTestPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid test plan payload.", details: parsed.error.flatten() });
  }
  const { projectId, requirementIds } = parsed.data;

  const project = await prisma.project.findFirst({ where: { id: projectId, createdById: req.userId } });
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  const plan = await prisma.$transaction(async (tx) => {
    const existingCount = await tx.testPlan.count({ where: { projectId } });
    const planCode = `TP-${String(existingCount + 1).padStart(4, "0")}`;

    const created = await tx.testPlan.create({
      data: {
        planCode,
        name: "Untitled Test Plan",
        testPhase: "",
        releaseVersion: "",
        environment: "",
        owner: "",
        objective: "",
        projectId,
        createdById: req.userId!,
      },
    });

    if (requirementIds && requirementIds.length > 0) {
      await replaceRequirementLinks(tx, created.id, projectId, req.userId!, requirementIds);
    }

    return tx.testPlan.findUniqueOrThrow({ where: { id: created.id }, include: { links: true } });
  });

  res.status(201).json(flattenTestPlan(plan));
});

const suggestInputSchema = z.object({
  field: z.enum(["objective", "testStrategy", "testDataRequirements", "riskDescription", "riskMitigation"]),
  context: z.record(z.string(), z.unknown()).default({}),
  provider: z.enum(["gemini", "anthropic", "openai"]).default("gemini"),
});

testPlansRouter.post("/suggest", async (req, res) => {
  const parsed = suggestInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
  }

  const provider = parsed.data.provider as SuggestProvider;
  const suggest = SUGGEST_PROVIDERS[provider];
  if (!suggest) {
    return res.status(400).json({ error: "This model isn't available yet." });
  }

  try {
    const suggestion = await suggest(parsed.data.field as SuggestField, parsed.data.context);
    res.json({ suggestion });
  } catch (err) {
    console.error(`Test Plan suggestion (${provider}) failed:`, err);
    res.status(502).json({ error: "AI suggestions are unavailable right now. Try again shortly." });
  }
});

testPlansRouter.get("/:id", async (req, res) => {
  const plan = await prisma.testPlan.findFirst({
    where: { id: req.params.id, createdById: req.userId },
    include: { links: { include: { requirement: true } } },
  });
  if (!plan) {
    return res.status(404).json({ error: "Test plan not found." });
  }
  const { links, ...rest } = plan;
  res.json({
    ...rest,
    selectedRequirementIds: links.map((l) => l.requirementId),
    requirements: links.map((l) => l.requirement),
  });
});

testPlansRouter.patch("/:id", async (req, res) => {
  const parsed = testPlanInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid test plan payload.", details: parsed.error.flatten() });
  }

  const existing = await prisma.testPlan.findFirst({
    where: { id: req.params.id, createdById: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Test plan not found." });
  }
  if (existing.status === "APPROVED" || existing.status === "SUPERSEDED") {
    return res.status(409).json({ error: "This test plan is approved and cannot be edited directly." });
  }

  const { requirementIds, ...fields } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    if (requirementIds) {
      await replaceRequirementLinks(tx, existing.id, existing.projectId, req.userId!, requirementIds);
    }
    return tx.testPlan.update({
      where: { id: existing.id },
      data: {
        ...toPrismaJsonUpdate(fields),
        // Editing a rejected plan puts it back into the normal draft/edit cycle.
        status: existing.status === "REJECTED" ? "DRAFT" : undefined,
      },
      include: { links: true },
    });
  });

  res.json(flattenTestPlan(updated));
});

function getRequiredFieldIssues(
  plan: {
    name: string;
    releaseVersion: string;
    testPhase: string;
    environment: string;
    owner: string;
    objective: string;
    testTypes: string[];
  },
  requirementCount: number,
): string[] {
  const issues: string[] = [];
  if (!plan.name?.trim()) issues.push("Test Plan Name is required.");
  if (!plan.releaseVersion?.trim()) issues.push("Release / Version is required.");
  if (!plan.testPhase?.trim()) issues.push("Test Phase is required.");
  if (!plan.environment?.trim()) issues.push("Environment is required.");
  if (!plan.owner?.trim()) issues.push("Owner is required.");
  if (!plan.objective?.trim()) issues.push("Objective is required.");
  if (requirementCount === 0) issues.push("At least one approved requirement must be selected.");
  if (!plan.testTypes || plan.testTypes.length === 0) issues.push("At least one test type must be selected.");
  return issues;
}

const generateInputSchema = z.object({
  provider: z.enum(["gemini", "anthropic", "openai"]).default("gemini"),
  documentFormats: z.array(z.enum(["docx", "pdf"])).default(["docx", "pdf"]),
});

testPlansRouter.post("/:id/generate", async (req, res) => {
  const parsed = generateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request.", details: parsed.error.flatten() });
  }

  const existing = await prisma.testPlan.findFirst({
    where: { id: req.params.id, createdById: req.userId },
    include: { links: { include: { requirement: true } } },
  });
  if (!existing) {
    return res.status(404).json({ error: "Test plan not found." });
  }
  if (existing.status === "APPROVED" || existing.status === "SUPERSEDED") {
    return res.status(409).json({ error: "This test plan is approved and cannot be edited directly." });
  }

  const issues = getRequiredFieldIssues(existing, existing.links.length);
  if (issues.length > 0) {
    return res.status(400).json({ error: "This test plan isn't ready to generate.", issues });
  }

  const provider = parsed.data.provider as GenerateProvider;
  const generate = GENERATE_PROVIDERS[provider];
  if (!generate) {
    return res.status(400).json({ error: "This model isn't available yet." });
  }

  const previousStatus = existing.status;
  await prisma.testPlan.update({ where: { id: existing.id }, data: { status: "GENERATING" } });

  const context = {
    testPlanName: existing.name,
    testPhase: existing.testPhase,
    releaseVersion: existing.releaseVersion,
    environment: existing.environment,
    priority: existing.priority,
    objective: existing.objective,
    testTypes: existing.testTypes,
    otherTestType: existing.otherTestType,
    inScope: existing.inScope,
    outOfScope: existing.outOfScope,
    testStrategy: existing.testStrategy,
    testDataStrategy: existing.testDataStrategy,
    environmentConfig: existing.environmentConfig,
    entryCriteria: existing.entryCriteria,
    exitCriteria: existing.exitCriteria,
    risks: existing.risks,
    dependencies: existing.dependencies,
    resources: existing.resources,
    schedule: existing.schedule,
    requirementTitles: existing.links.map((l) => l.requirement.title),
  };

  try {
    const generated = await generate({ context });

    const updated = await prisma.testPlan.update({
      where: { id: existing.id },
      data: {
        status: "GENERATED",
        aiProvider: provider,
        documentFormats: parsed.data.documentFormats,
        generatedContent: generated as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
      },
      include: { links: true },
    });
    res.json(flattenTestPlan(updated));
  } catch (err) {
    console.error(`Test Plan generation (${provider}) failed:`, err);
    await prisma.testPlan.update({ where: { id: existing.id }, data: { status: previousStatus } });
    res.status(502).json({ error: "Test Plan generation failed. Try again shortly." });
  }
});

testPlansRouter.get("/:id/document", async (req, res) => {
  const format = req.query.format;
  if (format !== "docx" && format !== "pdf") {
    return res.status(400).json({ error: "format must be 'docx' or 'pdf'." });
  }

  const plan = await prisma.testPlan.findFirst({
    where: { id: req.params.id, createdById: req.userId },
    include: { links: { include: { requirement: true } }, project: true },
  });
  if (!plan) {
    return res.status(404).json({ error: "Test plan not found." });
  }
  if (!plan.generatedContent) {
    return res.status(400).json({ error: "Generate this test plan before downloading a document." });
  }

  const blocks = buildDocumentModel({
    plan: plan as unknown as TestPlanForDoc,
    projectName: plan.project.name,
    requirements: plan.links.map((l) => ({
      id: l.requirement.id,
      title: l.requirement.title,
      priority: l.requirement.priority,
    })),
  });

  const title = `${plan.planCode} — ${plan.name}`;
  const filename = `${plan.planCode}-v${plan.version}.${format}`;

  if (format === "docx") {
    const buffer = await renderTestPlanDocx(blocks, title);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } else {
    const buffer = await renderTestPlanPdf(blocks, title);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
});

testPlansRouter.post("/:id/approve", async (req, res) => {
  const existing = await prisma.testPlan.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Test plan not found." });
  }
  if (existing.status !== "GENERATED") {
    return res.status(409).json({ error: "Generate this test plan before approving it." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (existing.previousVersionId) {
      await tx.testPlan.update({
        where: { id: existing.previousVersionId },
        data: { status: "SUPERSEDED", isLatest: false },
      });
    }
    return tx.testPlan.update({
      where: { id: existing.id },
      data: { status: "APPROVED", approvedById: req.userId!, approvedAt: new Date(), isLatest: true },
      include: { links: true },
    });
  });

  res.json(flattenTestPlan(updated));
});

const rejectInputSchema = z.object({ reason: z.string().min(1) });

testPlansRouter.post("/:id/reject", async (req, res) => {
  const parsed = rejectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A rejection reason is required." });
  }

  const existing = await prisma.testPlan.findFirst({ where: { id: req.params.id, createdById: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: "Test plan not found." });
  }
  if (existing.status !== "GENERATED") {
    return res.status(409).json({ error: "Only a generated test plan can be rejected." });
  }

  const updated = await prisma.testPlan.update({
    where: { id: existing.id },
    data: { status: "REJECTED", rejectedReason: parsed.data.reason },
    include: { links: true },
  });
  res.json(flattenTestPlan(updated));
});

testPlansRouter.post("/:id/new-version", async (req, res) => {
  const existing = await prisma.testPlan.findFirst({
    where: { id: req.params.id, createdById: req.userId },
    include: { links: true },
  });
  if (!existing) {
    return res.status(404).json({ error: "Test plan not found." });
  }
  if (existing.status !== "APPROVED") {
    return res.status(409).json({ error: "Only an approved test plan can be revised into a new version." });
  }

  const [major, minor] = existing.version.split(".").map(Number);
  const nextVersion = `${major}.${(minor || 0) + 1}`;

  const created = await prisma.$transaction(async (tx) => {
    await tx.testPlan.update({ where: { id: existing.id }, data: { isLatest: false } });

    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      approvedById: _approvedById,
      approvedAt: _approvedAt,
      rejectedReason: _rejectedReason,
      generatedContent: _generatedContent,
      generatedAt: _generatedAt,
      links: _links,
      version: _version,
      status: _status,
      isLatest: _isLatest,
      previousVersionId: _previousVersionId,
      ...copyable
    } = existing;

    const newPlan = await tx.testPlan.create({
      data: {
        ...toPrismaJsonUpdate(copyable),
        version: nextVersion,
        status: "DRAFT",
        previousVersionId: existing.id,
        isLatest: true,
      } as Prisma.TestPlanUncheckedCreateInput,
    });

    if (existing.links.length > 0) {
      await tx.testPlanRequirement.createMany({
        data: existing.links.map((l) => ({ testPlanId: newPlan.id, requirementId: l.requirementId })),
      });
    }

    return tx.testPlan.findUniqueOrThrow({ where: { id: newPlan.id }, include: { links: true } });
  });

  res.status(201).json(flattenTestPlan(created));
});

testPlansRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.testPlan.findFirst({
    where: { id: req.params.id, createdById: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Test plan not found." });
  }
  if (existing.status !== "DRAFT") {
    return res.status(409).json({ error: "Only draft test plans can be deleted." });
  }

  await prisma.testPlan.delete({ where: { id: existing.id } });
  res.status(204).end();
});
