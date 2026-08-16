-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('Draft', 'InReview', 'Approved');

-- CreateEnum
CREATE TYPE "RequirementPriority" AS ENUM ('Low', 'Medium', 'High');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Test Architect',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptanceCriteria" TEXT[],
    "flows" TEXT[],
    "risks" TEXT[],
    "status" "RequirementStatus" NOT NULL DEFAULT 'Draft',
    "priority" "RequirementPriority" NOT NULL DEFAULT 'Medium',
    "sourceText" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Requirement_createdById_idx" ON "Requirement"("createdById");

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
