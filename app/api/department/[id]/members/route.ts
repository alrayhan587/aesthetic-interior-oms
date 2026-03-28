import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';
import { Prisma } from '@/generated/prisma/client';

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    // console.log(...args);
  }
};

/*
  POSTMAN TESTING DATA
  =====================
  
  POST - Add a user to a department
  URL: http://localhost:3000/api/department/{departmentId}/members
  Method: POST
  Headers: 
    - Content-Type: application/json
    - Authorization: Bearer {token}
  
  Request Body:
  {
    "userId": "user-123"
  }
  
  Example curl:
  curl -X POST http://localhost:3000/api/department/cm7m8n9o0p1q2r3s/members \
    -H "Content-Type: application/json" \
    -d '{"userId": "user-123"}'
  
  Expected Success Response (201):
  {
    "success": true,
    "data": {
      "userId": "user-123",
      "departmentId": "cm7m8n9o0p1q2r3s",
      "user": {
        "id": "user-123",
        "fullName": "John Doe",
        "email": "john@example.com"
      },
      "department": {
        "id": "cm7m8n9o0p1q2r3s",
        "name": "Sales"
      }
    },
    "message": "John Doe added to Sales successfully"
  }
  
  Expected Error: User already in department (409):
  {
    "success": false,
    "error": "User is already in this department"
  }
  
  Expected Error: Department not found (404):
  {
    "success": false,
    "error": "Department not found"
  }
  
  Expected Error: User not found (404):
  {
    "success": false,
    "error": "User not found"
  }
  
  =====================
  
  DELETE - Remove a user from a department
  URL: http://localhost:3000/api/department/{departmentId}/members
  Method: DELETE
  Headers: 
    - Content-Type: application/json
    - Authorization: Bearer {token}
  
  Request Body:
  {
    "userId": "user-123"
  }
  
  Example curl:
  curl -X DELETE http://localhost:3000/api/department/cm7m8n9o0p1q2r3s/members \
    -H "Content-Type: application/json" \
    -d '{"userId": "user-123"}'
  
  Expected Success Response (200):
  {
    "success": true,
    "data": {
      "userId": "user-123",
      "departmentId": "cm7m8n9o0p1q2r3s"
    },
    "message": "John Doe removed from Sales successfully"
  }
  
  Expected Error: User not in department (404):
  {
    "success": false,
    "error": "User is not in this department"
  }
  
  Expected Error: Department not found (404):
  {
    "success": false,
    "error": "Department not found"
  }
*/

type MembershipBody = {
  userId?: unknown;
};

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function parseJsonBody(request: NextRequest): Promise<MembershipBody | null> {
  try {
    return (await request.json()) as MembershipBody;
  } catch {
    return null;
  }
}


// POST - Add a user to a department
// Associates a user with a department
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    debugLog('🔵 [POST /api/department/[id]/members] - Request received');
    const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }
    debugLog('✅ [POST /api/department/[id]/members] - Auth passed');

    const body = await parseJsonBody(request);
    debugLog('📝 [POST /api/department/[id]/members] - Parsed body:', JSON.stringify(body));
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const resolvedParams = await params;
    const departmentId = resolvedParams?.id;
    debugLog('🔍 [POST /api/department/[id]/members] - Resolved departmentId:', departmentId);

    if (!departmentId || typeof departmentId !== 'string') {
      debugLog('🔴 [POST /api/department/[id]/members] - Invalid departmentId');
      return NextResponse.json(
        { success: false, error: 'Invalid department id' },
        { status: 400 }
      );
    }

    const userId = toOptionalString(body.userId);
    debugLog('👤 [POST /api/department/[id]/members] - Resolved userId:', userId);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    
    debugLog('🔎 [POST /api/department/[id]/members] - Checking department and user existence');
    const [department, user] = await Promise.all([
      prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true } }),
    ]);
    debugLog('📊 [POST /api/department/[id]/members] - Department:', department, 'User:', user);

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }


    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already in department
    debugLog('🔄 [POST /api/department/[id]/members] - Checking for existing membership');
    const existingAssignment = await prisma.userDepartment.findUnique({
      where: {
        userId_departmentId: {
          userId,
          departmentId,
        },
      },
    });
    debugLog('📊 [POST /api/department/[id]/members] - Existing assignment:', existingAssignment);

    if (existingAssignment) {
      return NextResponse.json(
        { success: false, error: 'User is already in this department' },
        { status: 409 }
      );
    }

    // Add user to department
    debugLog('💾 [POST /api/department/[id]/members] - Creating user-department association');
    const userDepartment = await prisma.userDepartment.create({
      data: {
        userId,
        departmentId,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    });
    debugLog('✨ [POST /api/department/[id]/members] - User successfully added to department');

    return NextResponse.json(
      {
        success: true,
        data: userDepartment,
        message: `${user.fullName} added to ${department.name} successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ [POST /api/department/[id]/members] - Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add user to department' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a user from a department
// Disassociates a user from a department
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    debugLog('🔵 [DELETE /api/department/[id]/members] - Request received');
    const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }
    debugLog('✅ [DELETE /api/department/[id]/members] - Auth passed');

    const body = await parseJsonBody(request);
    debugLog('📝 [DELETE /api/department/[id]/members] - Parsed body:', JSON.stringify(body));
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const resolvedParams = await params;
    const departmentId = resolvedParams?.id;
    debugLog('🔍 [DELETE /api/department/[id]/members] - Resolved departmentId:', departmentId);

    if (!departmentId || typeof departmentId !== 'string') {
      debugLog('🔴 [DELETE /api/department/[id]/members] - Invalid departmentId');
      return NextResponse.json(
        { success: false, error: 'Invalid department id' },
        { status: 400 }
      );
    }

    const userId = toOptionalString(body.userId);
    debugLog('👤 [DELETE /api/department/[id]/members] - Resolved userId:', userId);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Verify department exists
    debugLog('🔎 [DELETE /api/department/[id]/members] - Checking department and user existence');
    const [department, user] = await Promise.all([
      prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true } }),
    ]);
    debugLog('📊 [DELETE /api/department/[id]/members] - Department:', department, 'User:', user);

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }


    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Remove user from department
    debugLog('🗑️ [DELETE /api/department/[id]/members] - Removing user from department');
    const result = await prisma.userDepartment.delete({
      where: {
        userId_departmentId: {
          userId,
          departmentId,
        },
      },
    });
    debugLog('✨ [DELETE /api/department/[id]/members] - User successfully removed from department');

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `${user.fullName} removed from ${department.name} successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ [DELETE /api/department/[id]/members] - Error:', error);
   
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'User is not in this department' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to remove user from department' },
      { status: 500 }
    );
  }
}
