-- AlterTable
ALTER TABLE "FacebookSyncControl"
ADD COLUMN     "latestEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "latestIntervalMinutes" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "latestBatchLimit" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "backfillEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "backfillIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "backfillBatchLimit" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "lastLatestSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastLatestSyncStatus" TEXT,
ADD COLUMN     "lastLatestSyncFetched" INTEGER,
ADD COLUMN     "lastLatestSyncCreated" INTEGER,
ADD COLUMN     "lastLatestSyncError" TEXT,
ADD COLUMN     "lastBackfillSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastBackfillSyncStatus" TEXT,
ADD COLUMN     "lastBackfillSyncFetched" INTEGER,
ADD COLUMN     "lastBackfillSyncCreated" INTEGER,
ADD COLUMN     "lastBackfillSyncError" TEXT,
ADD COLUMN     "latestWatermark" TIMESTAMP(3),
ADD COLUMN     "backfillCursor" TEXT;

-- Seed new fields from existing legacy fields where helpful
UPDATE "FacebookSyncControl"
SET
  "latestBatchLimit" = "batchLimit",
  "backfillBatchLimit" = "batchLimit",
  "backfillIntervalMinutes" = "fallbackIntervalMinutes",
  "latestWatermark" = "incrementalWatermark",
  "backfillCursor" = "incrementalCursor",
  "lastLatestSyncAt" = "lastSyncAt",
  "lastLatestSyncStatus" = "lastSyncStatus",
  "lastLatestSyncFetched" = "lastSyncFetched",
  "lastLatestSyncCreated" = "lastSyncCreated",
  "lastLatestSyncError" = "lastSyncError",
  "lastBackfillSyncAt" = "lastSyncAt",
  "lastBackfillSyncStatus" = "lastSyncStatus",
  "lastBackfillSyncFetched" = "lastSyncFetched",
  "lastBackfillSyncCreated" = "lastSyncCreated",
  "lastBackfillSyncError" = "lastSyncError"
WHERE "id" = 'default';
