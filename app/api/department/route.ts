import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    // console.log(...args);
  }
};

type CreateDepartmentBody = {
  name?: unknown;
  description?: unknown;
};

type UpdateDepartmentBody = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
};

type DeleteDepartmentBody = {
  id?: unknown;
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

async function parseUpdateJsonBody(request: NextRequest): Promise<UpdateDepartmentBody | null> {
  try {
    return (await request.json()) as UpdateDepartmentBody;
  } catch {
    return null;
  }
}

async function parseDeleteJsonBody(request: NextRequest): Promise<DeleteDepartmentBody | null> {
  try {
    return (await request.json()) as DeleteDepartmentBody;
  } catch {
    return null;
  }
}

function resolveDepartmentIdFromQuery(request: NextRequest): string | null {
  const raw = request.nextUrl.searchParams.get('id');
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// GET - Fetch all departments
// Returns all departments with count of users in each
export async function GET() {
  try {
    debugLog('🔍 [GET /api/department] - Request received');
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }
    
    debugLog('🔍 [GET /api/department] - Querying database...');
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

    debugLog('🔍 [GET /api/department] - Found departments:', departments.length);
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
    debugLog('🔍 [POST /api/department] - Request received');
    const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }

    debugLog('🔍 [POST /api/department] - Parsing request body...');
    const body = await parseJsonBody(request);
    debugLog('🔍 [POST /api/department] - Request body:', body);
    
    if (!body) {
      debugLog('🔍 [POST /api/department] - Invalid JSON body');
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const name = toOptionalString(body.name);
    const description = toOptionalString(body.description);
    debugLog('🔍 [POST /api/department] - Parsed values - name:', name, 'description:', description);

    if (!name) {
      debugLog('🔍 [POST /api/department] - Name is required');
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if department with same name already exists
    debugLog('🔍 [POST /api/department] - Checking for existing department...');
    const existingDepartment = await prisma.department.findUnique({
      where: { name },
      select: { id: true },
    });
    debugLog('🔍 [POST /api/department] - Existing department:', existingDepartment);

    if (existingDepartment) {
      debugLog('🔍 [POST /api/department] - Department already exists');
      return NextResponse.json(
        { success: false, error: 'Department with this name already exists' },
        { status: 409 }
      );
    }

    // Create the department
    debugLog('🔍 [POST /api/department] - Creating department...');
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

    debugLog('🔍 [POST /api/department] - Department created:', department);
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

// PUT - Update a department by id from query/body
// Supports clients that call /api/department?id=<id> instead of /api/department/<id>
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }

    const body = await parseUpdateJsonBody(request);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const queryId = resolveDepartmentIdFromQuery(request);
    const bodyId = toOptionalString(body.id);
    const departmentId = queryId || bodyId;

    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: 'Department id is required (query: id or body: id)' },
        { status: 400 }
      );
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
    if (!hasName && !hasDescription) {
      return NextResponse.json(
        { success: false, error: 'At least one field (name or description) is required' },
        { status: 400 }
      );
    }

    const name = toOptionalString(body.name);
    const description = toOptionalString(body.description);
    if (hasName && !name) {
      return NextResponse.json(
        { success: false, error: 'Name cannot be empty' },
        { status: 400 }
      );
    }

    const existingDepartment = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });

    if (!existingDepartment) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    if (name && name !== existingDepartment.name) {
      const duplicateName = await prisma.department.findUnique({
        where: { name },
        select: { id: true },
      });

      if (duplicateName) {
        return NextResponse.json(
          { success: false, error: 'Department with this name already exists' },
          { status: 409 }
        );
      }
    }

    const updatedDepartment = await prisma.department.update({
      where: { id: departmentId },
      data: {
        ...(name && { name }),
        ...(body.description !== undefined && { description: description || null }),
      },
      include: {
        _count: {
          select: {
            userDepartments: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedDepartment,
      message: 'Department updated successfully',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a department by id from query/body
// Supports clients that call /api/department?id=<id> instead of /api/department/<id>
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }

    const queryId = resolveDepartmentIdFromQuery(request);
    const body = await parseDeleteJsonBody(request);
    const bodyId = toOptionalString(body?.id);
    const departmentId = queryId || bodyId;

    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: 'Department id is required (query: id or body: id)' },
        { status: 400 }
      );
    }

    const existingDepartment = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!existingDepartment) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    const deletedDepartment = await prisma.department.delete({
      where: { id: departmentId },
    });

    return NextResponse.json({
      success: true,
      data: deletedDepartment,
      message: 'Department deleted successfully',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to delete department' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, PUT, DELETE, OPTIONS',
    },
  });
}
