DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'LeadJrArchitectRequestStatus'
  ) THEN
    CREATE TYPE "LeadJrArchitectRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END
$$;

ALTER TABLE "LeadPhaseTask"
ADD COLUMN IF NOT EXISTS "sourceVisitId" TEXT;

CREATE INDEX IF NOT EXISTS "LeadPhaseTask_sourceVisitId_idx" ON "LeadPhaseTask"("sourceVisitId");

CREATE TABLE IF NOT EXISTS "LeadJrArchitectRequest" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status" "LeadJrArchitectRequestStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadJrArchitectRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadJrArchitectRequest_leadId_idx" ON "LeadJrArchitectRequest"("leadId");
CREATE INDEX IF NOT EXISTS "LeadJrArchitectRequest_requestedById_idx" ON "LeadJrArchitectRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "LeadJrArchitectRequest_status_idx" ON "LeadJrArchitectRequest"("status");
CREATE INDEX IF NOT EXISTS "LeadJrArchitectRequest_createdAt_idx" ON "LeadJrArchitectRequest"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadJrArchitectRequest_pending_unique"
ON "LeadJrArchitectRequest"("leadId", "requestedById")
WHERE "status" = 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadPhaseTask_sourceVisitId_fkey'
  ) THEN
    ALTER TABLE "LeadPhaseTask"
    ADD CONSTRAINT "LeadPhaseTask_sourceVisitId_fkey"
    FOREIGN KEY ("sourceVisitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadJrArchitectRequest_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadJrArchitectRequest"
    ADD CONSTRAINT "LeadJrArchitectRequest_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadJrArchitectRequest_requestedById_fkey'
  ) THEN
    ALTER TABLE "LeadJrArchitectRequest"
    ADD CONSTRAINT "LeadJrArchitectRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadJrArchitectRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "LeadJrArchitectRequest"
    ADD CONSTRAINT "LeadJrArchitectRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
