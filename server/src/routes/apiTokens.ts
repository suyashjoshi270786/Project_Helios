import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { generateApiToken, hashApiToken } from "../lib/apiToken.js";
import { friendlyValidationError } from "../lib/validation.js";

export const apiTokensRouter = Router();
apiTokensRouter.use(requireAuth);

function toTokenSummary(token: {
  id: string;
  name: string;
  tokenHash: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  const { tokenHash, ...rest } = token;
  return { ...rest, lastFour: tokenHash.slice(-4) };
}

apiTokensRouter.get("/", async (req, res) => {
  const tokens = await prisma.apiToken.findMany({
    where: { userId: req.userId!, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  res.json(tokens.map(toTokenSummary));
});

const createTokenSchema = z.object({ name: z.string().min(1).max(60) });

apiTokensRouter.post("/", async (req, res) => {
  const parsed = createTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: friendlyValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const raw = generateApiToken();
  const token = await prisma.apiToken.create({
    data: { name: parsed.data.name, tokenHash: hashApiToken(raw), userId: req.userId! },
  });

  // The raw token is only ever returned here — it can't be retrieved again.
  res.status(201).json({ ...toTokenSummary(token), token: raw });
});

apiTokensRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.apiToken.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) {
    return res.status(404).json({ error: "Token not found." });
  }
  await prisma.apiToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  res.status(204).end();
});
