import prisma from '@/lib/prisma';
import { FollowUpStatus, Prisma } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveFollowUpId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params;
  const id = resolvedParams?.id;
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// GET /api/followup/[id] - Get a single follow-up by ID
export async function GET(_request: NextRequest, context: RouteContext) {
  const id = await resolveFollowUpId(context);
  if (!id) {
    return NextResponse.json({ success: false, error: 'Invalid follow-up id' }, { status: 400 });
  }

  try {
    const followUp = await prisma.followUp.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            location: true,
          },
        },
        assignedTo: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: 'Follow-up not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: followUp });
  } catch (error: any) {
    console.error('Error fetching follow-up:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch follow-up', message: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/followup/[id] - Update a follow-up
export async function PUT(request: NextRequest, context: RouteContext) {
  const id = await resolveFollowUpId(context);
  if (!id) {
    return NextResponse.json({ success: false, error: 'Invalid follow-up id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const {
      assignedToId,
      followupDate,
      status,
      notes,
      userId, // User updating the follow-up (for activity log)
    } = body

    // Check if follow-up exists
    const existingFollowUp = await prisma.followUp.findUnique({ where: { id } });
    if (!existingFollowUp) {
      return NextResponse.json(
        { success: false, error: 'Follow-up not found' },
        { status: 404 }
      );
    }

    // Validate assigned user if provided
    if (assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Assigned user not found' },
          { status: 404 }
        );
      }
    }

    // Update follow-up with transaction to log activity
    const followUp = await prisma.$transaction(async (tx) => {
      const updatedFollowUp = await tx.followUp.update({
        where: { id },
        data: {
          ...(assignedToId !== undefined ? { assignedToId } : {}),
          ...(followupDate !== undefined ? { followupDate: new Date(followupDate) } : {}),
          ...(status !== undefined ? { status: status as FollowUpStatus } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
        include: {
          lead: {
            select: { id: true, name: true, email: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, email: true },
          },
        },
      })

      // Log activity when follow-up is completed
      if (
        status === FollowUpStatus.COMPLETED &&
        existingFollowUp.status !== FollowUpStatus.COMPLETED &&
        userId
      ) {
        await tx.activityLog.create({
          data: {
            leadId: existingFollowUp.leadId,
            userId,
            type: 'FOLLOW_UP_COMPLETED',
            description: `Follow-up completed for lead`,
          },
        })
      }

      return updatedFollowUp
    })

    return NextResponse.json({
      success: true,
      data: followUp,
      message: 'Follow-up updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating follow-up:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update follow-up', message: error.message },
      { status: 500 }
    )
  }
}

// PATCH /api/followup/[id] - Partial update a follow-up
export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = await resolveFollowUpId(context);
  if (!id) {
    return NextResponse.json({ success: false, error: 'Invalid follow-up id' }, { status: 400 });
  }

  try {
    const body = await request.json()

    // Check if follow-up exists
    const existingFollowUp = await prisma.followUp.findUnique({ where: { id } })
    if (!existingFollowUp) {
      return NextResponse.json(
        { success: false, error: 'Follow-up not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Prisma.FollowUpUpdateInput = {}
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId
    if (body.followupDate !== undefined) updateData.followupDate = new Date(body.followupDate)
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes

    const followUp = await prisma.followUp.update({
      where: { id },
      data: updateData,
      include: {
        lead: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, fullName: true, email: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: followUp,
      message: 'Follow-up updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating follow-up:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update follow-up', message: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/followup/[id] - Delete a follow-up
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = await resolveFollowUpId(context);
  if (!id) {
    return NextResponse.json({ success: false, error: 'Invalid follow-up id' }, { status: 400 });
  }

  try {
    // Check if follow-up exists
    const existingFollowUp = await prisma.followUp.findUnique({ where: { id } });
    if (!existingFollowUp) {
      return NextResponse.json(
        { success: false, error: 'Follow-up not found' },
        { status: 404 }
      );
    }

    await prisma.followUp.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Follow-up deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting follow-up:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete follow-up', message: error.message },
      { status: 500 }
    )
  }
}
