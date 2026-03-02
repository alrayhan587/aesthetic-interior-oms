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
    const upcoming = searchParams.get('upcoming') === 'true'

    // Build where clause
    const where: Prisma.FollowUpWhereInput = {}

    if (leadId) where.leadId = leadId
    if (assignedToId) where.assignedToId = assignedToId
    if (status && Object.values(FollowUpStatus).includes(status)) where.status = status
    if (upcoming) {
      where.followupDate = { gte: new Date() }
      where.status = FollowUpStatus.PENDING
    }

    // Get follow-ups with pagination
    const [followUps, total] = await Promise.all([
      prisma.followUp.findMany({
        where,
        include: {
          lead: {
            select: { id: true, name: true, email: true, phone: true, status: true },
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
  } catch (error: any) {
    console.error('Error fetching follow-ups:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch follow-ups', message: error.message },
      { status: 500 }
    )
  }
}

// POST /api/followup - Create a new follow-up
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      leadId,
      assignedToId,
      followupDate,
      notes,
      userId, // User creating the follow-up (for activity log)
    } = body

    // Validation
    if (!leadId || !assignedToId || !followupDate) {
      return NextResponse.json(
        { success: false, error: 'Lead ID, assigned user, and follow-up date are required' },
        { status: 400 }
      )
    }

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    })

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Check if assigned user exists
    const user = await prisma.user.findUnique({
      where: { id: assignedToId },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Assigned user not found' },
        { status: 404 }
      )
    }

    // Create follow-up with transaction to log activity
    const followUp = await prisma.$transaction(async (tx) => {
      const newFollowUp = await tx.followUp.create({
        data: {
          leadId,
          assignedToId,
          followupDate: new Date(followupDate),
          notes,
        },
        include: {
          lead: {
            select: { id: true, name: true, email: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Log activity if userId is provided
      if (userId) {
        await tx.activityLog.create({
          data: {
            leadId,
            userId,
            type: "FOLLOW_UP_SCHEDULED",
            description: `Follow-up scheduled for ${new Date(followupDate).toLocaleDateString()}`,
          },
        });
      }

      return newFollowUp;
    });

    return NextResponse.json(
      { success: true, data: followUp, message: "Follow-up created successfully" },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Error creating follow-up:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create follow-up", message: error.message },
      { status: 500 }
    )
  }
}
