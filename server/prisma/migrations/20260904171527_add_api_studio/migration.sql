-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS');

-- CreateEnum
CREATE TYPE "ApiAuthType" AS ENUM ('None', 'Bearer', 'Basic', 'ApiKey');

-- CreateEnum
CREATE TYPE "ApiExecutionStatus" AS ENUM ('Success', 'Error', 'Blocked');

-- CreateTable
CREATE TABLE "ApiRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "method" "HttpMethod" NOT NULL DEFAULT 'GET',
    "url" TEXT NOT NULL,
    "queryParams" JSONB,
    "headers" JSONB,
    "bodyType" TEXT,
    "body" TEXT,
    "authType" "ApiAuthType" NOT NULL DEFAULT 'None',
    "authConfig" JSONB,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiExecution" (
    "id" TEXT NOT NULL,
    "apiRequestId" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL,
    "url" TEXT NOT NULL,
    "requestHeaders" JSONB,
    "requestBody" TEXT,
    "status" "ApiExecutionStatus" NOT NULL,
    "statusCode" INTEGER,
    "responseHeaders" JSONB,
    "responseBody" TEXT,
    "responseTruncated" BOOLEAN NOT NULL DEFAULT false,
    "responseSizeBytes" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "executedById" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiRequest_projectId_idx" ON "ApiRequest"("projectId");

-- CreateIndex
CREATE INDEX "ApiRequest_createdById_idx" ON "ApiRequest"("createdById");

-- CreateIndex
CREATE INDEX "ApiExecution_apiRequestId_idx" ON "ApiExecution"("apiRequestId");

-- CreateIndex
CREATE INDEX "ApiExecution_executedById_idx" ON "ApiExecution"("executedById");

-- AddForeignKey
ALTER TABLE "ApiRequest" ADD CONSTRAINT "ApiRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequest" ADD CONSTRAINT "ApiRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_apiRequestId_fkey" FOREIGN KEY ("apiRequestId") REFERENCES "ApiRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
