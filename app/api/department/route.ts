import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';
import { auth } from '@clerk/nextjs/server';

type CreateDepartmentBody = {
  name?: unknown;
  description?: unknown;
};

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function parseJsonBody(request: NextRequest): Promise<CreateDepartmentBody | null> {
  try {
    return (await request.json()) as CreateDepartmentBody;
  } catch {
    return null;
  }
}

// GET - Fetch all departments
// Returns all departments with count of users in each
export async function GET() {
  try {
    console.log('🔍 [GET /api/department] - Request received');
    
    // Verify user is authenticated via Clerk
    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    // console.log('🔍 [GET /api/department] - Auth check passed');
    // const authResult = await requireDatabaseRoles([]);
    // console.log('🔍 [GET /api/department] - authResult:', authResult);
    
    // if (!authResult.ok) {
    //   console.log('🔍 [GET /api/department] - Auth failed:', authResult);
    //   return authResult.response;
    // }
    
    console.log('🔍 [GET /api/department] - Querying database...');
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

    console.log('🔍 [GET /api/department] - Found departments:', departments.length);
    return NextResponse.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error('❌ [GET /api/department] - Error:', error);
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
    console.log('🔍 [POST /api/department] - Request received');
    
    // Verify user is authenticated via Clerk middleware

    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    // Verify user has required database roles/permissions
    // console.log('🔍 [POST /api/department] - Auth check passed');
    // const authResult = await requireDatabaseRoles([]);
    // console.log('🔍 [POST /api/department] - authResult:', authResult);
    
    // if (!authResult.ok) {
    //   console.log('🔍 [POST /api/department] - Auth failed:', authResult);
    //   return authResult.response;
    // }

    console.log('🔍 [POST /api/department] - Parsing request body...');
    const body = await parseJsonBody(request);
    console.log('🔍 [POST /api/department] - Request body:', body);
    
    if (!body) {
      console.log('🔍 [POST /api/department] - Invalid JSON body');
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const name = toOptionalString(body.name);
    const description = toOptionalString(body.description);
    console.log('🔍 [POST /api/department] - Parsed values - name:', name, 'description:', description);

    if (!name) {
      console.log('🔍 [POST /api/department] - Name is required');
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if department with same name already exists
    console.log('🔍 [POST /api/department] - Checking for existing department...');
    const existingDepartment = await prisma.department.findUnique({
      where: { name },
      select: { id: true },
    });
    console.log('🔍 [POST /api/department] - Existing department:', existingDepartment);

    if (existingDepartment) {
      console.log('🔍 [POST /api/department] - Department already exists');
      return NextResponse.json(
        { success: false, error: 'Department with this name already exists' },
        { status: 409 }
      );
    }

    // Create the department
    console.log('🔍 [POST /api/department] - Creating department...');
    const department = await prisma.department.create({
      data: {
        name,
        description
      },
      include: {
        _count: {
          select: {
            userDepartments: true,
          },
        },
      },
    });

    console.log('🔍 [POST /api/department] - Department created:', department);
    return NextResponse.json(
      {
        success: true,
        data: department,
        message: 'Department created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ [POST /api/department] - Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create department' },
      { status: 500 }
    );
  }
}
