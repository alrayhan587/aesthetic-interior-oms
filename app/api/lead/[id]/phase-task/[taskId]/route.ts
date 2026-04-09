import { ActivityType, LeadPhaseTaskStatus } from '@/generated/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { buildScopedLeadWhere } from '@/lib/lead-access'
import { canManagePrimaryLeadFlow, isSrOrAdmin } from '@/lib/lead-workflow-auth'
import { logActivity } from '@/lib/activity-log-service'

type RouteContext = {
  params: { id: string; taskId: string } | Promise<{ id: string; taskId: string }>
}

type UpdatePhaseTaskBody = {
  workDetails?: unknown
  assigneeUserId?: unknown
  dueAt?: unknown
  status?: unknown
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toTaskStatus(value: unknown): LeadPhaseTaskStatus | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return Object.values(LeadPhaseTaskStatus).includes(normalized as LeadPhaseTaskStatus)
    ? (normalized as LeadPhaseTaskStatus)
    : null
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorDepartments = authResult.actor.userDepartments ?? []
    if (!isSrOrAdmin(actorDepartments)) {
      return NextResponse.json({ success: false, error: 'Only SR CRM or Admin can update phase tasks' }, { status: 403 })
    }

    const { id: leadId, taskId } = await context.params
    if (!leadId || !taskId) {
      return NextResponse.json({ success: false, error: 'Invalid route params' }, { status: 400 })
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
      return NextResponse.json({ success: false, error: 'Only primary owner or admin can update phase tasks' }, { status: 403 })
    }

    const body = (await request.json()) as UpdatePhaseTaskBody
    const workDetails = toOptionalString(body.workDetails)
    const assigneeUserId = toOptionalString(body.assigneeUserId)
    const dueAtRaw = toOptionalString(body.dueAt)
    const nextStatus = toTaskStatus(body.status)

    const nextDueAt = dueAtRaw ? new Date(dueAtRaw) : null
    if (dueAtRaw && (!nextDueAt || Number.isNaN(nextDueAt.getTime()))) {
      return NextResponse.json({ success: false, error: 'dueAt must be a valid ISO date' }, { status: 400 })
    }

    const existingTask = await prisma.leadPhaseTask.findFirst({
      where: { id: taskId, leadId },
      select: {
        id: true,
        phaseType: true,
        dueAt: true,
        assigneeUserId: true,
        status: true,
      },
    })

    if (!existingTask) {
      return NextResponse.json({ success: false, error: 'Phase task not found' }, { status: 404 })
    }

    if (assigneeUserId) {
      const assigneeExists = await prisma.user.findUnique({ where: { id: assigneeUserId }, select: { id: true } })
      if (!assigneeExists) {
        return NextResponse.json({ success: false, error: 'Assignee user not found' }, { status: 404 })
      }
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.leadPhaseTask.update({
        where: { id: existingTask.id },
        data: {
          ...(body.workDetails !== undefined ? { workDetails } : {}),
          ...(assigneeUserId ? { assigneeUserId } : {}),
          ...(nextDueAt ? { dueAt: nextDueAt } : {}),
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(nextStatus === LeadPhaseTaskStatus.COMPLETED ? { completedAt: new Date() } : {}),
          ...(nextStatus && nextStatus !== LeadPhaseTaskStatus.COMPLETED ? { completedAt: null } : {}),
          ...(body.workDetails !== undefined || assigneeUserId || nextDueAt || nextStatus
            ? { lastSrActionAt: new Date() }
            : {}),
        },
        include: {
          assignee: { select: { id: true, fullName: true, email: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      })

      if (nextDueAt && nextDueAt.getTime() !== existingTask.dueAt.getTime()) {
        await logActivity(tx, {
          leadId,
          userId: authResult.actorUserId,
          type: ActivityType.PHASE_DEADLINE_SET,
          description: `${existingTask.phaseType} task deadline updated to ${nextDueAt.toISOString()}.`,
        })
      }

      return updated
    })

    return NextResponse.json({ success: true, data: updatedTask, message: 'Phase task updated successfully' })
  } catch (error) {
    console.error('[lead/:id/phase-task/:taskId][PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update phase task' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'PATCH, OPTIONS' },
  })
}
