import { prisma } from "./prisma.js";
import type { ModuleKey } from "./modules.js";

// Every project belongs to exactly one Team; a user can see and act on a
// project iff they're a member of that team. This replaces the old
// "createdById === req.userId" checks everywhere — visibility is now
// per-team, not per-creator, so any teammate can see records another
// teammate created within a shared project.
//
// On top of team membership, an Owner/Admin can restrict a plain Member to
// only specific modules (TeamMember.modules) — Owners and Admins themselves
// always have full access, since they're the ones granting it.

export function accessibleProjectsWhere(userId: string) {
  return { team: { members: { some: { userId } } } };
}

async function memberModuleAllowed(userId: string, teamId: string, module?: ModuleKey): Promise<boolean> {
  if (!module) return true;
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
  if (!membership) return false;
  if (membership.role !== "Member") return true;
  return membership.modules.includes(module);
}

export async function findAccessibleProject(userId: string, projectId: string, module?: ModuleKey) {
  const project = await prisma.project.findFirst({ where: { id: projectId, ...accessibleProjectsWhere(userId) } });
  if (!project) return null;
  if (!(await memberModuleAllowed(userId, project.teamId, module))) return null;
  return project;
}

export async function hasProjectAccess(userId: string, projectId: string, module?: ModuleKey): Promise<boolean> {
  return !!(await findAccessibleProject(userId, projectId, module));
}

export async function getUserTeamIds(userId: string): Promise<string[]> {
  const memberships = await prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } });
  return memberships.map((m) => m.teamId);
}

// A second axis on top of per-module access: within a module a Member has,
// some actions (renaming, direct priority/estimate edits, reordering,
// deleting) are still Owner/Admin-only — a Member can view everything and
// move work through its normal status/sprint workflow, but not restructure
// it directly. Owners/Admins always pass, same as memberModuleAllowed.
export async function isWriteRole(userId: string, teamId: string): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
  return !!membership && membership.role !== "Member";
}
