-- CreateEnum
CREATE TYPE "ApiExecutionMode" AS ENUM ('Manual', 'Test', 'Cycle', 'Scheduled', 'CI');

-- AlterTable: ApiRequest additions (both safe on non-empty tables — one has
-- a default, the other is nullable).
ALTER TABLE "ApiRequest"
  ADD COLUMN "followRedirects" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedById" TEXT;

-- AlterTable: ApiExecution additions. projectId/correlationId are added
-- nullable first because this table already has real rows (from manual
-- testing) with no default value we could give them at add-column time —
-- backfill below, then tighten to NOT NULL.
ALTER TABLE "ApiExecution"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "errorCode" TEXT,
  ADD COLUMN "executionMode" "ApiExecutionMode" NOT NULL DEFAULT 'Manual',
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

-- Backfill existing rows.
UPDATE "ApiExecution" e
SET "projectId" = r."projectId"
FROM "ApiRequest" r
WHERE e."apiRequestId" = r."id" AND e."projectId" IS NULL;

-- Pre-existing single executions get their own id as their correlationId —
-- a reasonable default for a "batch of one".
UPDATE "ApiExecution" SET "correlationId" = "id" WHERE "correlationId" IS NULL;

-- The old executedAt is the best available approximation of both
-- start and completion for a pipeline that has always been synchronous.
UPDATE "ApiExecution" SET "startedAt" = "executedAt", "completedAt" = "executedAt" WHERE "startedAt" IS NULL;

-- Now safe to tighten.
ALTER TABLE "ApiExecution"
  ALTER COLUMN "projectId" SET NOT NULL,
  ALTER COLUMN "correlationId" SET NOT NULL,
  ALTER COLUMN "startedAt" SET NOT NULL,
  ALTER COLUMN "startedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "completedAt" SET NOT NULL,
  ALTER COLUMN "completedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ApiExecution" DROP COLUMN "executedAt";

-- CreateIndex
CREATE INDEX "ApiRequest_updatedById_idx" ON "ApiRequest"("updatedById");
CREATE INDEX "ApiExecution_projectId_idx" ON "ApiExecution"("projectId");
CREATE INDEX "ApiExecution_correlationId_idx" ON "ApiExecution"("correlationId");

-- AddForeignKey
ALTER TABLE "ApiRequest" ADD CONSTRAINT "ApiRequest_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
