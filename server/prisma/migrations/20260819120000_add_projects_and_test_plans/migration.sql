-- CreateEnum
CREATE TYPE "TestPlanStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'GENERATING', 'GENERATED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "TestPlanPriority" AS ENUM ('Critical', 'High', 'Medium', 'Low');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPlan" (
    "id" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "previousVersionId" TEXT,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "status" "TestPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "testPhase" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "priority" "TestPlanPriority" NOT NULL DEFAULT 'Medium',
    "owner" TEXT NOT NULL,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "objective" TEXT NOT NULL,
    "testTypes" TEXT[],
    "otherTestType" TEXT,
    "inScope" TEXT[],
    "outOfScope" TEXT[],
    "testStrategy" JSONB,
    "testDataStrategy" JSONB,
    "environmentConfig" JSONB,
    "entryCriteria" JSONB,
    "exitCriteria" JSONB,
    "risks" JSONB,
    "dependencies" JSONB,
    "resources" JSONB,
    "schedule" JSONB,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPlanRequirement" (
    "id" TEXT NOT NULL,
    "testPlanId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestPlanRequirement_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add nullable projectId to Requirement first (backfilled by a
-- one-off script, then a follow-up migration sets it NOT NULL).
ALTER TABLE "Requirement" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "TestPlan_projectId_planCode_key" ON "TestPlan"("projectId", "planCode");

-- CreateIndex
CREATE INDEX "TestPlan_projectId_idx" ON "TestPlan"("projectId");

-- CreateIndex
CREATE INDEX "TestPlan_createdById_idx" ON "TestPlan"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "TestPlanRequirement_testPlanId_requirementId_key" ON "TestPlanRequirement"("testPlanId", "requirementId");

-- CreateIndex
CREATE INDEX "TestPlanRequirement_requirementId_idx" ON "TestPlanRequirement"("requirementId");

-- CreateIndex
CREATE INDEX "Requirement_projectId_idx" ON "Requirement"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPlan" ADD CONSTRAINT "TestPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPlan" ADD CONSTRAINT "TestPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPlanRequirement" ADD CONSTRAINT "TestPlanRequirement_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "TestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPlanRequirement" ADD CONSTRAINT "TestPlanRequirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
