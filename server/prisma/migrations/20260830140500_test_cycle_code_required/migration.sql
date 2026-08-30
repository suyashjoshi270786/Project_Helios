-- AlterTable
ALTER TABLE "TestCycle" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TestCycle_projectId_code_key" ON "TestCycle"("projectId", "code");

