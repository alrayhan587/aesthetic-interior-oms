-- AlterTable
ALTER TABLE "User"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "FacebookSyncControl"
ADD COLUMN "jrCrmRoundRobinOffset" INTEGER NOT NULL DEFAULT 0;
