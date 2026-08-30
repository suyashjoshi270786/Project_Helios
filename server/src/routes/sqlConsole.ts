import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { isWriteRole, getUserTeamIds } from "../lib/access.js";

export const sqlConsoleRouter = Router();
sqlConsoleRouter.use(requireAuth);

const MAX_ROWS = 500;

// Real Prisma queries, always pre-filtered to one team's projects — the safe,
// always-available path since it can't leak another team's data regardless
// of what's typed, unlike the free-form SQL mode below.
const CURATED_QUERIES: Record<string, { label: string; run: (teamId: string) => Promise<unknown[]> }> = {
  projects: {
    label: "My Team's Projects",
    run: (teamId) => prisma.project.findMany({ where: { teamId }, orderBy: { createdAt: "desc" }, take: MAX_ROWS }),
  },
  requirements: {
    label: "My Team's Requirements",
    run: (teamId) =>
      prisma.requirement.findMany({ where: { project: { teamId } }, orderBy: { createdAt: "desc" }, take: MAX_ROWS }),
  },
  testCases: {
    label: "My Team's Test Cases",
    run: (teamId) =>
      prisma.testCase.findMany({ where: { project: { teamId } }, orderBy: { createdAt: "desc" }, take: MAX_ROWS }),
  },
  workItems: {
    label: "My Team's Work Items",
    run: (teamId) =>
      prisma.workItem.findMany({ where: { project: { teamId } }, orderBy: { createdAt: "desc" }, take: MAX_ROWS }),
  },
  testCycles: {
    label: "My Team's Test Cycles",
    run: (teamId) =>
      prisma.testCycle.findMany({ where: { project: { teamId } }, orderBy: { createdAt: "desc" }, take: MAX_ROWS }),
  },
  members: {
    label: "My Team's Members",
    run: (teamId) =>
      prisma.teamMember.findMany({
        where: { teamId },
        select: { role: true, joinedAt: true, user: { select: { name: true, email: true } } },
      }),
  },
};

sqlConsoleRouter.get("/curated", async (_req, res) => {
  res.json(Object.entries(CURATED_QUERIES).map(([key, { label }]) => ({ key, label })));
});

const curatedRunSchema = z.object({ teamId: z.string().min(1) });

sqlConsoleRouter.post("/curated/:key/run", async (req, res) => {
  const parsed = curatedRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  const query = CURATED_QUERIES[req.params.key];
  if (!query) {
    return res.status(404).json({ error: "Unknown query." });
  }
  if (!(await isWriteRole(req.userId!, parsed.data.teamId))) {
    return res.status(403).json({ error: "Only a team owner or admin can use the SQL console." });
  }

  const rows = await query.run(parsed.data.teamId);
  res.json({ rows, truncated: rows.length >= MAX_ROWS });
});

// Free-form SQL is explicitly NOT team-scoped — genuinely guaranteeing that
// for arbitrary SQL text would require Postgres Row-Level Security policies
// per table, which don't exist yet. This mode is honestly labeled "full
// database" on the frontend; the safety net here is that it's physically
// read-only (a Postgres READ ONLY transaction rejects any write regardless
// of what slips past the text validation below) and restricted to anyone
// who is Owner/Admin on at least one team.
const BLOCKED_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|CALL|EXECUTE|VACUUM|REINDEX|MERGE|DO|LISTEN|NOTIFY|SET)\b/i;

function validateReadOnlySql(sqlText: string): string | null {
  const trimmed = sqlText.trim().replace(/;+\s*$/, "");
  if (!trimmed) return "Enter a query to run.";
  if (trimmed.includes(";")) return "Only a single statement is allowed.";
  const firstWord = trimmed.match(/^(\w+)/)?.[1]?.toUpperCase();
  if (firstWord !== "SELECT" && firstWord !== "WITH") return "Only SELECT queries are allowed.";
  if (BLOCKED_KEYWORDS.test(trimmed)) return "Only read-only SELECT queries are allowed.";
  return null;
}

const rawInputSchema = z.object({ sql: z.string().min(1) });

sqlConsoleRouter.post("/raw", async (req, res) => {
  const parsed = rawInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const teamIds = await getUserTeamIds(req.userId!);
  const writeChecks = await Promise.all(teamIds.map((teamId) => isWriteRole(req.userId!, teamId)));
  if (!writeChecks.some(Boolean)) {
    return res.status(403).json({ error: "Only a team owner or admin can use the SQL console." });
  }

  const validationError = validateReadOnlySql(parsed.data.sql);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const sqlText = parsed.data.sql.trim().replace(/;+\s*$/, "");

  try {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5000'");
      return tx.$queryRawUnsafe(sqlText);
    });
    const list = Array.isArray(rows) ? rows : [rows];
    res.json({ rows: list.slice(0, MAX_ROWS), truncated: list.length > MAX_ROWS });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Query failed." });
  }
});
