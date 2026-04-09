DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadStage' AND e.enumlabel = 'VISIT_PHASE'
  ) THEN
    ALTER TYPE "LeadStage" ADD VALUE 'VISIT_PHASE';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'VISIT_SCHEDULED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'VISIT_SCHEDULED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'VISIT_COMPLETED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'VISIT_COMPLETED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'VISIT_RESCHEDULED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'VISIT_RESCHEDULED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'VISIT_CANCELLED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'VISIT_CANCELLED';
  END IF;
END
$$;
