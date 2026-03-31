import { NextRequest, NextResponse } from 'next/server'
import { NotificationType } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'

function toPositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

async function ensureFollowupDueNotifications(userId: string) {
  const now = new Date()
  const reminderWindowEnd = new Date(now.getTime() + 15 * 60 * 1000)

  const reminderFollowups = await prisma.followUp.findMany({
    where: {
      assignedToId: userId,
      status: 'PENDING',
      followupDate: { gt: now, lte: reminderWindowEnd },
      notifications: {
        none: {
          userId,
          type: NotificationType.FOLLOWUP_REMINDER_15M,
        },
      },
    },
    include: {
      lead: {
        select: { id: true, name: true },
      },
    },
    take: 100,
    orderBy: { followupDate: 'asc' },
  })

  const dueFollowups = await prisma.followUp.findMany({
    where: {
      assignedToId: userId,
      status: 'PENDING',
      followupDate: { lte: now },
      notifications: {
        none: {
          userId,
          type: NotificationType.FOLLOWUP_DUE,
        },
      },
    },
    include: {
      lead: {
        select: { id: true, name: true },
      },
    },
    take: 100,
    orderBy: { followupDate: 'asc' },
  })

  if (reminderFollowups.length === 0 && dueFollowups.length === 0) return

  if (reminderFollowups.length > 0) {
    await prisma.notification.createMany({
      data: reminderFollowups.map((followup) => ({
        userId,
        leadId: followup.leadId,
        followUpId: followup.id,
        type: NotificationType.FOLLOWUP_REMINDER_15M,
        title: 'Follow-up in 15 minutes',
        message: `Upcoming follow-up for ${followup.lead.name}.`,
        scheduledFor: followup.followupDate,
      })),
      skipDuplicates: true,
    })
  }

  await prisma.notification.createMany({
    data: dueFollowups.map((followup) => ({
      userId,
      leadId: followup.leadId,
      followUpId: followup.id,
      type: NotificationType.FOLLOWUP_DUE,
      title: 'Follow-up due',
      message: `Follow-up for ${followup.lead.name} is due now.`,
      scheduledFor: followup.followupDate,
    })),
    skipDuplicates: true,
  })
}

async function clearOrphanFollowupNotifications(userId: string) {
  await prisma.notification.deleteMany({
    where: {
      userId,
      type: {
        in: [NotificationType.FOLLOWUP_DUE, NotificationType.FOLLOWUP_REMINDER_15M],
      },
      OR: [{ leadId: null }, { followUpId: null }],
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const userId = authResult.actorUserId
    const limit = toPositiveInt(request.nextUrl.searchParams.get('limit'), 20, 100)

    await clearOrphanFollowupNotifications(userId)
    await ensureFollowupDueNotifications(userId)

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        include: {
          lead: {
            select: { id: true, name: true },
          },
          followUp: {
            select: { id: true, followupDate: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items,
        unreadCount,
      },
    })
  } catch (error) {
    console.error('[notifications][GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 },
    )
  }
}

export async function PATCH() {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    await prisma.notification.updateMany({
      where: {
        userId: authResult.actorUserId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'All notifications marked as read',
    })
  } catch (error) {
    console.error('[notifications][PATCH] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'GET, PATCH, OPTIONS' },
  })
}
