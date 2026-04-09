import { LeadStage, LeadSubStatus } from '@/generated/prisma/client';

export const stageSubStatusMap: Record<LeadStage, LeadSubStatus[]> = {
  NEW: [],
  NUMBER_COLLECTED: [],
  DISCOVERY: ['FIRST_MEETING_SET', 'PROPOSAL_SENT', 'LAYOUT_REVISION', 'PROJECT_DROPPED'],
  CAD_PHASE: ['CAD_ASSIGNED', 'CAD_WORKING', 'CAD_COMPLETED', 'CAD_APPROVED'],
  QUOTATION_PHASE: [
    'QUOTATION_ASSIGNED',
    'QUOTATION_WORKING',
    'QUOTATION_COMPLETED',
    'QUOTATION_CORRECTION',
  ],
  BUDGET_PHASE: [
    'BUDGET_MEETING_SET',
    'CLIENT_CONFIRMED',
    'CLIENT_PARTIALLY_PAID',
    'CLIENT_FULL_PAID',
    'REJECTED_OFFER',
  ],
  VISIT_PHASE: ['VISIT_SCHEDULED', 'VISIT_COMPLETED', 'VISIT_RESCHEDULED', 'VISIT_CANCELLED'],
  VISUALIZATION_PHASE: [
    'VISUAL_ASSIGNED',
    'VISUAL_WORKING',
    'VISUAL_COMPLETED',
    'CLIENT_APPROVED',
    'VISUAL_CORRECTION',
  ],
  CONVERSION: ['CLIENT_CONFIRMED', 'CLIENT_PARTIALLY_PAID', 'CLIENT_FULL_PAID', 'CLIENT_APPROVED'],
  CONTACT_ATTEMPTED: ['NO_ANSWER'],
  NURTURING: ['WARM_LEAD', 'FUTURE_CLIENT'],
  // Legacy visit stages kept for backward compatibility with old records.
  VISIT_SCHEDULED: ['VISIT_SCHEDULED'],
  VISIT_RESCHEDULED: ['VISIT_RESCHEDULED'],
  VISIT_COMPLETED: ['VISIT_COMPLETED'],
  VISIT_CANCELLED: ['VISIT_CANCELLED'],
  CLOSED: ['PROJECT_DROPPED', 'REJECTED_OFFER', 'SMALL_BUDGET', 'INVALID', 'NOT_INTERESTED', 'LOST', 'DEAD_LEAD'],
};

export function isSubStatusAllowedForStage(stage: LeadStage, subStatus: LeadSubStatus | null): boolean {
  const allowed = stageSubStatusMap[stage];

  if (allowed.length === 0) {
    return subStatus === null;
  }

  return subStatus !== null && allowed.includes(subStatus);
}
