import { prisma } from "./prisma.js";

export class UserDeletionError extends Error {}

// Most of the FK graph already cascades or sets null on user deletion
// (TeamMember/PasswordResetToken/ApiToken cascade; WorkItem assignee/reporter
// set null) — the only blockers are the createdById/approvedById/invitedById
// attribution columns, which default to Restrict. This walks every team and
// project the user touched and reassigns attribution to that team's owner
// before deleting the account, so a departing person's real work (projects,
// requirements, test cases, ...) stays intact for the team.
export async function reassignAndDeleteUser(targetUserId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const ownedTeams = await tx.teamMember.findMany({
      where: { userId: targetUserId, role: "Owner" },
      select: { teamId: true },
    });
    for (const { teamId } of ownedTeams) {
      const ownerCount = await tx.teamMember.count({ where: { teamId, role: "Owner" } });
      if (ownerCount <= 1) {
        throw new UserDeletionError("This person is the sole owner of a team — promote someone else first.");
      }
    }

    // Teams they personally created — hand attribution to another owner/admin.
    const createdTeams = await tx.team.findMany({ where: { createdById: targetUserId } });
    for (const team of createdTeams) {
      const replacement = await tx.teamMember.findFirst({
        where: { teamId: team.id, userId: { not: targetUserId }, role: { in: ["Owner", "Admin"] } },
        orderBy: { joinedAt: "asc" },
      });
      if (!replacement) {
        throw new UserDeletionError(`No other owner/admin exists on "${team.name}" to reassign it to.`);
      }
      await tx.team.update({ where: { id: team.id }, data: { createdById: replacement.userId } });
    }

    const affectedProjects = await tx.project.findMany({
      where: {
        OR: [
          { createdById: targetUserId },
          { requirements: { some: { createdById: targetUserId } } },
          { testPlans: { some: { createdById: targetUserId } } },
          { folders: { some: { createdById: targetUserId } } },
          { testSuites: { some: { createdById: targetUserId } } },
          { testCases: { some: { createdById: targetUserId } } },
          { testCycles: { some: { createdById: targetUserId } } },
          { workItems: { some: { createdById: targetUserId } } },
          { sprints: { some: { createdById: targetUserId } } },
        ],
      },
      select: { id: true, team: { select: { createdById: true } } },
    });

    for (const project of affectedProjects) {
      const reassignToId = project.team.createdById;
      if (reassignToId === targetUserId) continue; // already reassigned above; defensive skip

      const where = { projectId: project.id, createdById: targetUserId };
      await tx.project.updateMany({ where: { id: project.id, createdById: targetUserId }, data: { createdById: reassignToId } });
      await tx.requirement.updateMany({ where, data: { createdById: reassignToId } });
      await tx.testPlan.updateMany({ where, data: { createdById: reassignToId } });
      // An approval shouldn't be silently reattributed to someone who didn't approve it.
      await tx.testPlan.updateMany({ where: { projectId: project.id, approvedById: targetUserId }, data: { approvedById: null } });
      await tx.folder.updateMany({ where, data: { createdById: reassignToId } });
      await tx.testSuite.updateMany({ where, data: { createdById: reassignToId } });
      await tx.testCase.updateMany({ where, data: { createdById: reassignToId } });
      await tx.testCycle.updateMany({ where, data: { createdById: reassignToId } });
      await tx.workItem.updateMany({ where, data: { createdById: reassignToId } });
      await tx.sprint.updateMany({ where, data: { createdById: reassignToId } });
    }

    // Pending/sent invites they issued, on any team — attribution-only, safe to drop.
    await tx.teamInvite.deleteMany({ where: { invitedById: targetUserId } });

    await tx.user.delete({ where: { id: targetUserId } });
  });
}
