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

// A project is accessible either through team-wide membership (the
// long-standing default — isProjectScoped: false) or through an explicit
// ProjectMember grant for that exact project (the new project-scoped invite
// path, see routes/projects.ts). Expressible natively in Prisma since
// ProjectMember is a real relation on Project — no cross-relation field
// comparison needed, so every existing call site of this function (a plain
// synchronous where-fragment, embedded in ~13 other route files) keeps
// working unchanged.
export function accessibleProjectsWhere(userId: string) {
  return {
    OR: [
      { team: { members: { some: { userId, isProjectScoped: false } } } },
      { projectMembers: { some: { userId } } },
    ],
  };
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

// Owner or Admin, and actually has access to this specific project (Owner
// always does, by construction; an Admin might be project-scoped to a
// *different* project and shouldn't be able to manage this one). Gates the
// new project-level invite endpoint — an Admin can add people to a project
// they manage even though (per isProjectOwner below) they can't see who's
// already there.
export async function isProjectManager(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: project.teamId, userId } } });
  if (!membership || membership.role === "Member") return false;
  return hasProjectAccess(userId, projectId);
}

// Only the team's Owner — never an Admin, even one who manages this exact
// project — can see who has access to it. Owner is always team-wide by
// construction, so no separate hasProjectAccess check is needed here.
export async function isProjectOwner(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: project.teamId, userId } } });
  return membership?.role === "Owner";
}
