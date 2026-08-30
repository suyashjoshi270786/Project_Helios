import { Router } from "express";
import bcrypt from "bcrypt";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { getUserTeamIds, isWriteRole } from "../lib/access.js";
import { reassignAndDeleteUser, UserDeletionError } from "../lib/userDeletion.js";
import { generateTemporaryPassword } from "../lib/password.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

type UserSummary = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  teams: { teamId: string; teamName: string; role: string }[];
};

// Scoped to people who share a team with the caller — an Admin can't reach
// into an unrelated org just because they know a user id.
usersRouter.get("/", async (req, res) => {
  const teamIds = await getUserTeamIds(req.userId!);
  const members = await prisma.teamMember.findMany({
    where: { teamId: { in: teamIds } },
    select: {
      role: true,
      teamId: true,
      team: { select: { name: true } },
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  const byUser = new Map<string, UserSummary>();
  for (const m of members) {
    const teamEntry = { teamId: m.teamId, teamName: m.team.name, role: m.role };
    const existing = byUser.get(m.user.id);
    if (existing) existing.teams.push(teamEntry);
    else byUser.set(m.user.id, { ...m.user, teams: [teamEntry] });
  }
  res.json([...byUser.values()]);
});

// Refuses (404) unless the caller shares a team with the target, then (403)
// unless the caller is Owner/Admin on at least one of those shared teams.
async function requireSharedTeamAdmin(callerId: string, targetId: string): Promise<string | null> {
  const [myTeamIds, targetTeamIds] = await Promise.all([getUserTeamIds(callerId), getUserTeamIds(targetId)]);
  const sharedTeamIds = myTeamIds.filter((id) => targetTeamIds.includes(id));
  if (sharedTeamIds.length === 0) {
    return "That user isn't on any of your teams.";
  }
  const writeChecks = await Promise.all(sharedTeamIds.map((teamId) => isWriteRole(callerId, teamId)));
  if (!writeChecks.some(Boolean)) {
    return "Only a team owner or admin can manage that account.";
  }
  return null;
}

// Never displays or stores the user's actual password — generates a fresh
// one, forces a change on next login, and hands it back once (same pattern
// as new-account provisioning) so an admin can relay it without depending
// on email delivery.
usersRouter.post("/:id/reset-password", async (req, res) => {
  const error = await requireSharedTeamAdmin(req.userId!, req.params.id);
  if (error) {
    return res.status(error.startsWith("That user") ? 404 : 403).json({ error });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash, mustChangePassword: true },
  });

  res.json({ email: user.email, temporaryPassword });
});

usersRouter.delete("/:id", async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: "You can't delete your own account from here." });
  }

  const sharedAdminError = await requireSharedTeamAdmin(req.userId!, req.params.id);
  if (sharedAdminError) {
    return res
      .status(sharedAdminError.startsWith("That user") ? 404 : 403)
      .json({ error: sharedAdminError.replace("manage", "delete") });
  }

  try {
    await reassignAndDeleteUser(req.params.id);
    res.status(204).end();
  } catch (err) {
    if (err instanceof UserDeletionError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});
