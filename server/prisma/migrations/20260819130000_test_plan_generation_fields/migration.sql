-- DropIndex
DROP INDEX "TestPlan_projectId_planCode_key";

-- AlterTable
ALTER TABLE "TestPlan"
  ADD COLUMN "aiProvider" TEXT NOT NULL DEFAULT 'gemini',
  ADD COLUMN "documentFormats" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "generatedContent" JSONB,
  ADD COLUMN "generatedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TestPlan_projectId_planCode_version_key" ON "TestPlan"("projectId", "planCode", "version");

-- CreateIndex
CREATE INDEX "TestPlan_approvedById_idx" ON "TestPlan"("approvedById");

-- AddForeignKey
ALTER TABLE "TestPlan" ADD CONSTRAINT "TestPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
