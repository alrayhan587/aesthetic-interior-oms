-- CreateTable
CREATE TABLE "InstagramSyncControl" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fallbackIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "batchLimit" INTEGER NOT NULL DEFAULT 20,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncFetched" INTEGER,
    "lastSyncCreated" INTEGER,
    "lastSyncError" TEXT,
    "lastSyncTrigger" TEXT,
    "incrementalCursor" TEXT,
    "incrementalWatermark" TIMESTAMP(3),
    "jrCrmRoundRobinOffset" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramSyncControl_pkey" PRIMARY KEY ("id")
);
