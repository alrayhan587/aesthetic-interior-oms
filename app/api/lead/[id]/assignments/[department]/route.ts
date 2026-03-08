import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';
import { logLeadCreated } from '@/lib/activity-log-service';

type UpdateAssignmentBody = {
  userId?: unknown;
};

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// PUT - Update assignment for a specific department
// Changes the user assigned to a department for a lead
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; department: string } }
) {
  try {
    // Verify user authentication
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const leadId = params.id;
    const department = params.department.toUpperCase();
    const body = (await request.json()) as UpdateAssignmentBody;

    const userId = toOptionalString(body.userId);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Validate department enum
    const validDepartments = [
      'SR_CRM',
      'JR_CRM',
      'QUOTATION',
      'VISIT_TEAM',
      'JR_ARCHITECT',
      'VISUALIZER_3D',
    ];
    if (!validDepartments.includes(department)) {
      return NextResponse.json(
        { success: false, error: `Invalid department. Must be one of: ${validDepartments.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, name: true },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Find and update the assignment
    const assignment = await prisma.$transaction(async (tx) => {
      const existingAssignment = await tx.leadAssignment.findFirst({
        where: {
          leadId,
          department: department as any,
        },
      });

      if (!existingAssignment) {
        throw new Error('Assignment not found for this lead and department');
      }

      const updated = await tx.leadAssignment.update({
        where: { id: existingAssignment.id },
        data: { userId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      // Log the update activity
      await logLeadCreated(tx, {
        leadId,
        userId: authResult.actorUserId,
        leadName: `Assignment updated: ${user.fullName} assigned to ${department} department`,
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      data: assignment,
      message: 'Assignment updated successfully',
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to update assignment';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: error instanceof Error && error.message.includes('not found') ? 404 : 500 }
    );
  }
}

// DELETE - Remove assignment for a specific department
// Unassigns the user from a department for a lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; department: string } }
) {
  try {
    // Verify user authentication
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const leadId = params.id;
    const department = params.department.toUpperCase();

    // Validate department enum
    const validDepartments = [
      'SR_CRM',
      'JR_CRM',
      'QUOTATION',
      'VISIT_TEAM',
      'JR_ARCHITECT',
      'VISUALIZER_3D',
    ];
    if (!validDepartments.includes(department)) {
      return NextResponse.json(
        { success: false, error: `Invalid department. Must be one of: ${validDepartments.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, name: true },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Transaction for atomic delete and logging
    const result = await prisma.$transaction(async (tx) => {
      // Find the assignment
      const assignment = await tx.leadAssignment.findFirst({
        where: {
          leadId,
          department: department as any,
        },
        include: {
          user: {
            select: { fullName: true },
          },
        },
      });

      if (!assignment) {
        throw new Error('Assignment not found');
      }

      // Delete the assignment
      const deleted = await tx.leadAssignment.delete({
        where: { id: assignment.id },
      });

      // Log the deletion activity
      await logLeadCreated(tx, {
        leadId,
        userId: authResult.actorUserId,
        leadName: `${assignment.user.fullName} unassigned from ${department} department`,
      });

      return deleted;
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Assignment removed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting assignment:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to delete assignment';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: error instanceof Error && error.message.includes('not found') ? 404 : 500 }
    );
  }
}
