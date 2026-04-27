import { ActivityType, LeadMeetingEventType } from '@/generated/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { canManagePrimaryLeadFlow, isSrOrAdmin } from '@/lib/lead-workflow-auth'
import { logActivity } from '@/lib/activity-log-service'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

type CreateMeetingBody = {
  type?: unknown
  title?: unknown
  notes?: unknown
  startsAt?: unknown
  endsAt?: unknown
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toMeetingType(value: unknown): LeadMeetingEventType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return Object.values(LeadMeetingEventType).includes(normalized as LeadMeetingEventType)
    ? (normalized as LeadMeetingEventType)
    : null
}

function defaultTitleForType(type: LeadMeetingEventType): string {
  if (type === LeadMeetingEventType.FIRST_MEETING) return 'First Meeting'
  if (type === LeadMeetingEventType.BUDGET_MEETING) return 'Budget Meeting'
  return 'Review Checkpoint'
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorDepartments = authResult.actor.userDepartments ?? []
    if (!isSrOrAdmin(actorDepartments)) {
      return NextResponse.json({ success: false, error: 'Only SR CRM or Admin can schedule meetings' }, { status: 403 })
    }

    const { id: leadId } = await context.params
    if (!leadId || typeof leadId !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
    }

    const body = (await request.json()) as CreateMeetingBody
    const type = toMeetingType(body.type)
    const title = toOptionalString(body.title)
    const notes = toOptionalString(body.notes)
    const startsAtRaw = toOptionalString(body.startsAt)
    const endsAtRaw = toOptionalString(body.endsAt)

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'type must be FIRST_MEETING, BUDGET_MEETING, or REVIEW_CHECKPOINT' },
        { status: 400 },
      )
    }

    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null
    const endsAt = endsAtRaw ? new Date(endsAtRaw) : null

    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ success: false, error: 'startsAt is required and must be valid ISO date' }, { status: 400 })
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ success: false, error: 'endsAt must be valid ISO date' }, { status: 400 })
    }
    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
      return NextResponse.json({ success: false, error: 'endsAt must be after startsAt' }, { status: 400 })
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, name: true, primaryOwnerUserId: true },
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
      return NextResponse.json(
        { success: false, error: 'Only primary owner, Senior CRM, or admin can schedule meetings' },
        { status: 403 },
      )
    }

    const meeting = await prisma.$transaction(async (tx) => {
      const created = await tx.leadMeetingEvent.create({
        data: {
          leadId,
          type,
          title: title ?? defaultTitleForType(type),
          notes,
          startsAt,
          endsAt,
          createdById: authResult.actorUserId,
        },
        include: {
          lead: { select: { id: true, name: true, stage: true, subStatus: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      })

      await logActivity(tx, {
        leadId,
        userId: authResult.actorUserId,
        type: ActivityType.MEETING_SCHEDULED,
        description: `${defaultTitleForType(type)} scheduled at ${startsAt.toISOString()}.`,
      })

      return created
    })

    return NextResponse.json({
      success: true,
      data: meeting,
      message: 'Meeting scheduled successfully',
    })
  } catch (error) {
    console.error('[lead/:id/meetings][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to schedule meeting' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  })
}
