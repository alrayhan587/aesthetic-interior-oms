import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';
import { logLeadCreated } from '@/lib/activity-log-service';

type AssignmentBody = {
  userId?: unknown;
  department?: unknown;
};

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// GET - Fetch all assignments for a lead
// Returns all departments and their assigned users
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const leadId = params.id;

    // Fetch the lead with all its assignments
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        leadId: lead.id,
        leadName: lead.name,
        assignments: lead.assignments,
      },
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

// POST - Create or update an assignment
// Assigns a user to a lead for a specific department
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify user authentication
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const leadId = params.id;
    const body = (await request.json()) as AssignmentBody;

    const userId = toOptionalString(body.userId);
    const department = toOptionalString(body.department);

    if (!userId || !department) {
      return NextResponse.json(
        { success: false, error: 'userId and department are required' },
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

    // Create or update assignment
    const assignment = await prisma.$transaction(async (tx) => {
      // Check if assignment already exists for this lead and department
      const existingAssignment = await tx.leadAssignment.findFirst({
        where: {
          leadId,
          department: department as any,
        },
      });

      let result;
      if (existingAssignment) {
        // Update existing assignment
        result = await tx.leadAssignment.update({
          where: { id: existingAssignment.id },
          data: { userId },
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        });
      } else {
        // Create new assignment
        result = await tx.leadAssignment.create({
          data: {
            leadId,
            userId,
            department: department as any,
          },
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        });
      }

      // Log the assignment activity
      await logLeadCreated(tx, {
        leadId,
        userId: authResult.actorUserId,
        leadName: `${user.fullName} assigned to ${department} department`,
      });

      return result;
    });

    return NextResponse.json(
      {
        success: true,
        data: assignment,
        message: existingAssignment
          ? 'Assignment updated successfully'
          : 'Assignment created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}
