import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { authRouter } from "./routes/auth.js";
import { requirementsRouter } from "./routes/requirements.js";
import { projectsRouter } from "./routes/projects.js";
import { testPlansRouter } from "./routes/testPlans.js";
import { foldersRouter } from "./routes/folders.js";
import { testSuitesRouter } from "./routes/testSuites.js";
import { testCasesRouter } from "./routes/testCases.js";
import { testCyclesRouter } from "./routes/testCycles.js";
import { testExecutionsRouter } from "./routes/testExecutions.js";
import { workItemsRouter } from "./routes/workItems.js";

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
app.use("/api/projects", projectsRouter);
app.use("/api/test-plans", testPlansRouter);
app.use("/api/folders", foldersRouter);
app.use("/api/test-suites", testSuitesRouter);
app.use("/api/test-cases", testCasesRouter);
app.use("/api/test-cycles", testCyclesRouter);
app.use("/api/test-executions", testExecutionsRouter);
app.use("/api/work-items", workItemsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`HeliosQE API listening on http://localhost:${port}`);
});
