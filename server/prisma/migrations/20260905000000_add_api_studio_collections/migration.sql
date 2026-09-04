-- AlterTable
ALTER TABLE "ApiExecution" ADD COLUMN     "assertionResults" JSONB;

-- AlterTable
ALTER TABLE "ApiRequest" ADD COLUMN     "assertions" JSONB,
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "pathParams" JSONB;

-- CreateTable
CREATE TABLE "ApiFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiFolder_projectId_idx" ON "ApiFolder"("projectId");

-- CreateIndex
CREATE INDEX "ApiFolder_parentId_idx" ON "ApiFolder"("parentId");

-- CreateIndex
CREATE INDEX "ApiRequest_folderId_idx" ON "ApiRequest"("folderId");

-- AddForeignKey
ALTER TABLE "ApiRequest" ADD CONSTRAINT "ApiRequest_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ApiFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiFolder" ADD CONSTRAINT "ApiFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiFolder" ADD CONSTRAINT "ApiFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ApiFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiFolder" ADD CONSTRAINT "ApiFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
