import {
  ActivityType,
  LeadAssignmentDepartment,
  LeadPhaseTaskStatus,
  LeadPhaseType,
  Prisma,
} from '@/generated/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { buildScopedLeadWhere } from '@/lib/lead-access'
import { canManagePrimaryLeadFlow, isSrOrAdmin } from '@/lib/lead-workflow-auth'
import { logActivity } from '@/lib/activity-log-service'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

type CreatePhaseTaskBody = {
  phaseType?: unknown
  assigneeUserId?: unknown
  dueAt?: unknown
  status?: unknown
}

async function resolveLeadId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params
  const id = resolvedParams?.id
  if (typeof id !== 'string') return null
  const trimmed = id.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toPhaseType(value: unknown): LeadPhaseType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return Object.values(LeadPhaseType).includes(normalized as LeadPhaseType)
    ? (normalized as LeadPhaseType)
    : null
}

function toTaskStatus(value: unknown): LeadPhaseTaskStatus | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return Object.values(LeadPhaseTaskStatus).includes(normalized as LeadPhaseTaskStatus)
    ? (normalized as LeadPhaseTaskStatus)
    : null
}

function defaultDepartmentForPhase(phaseType: LeadPhaseType): LeadAssignmentDepartment {
  return phaseType === LeadPhaseType.CAD
    ? LeadAssignmentDepartment.JR_ARCHITECT
    : LeadAssignmentDepartment.QUOTATION
}

async function resolveValidAssigneeUserId(input: {
  requestedAssignee: string | null
  fallbackAssignee: string | null
  actorUserId: string
}): Promise<string | null> {
  const candidates = Array.from(
    new Set(
      [input.requestedAssignee, input.fallbackAssignee, input.actorUserId].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
    ),
  )

  if (candidates.length === 0) return null

  const users = await prisma.user.findMany({
    where: { id: { in: candidates } },
    select: { id: true },
  })
  const existing = new Set(users.map((user) => user.id))

  if (input.requestedAssignee && existing.has(input.requestedAssignee)) return input.requestedAssignee
  if (input.fallbackAssignee && existing.has(input.fallbackAssignee)) return input.fallbackAssignee
  if (existing.has(input.actorUserId)) return input.actorUserId

  return null
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorDepartments = authResult.actor.userDepartments ?? []
    if (!isSrOrAdmin(actorDepartments)) {
      return NextResponse.json({ success: false, error: 'Only SR CRM or Admin can create phase tasks' }, { status: 403 })
    }

    const leadId = await resolveLeadId(context)
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
    }

    const body = (await request.json()) as CreatePhaseTaskBody
    const phaseType = toPhaseType(body.phaseType)
    const status = toTaskStatus(body.status) ?? LeadPhaseTaskStatus.OPEN
    const dueAtRaw = toOptionalString(body.dueAt)
    const dueAt = dueAtRaw ? new Date(dueAtRaw) : null

    if (!phaseType) {
      return NextResponse.json({ success: false, error: 'phaseType must be CAD or QUOTATION' }, { status: 400 })
    }
    if (!dueAt || Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ success: false, error: 'dueAt must be a valid ISO date' }, { status: 400 })
    }

    const scopedWhere = buildScopedLeadWhere({
      leadId,
      actorUserId: authResult.actorUserId,
      actorDepartments,
    })

    const lead = await prisma.lead.findFirst({
      where: scopedWhere,
      select: { id: true, primaryOwnerUserId: true },
    })
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    if (
      !canManagePrimaryLeadFlow({
        actorUserId: authResult.actorUserId,
        actorDepartments,
        lead: { primaryOwnerUserId: lead.primaryOwnerUserId },
      })
    ) {
      return NextResponse.json({ success: false, error: 'Only primary owner or admin can manage phase tasks' }, { status: 403 })
    }

    const requestedAssignee = toOptionalString(body.assigneeUserId)
    const fallbackAssignment = await prisma.leadAssignment.findFirst({
      where: {
        leadId,
        department: defaultDepartmentForPhase(phaseType),
      },
      orderBy: { createdAt: 'desc' },
      select: { userId: true },
    })

    const assigneeUserId = await resolveValidAssigneeUserId({
      requestedAssignee,
      fallbackAssignee: fallbackAssignment?.userId ?? null,
      actorUserId: authResult.actorUserId,
    })
    if (!assigneeUserId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid assignee found. Re-assign the lead department user and try again.',
        },
        { status: 400 },
      )
    }

    const task = await prisma.leadPhaseTask.create({
      data: {
        leadId,
        phaseType,
        assigneeUserId,
        dueAt,
        status,
        createdById: authResult.actorUserId,
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    await logActivity(prisma, {
      leadId,
      userId: authResult.actorUserId,
      type: ActivityType.PHASE_DEADLINE_SET,
      description: `${phaseType} task deadline set to ${task.dueAt.toISOString()}.`,
    })

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Phase task created successfully',
    })
  } catch (error) {
    console.error('[lead/:id/phase-task][POST] Error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json(
        { success: false, error: 'Selected assignee is invalid. Please choose an active existing user.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: false, error: 'Failed to create phase task' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  })
}
