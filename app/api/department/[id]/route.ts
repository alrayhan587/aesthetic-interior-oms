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

// PUT - Update a department
// Updates department name and/or description
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify user authentication
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const departmentId = params.id;
    const body = (await request.json()) as UpdateDepartmentBody;

    const name = toOptionalString(body.name);
    const description = toOptionalString(body.description);

    // Check if at least one field is provided
    if (!name && description === null && body.description === undefined) {
      return NextResponse.json(
        { success: false, error: 'At least one field (name or description) is required' },
        { status: 400 }
      );
    }

    // Verify department exists
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

    // If changing name, check if new name already exists
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

    // Update the department
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
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a department
// Deletes a department (cascade deletes associated userDepartments)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify user authentication
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const departmentId = params.id;

    // Verify department exists
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

    // Delete the department (cascade will handle userDepartments)
    const deletedDepartment = await prisma.department.delete({
      where: { id: departmentId },
    });

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
