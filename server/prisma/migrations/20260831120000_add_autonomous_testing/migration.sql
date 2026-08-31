-- CreateEnum
CREATE TYPE "AutonomousRunStatus" AS ENUM ('Pending', 'Running', 'Completed', 'Failed', 'Cancelled');

-- CreateEnum
CREATE TYPE "AutonomousStageName" AS ENUM ('Initialization', 'Login', 'AuthVerification', 'Exploration', 'WorkflowDiscovery', 'ScenarioGeneration', 'BddGeneration', 'TestGeneration', 'TestCycleCreation', 'TestExecution', 'FailureAnalysis', 'DefectCreation', 'ReportGeneration');

-- CreateEnum
CREATE TYPE "AutonomousStageStatus" AS ENUM ('Pending', 'Running', 'Completed', 'Failed', 'Skipped', 'Cancelled');

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "autonomousRunId" TEXT;

-- AlterTable
ALTER TABLE "TestCycle" ADD COLUMN     "autonomousRunId" TEXT;

-- CreateTable
CREATE TABLE "AutonomousRun" (
    "id" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "appName" TEXT,
    "environment" TEXT,
    "instructions" TEXT,
    "maxDepth" INTEGER,
    "maxTests" INTEGER,
    "status" "AutonomousRunStatus" NOT NULL DEFAULT 'Pending',
    "currentStage" "AutonomousStageName",
    "discoveredPages" JSONB,
    "discoveredElements" JSONB,
    "workflows" JSONB,
    "scenarios" JSONB,
    "bddDocuments" JSONB,
    "report" JSONB,
    "pagesVisited" INTEGER NOT NULL DEFAULT 0,
    "actionsTaken" INTEGER NOT NULL DEFAULT 0,
    "testsGenerated" INTEGER NOT NULL DEFAULT 0,
    "testsExecuted" INTEGER NOT NULL DEFAULT 0,
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "testsFailed" INTEGER NOT NULL DEFAULT 0,
    "defectsCreated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutonomousRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomousStage" (
    "id" TEXT NOT NULL,
    "autonomousRunId" TEXT NOT NULL,
    "stage" "AutonomousStageName" NOT NULL,
    "status" "AutonomousStageStatus" NOT NULL DEFAULT 'Pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "logs" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutonomousStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutonomousRun_projectId_idx" ON "AutonomousRun"("projectId");

-- CreateIndex
CREATE INDEX "AutonomousRun_createdById_idx" ON "AutonomousRun"("createdById");

-- CreateIndex
CREATE INDEX "AutonomousRun_status_idx" ON "AutonomousRun"("status");

-- CreateIndex
CREATE INDEX "AutonomousStage_autonomousRunId_idx" ON "AutonomousStage"("autonomousRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomousStage_autonomousRunId_stage_key" ON "AutonomousStage"("autonomousRunId", "stage");

-- CreateIndex
CREATE INDEX "TestCase_autonomousRunId_idx" ON "TestCase"("autonomousRunId");

-- CreateIndex
CREATE INDEX "TestCycle_autonomousRunId_idx" ON "TestCycle"("autonomousRunId");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_autonomousRunId_fkey" FOREIGN KEY ("autonomousRunId") REFERENCES "AutonomousRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCycle" ADD CONSTRAINT "TestCycle_autonomousRunId_fkey" FOREIGN KEY ("autonomousRunId") REFERENCES "AutonomousRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomousRun" ADD CONSTRAINT "AutonomousRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomousRun" ADD CONSTRAINT "AutonomousRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomousStage" ADD CONSTRAINT "AutonomousStage_autonomousRunId_fkey" FOREIGN KEY ("autonomousRunId") REFERENCES "AutonomousRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
