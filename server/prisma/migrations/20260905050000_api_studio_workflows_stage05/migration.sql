-- CreateEnum
CREATE TYPE "WorkflowFailurePolicy" AS ENUM ('Stop', 'Continue', 'ContinueButMarkFailed');

-- CreateTable
CREATE TABLE "ApiWorkflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "failurePolicy" "WorkflowFailurePolicy" NOT NULL DEFAULT 'Stop',
    "steps" JSONB,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiWorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "overallResult" "ApiTestResult" NOT NULL,
    "steps" JSONB NOT NULL,
    "executedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiWorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiWorkflow_projectId_idx" ON "ApiWorkflow"("projectId");

-- CreateIndex
CREATE INDEX "ApiWorkflowRun_workflowId_idx" ON "ApiWorkflowRun"("workflowId");

-- CreateIndex
CREATE INDEX "ApiWorkflowRun_projectId_idx" ON "ApiWorkflowRun"("projectId");

-- AddForeignKey
ALTER TABLE "ApiWorkflow" ADD CONSTRAINT "ApiWorkflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiWorkflow" ADD CONSTRAINT "ApiWorkflow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiWorkflowRun" ADD CONSTRAINT "ApiWorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApiWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiWorkflowRun" ADD CONSTRAINT "ApiWorkflowRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiWorkflowRun" ADD CONSTRAINT "ApiWorkflowRun_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
