import {
  ActivityType,
  LeadAssignmentDepartment,
  LeadJrArchitectRequestStatus,
  LeadPhaseTaskStatus,
  LeadPhaseType,
  LeadStage,
  LeadSubStatus,
  Prisma,
} from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { logActivity, logLeadStageChanged, logLeadSubStatusChanged, logUserAssigned } from '@/lib/activity-log-service'
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete'
import { DEFAULT_CAD_WORK_DETAILS } from '@/lib/sr-task-service'
import { createSrCadReviewTodosForCadStart } from '@/lib/sr-cad-todo'
import { hasJrArchitectureLeaderRole } from '@/lib/jr-architecture-roles'
import { ensureSeniorCrmAssignment } from '@/lib/lead-handoff'

type QueuePermissionFlags = {
  isAdmin: boolean
  isSeniorCrm: boolean
  isJrArchitect: boolean
  isVisitTeam: boolean
  isJrArchitectureLeader: boolean
}

export type VisitCompleteQueueItem = {
  leadId: string
  leadName: string
  leadPhone: string | null
  leadLocation: string | null
  stage: LeadStage
  subStatus: LeadSubStatus | null
  jrArchitectAssignee: { id: string; fullName: string; email: string } | null
  srCrmAssignee: { id: string; fullName: string; email: string } | null
  latestCompletedVisit: {
    id: string
    scheduledAt: Date
    completedAt: Date | null
    location: string
    projectSqft: number | null
    projectStatus: string | null
    assignedVisitLead: { id: string; fullName: string } | null
    summary: string | null
    clientMood: string | null
    clientPotentiality: string | null
    projectType: string | null
    clientPersonality: string | null
    budgetRange: string | null
    timelineUrgency: string | null
    stylePreference: string | null
  } | null
  pendingRequests: Array<{
    id: string
    requestedById: string
    requestedByName: string
    requestedByEmail: string
    note: string | null
    createdAt: Date
    status: LeadJrArchitectRequestStatus
  }>
}

export function getQueuePermissionFlags(
  actorDepartments: string[],
  actorRoles: string[] = [],
): QueuePermissionFlags {
  const departmentSet = new Set(actorDepartments)
  return {
    isAdmin: departmentSet.has('ADMIN'),
    isSeniorCrm: departmentSet.has('SR_CRM'),
    isJrArchitect: departmentSet.has('JR_ARCHITECT'),
    isVisitTeam: departmentSet.has('VISIT_TEAM'),
    isJrArchitectureLeader: hasJrArchitectureLeaderRole(actorRoles),
  }
}

export function canViewVisitCompleteQueue(flags: QueuePermissionFlags): boolean {
  return flags.isAdmin || flags.isSeniorCrm || flags.isJrArchitect
}

export function canAssignJrArchitect(flags: QueuePermissionFlags): boolean {
  return flags.isAdmin || flags.isSeniorCrm || flags.isVisitTeam || flags.isJrArchitectureLeader
}

export function canRequestJrArchitectWork(flags: QueuePermissionFlags): boolean {
  return flags.isJrArchitect
}

type AssignJrArchitectInput = {
  actorUserId: string
  actorDepartments: string[]
  actorRoles: string[]
  leadId: string
  jrArchitectUserId: string
  requestId?: string | null
  reason?: string | null
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function addIfValue(lines: string[], label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return
  lines.push(`${label}: ${value}`)
}

function buildCadWorkDetailsFromVisit(input: {
  leadName: string
  visit: {
    scheduledAt: Date
    location: string
    projectSqft: number | null
    projectStatus: string | null
    result: {
      summary: string
      clientMood: string | null
      clientPotentiality: string | null
      projectType: string | null
      clientPersonality: string | null
      budgetRange: string | null
      timelineUrgency: string | null
      stylePreference: string | null
      completedAt: Date
    } | null
  } | null
}): string {
  const lines: string[] = [DEFAULT_CAD_WORK_DETAILS]

  if (!input.visit) {
    lines.push('')
    lines.push('Visit Data: No completed visit result found while assigning CAD.')
    return lines.join('\n')
  }

  lines.push('')
  lines.push('Visit Context (Auto):')
  addIfValue(lines, 'Lead', input.leadName)
  addIfValue(lines, 'Visit Date', input.visit.scheduledAt.toISOString())
  addIfValue(lines, 'Visit Location', input.visit.location)
  addIfValue(lines, 'Project Sqft', input.visit.projectSqft)
  addIfValue(lines, 'Project Status', input.visit.projectStatus?.replace(/_/g, ' '))

  const result = input.visit.result
  if (result) {
    lines.push('')
    lines.push('Client & Site Notes (From Visit Result):')
    addIfValue(lines, 'Summary', cleanText(result.summary))
    addIfValue(lines, 'Client Mood', cleanText(result.clientMood))
    addIfValue(lines, 'Client Potentiality', cleanText(result.clientPotentiality))
    addIfValue(lines, 'Project Type', cleanText(result.projectType))
    addIfValue(lines, 'Client Personality', cleanText(result.clientPersonality))
    addIfValue(lines, 'Budget Range', cleanText(result.budgetRange))
    addIfValue(lines, 'Timeline Urgency', cleanText(result.timelineUrgency))
    addIfValue(lines, 'Style Preference', cleanText(result.stylePreference))
    addIfValue(lines, 'Result Completed At', result.completedAt.toISOString())
  }

  return lines.join('\n')
}

async function ensureJrArchitectUser(tx: Prisma.TransactionClient, userId: string): Promise<{
  id: string
  fullName: string
}> {
  const user = await tx.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      userDepartments: {
        some: {
          department: {
            name: 'JR_ARCHITECT',
          },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
    },
  })

  if (!user) throw new Error('JR_ARCHITECT_NOT_FOUND')
  return user
}

export async function listVisitCompleteQueueItems(input?: {
  srAssigneeUserId?: string | null
}): Promise<VisitCompleteQueueItem[]> {
  const leads = await prisma.lead.findMany({
    where: {
      stage: LeadStage.VISIT_PHASE,
      subStatus: LeadSubStatus.VISIT_COMPLETED,
      ...(input?.srAssigneeUserId
        ? {
            assignments: {
              some: {
                department: LeadAssignmentDepartment.SR_CRM,
                userId: input.srAssigneeUserId,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      location: true,
      stage: true,
      subStatus: true,
      assignments: {
        where: {
          department: {
            in: [LeadAssignmentDepartment.JR_ARCHITECT, LeadAssignmentDepartment.SR_CRM],
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          department: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      visits: {
        where: { status: 'COMPLETED' },
        orderBy: { scheduledAt: 'desc' },
        take: 1,
        select: {
          id: true,
          scheduledAt: true,
          location: true,
          projectSqft: true,
          projectStatus: true,
          assignedTo: {
            select: {
              id: true,
              fullName: true,
            },
          },
          result: {
            select: {
              summary: true,
              clientMood: true,
              clientPotentiality: true,
              projectType: true,
              clientPersonality: true,
              budgetRange: true,
              timelineUrgency: true,
              stylePreference: true,
              completedAt: true,
            },
          },
        },
      },
      jrArchitectRequests: {
        where: {
          status: LeadJrArchitectRequestStatus.PENDING,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          note: true,
          status: true,
          createdAt: true,
          requestedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { updated_at: 'desc' },
  })

  return leads.map((lead) => {
    const jrAssign = lead.assignments.find(
      (row) => row.department === LeadAssignmentDepartment.JR_ARCHITECT,
    )
    const srAssign = lead.assignments.find(
      (row) => row.department === LeadAssignmentDepartment.SR_CRM,
    )
    const latestVisit = lead.visits[0] ?? null
    const visitResult = latestVisit?.result ?? null

    return {
      leadId: lead.id,
      leadName: lead.name,
      leadPhone: lead.phone,
      leadLocation: lead.location,
      stage: lead.stage,
      subStatus: lead.subStatus,
      jrArchitectAssignee: jrAssign?.user ?? null,
      srCrmAssignee: srAssign?.user ?? null,
      latestCompletedVisit: latestVisit
        ? {
            id: latestVisit.id,
            scheduledAt: latestVisit.scheduledAt,
            completedAt: visitResult?.completedAt ?? null,
            location: latestVisit.location,
            projectSqft: latestVisit.projectSqft ?? null,
            projectStatus: latestVisit.projectStatus ?? null,
            assignedVisitLead: latestVisit.assignedTo ?? null,
            summary: visitResult?.summary ?? null,
            clientMood: visitResult?.clientMood ?? null,
            clientPotentiality: visitResult?.clientPotentiality ?? null,
            projectType: visitResult?.projectType ?? null,
            clientPersonality: visitResult?.clientPersonality ?? null,
            budgetRange: visitResult?.budgetRange ?? null,
            timelineUrgency: visitResult?.timelineUrgency ?? null,
            stylePreference: visitResult?.stylePreference ?? null,
          }
        : null,
      pendingRequests: lead.jrArchitectRequests.map((request) => ({
        id: request.id,
        requestedById: request.requestedBy.id,
        requestedByName: request.requestedBy.fullName,
        requestedByEmail: request.requestedBy.email,
        note: request.note,
        createdAt: request.createdAt,
        status: request.status,
      })),
    }
  })
}

export async function createVisitCompleteRequest(input: {
  actorUserId: string
  actorDepartments: string[]
  actorRoles?: string[]
  leadId: string
  note?: string | null
}) {
  const flags = getQueuePermissionFlags(input.actorDepartments, input.actorRoles ?? [])
  if (!canRequestJrArchitectWork(flags)) {
    throw new Error('FORBIDDEN')
  }

  const note = cleanText(input.note)

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: input.leadId },
      select: {
        id: true,
        stage: true,
        subStatus: true,
        assignments: {
          where: { department: LeadAssignmentDepartment.JR_ARCHITECT },
          take: 1,
          select: { id: true },
        },
      },
    })

    if (!lead) throw new Error('LEAD_NOT_FOUND')
    if (lead.stage !== LeadStage.VISIT_PHASE || lead.subStatus !== LeadSubStatus.VISIT_COMPLETED) {
      throw new Error('NOT_IN_VISIT_COMPLETED')
    }
    if (lead.assignments.length > 0) throw new Error('ALREADY_ASSIGNED')

    const existingPending = await tx.leadJrArchitectRequest.findFirst({
      where: {
        leadId: input.leadId,
        requestedById: input.actorUserId,
        status: LeadJrArchitectRequestStatus.PENDING,
      },
      select: { id: true },
    })

    if (existingPending) {
      return { requestId: existingPending.id, created: false }
    }

    const created = await tx.leadJrArchitectRequest.create({
      data: {
        leadId: input.leadId,
        requestedById: input.actorUserId,
        note,
      },
      select: { id: true },
    })

    await logActivity(tx, {
      leadId: input.leadId,
      userId: input.actorUserId,
      type: ActivityType.NOTE,
      description: 'JR Architect requested to work on this visit-completed lead.',
    })

    return { requestId: created.id, created: true }
  })
}

export async function assignJrArchitectFromVisitComplete(input: AssignJrArchitectInput) {
  const flags = getQueuePermissionFlags(input.actorDepartments, input.actorRoles)
  if (!canAssignJrArchitect(flags)) {
    throw new Error('FORBIDDEN')
  }

  const reason = cleanText(input.reason)
  const requestId = cleanText(input.requestId)

  return prisma.$transaction(async (tx) => {
    const [lead, jrArchitect] = await Promise.all([
      tx.lead.findUnique({
        where: { id: input.leadId },
        select: {
          id: true,
          name: true,
          stage: true,
          subStatus: true,
          assignments: {
            where: {
              department: {
                in: [LeadAssignmentDepartment.JR_ARCHITECT, LeadAssignmentDepartment.SR_CRM],
              },
            },
            select: {
              id: true,
              department: true,
              userId: true,
            },
          },
        },
      }),
      ensureJrArchitectUser(tx, input.jrArchitectUserId),
    ])

    if (!lead) throw new Error('LEAD_NOT_FOUND')
    if (lead.stage !== LeadStage.VISIT_PHASE || lead.subStatus !== LeadSubStatus.VISIT_COMPLETED) {
      throw new Error('NOT_IN_VISIT_COMPLETED')
    }

    if (flags.isVisitTeam && !flags.isAdmin && !flags.isSeniorCrm) {
      const hasCompletedVisitByActor = await tx.visit.count({
        where: {
          leadId: input.leadId,
          status: 'COMPLETED',
          assignedToId: input.actorUserId,
        },
      })
      if (hasCompletedVisitByActor === 0) {
        throw new Error('VISIT_TEAM_NOT_ALLOWED')
      }
    }

    const existingJrAssignment = lead.assignments.find(
      (row) => row.department === LeadAssignmentDepartment.JR_ARCHITECT,
    )

    if (existingJrAssignment) {
      await tx.leadAssignment.update({
        where: { id: existingJrAssignment.id },
        data: { userId: jrArchitect.id },
      })
    } else {
      await tx.leadAssignment.create({
        data: {
          leadId: input.leadId,
          userId: jrArchitect.id,
          department: LeadAssignmentDepartment.JR_ARCHITECT,
        },
      })
    }

    const preferActorAsSr = flags.isSeniorCrm || flags.isAdmin ? input.actorUserId : null
    await ensureSeniorCrmAssignment({
      tx,
      leadId: input.leadId,
      preferredUserId: preferActorAsSr,
      actorUserId: input.actorUserId,
    })

    await tx.lead.update({
      where: { id: input.leadId },
      data: {
        stage: LeadStage.CAD_PHASE,
        subStatus: LeadSubStatus.CAD_ASSIGNED,
      },
    })

    await logLeadStageChanged(tx, {
      leadId: input.leadId,
      userId: input.actorUserId,
      from: lead.stage,
      to: LeadStage.CAD_PHASE,
      reason: reason ?? 'JR Architect assigned from visit-complete queue',
    })

    await logLeadSubStatusChanged(tx, {
      leadId: input.leadId,
      userId: input.actorUserId,
      from: lead.subStatus,
      to: LeadSubStatus.CAD_ASSIGNED,
      reason: reason ?? 'JR Architect assigned from visit-complete queue',
    })

    const latestCompletedVisit = await tx.visit.findFirst({
      where: {
        leadId: input.leadId,
        status: 'COMPLETED',
      },
      orderBy: { scheduledAt: 'desc' },
      select: {
        id: true,
        scheduledAt: true,
        location: true,
        projectSqft: true,
        projectStatus: true,
        result: {
          select: {
            summary: true,
            clientMood: true,
            clientPotentiality: true,
            projectType: true,
            clientPersonality: true,
            budgetRange: true,
            timelineUrgency: true,
            stylePreference: true,
            completedAt: true,
          },
        },
      },
    })

    const now = new Date()
    const dueAt = new Date(now)
    dueAt.setDate(dueAt.getDate() + 3)

    await tx.leadPhaseTask.updateMany({
      where: {
        leadId: input.leadId,
        phaseType: LeadPhaseType.CAD,
        status: { in: [LeadPhaseTaskStatus.OPEN, LeadPhaseTaskStatus.IN_REVIEW] },
      },
      data: {
        status: LeadPhaseTaskStatus.CANCELLED,
        completedAt: now,
      },
    })

    const cadWorkDetails = buildCadWorkDetailsFromVisit({
      leadName: lead.name,
      visit: latestCompletedVisit
        ? {
            scheduledAt: latestCompletedVisit.scheduledAt,
            location: latestCompletedVisit.location,
            projectSqft: latestCompletedVisit.projectSqft ?? null,
            projectStatus: latestCompletedVisit.projectStatus ?? null,
            result: latestCompletedVisit.result ?? null,
          }
        : null,
    })

    const createdTask = await tx.leadPhaseTask.create({
      data: {
        leadId: input.leadId,
        phaseType: LeadPhaseType.CAD,
        workDetails: cadWorkDetails,
        assigneeUserId: jrArchitect.id,
        startedAt: now,
        dueAt,
        createdById: input.actorUserId,
        sourceVisitId: latestCompletedVisit?.id ?? null,
      },
      select: {
        id: true,
        dueAt: true,
      },
    })

    const pendingRequests = await tx.leadJrArchitectRequest.findMany({
      where: {
        leadId: input.leadId,
        status: LeadJrArchitectRequestStatus.PENDING,
      },
      select: {
        id: true,
      },
    })

    if (pendingRequests.length > 0) {
      const approvedRequestId = requestId ?? null
      await Promise.all(
        pendingRequests.map(async (pending) => {
          const nextStatus =
            approvedRequestId && pending.id === approvedRequestId
              ? LeadJrArchitectRequestStatus.APPROVED
              : LeadJrArchitectRequestStatus.REJECTED
          await tx.leadJrArchitectRequest.update({
            where: { id: pending.id },
            data: {
              status: nextStatus,
              reviewedById: input.actorUserId,
              reviewedAt: now,
            },
          })
        }),
      )
    }

    await createSrCadReviewTodosForCadStart({
      tx,
      leadId: input.leadId,
      fromStage: lead.stage,
      fromSubStatus: lead.subStatus,
      toStage: LeadStage.CAD_PHASE,
      toSubStatus: LeadSubStatus.CAD_ASSIGNED,
      triggeredByUserId: input.actorUserId,
      triggeredAt: now,
    })

    await logUserAssigned(tx, {
      leadId: input.leadId,
      userId: input.actorUserId,
      leadName: `${jrArchitect.fullName} assigned to JR_ARCHITECT department`,
    })

    await logActivity(tx, {
      leadId: input.leadId,
      userId: input.actorUserId,
      type: ActivityType.PHASE_DEADLINE_SET,
      description: `CAD task ${createdTask.id} created with deadline ${createdTask.dueAt.toISOString()}.`,
    })

    await autoCompletePendingFollowups(tx, {
      leadId: input.leadId,
      userId: input.actorUserId,
      action: 'assignment update',
    })

    return {
      taskId: createdTask.id,
      dueAt: createdTask.dueAt,
      jrArchitectId: jrArchitect.id,
      jrArchitectName: jrArchitect.fullName,
    }
  })
}
