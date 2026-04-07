import prisma from '@/lib/prisma';
import { LeadStage } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';
import { logLeadCreated, logUserAssigned } from '@/lib/activity-log-service';
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete';

/*
  POSTMAN TESTING DATA
  =====================
  
  BASE URL: http://localhost:3000/api/lead/{leadId}/assignments/{department}
  
  VALID DEPARTMENTS: ADMIN, SR_CRM, JR_CRM, QUOTATION, VISIT_TEAM, JR_ARCHITECT, VISUALIZER_3D
  
  =====================
  PUT - Update assignment for a specific department
  =====================
  URL: http://localhost:3000/api/lead/{leadId}/assignments/{department}
  Method: PUT
  Headers: 
    - Content-Type: application/json
    - Authorization: Bearer {token}
  
  Request Body:
  {
    "userId": "cmmhf6aef0003pku3125gleqh"
  }
  
  Example URLs:
  http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g/assignments/sr_crm
  http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g/assignments/JR_CRM
  
  Example curl:
  curl -X PUT http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g/assignments/SR_CRM \
    -H "Content-Type: application/json" \
    -d '{"userId": "cmmhf6aef0003pku3125gleqh"}'
  
  Expected Success Response (200):
  {
    "success": true,
    "data": {
      "id": "cmmiwa5xo0001fdwby7l7wjo2",
      "leadId": "cmmhfdt160000vzwb5ai4ej2g",
      "userId": "cmmhf6aef0003pku3125gleqh",
      "department": "SR_CRM",
      "createdAt": "2026-03-09T08:03:54.636Z",
      "user": {
        "id": "cmmhf6aef0003pku3125gleqh",
        "fullName": "aesthetic interior",
        "email": "mdalraihan435@gmail.com"
      }
    },
    "message": "Assignment updated successfully"
  }
  
  Expected Error Responses:
  - Missing userId (400):
    {"success": false, "error": "userId is required"}
  
  - Invalid department (400):
    {"success": false, "error": "Invalid department. Must be one of: ADMIN, SR_CRM, JR_CRM, QUOTATION, VISIT_TEAM, JR_ARCHITECT, VISUALIZER_3D"}
  
  - Lead not found (404):
    {"success": false, "error": "Lead not found"}
  
  - User not found (404):
    {"success": false, "error": "User not found"}
  
  - Assignment not found (404):
    {"success": false, "error": "Assignment not found for this lead and department"}
  
  =====================
  DELETE - Remove assignment for a specific department
  =====================
  URL: http://localhost:3000/api/lead/{leadId}/assignments/{department}
  Method: DELETE
  Headers: 
    - Authorization: Bearer {token}
  
  No request body needed
  
  Example URLs:
  http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g/assignments/sr_crm
  http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g/assignments/JR_CRM
  
  Example curl:
  curl -X DELETE http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g/assignments/SR_CRM \
    -H "Authorization: Bearer {token}"
  
  Expected Success Response (200):
  {
    "success": true,
    "data": {
      "id": "cmmiwa5xo0001fdwby7l7wjo2",
      "leadId": "cmmhfdt160000vzwb5ai4ej2g",
      "userId": "cmmhf6aef0003pku3125gleqh",
      "department": "SR_CRM",
      "createdAt": "2026-03-09T08:03:54.636Z"
    },
    "message": "Assignment removed successfully"
  }
  
  Expected Error Responses:
  - Invalid department (400):
    {"success": false, "error": "Invalid department. Must be one of: ADMIN, SR_CRM, JR_CRM, QUOTATION, VISIT_TEAM, JR_ARCHITECT, VISUALIZER_3D"}
  
  - Lead not found (404):
    {"success": false, "error": "Lead not found"}
  
  - Assignment not found (404):
    {"success": false, "error": "Assignment not found"}
  
  =====================
  POSTMAN COLLECTION SETUP
  =====================
  
  1. Create a new Collection: "Lead Assignments - Department"
  2. Create two requests:
  
  Request 1: Update Assignment
  - Name: PUT - Update Assignment
  - Method: PUT
  - URL: {{baseUrl}}/api/lead/{{leadId}}/assignments/{{department}}
  - Body: {"userId": "{{userId}}"}
  - Headers: Content-Type: application/json, Authorization: Bearer {{token}}
  
  Request 2: Delete Assignment
  - Name: DELETE - Remove Assignment
  - Method: DELETE
  - URL: {{baseUrl}}/api/lead/{{leadId}}/assignments/{{department}}
  - Headers: Authorization: Bearer {{token}}
  
  3. Set collection variables:
  - baseUrl: http://localhost:3000
  - leadId: cmmhfdt160000vzwb5ai4ej2g
  - department: SR_CRM
  - userId: cmmhf6aef0003pku3125gleqh
  - token: your_auth_token
*/

type UpdateAssignmentBody = {
  userId?: unknown;
};

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    // console.log(...args);
  }
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
  { params }: { params: Promise<{ id: string; department: string }> }
) {
  try {
    debugLog('🔵 [PUT /api/lead/[id]/assignments/[department]] - Request received');
    
    // Verify user authentication
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }
    debugLog('✅ [PUT /api/lead/[id]/assignments/[department]] - Auth passed');
    const actorUserId = authResult.ok ? authResult.actorUserId : null;

    const resolvedParams = await params;
    const leadId = resolvedParams?.id;
    const department = resolvedParams?.department?.toUpperCase();
    debugLog('🔍 [PUT /api/lead/[id]/assignments/[department]] - Resolved leadId:', leadId, 'department:', department);
    
    if (!leadId || !department || typeof leadId !== 'string' || typeof department !== 'string') {
      debugLog('🔴 [PUT /api/lead/[id]/assignments/[department]] - Invalid params');
      return NextResponse.json(
        { success: false, error: 'Invalid lead id or department' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as UpdateAssignmentBody;
    debugLog('📝 [PUT /api/lead/[id]/assignments/[department]] - Parsed body:', JSON.stringify(body));

    const userId = toOptionalString(body.userId);
    debugLog('👤 [PUT /api/lead/[id]/assignments/[department]] - userId:', userId);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
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
      'ACCOUNTS',
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
      select: { id: true, name: true, stage: true },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

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
    debugLog('💾 [PUT /api/lead/[id]/assignments/[department]] - Updating assignment');
    const assignment = await prisma.$transaction(async (tx) => {
      const existingAssignment = await tx.leadAssignment.findFirst({
        where: {
          leadId,
          department: department as any,
        },
      });
      debugLog('📊 [PUT /api/lead/[id]/assignments/[department]] - Existing assignment:', existingAssignment);

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
      await logUserAssigned(tx, {
        leadId,
        userId: userId,
        leadName: `Assignment updated: ${user.fullName} assigned to ${department} department`,
      });

      await autoCompletePendingFollowups(tx, {
        leadId,
        userId: actorUserId,
        action: 'assignment update',
      });

      return updated;
    });
    debugLog('✨ [PUT /api/lead/[id]/assignments/[department]] - Assignment updated successfully');

    return NextResponse.json({
      success: true,
      data: assignment,
      message: 'Assignment updated successfully',
    });
  } catch (error) {
    console.error('❌ [PUT /api/lead/[id]/assignments/[department]] - Error:', error);
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
  { params }: { params: Promise<{ id: string; department: string }> }
) {
  try {
    debugLog('🔵 [DELETE /api/lead/[id]/assignments/[department]] - Request received');
    
    // Verify user authentication
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }
    debugLog('✅ [DELETE /api/lead/[id]/assignments/[department]] - Auth passed');
    const actorUserId = authResult.ok ? authResult.actorUserId : null;

    const resolvedParams = await params;
    const leadId = resolvedParams?.id;
    const department = resolvedParams?.department?.toUpperCase();
    debugLog('🔍 [DELETE /api/lead/[id]/assignments/[department]] - Resolved leadId:', leadId, 'department:', department);
    
    if (!leadId || !department || typeof leadId !== 'string' || typeof department !== 'string') {
      debugLog('🔴 [DELETE /api/lead/[id]/assignments/[department]] - Invalid params');
      return NextResponse.json(
        { success: false, error: 'Invalid lead id or department' },
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
      'ACCOUNTS',
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
      select: { id: true, name: true, stage: true },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Transaction for atomic delete and logging
    debugLog('💾 [DELETE /api/lead/[id]/assignments/[department]] - Deleting assignment');
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
      debugLog('📊 [DELETE /api/lead/[id]/assignments/[department]] - Found assignment:', assignment);

      if (
        department === 'SR_CRM' &&
        lead.stage !== LeadStage.CONVERSION &&
        lead.stage !== LeadStage.CLOSED
      ) {
        throw new Error('SR_CRM assignment is required until lead reaches CONVERSION or CLOSED');
      }

      // Delete the assignment
      debugLog('🗑️ [DELETE /api/lead/[id]/assignments/[department]] - Deleting');
      const deleted = await tx.leadAssignment.delete({
        where: { id: assignment.id },
      });

      // Log the deletion activity
      await logUserAssigned(tx, {
        leadId,
        userId: actorUserId,
        leadName: `${assignment.user.fullName} unassigned from ${department} department`,
      });

      await autoCompletePendingFollowups(tx, {
        leadId,
        userId: actorUserId,
        action: 'assignment update',
      });

      return deleted;
    });
    debugLog('✨ [DELETE /api/lead/[id]/assignments/[department]] - Assignment deleted successfully');

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Assignment removed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ [DELETE /api/lead/[id]/assignments/[department]] - Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to delete assignment';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: error instanceof Error && error.message.includes('not found') ? 404 : 500 }
    );
  }
}
