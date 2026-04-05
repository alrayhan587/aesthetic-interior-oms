import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ActivityType, VisitUpdateRequestStatus, VisitUpdateRequestType } from '@/generated/prisma/client'
import { requireDatabaseRoles } from '@/lib/authz'
import { logActivity } from '@/lib/activity-log-service'
import { findVisitConflict, isFutureDate } from '@/lib/visit-guards'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

type CreateUpdateRequestBody = {
  type?: unknown
  reason?: unknown
  requestedScheduleAt?: unknown
}

async function resolveVisitId(context: RouteContext): Promise<string | null> {
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

function toRequestType(value: unknown): VisitUpdateRequestType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return Object.values(VisitUpdateRequestType).includes(normalized as VisitUpdateRequestType)
    ? (normalized as VisitUpdateRequestType)
    : null
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const visitId = await resolveVisitId(context)
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit id' }, { status: 400 })
    }

    const requests = await prisma.visitUpdateRequest.findMany({
      where: { visitId },
      include: {
        requestedBy: { select: { id: true, fullName: true, email: true } },
        resolvedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: requests })
  } catch (error) {
    console.error('[visit-schedule/:id/update-request][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch visit update requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response
    const actorUserId = authResult.actorUserId

    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        userDepartments: {
          select: {
            department: { select: { name: true } },
          },
        },
      },
    })
    const isVisitTeam = (actor?.userDepartments ?? []).some((d) => d.department.name === 'VISIT_TEAM')
    if (!isVisitTeam) {
      return NextResponse.json(
        { success: false, error: 'Only VISIT_TEAM can request reschedule/cancel' },
        { status: 403 },
      )
    }

    const visitId = await resolveVisitId(context)
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit id' }, { status: 400 })
    }

    const body = (await request.json()) as CreateUpdateRequestBody
    const type = toRequestType(body.type)
    const reason = toOptionalString(body.reason)
    const requestedScheduleAtRaw = toOptionalString(body.requestedScheduleAt)
    const requestedScheduleAt = requestedScheduleAtRaw ? new Date(requestedScheduleAtRaw) : null

    if (!type || !reason) {
      return NextResponse.json(
        { success: false, error: 'type and reason are required' },
        { status: 400 },
      )
    }
    if (type === VisitUpdateRequestType.RESCHEDULE) {
      if (!requestedScheduleAt || Number.isNaN(requestedScheduleAt.getTime())) {
        return NextResponse.json(
          { success: false, error: 'requestedScheduleAt is required for RESCHEDULE request' },
          { status: 400 },
        )
      }
      if (!isFutureDate(requestedScheduleAt)) {
        return NextResponse.json(
          { success: false, error: 'requestedScheduleAt must be in the future' },
          { status: 400 },
        )
      }
    }

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      select: { id: true, leadId: true, assignedToId: true },
    })
    if (!visit) {
      return NextResponse.json({ success: false, error: 'Visit not found' }, { status: 404 })
    }

    const isAssignedByVisit = visit.assignedToId === actorUserId
    const isAssignedByLead = await prisma.leadAssignment.findFirst({
      where: {
        leadId: visit.leadId,
        userId: actorUserId,
        department: 'VISIT_TEAM',
      },
      select: { id: true },
    })
    if (!isAssignedByVisit && !isAssignedByLead) {
      return NextResponse.json(
        { success: false, error: 'You can request updates only for your assigned visits' },
        { status: 403 },
      )
    }

    const pendingExisting = await prisma.visitUpdateRequest.findFirst({
      where: {
        visitId,
        status: VisitUpdateRequestStatus.PENDING,
      },
      select: { id: true },
    })
    if (pendingExisting) {
      return NextResponse.json(
        { success: false, error: 'A pending update request already exists for this visit' },
        { status: 409 },
      )
    }

    const created = await prisma.$transaction(async (tx) => {
      if (type === VisitUpdateRequestType.RESCHEDULE && requestedScheduleAt && visit.assignedToId) {
        const conflict = await findVisitConflict(tx, {
          assignedToId: visit.assignedToId,
          scheduledAt: requestedScheduleAt,
          excludeVisitId: visitId,
        })
        if (conflict) {
          throw new Error('VISIT_CONFLICT')
        }
      }

      const newRequest = await tx.visitUpdateRequest.create({
        data: {
          visitId,
          type,
          reason,
          requestedScheduleAt: type === VisitUpdateRequestType.RESCHEDULE ? requestedScheduleAt : null,
          requestedById: actorUserId,
        },
      })

      await logActivity(tx, {
        leadId: visit.leadId,
        userId: actorUserId,
        type: ActivityType.NOTE,
        description:
          type === VisitUpdateRequestType.RESCHEDULE
            ? `Visit team requested RESCHEDULE for visit ${visitId}.`
            : `Visit team requested CANCEL for visit ${visitId}.`,
      })

      return newRequest
    })

    return NextResponse.json(
      { success: true, data: created, message: 'Visit update request sent to JR CRM' },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'VISIT_CONFLICT') {
      return NextResponse.json(
        { success: false, error: 'Assigned visit team member already has a nearby scheduled visit' },
        { status: 409 },
      )
    }
    console.error('[visit-schedule/:id/update-request][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create visit update request' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'GET, POST, OPTIONS' },
  })
}
