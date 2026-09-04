-- CreateEnum
CREATE TYPE "VariableClassification" AS ENUM ('Public', 'Configuration', 'Sensitive', 'Secret');

-- CreateEnum
CREATE TYPE "EnvironmentClassification" AS ENUM ('Development', 'Staging', 'Production');

-- AlterTable
ALTER TABLE "ApiExecution" ADD COLUMN     "environmentId" TEXT;

-- CreateTable
CREATE TABLE "ApiEnvironment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "classification" "EnvironmentClassification" NOT NULL DEFAULT 'Development',
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiEnvironmentVariable" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "classification" "VariableClassification" NOT NULL DEFAULT 'Configuration',
    "value" TEXT,
    "encryptedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiEnvironmentVariable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiEnvironment_projectId_idx" ON "ApiEnvironment"("projectId");

-- CreateIndex
CREATE INDEX "ApiEnvironmentVariable_environmentId_idx" ON "ApiEnvironmentVariable"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiEnvironmentVariable_environmentId_key_key" ON "ApiEnvironmentVariable"("environmentId", "key");

-- CreateIndex
CREATE INDEX "ApiExecution_environmentId_idx" ON "ApiExecution"("environmentId");

-- AddForeignKey
ALTER TABLE "ApiEnvironment" ADD CONSTRAINT "ApiEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiEnvironment" ADD CONSTRAINT "ApiEnvironment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiEnvironmentVariable" ADD CONSTRAINT "ApiEnvironmentVariable_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "ApiEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "ApiEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
