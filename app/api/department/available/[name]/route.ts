import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

const VALID_DEPARTMENTS = [
  'ADMIN',
  'SR_CRM',
  'JR_CRM',
  'QUOTATION',
  'VISIT_TEAM',
  'JR_ARCHITECT',
  'VISUALIZER_3D',
] as const;

// GET - Fetch available users for a specific department (by name)
// Returns users who are members of the given department
// Used for assignment modal to show available users to assign
export async function GET(
    _request: NextRequest,
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const departmentName = params.name.toUpperCase();

   

   if (!VALID_DEPARTMENTS.includes(departmentName as (typeof VALID_DEPARTMENTS)[number])) {
      return NextResponse.json(
        {
          success: false,
         error: `Invalid department. Must be one of: ${VALID_DEPARTMENTS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Find department by name
    const department = await prisma.department.findUnique({
      where: { name: departmentName },
      select: { id: true, name: true },
    });

    if (!department) {
      return NextResponse.json(
        { success: false, error: `Department "${departmentName}" not found` },
        { status: 404 }
      );
    }

    // Fetch all users in this department
    const userDepartments = await prisma.userDepartment.findMany({
      where: { departmentId: department.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        user: {
          fullName: 'asc',
        },
      },
    });

    const users = userDepartments.map((ud) => ({
      id: ud.user.id,
      fullName: ud.user.fullName,
      email: ud.user.email,
      phone: ud.user.phone,
    }));

    return NextResponse.json({
      success: true,
      data: {
        department: departmentName,
        departmentId: department.id,
        users,
        count: users.length,
      },
    });
  } catch (error) {
    console.error('Error fetching available users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch available users' },
      { status: 500 }
    );
  }
}
