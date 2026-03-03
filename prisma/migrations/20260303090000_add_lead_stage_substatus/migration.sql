-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACT_ATTEMPTED', 'NURTURING', 'VISIT_SCHEDULED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LeadSubStatus" AS ENUM ('NUMBER_COLLECTED', 'NO_ANSWER', 'WARM_LEAD', 'FUTURE_CLIENT', 'SMALL_BUDGET', 'DEAD_LEAD', 'INVALID', 'NOT_INTERESTED', 'LOST');

-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
ADD COLUMN "subStatus" "LeadSubStatus";

-- Enforce stage/subStatus dependency
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_stage_subStatus_check" CHECK (
  (
    "stage" = 'NEW'::"LeadStage"
    AND "subStatus" IS NULL
  )
  OR (
    "stage" = 'CONTACT_ATTEMPTED'::"LeadStage"
    AND "subStatus" IN ('NUMBER_COLLECTED'::"LeadSubStatus", 'NO_ANSWER'::"LeadSubStatus")
  )
  OR (
    "stage" = 'NURTURING'::"LeadStage"
    AND "subStatus" IN ('WARM_LEAD'::"LeadSubStatus", 'FUTURE_CLIENT'::"LeadSubStatus", 'SMALL_BUDGET'::"LeadSubStatus")
  )
  OR (
    "stage" = 'VISIT_SCHEDULED'::"LeadStage"
    AND "subStatus" IS NULL
  )
  OR (
    "stage" = 'CLOSED'::"LeadStage"
    AND "subStatus" IN ('INVALID'::"LeadSubStatus", 'NOT_INTERESTED'::"LeadSubStatus", 'LOST'::"LeadSubStatus", 'DEAD_LEAD'::"LeadSubStatus")
  )
);
