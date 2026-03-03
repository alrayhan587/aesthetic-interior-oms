import { LeadStage, LeadSubStatus } from '@/generated/prisma/client';

export const stageSubStatusMap: Record<LeadStage, LeadSubStatus[]> = {
  NEW: [],
  CONTACT_ATTEMPTED: ['NUMBER_COLLECTED', 'NO_ANSWER'],
  NURTURING: ['WARM_LEAD', 'FUTURE_CLIENT', 'SMALL_BUDGET'],
  VISIT_SCHEDULED: [],
  CLOSED: ['INVALID', 'NOT_INTERESTED', 'LOST', 'DEAD_LEAD'],
};

export function isSubStatusAllowedForStage(stage: LeadStage, subStatus: LeadSubStatus | null): boolean {
  const allowed = stageSubStatusMap[stage];

  if (allowed.length === 0) {
    return subStatus === null;
  }

  return subStatus !== null && allowed.includes(subStatus);
}
