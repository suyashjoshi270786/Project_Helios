-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "TeamInvite" ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY[]::TEXT[];

