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
import { sprintsRouter } from "./routes/sprints.js";
import { teamsRouter } from "./routes/teams.js";
import { apiTokensRouter } from "./routes/apiTokens.js";
import { sqlConsoleRouter } from "./routes/sqlConsole.js";
import { usersRouter } from "./routes/users.js";
import { accessRequestsRouter } from "./routes/accessRequests.js";
import { autonomousTestingRouter } from "./routes/autonomousTesting.js";
import { apiStudioRouter } from "./routes/apiStudio.js";
import { reconcileStuckRunsOnBoot } from "./autonomous/index.js";

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

// Only the credential-guessing surface needs throttling — /api/auth/me is a
// lightweight session check every page load makes, and rate-limiting it
// alongside login/register would log real users out during normal use.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  "/api/auth",
  (req, res, next) => {
    const throttled = ["/login", "/register", "/forgot-password", "/reset-password"];
    if (throttled.includes(req.path)) return authRateLimit(req, res, next);
    next();
  },
  authRouter,
);

// A guessed or leaked API token is the same kind of credential-guessing risk
// as a login attempt — throttle any request bearing one, everywhere, the
// same way login/register already are.
const apiTokenRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use((req, res, next) => {
  if (req.headers.authorization?.startsWith("Bearer ")) return apiTokenRateLimit(req, res, next);
  next();
});

app.use("/api/api-tokens", apiTokensRouter);
app.use("/api/sql-console", sqlConsoleRouter);
app.use("/api/users", usersRouter);
app.use("/api/access-requests", accessRequestsRouter);
app.use("/api/requirements", requirementsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/test-plans", testPlansRouter);
app.use("/api/folders", foldersRouter);
app.use("/api/test-suites", testSuitesRouter);
app.use("/api/test-cases", testCasesRouter);
app.use("/api/test-cycles", testCyclesRouter);
app.use("/api/test-executions", testExecutionsRouter);
app.use("/api/work-items", workItemsRouter);
app.use("/api/sprints", sprintsRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/autonomous-testing", autonomousTestingRouter);
app.use("/api/api-studio", apiStudioRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Last-resort safety net: catches anything a route didn't handle itself
// (Express 5 forwards a rejected async handler's promise here automatically).
// Without this, an unexpected error either leaks raw details to the client
// or returns a body with no `error` field, which is exactly what made the
// frontend fall back to its own generic "Something went wrong" text with no
// way to tell what actually happened. This logs the real error server-side
// and always answers with the same clean, non-technical JSON shape every
// other route already uses.
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`Unhandled error on ${req.method} ${req.path}:`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on our end. Please try again." });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`HeliosQE API listening on http://localhost:${port}`);
});

// If the process restarted mid-run (e.g. a Render free-tier cold
// start/restart), any AutonomousRun left "Running" in the DB is orphaned —
// no in-memory cancellation/timing handle survives a restart. Mark those
// Failed instead of leaving them stuck forever. No-op when there are none.
reconcileStuckRunsOnBoot().catch((err) => {
  console.error("[autonomous] Failed to reconcile stuck runs on boot:", err);
});
