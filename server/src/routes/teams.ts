import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { sendTeamInviteEmail } from "../lib/email.js";
import { friendlyValidationError } from "../lib/validation.js";
import { MODULE_KEYS } from "../lib/modules.js";

export const teamsRouter = Router();

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function requireMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
}

// Public — the invite token itself is the secret, so anyone holding the link
// can see who invited them and to what, before deciding whether to sign in.
teamsRouter.get("/invites/:token", async (req, res) => {
  const invite = await prisma.teamInvite.findUnique({
    where: { tokenHash: hashToken(req.params.token) },
    include: { team: { select: { name: true } }, invitedBy: { select: { name: true } } },
  });
  if (!invite || invite.status !== "Pending" || invite.expiresAt < new Date()) {
    return res.status(404).json({ error: "This invite link is invalid or has expired." });
  }
  res.json({
    teamName: invite.team.name,
    inviterName: invite.invitedBy.name,
    email: invite.email,
    role: invite.role,
  });
});

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

teamsRouter.post("/", async (req, res) => {
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

teamsRouter.get("/:id/members", async (req, res) => {
  const membership = await requireMembership(req.params.id, req.userId!);
  if (!membership) return res.status(404).json({ error: "Team not found." });

  const members = await prisma.teamMember.findMany({
    where: { teamId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  });
  res.json(members.map((m) => ({ ...m.user, role: m.role, modules: m.modules, joinedAt: m.joinedAt })));
});

teamsRouter.get("/:id/invites", async (req, res) => {
  const membership = await requireMembership(req.params.id, req.userId!);
  if (!membership || membership.role === "Member") {
    return res.status(403).json({ error: "Only team owners and admins can view invites." });
  }
  const invites = await prisma.teamInvite.findMany({
    where: { teamId: req.params.id, status: "Pending" },
    orderBy: { createdAt: "desc" },
  });
  res.json(invites.map(({ tokenHash: _tokenHash, ...invite }) => invite));
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["Admin", "Member"]).default("Member"),
  modules: z.array(z.enum(MODULE_KEYS)).default([]),
});

teamsRouter.post("/:id/invites", async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  const membership = await requireMembership(req.params.id, req.userId!);
  if (!membership || membership.role === "Member") {
    return res.status(403).json({ error: "Only team owners and admins can invite people." });
  }

  const team = await prisma.team.findUnique({ where: { id: req.params.id } });
  if (!team) return res.status(404).json({ error: "Team not found." });

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) {
    const alreadyMember = await requireMembership(team.id, existingUser.id);
    if (alreadyMember) {
      return res.status(409).json({ error: "That person is already on this team." });
    }
  }

  const inviter = await prisma.user.findUnique({ where: { id: req.userId! } });
  const token = crypto.randomBytes(32).toString("hex");

  await prisma.teamInvite.deleteMany({
    where: { teamId: team.id, email: parsed.data.email, status: "Pending" },
  });
  const invite = await prisma.teamInvite.create({
    data: {
      teamId: team.id,
      email: parsed.data.email,
      role: parsed.data.role,
      // Admins/Owners always have full access regardless of this list — it
      // only constrains a plain Member.
      modules: parsed.data.role === "Member" ? parsed.data.modules : [],
      tokenHash: hashToken(token),
      invitedById: req.userId!,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const frontendOrigin = process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";
  const inviteUrl = `${frontendOrigin}/invite/${token}`;

  try {
    await sendTeamInviteEmail(parsed.data.email, team.name, inviter!.name, inviteUrl);
  } catch (err) {
    console.error("Failed to send team invite email:", err);
  }

  res.status(201).json({ id: invite.id, email: invite.email, role: invite.role, status: invite.status });
});

teamsRouter.delete("/:id/invites/:inviteId", async (req, res) => {
  const membership = await requireMembership(req.params.id, req.userId!);
  if (!membership || membership.role === "Member") {
    return res.status(403).json({ error: "Only team owners and admins can revoke invites." });
  }
  await prisma.teamInvite.updateMany({
    where: { id: req.params.inviteId, teamId: req.params.id },
    data: { status: "Revoked" },
  });
  res.status(204).end();
});

const acceptSchema = z.object({}).optional();

teamsRouter.post("/invites/:token/accept", async (req, res) => {
  acceptSchema.parse(req.body);
  const invite = await prisma.teamInvite.findUnique({ where: { tokenHash: hashToken(req.params.token) } });
  if (!invite || invite.status !== "Pending" || invite.expiresAt < new Date()) {
    return res.status(404).json({ error: "This invite link is invalid or has expired." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (user!.email !== invite.email) {
    return res.status(403).json({ error: `This invite was sent to ${invite.email}, not your account.` });
  }

  await prisma.$transaction([
    prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: invite.teamId, userId: req.userId! } },
      create: { teamId: invite.teamId, userId: req.userId!, role: invite.role, modules: invite.modules },
      update: {},
    }),
    prisma.teamInvite.update({ where: { id: invite.id }, data: { status: "Accepted" } }),
  ]);

  const team = await prisma.team.findUnique({ where: { id: invite.teamId } });
  res.json({ teamId: invite.teamId, teamName: team?.name });
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
