import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

const VALID_DEPARTMENTS = [
  'ADMIN',
  'SR_CRM',
  'JR_CRM',
  'QUOTATION',
  'QUOTATION_TEAM',
  'VISIT_TEAM',
  'JR_ARCHITECT',
  'VISUALIZER_3D',
  'ACCOUNTS',
] as const;

function resolveDepartmentAliases(departmentName: string): string[] {
  if (departmentName === 'QUOTATION' || departmentName === 'QUOTATION_TEAM') {
    return ['QUOTATION', 'QUOTATION_TEAM']
  }
  return [departmentName]
}

// GET - Fetch all users in a specific department (by name)
// Returns dropdown-ready list of all department members
export async function GET(
  request: NextRequest,
  context?: { params: { name: string } | Promise<{ name: string }> }
) {
  try {
    // console.log('[DEPT-API] Context:', context);
    let nameParam: string | undefined;

    // Handle both sync and async params (different Next.js versions)
    if (context?.params) {
      // console.log('[DEPT-API] Params type:', typeof context.params);
      if (context.params instanceof Promise) {
        const resolvedParams = await context.params;
        nameParam = resolvedParams.name;
        // console.log('[DEPT-API] Resolved async params:', resolvedParams);
      } else {
        nameParam = context.params.name;
        // console.log('[DEPT-API] Sync params:', context.params);
      }
    }

    // Fallback: extract from URL pathname if params not available
    if (!nameParam) {
      const pathSegments = request.nextUrl.pathname.split('/');
      nameParam = pathSegments[pathSegments.length - 1];
      // console.log('[DEPT-API] Extracted from URL:', nameParam, 'Path:', request.nextUrl.pathname);
    }

    // console.log('[DEPT-API] nameParam:', nameParam);

    if (!nameParam) {
      return NextResponse.json(
        { success: false, error: 'Department name is required' },
        { status: 400 }
      );
    }

    const departmentName = nameParam.toUpperCase();
    // console.log('[DEPT-API] departmentName:', departmentName);

   

   if (!VALID_DEPARTMENTS.includes(departmentName as (typeof VALID_DEPARTMENTS)[number])) {
      return NextResponse.json(
        {
          success: false,
         error: `Invalid department. Must be one of: ${VALID_DEPARTMENTS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const departmentNames = resolveDepartmentAliases(departmentName)

    // Fetch all users in this department (including compatible aliases)
    const userDepartments = await prisma.userDepartment.findMany({
      where: {
        department: {
          name: {
            in: departmentNames,
          },
        },
      },
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

    // console.log('[DEPT-API] UserDepartments count:', userDepartments.length);
    // console.log('[DEPT-API] UserDepartments data:', JSON.stringify(userDepartments, null, 2));

    const users = Array.from(
      new Map(
        userDepartments.map((ud) => [
          ud.user.id,
          {
            id: ud.user.id,
            fullName: ud.user.fullName,
            email: ud.user.email,
            phone: ud.user.phone,
          },
        ]),
      ).values(),
    );

    // console.log('[DEPT-API] Final users array:', JSON.stringify(users, null, 2));

    const response = NextResponse.json({
      success: true,
      users,
    });
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=90');
    return response;
  } catch (error) {
    console.error('[DEPT-API] Error fetching department users:', error);
    console.error('[DEPT-API] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch department users' },
      { status: 500 }
    );
  }
}
