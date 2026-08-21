-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('Initiative', 'Epic', 'Feature', 'Story', 'Task', 'SubTask', 'Defect');

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "type" "WorkItemType" NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "asA" TEXT,
    "iWant" TEXT,
    "soThat" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Backlog',
    "priority" TEXT,
    "assignee" TEXT,
    "reporter" TEXT,
    "storyPoints" INTEGER,
    "originalEstimate" DOUBLE PRECISION,
    "remainingEstimate" DOUBLE PRECISION,
    "labels" TEXT[],
    "components" TEXT[],
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "parentId" TEXT,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemAcceptanceCriterion" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItemAcceptanceCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemTestCase" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkItem_projectId_idx" ON "WorkItem"("projectId");

-- CreateIndex
CREATE INDEX "WorkItem_parentId_idx" ON "WorkItem"("parentId");

-- CreateIndex
CREATE INDEX "WorkItem_createdById_idx" ON "WorkItem"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_projectId_key_key" ON "WorkItem"("projectId", "key");

-- CreateIndex
CREATE INDEX "WorkItemAcceptanceCriterion_workItemId_idx" ON "WorkItemAcceptanceCriterion"("workItemId");

-- CreateIndex
CREATE INDEX "WorkItemTestCase_testCaseId_idx" ON "WorkItemTestCase"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemTestCase_workItemId_testCaseId_key" ON "WorkItemTestCase"("workItemId", "testCaseId");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemAcceptanceCriterion" ADD CONSTRAINT "WorkItemAcceptanceCriterion_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemTestCase" ADD CONSTRAINT "WorkItemTestCase_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemTestCase" ADD CONSTRAINT "WorkItemTestCase_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
