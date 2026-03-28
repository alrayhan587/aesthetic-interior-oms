import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    // console.log(...args);
  }
};

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type UpdateDepartmentBody = {
  name?: unknown;
  description?: unknown;
};

async function resolveDepartmentId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params;
  const id = resolvedParams?.id;

  if (typeof id !== 'string') return null;

  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function parseJsonBody(request: NextRequest): Promise<UpdateDepartmentBody | null> {
  try {
    return (await request.json()) as UpdateDepartmentBody;
  } catch {
    return null;
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    debugLog('🔵 [PUT /api/department/[id]] - Request received');
    const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }

    const departmentId = await resolveDepartmentId(context);
    debugLog('🔍 [PUT /api/department/[id]] - Resolved departmentId:', departmentId);
    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: 'Invalid department id' },
        { status: 400 }
      );
    }

    const body = await parseJsonBody(request);
    debugLog('📝 [PUT /api/department/[id]] - Parsed body:', JSON.stringify(body));
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
    debugLog('📋 [PUT /api/department/[id]] - Has name:', hasName, 'Has description:', hasDescription);

    if (!hasName && !hasDescription) {
      return NextResponse.json(
        { success: false, error: 'At least one field (name or description) is required' },
        { status: 400 }
      );
    }

    const name = toOptionalString(body.name);
    const description = toOptionalString(body.description);
    debugLog('✏️ [PUT /api/department/[id]] - Extracted name:', name, 'description:', description);

    if (hasName && !name) {
      return NextResponse.json(
        { success: false, error: 'Name cannot be empty' },
        { status: 400 }
      );
    }

    debugLog('🔎 [PUT /api/department/[id]] - Looking up existing department');
    const existingDepartment = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });
    debugLog('📊 [PUT /api/department/[id]] - Existing department:', existingDepartment);

    if (!existingDepartment) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    if (name && name !== existingDepartment.name) {
      debugLog('🔄 [PUT /api/department/[id]] - Checking for duplicate name:', name);
      const duplicateName = await prisma.department.findUnique({
        where: { name },
        select: { id: true },
      });
      debugLog('🔎 [PUT /api/department/[id]] - Duplicate check result:', duplicateName);

      if (duplicateName) {
        return NextResponse.json(
          { success: false, error: 'Department with this name already exists' },
          { status: 409 }
        );
      }
    }

    debugLog('💾 [PUT /api/department/[id]] - Updating department with id:', departmentId);
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
    debugLog('✨ [PUT /api/department/[id]] - Department updated successfully:', updatedDepartment);

    return NextResponse.json({
      success: true,
      data: updatedDepartment,
      message: 'Department updated successfully',
    });
  } catch (error) {
    console.error('❌ [PUT /api/department/[id]] - Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles(['admin']);
    if (!authResult.ok) {
      return authResult.response;
    }

    const departmentId = await resolveDepartmentId(context);
    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: 'Invalid department id' },
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
  } catch (error) {
    console.error('Error deleting department:', error);
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
      Allow: 'PUT, DELETE, OPTIONS',
    },
  });
}
