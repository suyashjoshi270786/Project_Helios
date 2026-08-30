import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { accessibleProjectsWhere, findAccessibleProject, getUserTeamIds } from "../lib/access.js";
import { MODULE_KEYS } from "../lib/modules.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const projectInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// Owner/Admin always have every module; only a Member's grant list applies —
// returning the full key list for them too means the frontend can just do
// `myModules.includes(key)` everywhere without a separate "am I restricted" check.
function withMyRole<T extends { team: { members: { role: string; modules: string[] }[] } }>({ team, ...project }: T) {
  const membership = team.members[0];
  const myRole = membership?.role ?? "Member";
  const myModules = myRole === "Member" ? (membership?.modules ?? []) : [...MODULE_KEYS];
  return { ...project, myRole, myModules };
}

projectsRouter.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    where: accessibleProjectsWhere(req.userId!),
    orderBy: { createdAt: "asc" },
    include: {
      team: { include: { members: { where: { userId: req.userId! }, select: { role: true, modules: true } } } },
    },
  });
  res.json(projects.map(withMyRole));
});

const createProjectSchema = projectInputSchema.extend({ teamId: z.string().min(1).optional() });

projectsRouter.post("/", async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }
  const { teamId, ...fields } = parsed.data;

  // Default to the user's own team if none was specified — keeps project
  // creation a one-click action for people who aren't juggling multiple teams.
  let resolvedTeamId = teamId;
  if (!resolvedTeamId) {
    const teamIds = await getUserTeamIds(req.userId!);
    resolvedTeamId = teamIds[0];
  } else {
    const teamIds = await getUserTeamIds(req.userId!);
    if (!teamIds.includes(resolvedTeamId)) {
      return res.status(403).json({ error: "You aren't a member of that team." });
    }
  }
  if (!resolvedTeamId) {
    return res.status(400).json({ error: "You need a team before you can create a project." });
  }

  const project = await prisma.project.create({
    data: { ...fields, teamId: resolvedTeamId, createdById: req.userId! },
  });
  res.status(201).json(project);
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await findAccessibleProject(req.userId!, req.params.id);
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: project.teamId, userId: req.userId! } },
  });
  const myRole = membership?.role ?? "Member";
  const myModules = myRole === "Member" ? (membership?.modules ?? []) : [...MODULE_KEYS];
  res.json({ ...project, myRole, myModules });
});

projectsRouter.patch("/:id", async (req, res) => {
  const parsed = projectInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const existing = await findAccessibleProject(req.userId!, req.params.id);
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
  const existing = await findAccessibleProject(req.userId!, req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Project not found." });
  }

  // Deleting a project cascades to everything inside it (requirements, test plans,
  // folders/suites/cases, test cycles, defects) — the foreign keys are set to CASCADE.
  await prisma.project.delete({ where: { id: existing.id } });
  res.status(204).end();
});
