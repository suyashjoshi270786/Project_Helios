import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { friendlyValidationError } from "../lib/validation.js";
import { accessibleProjectsWhere, findAccessibleProject, getUserTeamIds, isProjectManager, isProjectOwner, isWriteRole } from "../lib/access.js";
import { MODULE_KEYS } from "../lib/modules.js";
import { generateTemporaryPassword } from "../lib/password.js";
import { sendNewAccountEmail } from "../lib/email.js";

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
  if (!(await isWriteRole(req.userId!, resolvedTeamId))) {
    return res.status(403).json({ error: "Only owners and admins can create projects. Ask one to add you to a project." });
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

// Deliberately minimal — no role, no modules, no scope — so it stays safe to
// expose to any project member (not just the Owner) for legitimate
// "assign this to someone" pickers like Work Items' assignee/reporter
// fields. This is a real project roster (team-wide members plus this
// project's own ProjectMember grants), not the whole team's, so it's also
// more accurate than the old cross-team lookup it replaces.
projectsRouter.get("/:id/assignable-members", async (req, res) => {
  const project = await findAccessibleProject(req.userId!, req.params.id);
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  const [teamWideMembers, projectMembers] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId: project.teamId, isProjectScoped: false },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);

  const seen = new Set<string>();
  const members: { id: string; name: string; email: string; avatarUrl: string | null }[] = [];
  for (const m of [...teamWideMembers, ...projectMembers]) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    members.push(m.user);
  }
  res.json(members);
});

// Owner-only, even for an Admin who manages this exact project — visibility
// into who has access is deliberately narrower than the ability to grant it
// (see isProjectManager vs isProjectOwner in lib/access.ts).
projectsRouter.get("/:id/members", async (req, res) => {
  if (!(await isProjectOwner(req.userId!, req.params.id))) {
    return res.status(403).json({ error: "Only this project's team owner can see who has access." });
  }
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  const [teamWideMembers, projectMembers] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId: project.teamId, isProjectScoped: false },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);

  // A team-wide member always wins the "scope" label over a stray
  // project-scoped grant for the same person — team-wide is the broader,
  // more accurate description of their actual access.
  const seen = new Set<string>();
  const members: { id: string; name: string; email: string; avatarUrl: string | null; role: string; scope: "team" | "project" }[] = [];
  for (const m of teamWideMembers) {
    seen.add(m.userId);
    members.push({ ...m.user, role: m.role, scope: "team" });
  }
  for (const m of projectMembers) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    members.push({ ...m.user, role: m.role, scope: "project" });
  }
  res.json(members);
});

const projectInviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["Admin", "Member"]).default("Member"),
  modules: z.array(z.enum(MODULE_KEYS)).default([]),
});

// Grants access to exactly this one project — never the whole team. Gated by
// isProjectManager (Owner, or an Admin who already manages this project), not
// isProjectOwner: an Admin can add people here despite not being able to see
// GET /:id/members above, per the explicit product decision behind this
// feature (write without read).
projectsRouter.post("/:id/invites", async (req, res) => {
  const parsed = projectInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  if (!(await isProjectManager(req.userId!, req.params.id))) {
    return res.status(403).json({ error: "Only this project's owner or admin can add people." });
  }
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }

  // Admins/Owners always have full access regardless of this list — it only
  // constrains a plain Member, same convention as the team-wide invite route.
  const modules = parsed.data.role === "Member" ? parsed.data.modules : [];
  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (existingUser) {
    const [existingMembership, existingProjectMember] = await Promise.all([
      prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: project.teamId, userId: existingUser.id } } }),
      prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: project.id, userId: existingUser.id } } }),
    ]);
    if (existingProjectMember || (existingMembership && !existingMembership.isProjectScoped)) {
      return res.status(409).json({ error: "That person already has access to this project." });
    }

    if (existingMembership) {
      // Already on this team via an earlier project-scoped invite (to a
      // *different* project) — just add this project too. Their existing
      // TeamMember is never touched, so nothing else they can already
      // access changes, and they can already log in with their own password.
      await prisma.projectMember.create({ data: { projectId: project.id, userId: existingUser.id, role: parsed.data.role } });
      return res.status(201).json({ email: parsed.data.email });
    }

    // Has an account (from some other team entirely) but isn't on this
    // team at all yet — same one-time temp-password reissue pattern as the
    // team-wide invite route, since this admin/owner shouldn't need to know
    // or guess that person's existing password.
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: existingUser.id }, data: { passwordHash, mustChangePassword: true } }),
      prisma.teamMember.create({ data: { teamId: project.teamId, userId: existingUser.id, role: parsed.data.role, modules, isProjectScoped: true } }),
      prisma.projectMember.create({ data: { projectId: project.id, userId: existingUser.id, role: parsed.data.role } }),
    ]);
    const frontendOrigin = process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";
    try {
      await sendNewAccountEmail(parsed.data.email, parsed.data.name, parsed.data.email, temporaryPassword, `${frontendOrigin}/login`);
    } catch (err) {
      console.error("Failed to send new account email:", err);
    }
    return res.status(201).json({ email: parsed.data.email, temporaryPassword });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      mustChangePassword: true,
      teamMemberships: { create: { teamId: project.teamId, role: parsed.data.role, modules, isProjectScoped: true } },
      projectMemberships: { create: { projectId: project.id, role: parsed.data.role } },
    },
  });

  const frontendOrigin = process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";
  try {
    await sendNewAccountEmail(parsed.data.email, parsed.data.name, parsed.data.email, temporaryPassword, `${frontendOrigin}/login`);
  } catch (err) {
    console.error("Failed to send new account email:", err);
  }
  res.status(201).json({ email: parsed.data.email, temporaryPassword });
});
