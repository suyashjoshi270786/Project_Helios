-- DropForeignKey
ALTER TABLE "Defect" DROP CONSTRAINT "Defect_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Defect" DROP CONSTRAINT "Defect_createdById_fkey";

-- DropForeignKey
ALTER TABLE "TestStepExecutionDefect" DROP CONSTRAINT "TestStepExecutionDefect_testStepExecutionId_fkey";

-- DropForeignKey
ALTER TABLE "TestStepExecutionDefect" DROP CONSTRAINT "TestStepExecutionDefect_defectId_fkey";

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN     "actualResult" TEXT,
ADD COLUMN     "environment" TEXT,
ADD COLUMN     "expectedResult" TEXT,
ADD COLUMN     "severity" TEXT,
ADD COLUMN     "stepsToReproduce" TEXT;

-- DropTable
DROP TABLE "Defect";

-- DropTable
DROP TABLE "TestStepExecutionDefect";

-- DropEnum
DROP TYPE "DefectStatus";

-- CreateTable
CREATE TABLE "WorkItemStepLink" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "testStepExecutionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemStepLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkItemStepLink_testStepExecutionId_idx" ON "WorkItemStepLink"("testStepExecutionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemStepLink_workItemId_testStepExecutionId_key" ON "WorkItemStepLink"("workItemId", "testStepExecutionId");

-- AddForeignKey
ALTER TABLE "WorkItemStepLink" ADD CONSTRAINT "WorkItemStepLink_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemStepLink" ADD CONSTRAINT "WorkItemStepLink_testStepExecutionId_fkey" FOREIGN KEY ("testStepExecutionId") REFERENCES "TestStepExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

