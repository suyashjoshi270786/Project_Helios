import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { authRouter } from "./routes/auth.js";
import { requirementsRouter } from "./routes/requirements.js";

const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authRateLimit, authRouter);
app.use("/api/requirements", requirementsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`HeliosQE API listening on http://localhost:${port}`);
});
