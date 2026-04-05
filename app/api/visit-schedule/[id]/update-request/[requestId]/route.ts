import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ActivityType, LeadStage, VisitStatus, VisitUpdateRequestStatus, VisitUpdateRequestType } from '@/generated/prisma/client'
import { requireDatabaseRoles } from '@/lib/authz'
import { logActivity, logLeadStageChanged } from '@/lib/activity-log-service'
import { findVisitConflict, isFutureDate } from '@/lib/visit-guards'

type RouteContext = {
  params:
    | { id: string; requestId: string }
    | Promise<{ id: string; requestId: string }>
}

type ResolveBody = {
  action?: unknown
  scheduledAt?: unknown
  reason?: unknown
}

async function resolveParams(context: RouteContext): Promise<{ visitId: string | null; requestId: string | null }> {
  const resolved = await context.params
  const visitId = typeof resolved?.id === 'string' ? resolved.id.trim() : ''
  const requestId = typeof resolved?.requestId === 'string' ? resolved.requestId.trim() : ''
  return {
    visitId: visitId || null,
    requestId: requestId || null,
  }
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response
    const actorUserId = authResult.actorUserId

    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        userDepartments: {
          select: {
            department: { select: { name: true } },
          },
        },
      },
    })
    const departments = new Set((actor?.userDepartments ?? []).map((d) => d.department.name))
    const canManage = departments.has('JR_CRM') || departments.has('ADMIN')
    if (!canManage) {
      return NextResponse.json(
        { success: false, error: 'Only JR_CRM/Admin can resolve update requests' },
        { status: 403 },
      )
    }

    const { visitId, requestId } = await resolveParams(context)
    if (!visitId || !requestId) {
      return NextResponse.json({ success: false, error: 'Invalid visit/request id' }, { status: 400 })
    }

    const body = (await request.json()) as ResolveBody
    const action = toOptionalString(body.action)?.toUpperCase()
    const scheduledAtRaw = toOptionalString(body.scheduledAt)
    const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null
    const reason = toOptionalString(body.reason)

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json({ success: false, error: 'action must be APPROVE or REJECT' }, { status: 400 })
    }
    if (scheduledAtRaw && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
      return NextResponse.json({ success: false, error: 'scheduledAt must be a valid ISO datetime' }, { status: 400 })
    }
    const existing = await prisma.visitUpdateRequest.findUnique({
      where: { id: requestId },
      include: {
        visit: {
          select: {
            id: true,
            leadId: true,
            assignedToId: true,
            lead: {
              select: {
                stage: true,
                subStatus: true,
              },
            },
          },
        },
      },
    })
    if (!existing || existing.visitId !== visitId) {
      return NextResponse.json({ success: false, error: 'Update request not found' }, { status: 404 })
    }
    if (existing.status !== VisitUpdateRequestStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: 'This request is already resolved' },
        { status: 409 },
      )
    }

    const resolved = await prisma.$transaction(async (tx) => {
      const nextRequestStatus =
        action === 'APPROVE' ? VisitUpdateRequestStatus.APPROVED : VisitUpdateRequestStatus.REJECTED

      const updatedRequest = await tx.visitUpdateRequest.update({
        where: { id: requestId },
        data: {
          status: nextRequestStatus,
          resolvedById: actorUserId,
          resolvedAt: new Date(),
        },
      })

      if (action === 'APPROVE') {
        if (existing.type === VisitUpdateRequestType.CANCEL) {
          await tx.visit.update({
            where: { id: visitId },
            data: { status: VisitStatus.CANCELLED },
          })
          if (existing.visit.lead.stage !== LeadStage.VISIT_CANCELLED) {
            await tx.lead.update({
              where: { id: existing.visit.leadId },
              data: { stage: LeadStage.VISIT_CANCELLED, subStatus: null },
            })
            await logLeadStageChanged(tx, {
              leadId: existing.visit.leadId,
              userId: actorUserId,
              from: existing.visit.lead.stage,
              to: LeadStage.VISIT_CANCELLED,
              reason: 'Visit cancel request approved',
            })
          }
        }

        if (existing.type === VisitUpdateRequestType.RESCHEDULE) {
          const resolvedScheduleAt = scheduledAt ?? existing.requestedScheduleAt
          if (!resolvedScheduleAt || Number.isNaN(resolvedScheduleAt.getTime())) {
            throw new Error('RESCHEDULE_DATE_REQUIRED')
          }
          if (!isFutureDate(resolvedScheduleAt)) {
            throw new Error('RESCHEDULE_MUST_BE_FUTURE')
          }
          if (existing.visit.assignedToId) {
            const conflict = await findVisitConflict(tx, {
              assignedToId: existing.visit.assignedToId,
              scheduledAt: resolvedScheduleAt,
              excludeVisitId: visitId,
            })
            if (conflict) {
              throw new Error('VISIT_CONFLICT')
            }
          }

          await tx.visit.update({
            where: { id: visitId },
            data: {
              status: VisitStatus.RESCHEDULED,
              scheduledAt: resolvedScheduleAt,
            },
          })
          if (existing.visit.lead.stage !== LeadStage.VISIT_RESCHEDULED) {
            await tx.lead.update({
              where: { id: existing.visit.leadId },
              data: { stage: LeadStage.VISIT_RESCHEDULED, subStatus: null },
            })
            await logLeadStageChanged(tx, {
              leadId: existing.visit.leadId,
              userId: actorUserId,
              from: existing.visit.lead.stage,
              to: LeadStage.VISIT_RESCHEDULED,
              reason: 'Visit reschedule request approved',
            })
          }
        }
      }

      const reasonPart = reason ? ` Reason: ${reason}` : ''
      await logActivity(tx, {
        leadId: existing.visit.leadId,
        userId: actorUserId,
        type: ActivityType.NOTE,
        description: `JR CRM ${action}D visit update request (${existing.type}) for visit ${visitId}.${reasonPart}`,
      })

      return updatedRequest
    })

    return NextResponse.json({
      success: true,
      data: resolved,
      message: action === 'APPROVE' ? 'Request approved and visit updated' : 'Request rejected',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'RESCHEDULE_DATE_REQUIRED') {
      return NextResponse.json(
        { success: false, error: 'A valid reschedule date is required to approve this request' },
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message === 'RESCHEDULE_MUST_BE_FUTURE') {
      return NextResponse.json(
        { success: false, error: 'Reschedule date must be in the future' },
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message === 'VISIT_CONFLICT') {
      return NextResponse.json(
        { success: false, error: 'Assigned visit team member already has a nearby scheduled visit' },
        { status: 409 },
      )
    }
    console.error('[visit-schedule/:id/update-request/:requestId][PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to resolve visit update request' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'PATCH, OPTIONS' },
  })
}
