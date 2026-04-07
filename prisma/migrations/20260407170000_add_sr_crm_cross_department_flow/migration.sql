DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadAssignmentDepartment' AND e.enumlabel = 'ACCOUNTS'
  ) THEN
    ALTER TYPE "LeadAssignmentDepartment" ADD VALUE 'ACCOUNTS';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadStage' AND e.enumlabel = 'DISCOVERY'
  ) THEN
    ALTER TYPE "LeadStage" ADD VALUE 'DISCOVERY';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadStage' AND e.enumlabel = 'CAD_PHASE'
  ) THEN
    ALTER TYPE "LeadStage" ADD VALUE 'CAD_PHASE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadStage' AND e.enumlabel = 'QUOTATION_PHASE'
  ) THEN
    ALTER TYPE "LeadStage" ADD VALUE 'QUOTATION_PHASE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadStage' AND e.enumlabel = 'BUDGET_PHASE'
  ) THEN
    ALTER TYPE "LeadStage" ADD VALUE 'BUDGET_PHASE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadStage' AND e.enumlabel = 'VISUALIZATION_PHASE'
  ) THEN
    ALTER TYPE "LeadStage" ADD VALUE 'VISUALIZATION_PHASE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadStage' AND e.enumlabel = 'CONVERSION'
  ) THEN
    ALTER TYPE "LeadStage" ADD VALUE 'CONVERSION';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'FIRST_MEETING_SET'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'FIRST_MEETING_SET';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'PROPOSAL_SENT'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'PROPOSAL_SENT';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'LAYOUT_REVISION'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'LAYOUT_REVISION';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'CAD_ASSIGNED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'CAD_ASSIGNED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'CAD_WORKING'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'CAD_WORKING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'CAD_COMPLETED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'CAD_COMPLETED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'CAD_APPROVED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'CAD_APPROVED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'QUOTATION_ASSIGNED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'QUOTATION_ASSIGNED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'QUOTATION_WORKING'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'QUOTATION_WORKING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'QUOTATION_COMPLETED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'QUOTATION_COMPLETED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'QUOTATION_CORRECTION'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'QUOTATION_CORRECTION';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'BUDGET_MEETING_SET'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'BUDGET_MEETING_SET';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'CLIENT_CONFIRMED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'CLIENT_CONFIRMED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'CLIENT_PARTIALLY_PAID'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'CLIENT_PARTIALLY_PAID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'CLIENT_FULL_PAID'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'CLIENT_FULL_PAID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'REJECTED_OFFER'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'REJECTED_OFFER';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'VISUAL_ASSIGNED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'VISUAL_ASSIGNED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'VISUAL_WORKING'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'VISUAL_WORKING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'VISUAL_COMPLETED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'VISUAL_COMPLETED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'CLIENT_APPROVED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'CLIENT_APPROVED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'VISUAL_CORRECTION'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'VISUAL_CORRECTION';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LeadSubStatus' AND e.enumlabel = 'PROJECT_DROPPED'
  ) THEN
    ALTER TYPE "LeadSubStatus" ADD VALUE 'PROJECT_DROPPED';
  END IF;
END
$$;
