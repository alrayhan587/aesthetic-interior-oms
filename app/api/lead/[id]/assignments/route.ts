import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';
import { logLeadCreated, logUserAssigned } from '@/lib/activity-log-service';
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    // console.log(...args);
  }
};

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
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    debugLog('🔵 [GET /api/lead/[id]/assignments] - Request received');
    
    const resolvedParams = await params;
    const leadId = resolvedParams?.id;
    debugLog('🔍 [GET /api/lead/[id]/assignments] - Resolved leadId:', leadId);
    
    if (!leadId || typeof leadId !== 'string') {
      debugLog('🔴 [GET /api/lead/[id]/assignments] - Invalid leadId');
      return NextResponse.json(
        { success: false, error: 'Invalid lead id' },
        { status: 400 }
      );
    }

    // Fetch the lead with all its assignments
    debugLog('🔎 [GET /api/lead/[id]/assignments] - Looking up lead');
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
    debugLog('📊 [GET /api/lead/[id]/assignments] - Lead found:', lead);

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    debugLog('✨ [GET /api/lead/[id]/assignments] - Response prepared with', lead.assignments.length, 'assignments');
    return NextResponse.json({
      success: true,
      data: {
        leadId: lead.id,
        leadName: lead.name,
        assignments: lead.assignments,
      },
    });
  } catch (error) {
    console.error('❌ [GET /api/lead/[id]/assignments] - Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

// POST - Create or update an assignment
// Assigns a user to a lead for a specific department
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    debugLog('🔵 [POST /api/lead/[id]/assignments] - Request received');
    
    const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }
    debugLog('✅ [POST /api/lead/[id]/assignments] - Auth passed');
    const actorUserId = authResult.ok ? authResult.actorUserId : null;

    const resolvedParams = await params;
    const leadId = resolvedParams?.id;
    debugLog('🔍 [POST /api/lead/[id]/assignments] - Resolved leadId:', leadId);
    
    if (!leadId || typeof leadId !== 'string') {
      debugLog('🔴 [POST /api/lead/[id]/assignments] - Invalid leadId');
      return NextResponse.json(
        { success: false, error: 'Invalid lead id' },
        { status: 400 }
      );
    }

    debugLog('📝 [POST /api/lead/[id]/assignments] - Parsing request body');
    const body = (await request.json()) as AssignmentBody;

    const userId = toOptionalString(body.userId);
    const department = toOptionalString(body.department);
    debugLog('👤 [POST /api/lead/[id]/assignments] - userId:', userId, 'department:', department);

    if (!userId || !department) {
      return NextResponse.json(
        { success: false, error: 'userId and department are required' },
        { status: 400 }
      );
    }

    // Validate department enum
    const validDepartments = [
      'ADMIN',
      'SR_CRM',
      'JR_CRM',
      'QUOTATION',
      'VISIT_TEAM',
      'JR_ARCHITECT',
      'VISUALIZER_3D',
    ];
    debugLog('🔎 [POST /api/lead/[id]/assignments] - Validating department');
    if (!validDepartments.includes(department)) {
      return NextResponse.json(
        { success: false, error: `Invalid department. Must be one of: ${validDepartments.join(', ')}` },
        { status: 400 }
      );
    }
    debugLog('✅ [POST /api/lead/[id]/assignments] - Department validation passed');

    // Verify lead exists
    debugLog('🔎 [POST /api/lead/[id]/assignments] - Checking lead and user');
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, name: true },
    });
    debugLog('📊 [POST /api/lead/[id]/assignments] - Lead lookup result:', lead);

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Verify user exists
    debugLog('🔎 [POST /api/lead/[id]/assignments] - Checking user');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        userDepartments: {
          select: { department: { select: { name: true } } },
        },
      },
    });
    debugLog('📊 [POST /api/lead/[id]/assignments] - User lookup result:', user);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userDepartmentNames = new Set(
      (user.userDepartments ?? []).map((row) => row.department.name),
    );
    if (!userDepartmentNames.has(department)) {
      return NextResponse.json(
        { success: false, error: `User is not mapped to ${department} department` },
        { status: 400 },
      );
    }

    // Create or update assignment
    debugLog('💾 [POST /api/lead/[id]/assignments] - Creating or updating assignment');
    let isUpdate = false;
    const assignment = await prisma.$transaction(async (tx) => {
      // Check if assignment already exists for this lead and department
      debugLog('🔄 [POST /api/lead/[id]/assignments] - Checking for existing assignment');
      const existingAssignment = await tx.leadAssignment.findFirst({
        where: {
          leadId,
          department: department as any,
        },
      });
      debugLog('📊 [POST /api/lead/[id]/assignments] - Existing assignment:', existingAssignment);

      let result;
      if (existingAssignment) {
        // Update existing assignment
        isUpdate = true;
        debugLog('🔄 [POST /api/lead/[id]/assignments] - Updating existing assignment');
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
        debugLog('✨ [POST /api/lead/[id]/assignments] - Creating new assignment');
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
      debugLog('📋 [POST /api/lead/[id]/assignments] - Logging user assignment activity');      await logUserAssigned(tx, {
        leadId,
        userId: user.id,
        leadName: `${user.fullName} assigned to ${department} department`,
      });
      debugLog('✅ [POST /api/lead/[id]/assignments] - Assignment activity logged');

      await autoCompletePendingFollowups(tx, {
        leadId,
        userId: actorUserId,
        action: 'assignment update',
      });

      return result;
    });
    debugLog('✨ [POST /api/lead/[id]/assignments] - Assignment', isUpdate ? 'updated' : 'created', 'successfully');

    return NextResponse.json(
      {
        success: true,
        data: assignment,
        message: isUpdate
          ? 'Assignment updated successfully'
          : 'Assignment created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ [POST /api/lead/[id]/assignments] - Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}
