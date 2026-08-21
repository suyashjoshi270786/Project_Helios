-- CreateEnum
CREATE TYPE "TestCycleStatus" AS ENUM ('NotStarted', 'InProgress', 'Completed');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('NotExecuted', 'Pass', 'Fail', 'Blocked');

-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('Open', 'Closed');

-- CreateTable
CREATE TABLE "TestCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "testPhase" TEXT NOT NULL,
    "environment" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "owner" TEXT,
    "status" "TestCycleStatus" NOT NULL DEFAULT 'NotStarted',
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCycleTest" (
    "id" TEXT NOT NULL,
    "testCycleId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "environment" TEXT,
    "tester" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCycleTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestExecution" (
    "id" TEXT NOT NULL,
    "testCycleTestId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'NotExecuted',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestStepExecution" (
    "id" TEXT NOT NULL,
    "testExecutionId" TEXT NOT NULL,
    "testStepId" TEXT,
    "stepNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "testData" TEXT,
    "expectedResult" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'NotExecuted',
    "actualResult" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestStepExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Defect" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DefectStatus" NOT NULL DEFAULT 'Open',
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Defect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestStepExecutionDefect" (
    "id" TEXT NOT NULL,
    "testStepExecutionId" TEXT NOT NULL,
    "defectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestStepExecutionDefect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCycle_projectId_idx" ON "TestCycle"("projectId");

-- CreateIndex
CREATE INDEX "TestCycle_createdById_idx" ON "TestCycle"("createdById");

-- CreateIndex
CREATE INDEX "TestCycleTest_testCaseId_idx" ON "TestCycleTest"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCycleTest_testCycleId_testCaseId_key" ON "TestCycleTest"("testCycleId", "testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "TestExecution_testCycleTestId_key" ON "TestExecution"("testCycleTestId");

-- CreateIndex
CREATE INDEX "TestStepExecution_testExecutionId_idx" ON "TestStepExecution"("testExecutionId");

-- CreateIndex
CREATE INDEX "Defect_projectId_idx" ON "Defect"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TestStepExecutionDefect_testStepExecutionId_defectId_key" ON "TestStepExecutionDefect"("testStepExecutionId", "defectId");

-- AddForeignKey
ALTER TABLE "TestCycle" ADD CONSTRAINT "TestCycle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCycle" ADD CONSTRAINT "TestCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCycleTest" ADD CONSTRAINT "TestCycleTest_testCycleId_fkey" FOREIGN KEY ("testCycleId") REFERENCES "TestCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCycleTest" ADD CONSTRAINT "TestCycleTest_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_testCycleTestId_fkey" FOREIGN KEY ("testCycleTestId") REFERENCES "TestCycleTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestStepExecution" ADD CONSTRAINT "TestStepExecution_testExecutionId_fkey" FOREIGN KEY ("testExecutionId") REFERENCES "TestExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestStepExecutionDefect" ADD CONSTRAINT "TestStepExecutionDefect_testStepExecutionId_fkey" FOREIGN KEY ("testStepExecutionId") REFERENCES "TestStepExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestStepExecutionDefect" ADD CONSTRAINT "TestStepExecutionDefect_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "Defect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
