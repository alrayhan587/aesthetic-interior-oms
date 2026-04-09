import {
  ActivityType,
  LeadAssignmentDepartment,
  LeadPhaseTaskStatus,
  LeadPhaseType,
  LeadSubStatus,
  Prisma,
} from '@/generated/prisma/client'
import { logActivity } from '@/lib/activity-log-service'

function phaseTypeFromSubStatus(subStatus: LeadSubStatus | null | undefined): LeadPhaseType | null {
  if (!subStatus) return null

  if (
    subStatus === LeadSubStatus.CAD_ASSIGNED ||
    subStatus === LeadSubStatus.CAD_WORKING ||
    subStatus === LeadSubStatus.CAD_COMPLETED ||
    subStatus === LeadSubStatus.CAD_APPROVED
  ) {
    return LeadPhaseType.CAD
  }

  if (
    subStatus === LeadSubStatus.QUOTATION_ASSIGNED ||
    subStatus === LeadSubStatus.QUOTATION_WORKING ||
    subStatus === LeadSubStatus.QUOTATION_COMPLETED ||
    subStatus === LeadSubStatus.QUOTATION_CORRECTION
  ) {
    return LeadPhaseType.QUOTATION
  }

  return null
}

export async function ensurePhaseTaskForSubStatus(input: {
  tx: Prisma.TransactionClient
  leadId: string
  subStatus: LeadSubStatus | null | undefined
  actorUserId: string
}): Promise<void> {
  const phaseType = phaseTypeFromSubStatus(input.subStatus)
  if (!phaseType) return

  const existingOpenTask = await input.tx.leadPhaseTask.findFirst({
    where: {
      leadId: input.leadId,
      phaseType,
      status: { in: [LeadPhaseTaskStatus.OPEN, LeadPhaseTaskStatus.IN_REVIEW] },
    },
    select: { id: true },
  })
  if (existingOpenTask) return

  const targetDepartment =
    phaseType === LeadPhaseType.CAD
      ? LeadAssignmentDepartment.JR_ARCHITECT
      : LeadAssignmentDepartment.QUOTATION

  const assignee = await input.tx.leadAssignment.findFirst({
    where: { leadId: input.leadId, department: targetDepartment },
    orderBy: { createdAt: 'desc' },
    select: { userId: true },
  })

  const dueAt = new Date()
  dueAt.setDate(dueAt.getDate() + (phaseType === LeadPhaseType.CAD ? 3 : 2))

  await input.tx.leadPhaseTask.create({
    data: {
      leadId: input.leadId,
      phaseType,
      assigneeUserId: assignee?.userId ?? input.actorUserId,
      dueAt,
      createdById: input.actorUserId,
    },
  })

  await logActivity(input.tx, {
    leadId: input.leadId,
    userId: input.actorUserId,
    type: ActivityType.PHASE_DEADLINE_SET,
    description: `Auto-created ${phaseType} task with default deadline.`,
  })
}
