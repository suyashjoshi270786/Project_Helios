import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { sendAccessRequestEmail, sendNewAccountEmail } from "../lib/email.js";
import { friendlyValidationError } from "../lib/validation.js";
import { getUserTeamIds, isWriteRole } from "../lib/access.js";
import { MODULE_KEYS } from "../lib/modules.js";
import { generateTemporaryPassword } from "../lib/password.js";

export const accessRequestsRouter = Router();

async function isAdminOfAnyTeam(userId: string): Promise<boolean> {
  const teamIds = await getUserTeamIds(userId);
  const checks = await Promise.all(teamIds.map((teamId) => isWriteRole(userId, teamId)));
  return checks.some(Boolean);
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  reason: z.string().max(1000).optional(),
});

// Public — self-registration is disabled, so this is the only way a new
// person gets on HeliosQE's radar. An Owner/Admin reviews and provisions
// the account from the Team page.
accessRequestsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists — try signing in instead." });
  }

  await prisma.accessRequest.create({ data: parsed.data });

  const notifyTo = process.env.ACCESS_REQUEST_NOTIFY_EMAIL || "suyash.joshi27@gmail.com";
  try {
    await sendAccessRequestEmail(notifyTo, parsed.data.name, parsed.data.email, parsed.data.reason);
  } catch (err) {
    console.error("Failed to send access request notification:", err);
  }

  res.status(201).json({ message: "Thanks — we'll be in touch once your access is approved." });
});

accessRequestsRouter.use(requireAuth);

accessRequestsRouter.get("/", async (req, res) => {
  if (!(await isAdminOfAnyTeam(req.userId!))) {
    return res.status(403).json({ error: "Only a team owner or admin can review access requests." });
  }
  const requests = await prisma.accessRequest.findMany({
    where: { status: "Pending" },
    orderBy: { createdAt: "asc" },
  });
  res.json(requests);
});

const approveSchema = z.object({
  teamId: z.string().min(1),
  role: z.enum(["Admin", "Member"]).default("Member"),
  modules: z.array(z.enum(MODULE_KEYS)).default([]),
});

accessRequestsRouter.post("/:id/approve", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error) });
  }
  if (!(await isWriteRole(req.userId!, parsed.data.teamId))) {
    return res.status(403).json({ error: "Only that team's owner or admin can approve access into it." });
  }

  const request = await prisma.accessRequest.findFirst({ where: { id: req.params.id, status: "Pending" } });
  if (!request) {
    return res.status(404).json({ error: "That request is no longer pending." });
  }
  const existing = await prisma.user.findUnique({ where: { email: request.email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  await prisma.$transaction([
    prisma.user.create({
      data: {
        email: request.email,
        name: request.name,
        passwordHash,
        mustChangePassword: true,
        teamMemberships: {
          create: {
            teamId: parsed.data.teamId,
            role: parsed.data.role,
            modules: parsed.data.role === "Member" ? parsed.data.modules : [],
          },
        },
      },
    }),
    prisma.accessRequest.update({
      where: { id: request.id },
      data: { status: "Approved", reviewedById: req.userId!, reviewedAt: new Date() },
    }),
  ]);

  const frontendOrigin = process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";
  try {
    await sendNewAccountEmail(request.email, request.name, request.email, temporaryPassword, `${frontendOrigin}/login`);
  } catch (err) {
    console.error("Failed to send new account email:", err);
  }

  // Also handed back directly (not just emailed) — email delivery to anyone
  // but the account holder's own inbox isn't guaranteed (e.g. Resend's sandbox
  // mode without a verified sending domain), so the admin can always relay
  // these manually rather than being blocked on that working.
  res.status(201).json({ email: request.email, temporaryPassword, loginUrl: `${frontendOrigin}/login` });
});

accessRequestsRouter.post("/:id/deny", async (req, res) => {
  if (!(await isAdminOfAnyTeam(req.userId!))) {
    return res.status(403).json({ error: "Only a team owner or admin can review access requests." });
  }
  const request = await prisma.accessRequest.findFirst({ where: { id: req.params.id, status: "Pending" } });
  if (!request) {
    return res.status(404).json({ error: "That request is no longer pending." });
  }
  await prisma.accessRequest.update({
    where: { id: request.id },
    data: { status: "Denied", reviewedById: req.userId!, reviewedAt: new Date() },
  });
  res.status(204).end();
});
