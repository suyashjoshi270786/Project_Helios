-- CreateEnum
CREATE TYPE "ApiTestResult" AS ENUM ('Pass', 'Fail', 'Error', 'Blocked', 'Skipped');

-- AlterTable
ALTER TABLE "ApiExecution" ADD COLUMN     "overallResult" "ApiTestResult",
ADD COLUMN     "retestOfId" TEXT;

-- CreateIndex
CREATE INDEX "ApiExecution_retestOfId_idx" ON "ApiExecution"("retestOfId");

-- AddForeignKey
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_retestOfId_fkey" FOREIGN KEY ("retestOfId") REFERENCES "ApiExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
