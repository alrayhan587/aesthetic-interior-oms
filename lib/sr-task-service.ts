import { NotificationType, Prisma } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'

export const DEFAULT_CAD_WORK_DETAILS =
  'Floor plan, furniture layout, beam layout, column layout, working detail, electrical and plumbing.'

export type SrTaskCard = {
  id: string
  leadId: string
  leadName: string
  leadStage: string
  leadSubStatus: string | null
  phaseType: string
  workDetails: string | null
  workerUserId: string
  workerName: string
  startedAt: Date
  dueAt: Date
  status: string
  completedAt: Date | null
  lastSrActionAt: Date | null
  lastNote: string | null
  lastNoteAt: Date | null
}

function toOptionalString(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toBooleanParam(value: string | null, fallback = false): boolean {
  const normalized = toOptionalString(value)?.toLowerCase()
  if (!normalized) return fallback
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parseIsoDate(value: string | null): Date | null {
  const normalized = toOptionalString(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseSrTaskQuery(searchParams: URLSearchParams): {
  myLeadsOnly: boolean
  from: Date | null
  to: Date | null
  todayOnly: boolean
} {
  return {
    myLeadsOnly: toBooleanParam(searchParams.get('myLeadsOnly'), true),
    from: parseIsoDate(searchParams.get('from')),
    to: parseIsoDate(searchParams.get('to')),
    todayOnly: toBooleanParam(searchParams.get('todayOnly'), false),
  }
}

export async function listSrTaskCards(input: {
  actorUserId: string
  isAdmin: boolean
  myLeadsOnly: boolean
  from?: Date | null
  to?: Date | null
  todayOnly?: boolean
}): Promise<SrTaskCard[]> {
  const whereParts: Prisma.Sql[] = [
    Prisma.sql`t."status"::text IN ('OPEN', 'IN_REVIEW', 'COMPLETED')`,
  ]

  if (input.todayOnly) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    whereParts.push(Prisma.sql`t."dueAt" >= ${start}`)
    whereParts.push(Prisma.sql`t."dueAt" < ${end}`)
    whereParts.push(Prisma.sql`t."status"::text IN ('OPEN', 'IN_REVIEW')`)
  } else {
    if (input.from) whereParts.push(Prisma.sql`t."dueAt" >= ${input.from}`)
    if (input.to) whereParts.push(Prisma.sql`t."dueAt" <= ${input.to}`)
  }

  const scopeMyLeadsOnly = !input.isAdmin || input.myLeadsOnly
  if (scopeMyLeadsOnly) {
    whereParts.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM "LeadAssignment" la
        WHERE la."leadId" = l."id"
          AND la."department" = 'SR_CRM'
          AND la."userId" = ${input.actorUserId}
      )
    `)
  } else {
    whereParts.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM "LeadAssignment" la
        WHERE la."leadId" = l."id"
          AND la."department" = 'SR_CRM'
      )
    `)
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`

  const rows = await prisma.$queryRaw<SrTaskCard[]>(Prisma.sql`
    SELECT
      t."id",
      t."leadId",
      l."name" AS "leadName",
      l."stage"::text AS "leadStage",
      l."subStatus"::text AS "leadSubStatus",
      t."phaseType"::text AS "phaseType",
      t."workDetails",
      t."assigneeUserId" AS "workerUserId",
      worker."fullName" AS "workerName",
      t."startedAt",
      t."dueAt",
      t."status"::text AS "status",
      t."completedAt",
      t."lastSrActionAt",
      ln."content" AS "lastNote",
      ln."createdAt" AS "lastNoteAt"
    FROM "LeadPhaseTask" t
    INNER JOIN "Lead" l ON l."id" = t."leadId"
    INNER JOIN "User" worker ON worker."id" = t."assigneeUserId"
    LEFT JOIN LATERAL (
      SELECT n."content", n."createdAt"
      FROM "Note" n
      WHERE n."leadId" = t."leadId" AND n."userId" = t."assigneeUserId"
      ORDER BY n."createdAt" DESC
      LIMIT 1
    ) ln ON true
    ${whereClause}
    ORDER BY t."dueAt" ASC, t."createdAt" DESC
  `)

  return rows
}

export async function ensureSrDeadlineAlerts(): Promise<void> {
  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)

  const overdueTasks = await prisma.leadPhaseTask.findMany({
    where: {
      status: { in: ['OPEN', 'IN_REVIEW'] },
      dueAt: { lt: now },
    },
    select: {
      id: true,
      leadId: true,
      dueAt: true,
      lastSrActionAt: true,
      phaseType: true,
      lead: { select: { name: true } },
      assignee: { select: { id: true, fullName: true } },
    },
    take: 200,
    orderBy: { dueAt: 'asc' },
  })

  if (overdueTasks.length === 0) return

  const leadIds = Array.from(new Set(overdueTasks.map((task) => task.leadId)))

  const [srAssignments, admins] = await Promise.all([
    prisma.leadAssignment.findMany({
      where: {
        leadId: { in: leadIds },
        department: 'SR_CRM',
      },
      select: { leadId: true, userId: true },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        userDepartments: { some: { department: { name: 'ADMIN' } } },
      },
      select: { id: true },
    }),
  ])

  const srByLead = new Map<string, string[]>()
  for (const row of srAssignments) {
    const list = srByLead.get(row.leadId) ?? []
    if (!list.includes(row.userId)) list.push(row.userId)
    srByLead.set(row.leadId, list)
  }

  const adminIds = admins.map((admin) => admin.id)
  if (adminIds.length === 0 && srByLead.size === 0) return

  const existingToday = await prisma.notification.findMany({
    where: {
      leadId: { in: leadIds },
      type: NotificationType.LEAD_ASSIGNED_TO_YOU,
      createdAt: { gte: dayStart },
      title: {
        in: [
          'JR deadline missed',
          'Senior CRM action missed on deadline day',
        ],
      },
    },
    select: { userId: true, leadId: true, title: true },
  })
  const existingSet = new Set(
    existingToday.map((item) => `${item.userId}|${item.leadId}|${item.title}`),
  )

  const notifications: Array<{
    userId: string
    leadId: string
    type: NotificationType
    title: string
    message: string
    scheduledFor: Date
  }> = []

  for (const task of overdueTasks) {
    const dueDate = task.dueAt.toISOString().slice(0, 10)
    const srUsers = srByLead.get(task.leadId) ?? []
    const jrDeadlineTitle = 'JR deadline missed'
    const jrDeadlineMessage = `${task.assignee.fullName} missed ${task.phaseType} deadline (${dueDate}) for ${task.lead.name}.`

    for (const srUserId of srUsers) {
      const key = `${srUserId}|${task.leadId}|${jrDeadlineTitle}`
      if (existingSet.has(key)) continue
      existingSet.add(key)
      notifications.push({
        userId: srUserId,
        leadId: task.leadId,
        type: NotificationType.LEAD_ASSIGNED_TO_YOU,
        title: jrDeadlineTitle,
        message: jrDeadlineMessage,
        scheduledFor: now,
      })
    }

    for (const adminId of adminIds) {
      const key = `${adminId}|${task.leadId}|${jrDeadlineTitle}`
      if (existingSet.has(key)) continue
      existingSet.add(key)
      notifications.push({
        userId: adminId,
        leadId: task.leadId,
        type: NotificationType.LEAD_ASSIGNED_TO_YOU,
        title: jrDeadlineTitle,
        message: jrDeadlineMessage,
        scheduledFor: now,
      })
    }

    const srMissedAction =
      task.lastSrActionAt === null ||
      task.lastSrActionAt.getTime() < task.dueAt.getTime()

    if (srMissedAction) {
      const srMissTitle = 'Senior CRM action missed on deadline day'
      const srMissMessage = `No Senior CRM action was recorded for ${task.lead.name} by deadline ${dueDate}.`
      for (const adminId of adminIds) {
        const key = `${adminId}|${task.leadId}|${srMissTitle}`
        if (existingSet.has(key)) continue
        existingSet.add(key)
        notifications.push({
          userId: adminId,
          leadId: task.leadId,
          type: NotificationType.LEAD_ASSIGNED_TO_YOU,
          title: srMissTitle,
          message: srMissMessage,
          scheduledFor: now,
        })
      }
    }
  }

  if (notifications.length === 0) return

  await prisma.notification.createMany({
    data: notifications,
  })
}

