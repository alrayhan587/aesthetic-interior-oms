import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireDatabaseRoles } from '@/lib/authz';
import { VisitStatus } from '@/generated/prisma/client';

function toOptionalString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toVisitStatus(value: string | null): VisitStatus | null {
  if (!value) return null;
  return Object.values(VisitStatus).includes(value as VisitStatus)
    ? (value as VisitStatus)
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const actor = await prisma.user.findUnique({
      where: { id: authResult.actorUserId },
      select: {
        id: true,
        userDepartments: {
          select: {
            department: { select: { name: true } },
          },
        },
      },
    });

    const departmentNames = new Set(
      (actor?.userDepartments ?? []).map((row) => row.department.name),
    );
    const isAdmin = departmentNames.has('ADMIN');
    const isVisitTeam = departmentNames.has('VISIT_TEAM');
    const isJuniorCrm = departmentNames.has('JR_CRM');

    if (!isAdmin && !isVisitTeam && !isJuniorCrm) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to view visit schedules' },
        { status: 403 },
      );
    }

    const leadId = toOptionalString(request.nextUrl.searchParams.get('leadId'));
    const assignedToId = toOptionalString(request.nextUrl.searchParams.get('assignedToId'));
    const mode = toOptionalString(request.nextUrl.searchParams.get('mode'));
    const statusParam = toOptionalString(request.nextUrl.searchParams.get('status'));
    const status = toVisitStatus(statusParam);

    if (statusParam && !status) {
      return NextResponse.json({ success: false, error: 'Invalid visit status filter' }, { status: 400 });
    }

    const visits = await prisma.visit.findMany({
      where: {
        ...(leadId ? { leadId } : {}),
        ...(isAdmin || isJuniorCrm
          ? assignedToId
            ? { assignedToId }
            : {}
          : mode === 'support'
            ? { supportAssignments: { some: { supportUserId: authResult.actorUserId } } }
            : mode === 'lead'
              ? { assignedToId: authResult.actorUserId }
              : {
                  OR: [
                    { assignedToId: authResult.actorUserId },
                    { supportAssignments: { some: { supportUserId: authResult.actorUserId } } },
                  ],
                }),
        ...(status ? { status } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, phone: true, location: true } },
        assignedTo: { select: { id: true, fullName: true, email: true, phone: true } },
        createdBy: { select: { id: true, fullName: true } },
        supportAssignments: {
          include: {
            supportUser: { select: { id: true, fullName: true, email: true } },
            result: { select: { id: true, completedAt: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        supportResults: {
          include: {
            supportUser: { select: { id: true, fullName: true, email: true } },
            files: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { completedAt: 'desc' },
        },
        result: {
          include: {
            files: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        updateRequests: {
          where: { status: 'PENDING' },
          include: {
            requestedBy: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: visits });
  } catch (error) {
    console.error('[visit-schedule][GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch visit schedules' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, OPTIONS',
    },
  });
}
