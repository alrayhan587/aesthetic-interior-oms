import prisma from '@/lib/prisma';
import { Prisma, FollowUpStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/followup - Get all follow-ups with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Filtering
    const leadId = searchParams.get('leadId')
    const assignedToId = searchParams.get('assignedToId')
    const status = searchParams.get('status') as FollowUpStatus | null
    const statusesParam = searchParams.get('statuses')
    const upcoming = searchParams.get('upcoming') === 'true'
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Build where clause
    const where: Prisma.FollowUpWhereInput = {}

    if (leadId) where.leadId = leadId
    if (assignedToId) where.assignedToId = assignedToId
    const parsedStatuses = statusesParam
      ?.split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is FollowUpStatus =>
        Object.values(FollowUpStatus).includes(value as FollowUpStatus),
      ) ?? []

    if (parsedStatuses.length > 0) {
      where.status = { in: parsedStatuses }
    } else if (status && Object.values(FollowUpStatus).includes(status)) {
      where.status = status
    }
    if (upcoming) {
      where.followupDate = { gte: new Date() }
      where.status = FollowUpStatus.PENDING
    }
    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null
    if (fromDate && Number.isNaN(fromDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid "from" date' },
        { status: 400 },
      )
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid "to" date' },
        { status: 400 },
      )
    }
    if (fromDate || toDate) {
      where.followupDate = {
        ...(where.followupDate as Prisma.DateTimeFilter | undefined),
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      }
    }

    // Get follow-ups with pagination
    const [followUps, total] = await Promise.all([
      prisma.followUp.findMany({
        where,
        include: {
          lead: {
            select: { id: true, name: true, email: true, phone: true, stage: true, subStatus:true },
          },
          assignedTo: {
            select: { id: true, fullName: true, email: true },
          },
        },
        skip,
        take: limit,
        orderBy: { followupDate: 'asc' },
      }),
      prisma.followUp.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: followUps,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: unknown) {
    console.error('Error fetching follow-ups:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch follow-ups',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
