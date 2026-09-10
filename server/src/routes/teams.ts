import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { sendNewAccountEmail } from "../lib/email.js";
import { friendlyValidationError } from "../lib/validation.js";
import { MODULE_KEYS } from "../lib/modules.js";
import { generateTemporaryPassword } from "../lib/password.js";
import { PLATFORM_OWNER_EMAIL } from "../lib/platformOwner.js";

export const teamsRouter = Router();

async function requireMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
}

teamsRouter.use(requireAuth);

teamsRouter.get("/", async (req, res) => {
  const memberships = await prisma.teamMember.findMany({
    where: { userId: req.userId },
    include: { team: { include: { _count: { select: { members: true, projects: true } } } } },
    orderBy: { joinedAt: "asc" },
  });
  res.json(
    memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
      memberCount: m.team._count.members,
      projectCount: m.team._count.projects,
    })),
  );
});

const createTeamSchema = z.object({ name: z.string().min(1) });

// HeliosQE has exactly one platform Owner — creating a brand new team
// (and therefore becoming its Owner) is restricted to that account so a
// second "Owner" can never appear anywhere in the system.
teamsRouter.post("/", async (req, res) => {
  const caller = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (caller?.email !== PLATFORM_OWNER_EMAIL) {
    return res.status(403).json({ error: "Only the platform owner can create additional teams." });
  }
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      createdById: req.userId!,
      members: { create: { userId: req.userId!, role: "Owner" } },
    },
  });
  res.status(201).json({ id: team.id, name: team.name, role: "Owner", memberCount: 1, projectCount: 0 });
});

// Genuinely destructive — Team -> Project cascades, so this removes every
// project (and everything inside them: requirements, test cases, work
// items, ...) that belongs to the team, not just the team row itself.
// Owner-only, and the frontend requires typing the team's name to confirm.
teamsRouter.delete("/:id", async (req, res) => {
  const membership = await requireMembership(req.params.id, req.userId!);
  if (!membership || membership.role !== "Owner") {
    return res.status(403).json({ error: "Only the team owner can delete a team." });
  }
  await prisma.team.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// Owner-only — an Admin or Member can no longer browse the team roster, even
// to see other Admins. This intentionally makes "who's on this team" opaque
// to everyone but the Owner; Admins keep the ability to invite people (see
// POST /:id/invites below) without being able to see who's already there.
teamsRouter.get("/:id/members", async (req, res) => {
  const membership = await requireMembership(req.params.id, req.userId!);
  if (!membership) return res.status(404).json({ error: "Team not found." });
  if (membership.role !== "Owner") {
    return res.status(403).json({ error: "Only the team owner can see who has access." });
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  });
  res.json(members.map((m) => ({ ...m.user, role: m.role, modules: m.modules, joinedAt: m.joinedAt })));
});

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["Admin", "Member"]).default("Member"),
  modules: z.array(z.enum(MODULE_KEYS)).default([]),
});

// Adding someone to a team is immediate, not a pending-link flow, and it
// always hands back a fresh temp password for the caller to relay — the
// same one-time-reveal pattern as approving an access request, since
// self-registration is closed and email delivery isn't guaranteed to
// work. This applies even if the email already has an account (e.g.
// someone being re-granted access after being removed): the owner/admin
// doing the granting shouldn't have to know or guess that person's old
// password, so a new one is issued every time.
teamsRouter.post("/:id/invites", async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  const membership = await requireMembership(req.params.id, req.userId!);
  if (!membership || membership.role === "Member") {
    return res.status(403).json({ error: "Only team owners and admins can add people." });
  }

  const team = await prisma.team.findUnique({ where: { id: req.params.id } });
  if (!team) return res.status(404).json({ error: "Team not found." });

  // Admins/Owners always have full access regardless of this list — it
  // only constrains a plain Member.
  const modules = parsed.data.role === "Member" ? parsed.data.modules : [];

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) {
    const alreadyMember = await requireMembership(team.id, existingUser.id);
    if (alreadyMember) {
      return res.status(409).json({ error: "That person is already on this team." });
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: existingUser.id }, data: { passwordHash, mustChangePassword: true } }),
      prisma.teamMember.create({ data: { teamId: team.id, userId: existingUser.id, role: parsed.data.role, modules } }),
    ]);
  } else {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        mustChangePassword: true,
        teamMemberships: { create: { teamId: team.id, role: parsed.data.role, modules } },
      },
    });
  }

  const frontendOrigin = process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";
  try {
    await sendNewAccountEmail(parsed.data.email, parsed.data.name, parsed.data.email, temporaryPassword, `${frontendOrigin}/login`);
  } catch (err) {
    console.error("Failed to send new account email:", err);
  }

  res.status(201).json({ email: parsed.data.email, temporaryPassword });
});

const memberUpdateSchema = z.object({
  role: z.enum(["Owner", "Admin", "Member"]).optional(),
  modules: z.array(z.enum(MODULE_KEYS)).optional(),
});

teamsRouter.patch("/:id/members/:userId", async (req, res) => {
  const parsed = memberUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  const membership = await requireMembership(req.params.id, req.userId!);
  if (!membership || membership.role !== "Owner") {
    return res.status(403).json({ error: "Only the team owner can change roles or permissions." });
  }
  const target = await requireMembership(req.params.id, req.params.userId);
  if (!target) return res.status(404).json({ error: "That person isn't on this team." });

  if (parsed.data.role === "Owner") {
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (targetUser?.email !== PLATFORM_OWNER_EMAIL) {
      return res.status(403).json({ error: `Only ${PLATFORM_OWNER_EMAIL} can hold the Owner role.` });
    }
  }

  if (parsed.data.role && target.role === "Owner" && parsed.data.role !== "Owner") {
    const ownerCount = await prisma.teamMember.count({ where: { teamId: req.params.id, role: "Owner" } });
    if (ownerCount <= 1) {
      return res.status(409).json({ error: "A team needs at least one owner." });
    }
  }

  await prisma.teamMember.update({
    where: { id: target.id },
    data: { ...(parsed.data.role ? { role: parsed.data.role } : {}), ...(parsed.data.modules ? { modules: parsed.data.modules } : {}) },
  });
  res.status(204).end();
});

teamsRouter.delete("/:id/members/:userId", async (req, res) => {
  const membership = await requireMembership(req.params.id, req.userId!);
  const isSelf = req.params.userId === req.userId;
  if (!membership || (membership.role === "Member" && !isSelf)) {
    return res.status(403).json({ error: "Only team owners and admins can remove members." });
  }
  const target = await requireMembership(req.params.id, req.params.userId);
  if (!target) return res.status(404).json({ error: "That person isn't on this team." });

  if (target.role === "Owner") {
    const ownerCount = await prisma.teamMember.count({ where: { teamId: req.params.id, role: "Owner" } });
    if (ownerCount <= 1) {
      return res.status(409).json({ error: "A team needs at least one owner — promote someone else first." });
    }
  }

  await prisma.teamMember.delete({ where: { id: target.id } });
  res.status(204).end();
});
