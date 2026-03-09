import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';
import { Prisma } from '@/generated/prisma/client';

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
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify user authentication
      const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }

    const body = await parseJsonBody(request);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const departmentId = params.id;

   

    const userId = toOptionalString(body.userId);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    
    const [department, user] = await Promise.all([
      prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true } }),
    ]);

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
    const existingAssignment = await prisma.userDepartment.findUnique({
      where: {
        userId_departmentId: {
          userId,
          departmentId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { success: false, error: 'User is already in this department' },
        { status: 409 }
      );
    }

    // Add user to department
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

    return NextResponse.json(
      {
        success: true,
        data: userDepartment,
        message: `${user.fullName} added to ${department.name} successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding user to department:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add user to department' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a user from a department
// Disassociates a user from a department
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify user authentication
     const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }

      const body = await parseJsonBody(request);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const departmentId = params.id;

    const userId = toOptionalString(body.userId);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Verify department exists
      const [department, user] = await Promise.all([
      prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true } }),
    ]);

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
    const result = await prisma.userDepartment.delete({
      where: {
        userId_departmentId: {
          userId,
          departmentId,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `${user.fullName} removed from ${department.name} successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error removing user from department:', error);
   
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
