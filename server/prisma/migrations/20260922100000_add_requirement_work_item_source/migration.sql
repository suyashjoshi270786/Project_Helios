-- CreateEnum
CREATE TYPE "RequirementSource" AS ENUM ('Document', 'WorkItem');

-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "primarySourceWorkItemId" TEXT,
ADD COLUMN     "sourceType" "RequirementSource" NOT NULL DEFAULT 'Document';

-- CreateTable
CREATE TABLE "RequirementWorkItem" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequirementWorkItem_workItemId_idx" ON "RequirementWorkItem"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementWorkItem_requirementId_workItemId_key" ON "RequirementWorkItem"("requirementId", "workItemId");

-- CreateIndex
CREATE INDEX "Requirement_primarySourceWorkItemId_idx" ON "Requirement"("primarySourceWorkItemId");

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_primarySourceWorkItemId_fkey" FOREIGN KEY ("primarySourceWorkItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementWorkItem" ADD CONSTRAINT "RequirementWorkItem_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementWorkItem" ADD CONSTRAINT "RequirementWorkItem_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
