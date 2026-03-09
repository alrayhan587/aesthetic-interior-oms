import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseRoles } from '@/lib/authz';

type UpdateDepartmentBody = {
  name?: unknown;
  description?: unknown;
};

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

// PUT - Update a department
// Updates department name and/or description
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('🔍 [PUT /api/department/[id]] - Request received');
    console.log('🔍 [PUT /api/department/[id]] - Params:', params);

    // Verify user authentication
    console.log('🔍 [PUT /api/department/[id]] - Checking auth...');
    const authResult = await requireDatabaseRoles(['admin']);
    console.log('🔍 [PUT /api/department/[id]] - Auth result:', authResult);
    if (!authResult.ok) {
      console.log('🔍 [PUT /api/department/[id]] - Auth failed');
      return authResult.response;
    }

    const departmentId = params.id;
    console.log('🔍 [PUT /api/department/[id]] - Department ID:', departmentId);

    console.log('🔍 [PUT /api/department/[id]] - Parsing body...');
    const body = await parseJsonBody(request);
    console.log('🔍 [PUT /api/department/[id]] - Body:', body);

    if (!body) {
      console.log('🔍 [PUT /api/department/[id]] - Invalid JSON body');
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
    console.log('🔍 [PUT /api/department/[id]] - hasName:', hasName, 'hasDescription:', hasDescription);

    if (!hasName && !hasDescription) {
      console.log('🔍 [PUT /api/department/[id]] - No fields provided');
      return NextResponse.json(
        { success: false, error: 'At least one field (name or description) is required' },
        { status: 400 }
      );
    }

    const name = toOptionalString(body.name);
    const description = toOptionalString(body.description);
    console.log('🔍 [PUT /api/department/[id]] - Parsed name:', name, 'description:', description);

    // Check if at least one field is provided
    if (hasName && !name) {
      console.log('🔍 [PUT /api/department/[id]] - Name is empty');
      return NextResponse.json(
        { success: false, error: 'Name cannot be empty' },
        { status: 400 }
      );
    }

    // Verify department exists
    console.log('🔍 [PUT /api/department/[id]] - Finding existing department...');
    const existingDepartment = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });
    console.log('🔍 [PUT /api/department/[id]] - Existing department:', existingDepartment);

    if (!existingDepartment) {
      console.log('🔍 [PUT /api/department/[id]] - Department not found');
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    // If changing name, check if new name already exists
    if (name && name !== existingDepartment.name) {
      console.log('🔍 [PUT /api/department/[id]] - Checking for duplicate name...');
      const duplicateName = await prisma.department.findUnique({
        where: { name },
        select: { id: true },
      });
      console.log('🔍 [PUT /api/department/[id]] - Duplicate check result:', duplicateName);

      if (duplicateName) {
        console.log('🔍 [PUT /api/department/[id]] - Duplicate name found');
        return NextResponse.json(
          { success: false, error: 'Department with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update the department
    console.log('🔍 [PUT /api/department/[id]] - Updating department...');
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

    console.log('🔍 [PUT /api/department/[id]] - Department updated successfully');
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

// DELETE - Remove a department
// Deletes a department (cascade deletes associated userDepartments)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {

  try {
    console.log('🔍 [DELETE /api/department/[id]] - Request received');
    console.log('🔍 [DELETE /api/department/[id]] - Params:', params);

    // Verify user authentication
    console.log('🔍 [DELETE /api/department/[id]] - Checking auth...');
    const authResult = await requireDatabaseRoles(['admin']);
    console.log('🔍 [DELETE /api/department/[id]] - Auth result:', authResult);
    if (!authResult.ok) {
      console.log('🔍 [DELETE /api/department/[id]] - Auth failed');
      return authResult.response;
    }

    const departmentId = params.id;
    console.log('🔍 [DELETE /api/department/[id]] - Department ID:', departmentId);

    // Verify department exists
    console.log('🔍 [DELETE /api/department/[id]] - Finding department...');
    const existingDepartment = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });
    console.log('🔍 [DELETE /api/department/[id]] - Found department:', existingDepartment);

    if (!existingDepartment) {
      console.log('🔍 [DELETE /api/department/[id]] - Department not found');
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    // Delete the department (cascade will handle userDepartments)
    console.log('🔍 [DELETE /api/department/[id]] - Deleting department...');
    const deletedDepartment = await prisma.department.delete({
      where: { id: departmentId },
    });
    console.log('🔍 [DELETE /api/department/[id]] - Department deleted');

    return NextResponse.json(
      {
        success: true,
        data: deletedDepartment,
        message: 'Department deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete department' },
      { status: 500 }
    );
  }
}
