import { promises as fs } from "fs";
import path from "path";

// Local disk only for v1 — no object-storage precedent exists anywhere in
// this codebase (see the implementation plan's "Deliberately Deferred"
// section). Gitignored, one subfolder per run.
const BASE_DIR = path.join(process.cwd(), "uploads", "autonomous");

async function ensureRunDir(runId: string): Promise<string> {
  const dir = path.join(BASE_DIR, runId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveScreenshot(runId: string, name: string, buffer: Buffer): Promise<string> {
  const dir = await ensureRunDir(runId);
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(dir, `${safeName}.png`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}
