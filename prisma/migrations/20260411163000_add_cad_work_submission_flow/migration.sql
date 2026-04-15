DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'CadSubmissionFileType'
  ) THEN
    CREATE TYPE "CadSubmissionFileType" AS ENUM (
      'FLOOR_PLAN',
      'FURNITURE_LAYOUT',
      'BEAM_LAYOUT',
      'COLUMN_LAYOUT',
      'LANDSCAPING',
      'ROOF_TOP_DESIGN',
      'ELECTRICAL_PLUMBING',
      'WORKING_DETAILS',
      'OTHERS'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "CadWorkSubmission" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "note" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CadWorkSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CadWorkSubmission_leadId_idx" ON "CadWorkSubmission"("leadId");
CREATE INDEX IF NOT EXISTS "CadWorkSubmission_submittedById_idx" ON "CadWorkSubmission"("submittedById");
CREATE INDEX IF NOT EXISTS "CadWorkSubmission_submittedAt_idx" ON "CadWorkSubmission"("submittedAt");

CREATE TABLE IF NOT EXISTS "CadWorkSubmissionFile" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "cadFileType" "CadSubmissionFileType" NOT NULL,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CadWorkSubmissionFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CadWorkSubmissionFile_submissionId_idx" ON "CadWorkSubmissionFile"("submissionId");
CREATE INDEX IF NOT EXISTS "CadWorkSubmissionFile_cadFileType_idx" ON "CadWorkSubmissionFile"("cadFileType");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CadWorkSubmission_leadId_fkey'
  ) THEN
    ALTER TABLE "CadWorkSubmission"
    ADD CONSTRAINT "CadWorkSubmission_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CadWorkSubmission_submittedById_fkey'
  ) THEN
    ALTER TABLE "CadWorkSubmission"
    ADD CONSTRAINT "CadWorkSubmission_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CadWorkSubmissionFile_submissionId_fkey'
  ) THEN
    ALTER TABLE "CadWorkSubmissionFile"
    ADD CONSTRAINT "CadWorkSubmissionFile_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "CadWorkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
