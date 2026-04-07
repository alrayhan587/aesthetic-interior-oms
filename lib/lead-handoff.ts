import { LeadAssignmentDepartment, LeadSubStatus, LeadStage, Prisma } from '@/generated/prisma/client'
import { logActivity } from '@/lib/activity-log-service'

export const PAYMENT_SUBSTATUSES: LeadSubStatus[] = [
  LeadSubStatus.CLIENT_CONFIRMED,
  LeadSubStatus.CLIENT_PARTIALLY_PAID,
  LeadSubStatus.CLIENT_FULL_PAID,
]

export function isPaymentSubStatus(subStatus: LeadSubStatus | null | undefined): boolean {
  if (!subStatus) return false
  return PAYMENT_SUBSTATUSES.includes(subStatus)
}

export function canManagePaymentStatus(input: {
  actorDepartments: string[]
  nextSubStatus: LeadSubStatus | null | undefined
}): boolean {
  if (!isPaymentSubStatus(input.nextSubStatus)) return true
  const departments = new Set(input.actorDepartments)
  return departments.has('SR_CRM') || departments.has('ACCOUNTS') || departments.has('ADMIN')
}

export function handoffDepartmentForSubStatus(
  subStatus: LeadSubStatus | null,
): LeadAssignmentDepartment | null {
  if (!subStatus) return null

  if (
    subStatus === LeadSubStatus.CAD_ASSIGNED ||
    subStatus === LeadSubStatus.CAD_WORKING ||
    subStatus === LeadSubStatus.CAD_COMPLETED ||
    subStatus === LeadSubStatus.CAD_APPROVED
  ) {
    return LeadAssignmentDepartment.JR_ARCHITECT
  }

  if (
    subStatus === LeadSubStatus.QUOTATION_ASSIGNED ||
    subStatus === LeadSubStatus.QUOTATION_WORKING ||
    subStatus === LeadSubStatus.QUOTATION_COMPLETED ||
    subStatus === LeadSubStatus.QUOTATION_CORRECTION
  ) {
    return LeadAssignmentDepartment.QUOTATION
  }

  if (
    subStatus === LeadSubStatus.VISUAL_ASSIGNED ||
    subStatus === LeadSubStatus.VISUAL_WORKING ||
    subStatus === LeadSubStatus.VISUAL_COMPLETED ||
    subStatus === LeadSubStatus.CLIENT_APPROVED ||
    subStatus === LeadSubStatus.VISUAL_CORRECTION
  ) {
    return LeadAssignmentDepartment.VISUALIZER_3D
  }

  if (isPaymentSubStatus(subStatus)) {
    return LeadAssignmentDepartment.ACCOUNTS
  }

  return null
}

type EnsureAssignmentInput = {
  tx: Prisma.TransactionClient
  leadId: string
  department: LeadAssignmentDepartment
  preferredUserId?: string | null
  actorUserId?: string | null
}

export async function ensureDepartmentAssignment({
  tx,
  leadId,
  department,
  preferredUserId,
  actorUserId,
}: EnsureAssignmentInput): Promise<{ assigned: boolean; userId: string | null }> {
  const existing = await tx.leadAssignment.findFirst({
    where: { leadId, department },
    select: { id: true, userId: true },
  })
  if (existing) {
    return { assigned: false, userId: existing.userId }
  }

  let selectedUserId: string | null = null

  if (preferredUserId) {
    const preferred = await tx.user.findFirst({
      where: {
        id: preferredUserId,
        isActive: true,
        userDepartments: {
          some: {
            department: {
              name: department,
            },
          },
        },
      },
      select: { id: true },
    })
    selectedUserId = preferred?.id ?? null
  }

  if (!selectedUserId) {
    const fallback = await tx.user.findFirst({
      where: {
        isActive: true,
        userDepartments: {
          some: {
            department: {
              name: department,
            },
          },
        },
      },
      select: { id: true },
      orderBy: [{ fullName: 'asc' }, { created_at: 'asc' }],
    })

    selectedUserId = fallback?.id ?? null
  }

  if (!selectedUserId) {
    return { assigned: false, userId: null }
  }

  await tx.leadAssignment.create({
    data: {
      leadId,
      userId: selectedUserId,
      department,
    },
  })

  if (actorUserId) {
    await logActivity(tx, {
      leadId,
      userId: actorUserId,
      type: 'USER_ASSIGNED',
      description: `Auto handoff assigned ${department} for lead workflow.`,
    })
  }

  return { assigned: true, userId: selectedUserId }
}

export async function ensureSeniorCrmAssignment(input: {
  tx: Prisma.TransactionClient
  leadId: string
  preferredUserId?: string | null
  actorUserId?: string | null
}): Promise<{ assigned: boolean; userId: string | null }> {
  return ensureDepartmentAssignment({
    tx: input.tx,
    leadId: input.leadId,
    department: LeadAssignmentDepartment.SR_CRM,
    preferredUserId: input.preferredUserId,
    actorUserId: input.actorUserId,
  })
}

export function requiresSrCrmAssignment(stage: LeadStage): boolean {
  return stage !== LeadStage.CONVERSION && stage !== LeadStage.CLOSED
}
