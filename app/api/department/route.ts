import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';

type CreateDepartmentBody = {
  name?: unknown;
  description?: unknown;
};

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// GET - Fetch all departments
// Returns all departments with count of users in each
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            userDepartments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// POST - Create a new department (Admin only)
// Creates a new department that can be assigned to users
export async function POST(request: NextRequest) {
  try {
    // Verify user authentication (basic check - can add role-based check later)
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const body = (await request.json()) as CreateDepartmentBody;

    const name = toOptionalString(body.name);
    const description = toOptionalString(body.description);

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if department with same name already exists
    const existingDepartment = await prisma.department.findUnique({
      where: { name },
      select: { id: true },
    });

    if (existingDepartment) {
      return NextResponse.json(
        { success: false, error: 'Department with this name already exists' },
        { status: 409 }
      );
    }

    // Create the department
    const department = await prisma.department.create({
      data: {
        name,
        description: description || null,
      },
      include: {
        _count: {
          select: {
            userDepartments: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: department,
        message: 'Department created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create department' },
      { status: 500 }
    );
  }
}
