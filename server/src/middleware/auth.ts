import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { hashApiToken } from "../lib/apiToken.js";

export const SESSION_COOKIE = "heliosqe_token";

type TokenPayload = { userId: string };

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Automation frameworks (CI runners, custom scripts) authenticate with a
// long-lived API token instead of a browser session — see routes/apiTokens.ts.
// The token inherits its creator's own team roles/module permissions, since
// downstream code only ever reads req.userId either way.
async function tryBearerToken(req: Request): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;

  const raw = header.slice("Bearer ".length).trim();
  if (!raw) return null;

  const apiToken = await prisma.apiToken.findUnique({ where: { tokenHash: hashApiToken(raw) } });
  if (!apiToken || apiToken.revokedAt) return null;

  prisma.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return apiToken.userId;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearerUserId = await tryBearerToken(req);
  if (bearerUserId) {
    req.userId = bearerUserId;
    return next();
  }

  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
