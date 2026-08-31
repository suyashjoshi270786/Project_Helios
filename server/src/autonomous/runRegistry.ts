import { prisma } from "../lib/prisma.js";

type RunHandle = { cancelled: boolean; startedAt: number };

// In-memory only — this process is the sole owner of any run it starts (no
// job queue/worker infra exists in this codebase, see the implementation
// plan's "Deliberately Deferred" section). A run's cancellation flag and
// start time live here for the duration of the process only.
const runs = new Map<string, RunHandle>();

export function registerRun(runId: string) {
  runs.set(runId, { cancelled: false, startedAt: Date.now() });
}

export function requestCancel(runId: string): boolean {
  const handle = runs.get(runId);
  if (!handle) return false;
  handle.cancelled = true;
  return true;
}

export function isCancelled(runId: string): boolean {
  return runs.get(runId)?.cancelled ?? false;
}

export function elapsedMs(runId: string): number {
  const handle = runs.get(runId);
  return handle ? Date.now() - handle.startedAt : 0;
}

export function unregisterRun(runId: string) {
  runs.delete(runId);
}

// Called once at process boot. If the server restarted mid-run (Render
// free-tier cold start/restart), any run still marked Running in the DB is
// now orphaned — no in-memory handle exists for it and it will never
// progress. Mark it Failed rather than leaving it stuck forever.
export async function reconcileStuckRunsOnBoot() {
  const stuck = await prisma.autonomousRun.findMany({
    where: { status: "Running" },
    select: { id: true, currentStage: true },
  });
  for (const run of stuck) {
    await prisma.$transaction([
      prisma.autonomousRun.update({
        where: { id: run.id },
        data: {
          status: "Failed",
          errorMessage: "Run interrupted by a server restart before it could complete.",
          completedAt: new Date(),
        },
      }),
      prisma.autonomousStage.updateMany({
        where: { autonomousRunId: run.id, status: "Running" },
        data: { status: "Failed", error: "Interrupted by a server restart.", completedAt: new Date() },
      }),
    ]);
  }
  if (stuck.length > 0) {
    console.warn(`[autonomous] Reconciled ${stuck.length} run(s) left Running from a previous process.`);
  }
}
