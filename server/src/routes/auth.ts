import bcrypt from "bcrypt";
import crypto from "crypto";
import { Router, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { requireAuth, SESSION_COOKIE } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { sendPasswordResetEmail } from "../lib/email.js";
import { friendlyValidationError } from "../lib/validation.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Client-side resizes avatars to a small JPEG/PNG data URL before sending — this is a
// safety net against anything that bypasses that resize, not the primary size control.
const avatarUrlSchema = z
  .string()
  .max(1_500_000, "Image is too large.")
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Unsupported image format.");

const registerSchema = credentialsSchema.extend({
  name: z.string().min(1),
  role: z.string().min(1).max(100).optional(),
  avatarUrl: avatarUrlSchema.optional(),
});

const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().min(1).max(100).optional(),
  avatarUrl: avatarUrlSchema.nullable().optional(),
});

function toUserResponse(user: { id: string; email: string; name: string; role: string; avatarUrl: string | null }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl };
}

// Local dev: frontend (localhost:5173) and backend (localhost:4000) are different
// ports but the same site, so `lax` + non-secure works over plain HTTP.
// Production: frontend (Netlify) and backend (Render) are entirely different
// domains — a genuinely cross-site setup. Cross-site cookies require
// `SameSite=None`, and browsers reject `None` without `Secure`.
const isProd = process.env.NODE_ENV === "production";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};

function issueSession(res: Response, userId: string) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
  res.cookie(SESSION_COOKIE, token, COOKIE_OPTIONS);
}

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid name, email, and a password of at least 8 characters." });
  }
  const { email, password, name, role, avatarUrl } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, ...(role ? { role } : {}), avatarUrl },
  });

  issueSession(res, user.id);
  res.status(201).json(toUserResponse(user));
});

authRouter.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter both email and password." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  issueSession(res, user.id);
  res.json(toUserResponse(user));
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json(toUserResponse(user));
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error, "Invalid profile update.") });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: parsed.data,
  });
  res.json(toUserResponse(user));
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const forgotPasswordSchema = z.object({ email: z.string().email() });

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to check which emails are registered.
  const genericResponse = () =>
    res.json({ message: "If an account exists for that email, we've sent a password reset link." });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return genericResponse();
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const frontendOrigin = process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";
  const resetUrl = `${frontendOrigin}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    return res.status(500).json({ error: "Could not send the reset email. Please try again later." });
  }

  return genericResponse();
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid token and a password of at least 8 characters." });
  }
  const { token, password } = parsed.data;

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  res.status(204).end();
});
