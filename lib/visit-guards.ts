import { Prisma, VisitStatus } from '@/generated/prisma/client'

type VisitConflictInput = {
  assignedToId: string
  scheduledAt: Date
  excludeVisitId?: string
}

const ACTIVE_VISIT_STATUSES: VisitStatus[] = [VisitStatus.SCHEDULED, VisitStatus.RESCHEDULED]
const DEFAULT_CONFLICT_WINDOW_MINUTES = 90

function getConflictWindowMinutes(): number {
  const raw = process.env.VISIT_CONFLICT_WINDOW_MINUTES
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_CONFLICT_WINDOW_MINUTES
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CONFLICT_WINDOW_MINUTES
  return parsed
}

export function isFutureDate(date: Date): boolean {
  return date.getTime() > Date.now()
}

export async function findVisitConflict(
  tx: Prisma.TransactionClient,
  input: VisitConflictInput,
) {
  const windowMinutes = getConflictWindowMinutes()
  const start = new Date(input.scheduledAt.getTime() - windowMinutes * 60 * 1000)
  const end = new Date(input.scheduledAt.getTime() + windowMinutes * 60 * 1000)

  return tx.visit.findFirst({
    where: {
      assignedToId: input.assignedToId,
      status: { in: ACTIVE_VISIT_STATUSES },
      ...(input.excludeVisitId ? { id: { not: input.excludeVisitId } } : {}),
      scheduledAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      id: true,
      scheduledAt: true,
      leadId: true,
    },
    orderBy: {
      scheduledAt: 'asc',
    },
  })
}
