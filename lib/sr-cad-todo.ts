import {
  LeadStage,
  LeadSubStatus,
  NotificationType,
  Prisma,
} from '@/generated/prisma/client'

export const SR_CAD_REVIEW_TODO_TITLE = 'Check lead CAD work'

type CadTodoTransitionInput = {
  fromStage: LeadStage
  fromSubStatus: LeadSubStatus | null
  toStage: LeadStage
  toSubStatus: LeadSubStatus | null
}

export function shouldCreateSrCadReviewTodo(input: CadTodoTransitionInput): boolean {
  return (
    input.fromStage === LeadStage.VISIT_PHASE &&
    input.fromSubStatus === LeadSubStatus.VISIT_COMPLETED &&
    input.toStage === LeadStage.CAD_PHASE &&
    input.toSubStatus === LeadSubStatus.CAD_ASSIGNED
  )
}

export async function createSrCadReviewTodosForCadStart(input: {
  tx: Prisma.TransactionClient
  leadId: string
  fromStage: LeadStage
  fromSubStatus: LeadSubStatus | null
  toStage: LeadStage
  toSubStatus: LeadSubStatus | null
  triggeredByUserId: string
  triggeredAt?: Date
}): Promise<void> {
  if (
    !shouldCreateSrCadReviewTodo({
      fromStage: input.fromStage,
      fromSubStatus: input.fromSubStatus,
      toStage: input.toStage,
      toSubStatus: input.toSubStatus,
    })
  ) {
    return
  }

  const when = input.triggeredAt ?? new Date()
  const dayStart = new Date(when)
  dayStart.setHours(0, 0, 0, 0)

  const [lead, actor, seniorCrmUsers] = await Promise.all([
    input.tx.lead.findUnique({
      where: { id: input.leadId },
      select: { id: true, name: true },
    }),
    input.tx.user.findUnique({
      where: { id: input.triggeredByUserId },
      select: { fullName: true },
    }),
    input.tx.user.findMany({
      where: {
        isActive: true,
        userDepartments: {
          some: {
            department: {
              name: 'SR_CRM',
            },
          },
        },
      },
      select: { id: true },
    }),
  ])

  if (!lead || seniorCrmUsers.length === 0) return

  const targetUserIds = seniorCrmUsers.map((user) => user.id)
  const existingToday = await input.tx.notification.findMany({
    where: {
      userId: { in: targetUserIds },
      leadId: input.leadId,
      type: NotificationType.LEAD_ASSIGNED_TO_YOU,
      title: SR_CAD_REVIEW_TODO_TITLE,
      createdAt: { gte: dayStart },
    },
    select: { userId: true },
  })
  const existingUserIds = new Set(existingToday.map((item) => item.userId))
  const todoDate = when.toISOString().slice(0, 10)
  const actorName = actor?.fullName ?? 'JR Architect'

  const notifications = targetUserIds
    .filter((userId) => !existingUserIds.has(userId))
    .map((userId) => ({
      userId,
      leadId: input.leadId,
      type: NotificationType.LEAD_ASSIGNED_TO_YOU,
      title: SR_CAD_REVIEW_TODO_TITLE,
      message: `Check ${lead.name} CAD work. Reason: ${actorName} started architect work on ${todoDate}.`,
      scheduledFor: when,
    }))

  if (notifications.length === 0) return

  await input.tx.notification.createMany({
    data: notifications,
  })
}

