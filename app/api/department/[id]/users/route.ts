import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch all users in a specific department
// Returns users who are members of the given department
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const departmentId = params.id;

    // Verify department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    // Fetch all users in this department
    const userDepartments = await prisma.userDepartment.findMany({
      where: { departmentId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            created_at: true,
          },
        },
      },
      orderBy: {
        user: {
          fullName: 'asc',
        },
      },
    });

    const users = userDepartments.map((ud) => ud.user);

    return NextResponse.json({
      success: true,
      data: {
        departmentId: department.id,
        departmentName: department.name,
        departmentDescription: department.description,
        users,
        count: users.length,
      },
    });
  } catch (error) {
    console.error('Error fetching department users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch department users' },
      { status: 500 }
    );
  }
}
