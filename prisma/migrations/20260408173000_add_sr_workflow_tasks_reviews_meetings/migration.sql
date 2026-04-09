DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'LeadPrimaryOwnerDepartment'
  ) THEN
    CREATE TYPE "LeadPrimaryOwnerDepartment" AS ENUM ('JR_CRM', 'SR_CRM');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'LeadPhaseType'
  ) THEN
    CREATE TYPE "LeadPhaseType" AS ENUM ('CAD', 'QUOTATION');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'LeadPhaseTaskStatus'
  ) THEN
    CREATE TYPE "LeadPhaseTaskStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'COMPLETED', 'CANCELLED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'LeadPhaseReviewDecision'
  ) THEN
    CREATE TYPE "LeadPhaseReviewDecision" AS ENUM ('APPROVED', 'REWORK');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'LeadMeetingEventType'
  ) THEN
    CREATE TYPE "LeadMeetingEventType" AS ENUM ('FIRST_MEETING', 'BUDGET_MEETING', 'REVIEW_CHECKPOINT');
  END IF;
END
$$;

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SR_TAKEOVER';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PHASE_DEADLINE_SET';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PHASE_REVIEW_ROUND';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MEETING_SCHEDULED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'HANDOFF_TRIGGERED';

ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "primaryOwnerDepartment" "LeadPrimaryOwnerDepartment",
ADD COLUMN IF NOT EXISTS "primaryOwnerUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Lead_primaryOwnerUserId_fkey'
  ) THEN
    ALTER TABLE "Lead"
    ADD CONSTRAINT "Lead_primaryOwnerUserId_fkey"
    FOREIGN KEY ("primaryOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Lead_primaryOwnerUserId_idx" ON "Lead"("primaryOwnerUserId");

CREATE TABLE IF NOT EXISTS "LeadPhaseTask" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "phaseType" "LeadPhaseType" NOT NULL,
  "assigneeUserId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "LeadPhaseTaskStatus" NOT NULL DEFAULT 'OPEN',
  "currentReviewRound" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadPhaseTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadPhaseReview" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "roundNo" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" TEXT NOT NULL,
  "decision" "LeadPhaseReviewDecision" NOT NULL,
  "comment" TEXT,
  CONSTRAINT "LeadPhaseReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadMeetingEvent" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" "LeadMeetingEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadMeetingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadPhaseTask_leadId_idx" ON "LeadPhaseTask"("leadId");
CREATE INDEX IF NOT EXISTS "LeadPhaseTask_assigneeUserId_idx" ON "LeadPhaseTask"("assigneeUserId");
CREATE INDEX IF NOT EXISTS "LeadPhaseTask_phaseType_idx" ON "LeadPhaseTask"("phaseType");
CREATE INDEX IF NOT EXISTS "LeadPhaseTask_status_idx" ON "LeadPhaseTask"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "LeadPhaseReview_taskId_roundNo_key" ON "LeadPhaseReview"("taskId", "roundNo");
CREATE INDEX IF NOT EXISTS "LeadPhaseReview_taskId_idx" ON "LeadPhaseReview"("taskId");
CREATE INDEX IF NOT EXISTS "LeadPhaseReview_reviewedById_idx" ON "LeadPhaseReview"("reviewedById");

CREATE INDEX IF NOT EXISTS "LeadMeetingEvent_leadId_idx" ON "LeadMeetingEvent"("leadId");
CREATE INDEX IF NOT EXISTS "LeadMeetingEvent_type_idx" ON "LeadMeetingEvent"("type");
CREATE INDEX IF NOT EXISTS "LeadMeetingEvent_startsAt_idx" ON "LeadMeetingEvent"("startsAt");
CREATE INDEX IF NOT EXISTS "LeadMeetingEvent_createdById_idx" ON "LeadMeetingEvent"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadPhaseTask_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadPhaseTask"
    ADD CONSTRAINT "LeadPhaseTask_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadPhaseTask_assigneeUserId_fkey'
  ) THEN
    ALTER TABLE "LeadPhaseTask"
    ADD CONSTRAINT "LeadPhaseTask_assigneeUserId_fkey"
    FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadPhaseTask_createdById_fkey'
  ) THEN
    ALTER TABLE "LeadPhaseTask"
    ADD CONSTRAINT "LeadPhaseTask_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadPhaseReview_taskId_fkey'
  ) THEN
    ALTER TABLE "LeadPhaseReview"
    ADD CONSTRAINT "LeadPhaseReview_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "LeadPhaseTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadPhaseReview_reviewedById_fkey'
  ) THEN
    ALTER TABLE "LeadPhaseReview"
    ADD CONSTRAINT "LeadPhaseReview_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadMeetingEvent_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadMeetingEvent"
    ADD CONSTRAINT "LeadMeetingEvent_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadMeetingEvent_createdById_fkey'
  ) THEN
    ALTER TABLE "LeadMeetingEvent"
    ADD CONSTRAINT "LeadMeetingEvent_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
