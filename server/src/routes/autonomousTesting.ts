import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { findAccessibleProject, accessibleProjectsWhere } from "../lib/access.js";
import { startRun, requestCancel, isAutonomousTestingEnabled, STAGE_ORDER } from "../autonomous/index.js";

export const autonomousTestingRouter = Router();
autonomousTestingRouter.use(requireAuth);

// Single enforcement point for the feature flag — every route below is a
// no-op (503) while ENABLE_AUTONOMOUS_TESTING isn't "true". Existing
// functionality is completely unaffected either way.
function requireFeatureFlag(_req: Request, res: Response, next: NextFunction) {
  if (!isAutonomousTestingEnabled()) {
    return res.status(503).json({ error: "Autonomous testing is not enabled on this server." });
  }
  next();
}
autonomousTestingRouter.use(requireFeatureFlag);

const startRunSchema = z.object({
  projectId: z.string().min(1),
  targetUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  environment: z.string().trim().max(100).optional(),
  appName: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(2000).optional(),
  maxDepth: z.coerce.number().int().min(1).max(10).optional(),
  maxTests: z.coerce.number().int().min(1).max(50).optional(),
});

// Credentials are received here, in this one request, and go straight into
// the orchestrator's in-memory closure — they are never written to the
// AutonomousRun row (the schema has no such columns), never logged, and
// never echoed back in this or any other response. See the implementation
// plan's credential-handling checklist.
autonomousTestingRouter.post("/runs", async (req, res) => {
  const parsed = startRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { projectId, targetUrl, username, password, environment, appName, instructions, maxDepth, maxTests } = parsed.data;

  const project = await findAccessibleProject(req.userId!, projectId, "autonomous-testing");
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.autonomousRun.create({
      data: {
        targetUrl,
        appName,
        environment,
        instructions,
        maxDepth,
        maxTests,
        projectId,
        createdById: req.userId!,
      },
    });
    await tx.autonomousStage.createMany({
      data: STAGE_ORDER.map((stage) => ({ autonomousRunId: created.id, stage })),
    });
    return created;
  });

  startRun(
    {
      runId: run.id,
      targetUrl,
      appName,
      environment,
      instructions,
      maxDepth: maxDepth ?? 3,
      maxTests: maxTests ?? 10,
      projectId,
      createdById: req.userId!,
    },
    { username, password },
  ).catch((err) => {
    console.error(`[autonomous] Unhandled error in run ${run.id}:`, (err as Error).message);
  });

  res.status(202).json({ id: run.id });
});

const bulkDeleteRunsSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

// Registered before "/runs/:id" so "/runs/bulk-delete" is never swallowed as
// an id (moot for this exact method/path combo today, but keeps the file
// consistent with that convention as routes get added).
autonomousTestingRouter.post("/runs/bulk-delete", async (req, res) => {
  const parsed = bulkDeleteRunsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const rows = await prisma.autonomousRun.findMany({
    where: { id: { in: parsed.data.ids }, project: accessibleProjectsWhere(req.userId!) },
    select: { id: true, status: true },
  });
  // A run still Pending/Running has an in-process orchestrator actively
  // writing to its row — deleting it out from under that would just make
  // the next stage update fail confusingly. Skip those; the caller can
  // stop the run first, then delete it once it's terminal.
  const deletableIds = rows.filter((r) => r.status !== "Pending" && r.status !== "Running").map((r) => r.id);
  if (deletableIds.length > 0) {
    await prisma.autonomousRun.deleteMany({ where: { id: { in: deletableIds } } });
  }
  res.json({ deleted: deletableIds.length, skippedActive: rows.length - deletableIds.length });
});

autonomousTestingRouter.get("/runs", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required." });
  }

  const runs = await prisma.autonomousRun.findMany({
    where: { projectId, project: accessibleProjectsWhere(req.userId!) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetUrl: true,
      appName: true,
      environment: true,
      status: true,
      currentStage: true,
      testsPassed: true,
      testsFailed: true,
      defectsCreated: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
  res.json(runs);
});

autonomousTestingRouter.get("/runs/:id", async (req, res) => {
  const run = await prisma.autonomousRun.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
    include: { stages: { orderBy: { createdAt: "asc" } } },
  });
  if (!run) {
    return res.status(404).json({ error: "Autonomous run not found." });
  }
  const { report: _report, ...rest } = run;
  res.json(rest);
});

autonomousTestingRouter.get("/runs/:id/report", async (req, res) => {
  const run = await prisma.autonomousRun.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
    select: { status: true, report: true },
  });
  if (!run) {
    return res.status(404).json({ error: "Autonomous run not found." });
  }
  if (!run.report) {
    return res.status(409).json({ error: "This run hasn't produced a report yet." });
  }
  res.json(run.report);
});

autonomousTestingRouter.post("/runs/:id/stop", async (req, res) => {
  const run = await prisma.autonomousRun.findFirst({
    where: { id: req.params.id, project: accessibleProjectsWhere(req.userId!) },
  });
  if (!run) {
    return res.status(404).json({ error: "Autonomous run not found." });
  }
  if (run.status !== "Pending" && run.status !== "Running") {
    return res.status(409).json({ error: "This run has already finished." });
  }
  requestCancel(run.id);
  res.status(202).json({ ok: true });
});
