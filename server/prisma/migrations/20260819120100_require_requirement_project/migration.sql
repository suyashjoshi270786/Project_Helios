-- All existing Requirement rows have been backfilled with a projectId by
-- scripts/backfillProjects.ts. Now enforce it going forward.
ALTER TABLE "Requirement" ALTER COLUMN "projectId" SET NOT NULL;
