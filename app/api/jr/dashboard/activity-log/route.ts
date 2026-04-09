import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { ActivityType } from '@/generated/prisma/client'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 20

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const actionLabelMap: Record<ActivityType, string> = {
  CALL: 'Call Made',
  STATUS_CHANGE: 'Status Changed',
  NOTE: 'Note Added',
  FOLLOWUP_SET: 'Followup Set',
  FOLLOWUP_COMPLETED: 'Followup Completed',
  VISIT_SCHEDULED: 'Visit Scheduled',
  LEAD_CREATED: 'Lead Created',
  USER_ASSIGNED: 'User Assigned',
  SR_TAKEOVER: 'SR Takeover',
  PHASE_DEADLINE_SET: 'Phase Deadline Set',
  PHASE_REVIEW_ROUND: 'Phase Review Round',
  MEETING_SCHEDULED: 'Meeting Scheduled',
  HANDOFF_TRIGGERED: 'Handoff Triggered',
}

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    })

    if (!actor) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      )
    }

    const { searchParams } = new URL(request.url)
    const parsedLimit = toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT)
    const limit = Math.min(parsedLimit, MAX_LIMIT)
    const offset = Math.max(0, toPositiveInt(searchParams.get('offset'), 0))

    const activities = await prisma.activityLog.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
      include: {
        lead: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true } },
      },
    })
    const hasMore = activities.length > limit
    const sliced = hasMore ? activities.slice(0, limit) : activities

    return NextResponse.json({
      success: true,
      data: sliced.map((activity) => ({
        id: activity.id,
        userId: activity.userId,
        userName: activity.user?.fullName ?? 'Unknown',
        leadId: activity.leadId,
        leadName: activity.lead?.name ?? 'Unknown',
        action: actionLabelMap[activity.type] ?? activity.type,
        description: activity.description,
        createdAt: activity.createdAt,
      })),
      pagination: {
        offset,
        limit,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      },
    })
  } catch (error) {
    console.error('[GET /api/jr/dashboard/activity-log] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load activity log' },
      { status: 500 },
    )
  }
}
