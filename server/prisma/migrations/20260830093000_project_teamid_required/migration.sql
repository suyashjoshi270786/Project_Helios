-- All existing Project rows have been backfilled with a teamId (personal
-- team per user) by a one-off script run alongside this migration.
ALTER TABLE "Project" ALTER COLUMN "teamId" SET NOT NULL;
