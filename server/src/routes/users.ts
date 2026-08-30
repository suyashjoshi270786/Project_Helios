import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { getUserTeamIds, isWriteRole } from "../lib/access.js";
import { reassignAndDeleteUser, UserDeletionError } from "../lib/userDeletion.js";

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

usersRouter.delete("/:id", async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: "You can't delete your own account from here." });
  }

  const [myTeamIds, targetTeamIds] = await Promise.all([
    getUserTeamIds(req.userId!),
    getUserTeamIds(req.params.id),
  ]);
  const sharedTeamIds = myTeamIds.filter((id) => targetTeamIds.includes(id));
  if (sharedTeamIds.length === 0) {
    return res.status(404).json({ error: "That user isn't on any of your teams." });
  }
  const writeChecks = await Promise.all(sharedTeamIds.map((teamId) => isWriteRole(req.userId!, teamId)));
  if (!writeChecks.some(Boolean)) {
    return res.status(403).json({ error: "Only a team owner or admin can delete a user account." });
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
